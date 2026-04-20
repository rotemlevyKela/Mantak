import { useEffect, useMemo, useRef, useState } from 'react'
import { STREAM_ORDER } from '../../domain/constants'
import type { AlertEvent, AppSnapshot, InterestArea, StreamId } from '../../domain/types'
import { readPreferences, readZones, writePreferences } from '../../lib/persistence'
import { advanceWorkflow, createWorkflowState, type WorkflowState } from '../../lib/stateMachine'
import { createNormalizerState, normalizeAlerts } from '../../lib/normalizer'
import { MockRealtimeEngine } from '../../mocks/realtimeEngine'
import { StatusBar } from './components/StatusBar'
import { DetectionMap } from './components/DetectionMap'
import { LidarViewport } from './components/LidarViewport'
import { AlertFeed } from './components/AlertFeed'
import { DockBar } from './components/DockBar'

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
  const [swapped, setSwapped] = useState(false)
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)
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
    const interval = window.setInterval(() => setZones(readZones()), 2000)
    return () => window.clearInterval(interval)
  }, [])

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

  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !dismissedStreams.includes(a.streamId)),
    [alerts, dismissedStreams],
  )

  const totalDetections = useMemo(
    () => STREAM_ORDER.reduce((sum, id) => sum + snapshot.tracksByStream[id].length, 0),
    [snapshot.tracksByStream],
  )

  const switchStream = (streamId: StreamId) => {
    setPreferences((prev) => ({ ...prev, selectedStreamId: streamId }))
    setWorkflowState((prev) => advanceWorkflow(prev, { type: 'CLEAR_FOCUS' }))
    setSelectedAlertId(null)
  }

  const onSelectAlert = (alert: AlertEvent) => {
    if (alert.alertId === selectedAlertId) {
      setSelectedAlertId(null)
      setWorkflowState((prev) => advanceWorkflow(prev, { type: 'CLEAR_FOCUS' }))
      return
    }
    setSelectedAlertId(alert.alertId)
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

  const activeTracks = snapshot.tracksByStream[preferences.selectedStreamId]
  const highlightedAlert = selectedAlertId
    ? visibleAlerts.find((a) => a.alertId === selectedAlertId) ?? null
    : null

  const detectionMapEl = (
    <DetectionMap
      tracksByStream={snapshot.tracksByStream}
      activeStreamId={preferences.selectedStreamId}
      onSwitchStream={switchStream}
      focusedTrackId={workflowState.focusTrackId}
      highlightedAlert={highlightedAlert}
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
        </div>

        <AlertFeed
          alerts={visibleAlerts}
          activeStreamId={preferences.selectedStreamId}
          selectedAlertId={selectedAlertId}
          onSelectAlert={onSelectAlert}
        />
      </div>

      <DockBar
        activeStreamId={preferences.selectedStreamId}
        totalDetections={totalDetections}
        onSwitchStream={switchStream}
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
