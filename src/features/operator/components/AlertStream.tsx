import { STREAM_LABELS, STREAM_ORDER } from '../../../domain/constants'
import type { AlertEvent, StreamId, TrackedObject } from '../../../domain/types'
import { formatClock } from '../../../lib/time'

interface AlertStreamProps {
  alerts: AlertEvent[]
  tracksByStream: Record<StreamId, TrackedObject[]>
  activeStreamId: StreamId
  onGoToStream: (streamId: StreamId) => void
}

export function AlertStream({
  alerts,
  tracksByStream,
  activeStreamId,
  onGoToStream,
}: AlertStreamProps) {
  return (
    <div className="t-alert-stream">
      <div className="t-alert-stream-list">
        {STREAM_ORDER.map((streamId, idx) => {
          const isActive = streamId === activeStreamId
          const trackCount = tracksByStream[streamId].length
          const streamAlerts = alerts.filter((a) => a.streamId === streamId)
          const latestTime = streamAlerts.length
            ? Math.max(...streamAlerts.map((a) => a.detectedAt))
            : null
          const hasDetections = trackCount > 0

          return (
            <div
              key={streamId}
              className={`t-alert-card${isActive ? ' t-alert-card--active' : ''}${hasDetections ? ' t-alert-card--detecting' : ''}`}
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
                      : 'No detections'}
                  </p>
                </div>

                <div className="t-alert-card-badges">
                  <div className={`t-alert-badge${hasDetections ? '' : ' t-alert-badge--dim'}`}>
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
