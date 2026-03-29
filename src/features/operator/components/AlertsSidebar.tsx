import { useMemo } from 'react'
import { STREAM_LABELS, STREAM_ORDER } from '../../../domain/constants'
import type { AlertEvent, StreamId } from '../../../domain/types'
import { formatClock } from '../../../lib/time'
import vehicleImg from '../../../assets/vehicle-top.png'

interface AlertsSidebarProps {
  alerts: AlertEvent[]
  now: number
  activeStreamId: StreamId
  onGoToStream: (streamId: StreamId) => void
  onDismissStream: (streamId: StreamId) => void
  onClose: () => void
}

interface StreamSummary {
  streamId: StreamId
  detectionCount: number
  latestTimestamp: number
}

export function AlertsSidebar({
  alerts,
  now,
  activeStreamId,
  onGoToStream,
  onDismissStream,
  onClose,
}: AlertsSidebarProps) {
  const streamSummaries = useMemo(() => {
    const summaries: StreamSummary[] = STREAM_ORDER.map((streamId) => {
      const streamAlerts = alerts.filter((a) => a.streamId === streamId)
      return {
        streamId,
        detectionCount: streamAlerts.length,
        latestTimestamp: streamAlerts.length > 0
          ? Math.max(...streamAlerts.map((a) => a.detectedAt))
          : now,
      }
    })
    return summaries.filter((s) => s.detectionCount > 0)
  }, [alerts, now])

  return (
    <aside className="panel" aria-label="Detections">
      <header className="panel-header">
        <strong className="panel-title">Detections</strong>
        <button
          className="panel-close"
          type="button"
          aria-label="Close panel"
          onClick={onClose}
        >
          <svg viewBox="0 0 14 14" width="12" height="12" stroke="currentColor" strokeWidth="1.5" fill="none">
            <line x1="1" y1="1" x2="13" y2="13" />
            <line x1="13" y1="1" x2="1" y2="13" />
          </svg>
        </button>
      </header>

      <ul className="stream-cards">
        {streamSummaries.length === 0 && (
          <li className="stream-card">
            <div className="stream-card-body">
              <div className="stream-card-title">No active detections</div>
              <div className="stream-card-meta">
                Incoming detections from all 4 streams will appear here.
              </div>
            </div>
          </li>
        )}

        {streamSummaries.map((summary) => (
          <li
            className="stream-card"
            key={summary.streamId}
            data-active={summary.streamId === activeStreamId}
          >
            <div className="stream-card-preview">
              <VehicleDetectionPreview streamId={summary.streamId} />
            </div>

            <div className="stream-card-body">
              <div className="stream-card-title">
                {STREAM_LABELS[summary.streamId]}
              </div>
              <div className="stream-card-detection-row">
                <span className="stream-card-meta">Areas of detection:</span>
                <span className="detection-count-badge">
                  {summary.detectionCount}
                </span>
              </div>
              {summary.latestTimestamp > 0 && (
                <div className="stream-card-time">
                  {formatClock(summary.latestTimestamp)}
                </div>
              )}
              <div className="stream-card-actions">
                <button
                  className="glass-btn"
                  type="button"
                  onClick={() => onGoToStream(summary.streamId)}
                >
                  <span>Go to Stream</span>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  className="glass-btn glass-btn-icon"
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => onDismissStream(summary.streamId)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}

const WEDGE_ROTATION: Record<StreamId, number> = {
  front: -20,
  right: 70,
  back: 160,
  left: 250,
}

function VehicleDetectionPreview({ streamId }: { streamId: StreamId }) {
  const wedgeAngle = WEDGE_ROTATION[streamId]

  return (
    <div className="vehicle-preview">
      {/* Detection wedge */}
      <svg
        className="vehicle-wedge"
        viewBox="0 0 120 130"
        width="120"
        height="130"
      >
        <defs>
          <radialGradient id={`glow-${streamId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="60%" stopColor="rgba(0,0,0,0.2)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Compass ring */}
        <circle cx="60" cy="68" r="48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

        {/* North indicator */}
        <line x1="60" y1="20" x2="60" y2="10" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
        <text x="60" y="8" textAnchor="middle" fill="white" fontSize="7" fontFamily="sans-serif"
          style={{ textShadow: '0 0 4px rgba(255,255,255,0.5)' }}>N</text>

        {/* Red detection wedge */}
        <g transform={`rotate(${wedgeAngle} 60 68)`}>
          <path
            d="M60 68 L42 22 A38 38 0 0 1 78 22 Z"
            fill="rgba(220, 30, 30, 0.85)"
          />
        </g>
      </svg>

      {/* Vehicle image on top */}
      <img
        className="vehicle-img"
        src={vehicleImg}
        alt=""
        width="80"
        height="90"
        draggable={false}
      />
    </div>
  )
}
