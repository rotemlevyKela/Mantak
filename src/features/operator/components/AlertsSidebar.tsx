import { STREAM_LABELS } from '../../../domain/constants'
import type { AlertEvent, SortMode } from '../../../domain/types'
import { formatClock, formatElapsed } from '../../../lib/time'

interface AlertsSidebarProps {
  alerts: AlertEvent[]
  now: number
  sortMode: SortMode
  onSortModeChange: (mode: SortMode) => void
  onAlertClick: (alert: AlertEvent) => void
  onDismiss: (alertId: string) => void
  showVelocity: boolean
  onToggleVelocity: () => void
  soundEnabled: boolean
  onToggleSound: () => void
}

export function AlertsSidebar({
  alerts,
  now,
  sortMode,
  onSortModeChange,
  onAlertClick,
  onDismiss,
  showVelocity,
  onToggleVelocity,
  soundEnabled,
  onToggleSound,
}: AlertsSidebarProps) {
  return (
    <aside className="panel" aria-label="Detections and alerts">
      <header className="panel-header">
        <strong className="panel-title">Detections</strong>
        <div className="panel-controls">
          <button
            className="chip"
            type="button"
            onClick={() => onSortModeChange(sortMode === 'priority' ? 'time' : 'priority')}
          >
            Sort: {sortMode}
          </button>
          <button className="chip" type="button" onClick={onToggleVelocity}>
            {showVelocity ? 'Velocity' : 'Motion'}
          </button>
          <button className="chip" type="button" onClick={onToggleSound}>
            {soundEnabled ? 'Sound on' : 'Sound off'}
          </button>
        </div>
      </header>

      <ul className="alerts-list">
        {alerts.length === 0 && (
          <li className="alert-card">
            <div className="alert-main">
              <div className="alert-title">No active detections</div>
              <div className="alert-meta">
                Incoming detections from all 4 streams will appear here.
              </div>
            </div>
          </li>
        )}

        {alerts.map((alert) => (
          <li className="alert-card" key={alert.alertId}>
            <div className="alert-main">
              <div className="alert-topline">
                <span className="priority-pill" data-level={alert.priority}>
                  {alert.priority}
                </span>
                <strong className="alert-title">{STREAM_LABELS[alert.streamId]}</strong>
              </div>
              <div className="alert-meta">
                {alert.objectType.toUpperCase()} - first seen{' '}
                {formatElapsed(alert.firstDetectedAt, now)} ago
              </div>
              <div className="alert-info-row">
                <span>
                  {showVelocity
                    ? `Velocity ${alert.velocityMps.toFixed(1)} m/s`
                    : `Status ${alert.motionState}`}
                </span>
                <span>Az {alert.distance.azimuthDeg.toFixed(1)} deg</span>
                <span>D {alert.distance.distanceM.toFixed(1)} m</span>
                <span>H {alert.dimensions.heightM.toFixed(1)} m</span>
                <span>L {alert.dimensions.lengthM.toFixed(1)} m</span>
              </div>
              <div className="alert-meta">{formatClock(alert.detectedAt)}</div>
              <div className="alert-snapshot" aria-label="Snapshot">
                {alert.snapshotUrl ? (
                  <img src={alert.snapshotUrl} alt="Detection snapshot" />
                ) : (
                  <span>Snapshot unavailable</span>
                )}
              </div>
              <div className="alert-actions">
                <button className="ghost-btn" type="button" onClick={() => onAlertClick(alert)}>
                  Go to Stream
                </button>
              </div>
            </div>
            <div>
              <button
                className="icon-btn"
                aria-label="Dismiss alert"
                type="button"
                onClick={() => onDismiss(alert.alertId)}
              >
                X
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
