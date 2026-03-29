import { useEffect, useMemo, useRef, useState } from 'react'
import { STREAM_LABELS, STREAM_ORDER } from '../../domain/constants'
import type { AlertEvent, AppSnapshot, InterestArea, StreamId } from '../../domain/types'
import {
  readPreferences,
  readZones,
  writePreferences,
} from '../../lib/persistence'
import {
  advanceWorkflow,
  createWorkflowState,
  type WorkflowState,
} from '../../lib/stateMachine'
import { createNormalizerState, normalizeAlerts } from '../../lib/normalizer'
import { MockRealtimeEngine } from '../../mocks/realtimeEngine'
import { AlertsSidebar } from './components/AlertsSidebar'
import { LidarViewport } from './components/LidarViewport'

const engine = new MockRealtimeEngine()

export function OperatorPage() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => ({
    now: Date.now(),
    streams: STREAM_ORDER.map((streamId) => ({
      id: streamId,
      label: STREAM_LABELS[streamId],
      available: true,
    })),
    tracksByStream: {
      front: [],
      left: [],
      back: [],
      right: [],
    },
    rawAlerts: [],
  }))
  const [preferences, setPreferences] = useState(() => readPreferences())
  const [zones, setZones] = useState<InterestArea[]>(() => readZones())
  const [dismissedStreams, setDismissedStreams] = useState<StreamId[]>([])
  const [workflowState, setWorkflowState] = useState<WorkflowState>(createWorkflowState())
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const normalizerStateRef = useRef(createNormalizerState())
  const queueRef = useRef<AlertEvent[]>([])
  const lastAudioMsRef = useRef(0)

  useEffect(() => {
    engine.setZones(zones)
    return engine.subscribe((next) => {
      setSnapshot(next)
      queueRef.current = [...next.rawAlerts, ...queueRef.current].slice(0, 150)
    })
  }, [zones])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setZones(readZones())
    }, 2000)
    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const normalized = normalizeAlerts(queueRef.current, normalizerStateRef.current, {
        now: Date.now(),
      })
      if (!normalized.length) {
        return
      }
      setAlerts((current) => [...normalized, ...current].slice(0, 120))
      queueRef.current = []
    }, 150)
    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    writePreferences(preferences)
  }, [preferences])

  useEffect(() => {
    if (!preferences.soundEnabled) {
      return
    }
    const newest = alerts[0]
    if (!newest) {
      return
    }
    if (newest.detectedAt - lastAudioMsRef.current < 2500 && newest.priority !== 'critical') {
      return
    }
    playAlertTone(newest.priority)
    lastAudioMsRef.current = newest.detectedAt
  }, [alerts, preferences.soundEnabled])

  const activeStream = useMemo(
    () => snapshot.streams.find((stream) => stream.id === preferences.selectedStreamId),
    [preferences.selectedStreamId, snapshot.streams],
  )

  const visibleAlerts = useMemo(() => {
    return alerts.filter((alert) => !dismissedStreams.includes(alert.streamId))
  }, [alerts, dismissedStreams])

  const switchStream = (streamId: StreamId) => {
    const target = snapshot.streams.find((stream) => stream.id === streamId)
    if (!target?.available) {
      setStatusMessage(`Cannot open ${STREAM_LABELS[streamId]}: stream unavailable`)
      return
    }
    setStatusMessage('')
    setPreferences((prev) => ({ ...prev, selectedStreamId: streamId }))
    setWorkflowState((prev) => advanceWorkflow(prev, { type: 'CLEAR_FOCUS' }))
  }

  const onGoToStream = (streamId: StreamId) => {
    const targetStream = snapshot.streams.find((stream) => stream.id === streamId)
    if (!targetStream?.available) {
      setStatusMessage(`Cannot open ${STREAM_LABELS[streamId]}: stream unavailable`)
      return
    }
    setStatusMessage('')
    let nextToken = 0
    setWorkflowState((prev) => {
      const streamAlerts = alerts.filter((a) => a.streamId === streamId)
      const target = streamAlerts[0]
      if (!target) {
        return advanceWorkflow(prev, { type: 'CLEAR_FOCUS' })
      }
      const next = advanceWorkflow(prev, {
        type: 'SELECT_ALERT',
        alertId: target.alertId,
        trackId: target.trackId,
        streamId: target.streamId,
      })
      nextToken = next.token
      return next
    })
    setPreferences((prev) => ({ ...prev, selectedStreamId: streamId }))
    window.setTimeout(() => {
      setWorkflowState((prev) =>
        advanceWorkflow(prev, {
          type: 'STREAM_SWITCHED',
          token: nextToken,
          streamId,
        }),
      )
    }, 120)
  }

  const activeTracks = snapshot.tracksByStream[preferences.selectedStreamId]

  return (
    <div className="operator-layout" data-sidebar={sidebarOpen}>
      {sidebarOpen && (
        <AlertsSidebar
          alerts={visibleAlerts}
          now={snapshot.now}
          activeStreamId={preferences.selectedStreamId}
          onGoToStream={onGoToStream}
          onDismissStream={(streamId) =>
            setDismissedStreams((prev) => (prev.includes(streamId) ? prev : [...prev, streamId]))
          }
          onClose={() => setSidebarOpen(false)}
        />
      )}
      <main className="operator-main">
        {statusMessage && (
          <div className="status-toast">{statusMessage}</div>
        )}

        <LidarViewport
          tracks={activeTracks}
          focusedTrackId={workflowState.focusTrackId}
          now={snapshot.now}
          streamLabel={activeStream?.label ?? 'Unknown'}
          activeStreamId={preferences.selectedStreamId}
          colorScale={preferences.colorScale}
          zones={zones}
          streamAvailable={activeStream?.available ?? false}
          onFocusResolved={(trackId) => {
            setWorkflowState((prev) =>
              advanceWorkflow(prev, {
                type: 'OBJECT_FOCUSED',
                token: prev.token,
                trackId,
              }),
            )
          }}
          onSwitchStream={switchStream}
        />
      </main>
    </div>
  )
}

function playAlertTone(priority: AlertEvent['priority']) {
  try {
    const context = new window.AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const frequency = priority === 'critical' ? 780 : priority === 'high' ? 620 : 440
    oscillator.frequency.value = frequency
    oscillator.type = 'square'
    oscillator.connect(gain)
    gain.connect(context.destination)
    gain.gain.value = priority === 'critical' ? 0.06 : 0.03
    oscillator.start()
    oscillator.stop(context.currentTime + 0.13)
  } catch {
    // Ignore if browser audio context is unavailable.
  }
}
