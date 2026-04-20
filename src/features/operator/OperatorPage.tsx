import { useEffect, useMemo, useRef, useState } from 'react'
import { STREAM_ORDER } from '../../domain/constants'
import type {
  AlertEvent, AlertResolution, AppSnapshot, InterestArea,
  StreamId, ThreatFlags, ThreatKind,
} from '../../domain/types'
import {
  readArchive, readPreferences, readZones,
  writeArchive, writePreferences, writeZones,
} from '../../lib/persistence'
import { advanceWorkflow, createWorkflowState, type WorkflowState } from '../../lib/stateMachine'
import { createNormalizerState, normalizeAlerts } from '../../lib/normalizer'
import { MockRealtimeEngine } from '../../mocks/realtimeEngine'
import { StatusBar } from './components/StatusBar'
import { DetectionMap } from './components/DetectionMap'
import { LidarViewport } from './components/LidarViewport'
import { AlertFeed } from './components/AlertFeed'
import { AlertSnapshotCard } from './components/AlertSnapshotCard'
import { DockBar } from './components/DockBar'
import { ZonesOverlay } from './components/ZonesOverlay'

const engine = new MockRealtimeEngine()

export function OperatorPage() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => ({
    now: Date.now(),
    streams: STREAM_ORDER.map((id) => ({ id, label: id, available: true })),
    tracksByStream: { front: [], left: [], back: [], right: [] },
    rawAlerts: [],
  }))
  const [preferences, setPreferences] = useState(() => readPreferences())
  const [zones, setZones] = useState<InterestArea[]>(() => readZones())
  const [dismissedStreams, _setDismissedStreams] = useState<StreamId[]>([])
  const [workflowState, setWorkflowState] = useState<WorkflowState>(createWorkflowState())
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [archivedAlerts, setArchivedAlerts] = useState<AlertEvent[]>(() => readArchive())
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active')
  const [swapped, setSwapped] = useState(false)
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)
  const [zonesEditorOpen, setZonesEditorOpen] = useState(false)
  const normalizerStateRef = useRef(createNormalizerState())
  const queueRef = useRef<AlertEvent[]>([])
  const lastAudioMsRef = useRef(0)
  const prevActiveStreamsRef = useRef<Set<StreamId>>(new Set())

  useEffect(() => {
    engine.setZones(zones)
    return engine.subscribe((next) => {
      setSnapshot(next)
      queueRef.current = [...next.rawAlerts, ...queueRef.current].slice(0, 150)
    })
  }, [zones])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const normalized = normalizeAlerts(queueRef.current, normalizerStateRef.current, { now: Date.now() })
      if (!normalized.length) return
      setAlerts((current) => [...normalized, ...current].slice(0, 120))
      queueRef.current = []
    }, 150)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => { writePreferences(preferences) }, [preferences])
  useEffect(() => { writeArchive(archivedAlerts) }, [archivedAlerts])
  useEffect(() => { writeZones(zones); engine.setZones(zones) }, [zones])

  const [alertFlash, setAlertFlash] = useState(false)

  useEffect(() => {
    const currentActive = new Set(
      STREAM_ORDER.filter((id) => snapshot.tracksByStream[id].length > 0),
    )
    const prev = prevActiveStreamsRef.current
    let newStreamDetected: StreamId | null = null
    for (const streamId of currentActive) {
      if (!prev.has(streamId)) {
        newStreamDetected = streamId
      }
    }
    if (newStreamDetected) {
      setPreferences((p) => ({ ...p, selectedStreamId: newStreamDetected! }))
      setAlertFlash(true)
      window.setTimeout(() => setAlertFlash(false), 5000)
    }
    prevActiveStreamsRef.current = currentActive
  }, [snapshot.tracksByStream])

  useEffect(() => {
    if (!preferences.soundEnabled) return
    const newest = alerts[0]
    if (!newest) return
    if (newest.detectedAt - lastAudioMsRef.current < 2500 && newest.priority !== 'critical') return
    playAlertTone(newest.priority)
    lastAudioMsRef.current = newest.detectedAt
  }, [alerts, preferences.soundEnabled])

  const archivedIdSet = useMemo(
    () => new Set(archivedAlerts.map((a) => a.alertId)),
    [archivedAlerts],
  )

  const visibleAlerts = useMemo(
    () => alerts.filter(
      (a) => !dismissedStreams.includes(a.streamId) && !archivedIdSet.has(a.alertId),
    ),
    [alerts, dismissedStreams, archivedIdSet],
  )

  const flaggedTrackFlags = useMemo(() => {
    const map: Record<string, ThreatFlags> = {}
    for (const a of visibleAlerts) {
      if (a.flags) map[a.trackId] = a.flags
    }
    return map
  }, [visibleAlerts])

  const totalDetections = useMemo(
    () => STREAM_ORDER.reduce((sum, id) => sum + snapshot.tracksByStream[id].length, 0),
    [snapshot.tracksByStream],
  )

  const switchStream = (streamId: StreamId) => {
    setPreferences((prev) => ({ ...prev, selectedStreamId: streamId }))
    setWorkflowState((prev) => advanceWorkflow(prev, { type: 'CLEAR_FOCUS' }))
    setSelectedAlertId(null)
  }

  const focusAlert = (alert: AlertEvent) => {
    let nextToken = 0
    setWorkflowState((prev) => {
      const next = advanceWorkflow(prev, {
        type: 'SELECT_ALERT',
        alertId: alert.alertId,
        trackId: alert.trackId,
        streamId: alert.streamId,
      })
      nextToken = next.token
      return next
    })
    setPreferences((prev) => ({ ...prev, selectedStreamId: alert.streamId }))
    window.setTimeout(() => {
      setWorkflowState((prev) =>
        advanceWorkflow(prev, { type: 'STREAM_SWITCHED', token: nextToken, streamId: alert.streamId }),
      )
    }, 120)
  }

  const onSelectAlert = (alert: AlertEvent) => {
    if (alert.alertId === selectedAlertId) {
      setSelectedAlertId(null)
      setWorkflowState((prev) => advanceWorkflow(prev, { type: 'CLEAR_FOCUS' }))
      return
    }
    setSelectedAlertId(alert.alertId)
    focusAlert(alert)
  }

  const onArchive = (alert: AlertEvent, resolution: AlertResolution) => {
    const archived: AlertEvent = {
      ...alert,
      status: 'archived',
      resolution,
      resolvedAt: Date.now(),
    }
    setAlerts((current) => current.filter((a) => a.alertId !== alert.alertId))
    setArchivedAlerts((current) => [archived, ...current].slice(0, 200))
    if (selectedAlertId === alert.alertId) {
      setSelectedAlertId(null)
      setWorkflowState((prev) => advanceWorkflow(prev, { type: 'CLEAR_FOCUS' }))
    }
  }

  const onDeleteArchived = (alert: AlertEvent) => {
    setArchivedAlerts((current) => current.filter((a) => a.alertId !== alert.alertId))
  }

  const onClearArchive = () => {
    setArchivedAlerts([])
  }

  const onFireThreat = (kind: ThreatKind) => engine.fireThreat(kind)

  const onResetDemo = () => {
    engine.resetDemo()
    setAlerts([])
    setArchivedAlerts([])
    setSelectedAlertId(null)
    normalizerStateRef.current = createNormalizerState()
    queueRef.current = []
    setWorkflowState((prev) => advanceWorkflow(prev, { type: 'CLEAR_FOCUS' }))
  }

  const activeTracks = snapshot.tracksByStream[preferences.selectedStreamId]
  const selectedAlert = selectedAlertId
    ? visibleAlerts.find((a) => a.alertId === selectedAlertId) ?? null
    : null

  const detectionMapEl = (
    <DetectionMap
      tracksByStream={snapshot.tracksByStream}
      activeStreamId={preferences.selectedStreamId}
      onSwitchStream={switchStream}
      focusedTrackId={workflowState.focusTrackId}
      highlightedAlert={selectedAlert}
      flaggedTrackFlags={flaggedTrackFlags}
    />
  )

  const lidarHeroEl = (
    <LidarViewport
      tracks={activeTracks}
      focusedTrackId={workflowState.focusTrackId}
      activeStreamId={preferences.selectedStreamId}
      variant="hero"
    />
  )

  const lidarInsetEl = (
    <LidarViewport
      tracks={activeTracks}
      focusedTrackId={workflowState.focusTrackId}
      activeStreamId={preferences.selectedStreamId}
      variant="inset"
    />
  )

  const heroEl = swapped ? lidarHeroEl : detectionMapEl
  const insetEl = swapped ? detectionMapEl : lidarInsetEl
  const zonesEditorVisible = zonesEditorOpen && !swapped

  return (
    <div className={`t-shell${alertFlash ? ' t-shell--alert-flash' : ''}`}>
      {alertFlash && <div className="t-alert-flash-overlay" />}
      <StatusBar
        tracksByStream={snapshot.tracksByStream}
        activeStreamId={preferences.selectedStreamId}
        now={snapshot.now}
        hasAlerts={visibleAlerts.length > 0}
      />

      <div className="t-main">
        <div className="t-stage">
          <div className="t-hero">{heroEl}</div>
          {zonesEditorVisible && (
            <ZonesOverlay
              zones={zones}
              onChange={setZones}
              onClose={() => setZonesEditorOpen(false)}
            />
          )}
          <div className="t-inset">{insetEl}</div>
          <div
            className="t-view-toggle"
            onClick={() => setSwapped((s) => !s)}
            role="button"
            tabIndex={0}
            aria-label="Switch view layout"
          >
            <span className={`t-view-toggle-key${!swapped ? ' t-view-toggle-key--active' : ''}`}>P</span>
            <span className={`t-view-toggle-key${swapped ? ' t-view-toggle-key--active' : ''}`}>R</span>
          </div>
          {selectedAlert && activeTab === 'active' && (
            <AlertSnapshotCard
              alert={selectedAlert}
              now={snapshot.now}
              onFocusMap={focusAlert}
              onArchive={onArchive}
              onClose={() => {
                setSelectedAlertId(null)
                setWorkflowState((prev) => advanceWorkflow(prev, { type: 'CLEAR_FOCUS' }))
              }}
            />
          )}
        </div>

        <AlertFeed
          activeAlerts={visibleAlerts}
          archivedAlerts={archivedAlerts}
          activeStreamId={preferences.selectedStreamId}
          selectedAlertId={selectedAlertId}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onSelectAlert={onSelectAlert}
          onArchive={onArchive}
          onDeleteArchived={onDeleteArchived}
          onClearArchive={onClearArchive}
        />
      </div>

      <DockBar
        activeStreamId={preferences.selectedStreamId}
        totalDetections={totalDetections}
        onSwitchStream={switchStream}
        onFireThreat={onFireThreat}
        onResetDemo={onResetDemo}
        onToggleZones={() => setZonesEditorOpen((o) => !o)}
        zonesActive={zonesEditorOpen}
      />
    </div>
  )
}

function playAlertTone(priority: AlertEvent['priority']) {
  try {
    const ctx = new window.AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = priority === 'critical' ? 780 : priority === 'high' ? 620 : 440
    osc.type = 'square'
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.value = priority === 'critical' ? 0.06 : 0.03
    osc.start()
    osc.stop(ctx.currentTime + 0.13)
  } catch { /* browser audio unavailable */ }
}
