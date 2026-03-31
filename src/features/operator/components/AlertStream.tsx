import { STREAM_LABELS, STREAM_ORDER } from '../../../domain/constants'
import type { AlertEvent, StreamId, TrackedObject } from '../../../domain/types'
import { formatClock } from '../../../lib/time'

interface AlertStreamProps {
  alerts: AlertEvent[]
  tracksByStream: Record<StreamId, TrackedObject[]>
  activeStreamId: StreamId
  alertFlash: boolean
  onGoToStream: (streamId: StreamId) => void
}

export function AlertStream({
  alerts,
  tracksByStream,
  activeStreamId,
  alertFlash,
  onGoToStream,
}: AlertStreamProps) {
  const activeStreams = STREAM_ORDER.filter((id) => tracksByStream[id].length > 0)

  if (activeStreams.length === 0) {
    return (
      <div className="t-alert-stream">
        <div className="t-alert-stream-empty">No LiDAR Detections</div>
      </div>
    )
  }

  return (
    <div className="t-alert-stream">
      <div className="t-alert-stream-list">
        {activeStreams.map((streamId, idx) => {
          const isSelected = streamId === activeStreamId
          const trackCount = tracksByStream[streamId].length
          const streamAlerts = alerts.filter((a) => a.streamId === streamId)
          const latestTime = streamAlerts.length
            ? Math.max(...streamAlerts.map((a) => a.detectedAt))
            : null

          return (
            <div
              key={streamId}
              className={`t-alert-card${alertFlash ? ' t-alert-card--detecting' : ''}${isSelected ? ' t-alert-card--selected' : ''}`}
              style={{ animationDelay: `${idx * 0.08}s` }}
              onClick={() => onGoToStream(streamId)}
            >
              <div className="t-alert-card-accent" />

              <div className="t-alert-card-body">
                <div className="t-alert-card-info">
                  <p className="t-alert-card-title">
                    {STREAM_LABELS[streamId]}
                  </p>
                  <p className="t-alert-card-sub">
                    {latestTime
                      ? `Last Detected ${formatClock(latestTime)}`
                      : 'Detecting...'}
                  </p>
                </div>

                <div className="t-alert-card-badges">
                  <div className="t-alert-badge">
                    <span>{trackCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
