import { useMemo } from 'react'
import { STREAM_LABELS, STREAM_ORDER } from '../../../domain/constants'
import type { AlertEvent, StreamId } from '../../../domain/types'
import { formatClock } from '../../../lib/time'

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
  maxPriority: 'critical' | 'high' | 'medium' | 'low'
}

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'CRIT',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
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
      const priorities = streamAlerts.map((a) => a.priority)
      const maxPriority = priorities.includes('critical')
        ? 'critical'
        : priorities.includes('high')
          ? 'high'
          : priorities.includes('medium')
            ? 'medium'
            : 'low'
      return {
        streamId,
        detectionCount: streamAlerts.length,
        latestTimestamp:
          streamAlerts.length > 0
            ? Math.max(...streamAlerts.map((a) => a.detectedAt))
            : now,
        maxPriority,
      }
    })
    return summaries.filter((s) => s.detectionCount > 0)
  }, [alerts, now])

  return (
    <aside className="c2-panel" aria-label="Detections">
      <header className="c2-header">
        <span className="c2-header-title">Detections</span>
        <button
          className="c2-header-close"
          type="button"
          aria-label="Close panel"
          onClick={onClose}
        >
          <svg viewBox="0 0 14 14" width="10" height="10" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="2" y1="2" x2="12" y2="12" />
            <line x1="12" y1="2" x2="2" y2="12" />
          </svg>
        </button>
      </header>

      <div className="c2-list">
        {streamSummaries.length === 0 && (
          <div className="c2-empty">
            <span className="c2-empty-label">No active detections</span>
            <span className="c2-empty-sub">All streams clear</span>
          </div>
        )}

        {streamSummaries.map((summary) => {
          const isActive = summary.streamId === activeStreamId
          return (
            <div
              className="c2-card"
              key={summary.streamId}
              data-active={isActive}
              data-priority={summary.maxPriority}
            >
              <div className="c2-card-compass">
                <CompassPreview streamId={summary.streamId} />
              </div>

              <div className="c2-card-body">
                <div className="c2-card-row-top">
                  <span className="c2-card-title">
                    {STREAM_LABELS[summary.streamId]}
                  </span>
                  <span className="c2-threat-tag" data-priority={summary.maxPriority}>
                    {PRIORITY_LABEL[summary.maxPriority]}
                  </span>
                </div>

                <div className="c2-card-row-meta">
                  <span className="c2-card-meta">Areas of detection:</span>
                  <span className="c2-count" data-priority={summary.maxPriority}>
                    {summary.detectionCount}
                  </span>
                </div>

                <div className="c2-card-row-meta">
                  <span className="c2-card-timestamp">
                    {formatClock(summary.latestTimestamp)}
                  </span>
                </div>

                <div className="c2-card-actions">
                  <button
                    className="c2-btn c2-btn-go"
                    type="button"
                    onClick={() => onGoToStream(summary.streamId)}
                  >
                    <span>Go to Stream</span>
                    <span className="c2-btn-arrow">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                  <button
                    className="c2-btn c2-btn-dismiss"
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => onDismissStream(summary.streamId)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

const WEDGE_ROTATION: Record<StreamId, number> = {
  front: -20,
  right: 70,
  back: 160,
  left: 250,
}

function CompassPreview({ streamId }: { streamId: StreamId }) {
  const angle = WEDGE_ROTATION[streamId]

  return (
    <div className="compass-mini">
      <svg className="compass-mini-svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />

        <line x1="50" y1="6" x2="50" y2="94" stroke="rgba(255,255,255,0.035)" strokeWidth="0.3" />
        <line x1="6" y1="50" x2="94" y2="50" stroke="rgba(255,255,255,0.035)" strokeWidth="0.3" />

        <line x1="50" y1="6" x2="50" y2="2" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" />
        <text x="50" y="1" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="5" fontFamily="sans-serif">N</text>

        <g transform={`rotate(${angle} 50 50)`}>
          <path
            className="wedge-area"
            d="M50 50 L37 14 A30 30 0 0 1 63 14 Z"
            fill="rgba(190, 18, 18, 0.75)"
          />
          <path
            className="wedge-area-stroke"
            d="M50 50 L37 14 A30 30 0 0 1 63 14 Z"
            fill="none"
            stroke="rgba(255, 60, 60, 0.45)"
            strokeWidth="0.4"
          />
        </g>
      </svg>

      <svg className="compass-mini-vehicle" viewBox="0 0 36 52" width="24" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="36" height="52" rx="6" ry="6" fill="rgba(80,80,80,0.6)" stroke="rgba(200,200,200,0.5)" strokeWidth="1"/>
        <rect x="4" y="4" width="28" height="20" rx="3" ry="3" fill="none" stroke="rgba(200,200,200,0.3)" strokeWidth="0.6"/>
        <rect x="4" y="28" width="28" height="20" rx="3" ry="3" fill="none" stroke="rgba(200,200,200,0.3)" strokeWidth="0.6"/>
        <line x1="18" y1="0" x2="18" y2="52" stroke="rgba(200,200,200,0.15)" strokeWidth="0.5"/>
      </svg>
    </div>
  )
}
