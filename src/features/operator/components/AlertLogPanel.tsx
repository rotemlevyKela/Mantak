import { STREAM_LABELS } from '../../../domain/constants'
import type { AlertEvent, StreamId } from '../../../domain/types'
import { formatClock, formatElapsed } from '../../../lib/time'

interface AlertLogPanelProps {
  alerts: AlertEvent[]
  open: boolean
  now: number
  onClose: () => void
  onSelectAlert: (alert: AlertEvent | null) => void
  selectedAlertId: string | null
}

const STREAM_DOT_COLOR: Record<StreamId, string> = {
  front: '#ef4444',
  right: '#f59e0b',
  left: '#3b82f6',
  back: '#a855f7',
}

const OBJECT_LABEL: Record<string, string> = {
  man: 'Person',
  drone: 'Drone',
  vehicle: 'Vehicle',
}

export function AlertLogPanel({ alerts, open, now, onClose, onSelectAlert, selectedAlertId }: AlertLogPanelProps) {
  const selectedAlert = selectedAlertId
    ? alerts.find((a) => a.alertId === selectedAlertId) ?? null
    : null

  return (
    <div className={`t-alert-log${open ? ' t-alert-log--open' : ''}`}>
      <div className="t-alert-log-header">
        <div className="t-alert-log-header-left">
          <h2 className="t-alert-log-title">Alert Log</h2>
          <span className="t-alert-log-count">{alerts.length}</span>
        </div>

        {selectedAlert && (
          <div className="t-alert-log-duration">
            <span className="t-alert-log-duration-label">Active for</span>
            <span className="t-alert-log-duration-value">
              {formatElapsed(selectedAlert.firstDetectedAt, now)}
            </span>
          </div>
        )}

        <button
          className="t-alert-log-close"
          type="button"
          onClick={onClose}
          aria-label="Close alert log"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="t-alert-log-timeline">
        {alerts.length === 0 ? (
          <div className="t-alert-log-empty">No alerts recorded</div>
        ) : (
          alerts.map((alert) => {
            const isSelected = alert.alertId === selectedAlertId
            const direction = STREAM_LABELS[alert.streamId].replace(/ Side$/i, '')

            return (
              <div
                key={alert.alertId}
                className={`t-alert-log-entry${isSelected ? ' t-alert-log-entry--selected' : ''}`}
                onClick={() => onSelectAlert(isSelected ? null : alert)}
              >
                <div className="t-alert-log-rail">
                  <span
                    className="t-alert-log-dot"
                    style={{ background: STREAM_DOT_COLOR[alert.streamId] }}
                  />
                  <span className="t-alert-log-line" />
                </div>

                <div className="t-alert-log-content">
                  <div className="t-alert-log-row-top">
                    <span className="t-alert-log-stream">
                      {direction}
                      <span className="t-alert-log-direction">{alert.streamId.toUpperCase()}</span>
                    </span>
                    <span className="t-alert-log-time">
                      {formatClock(alert.detectedAt)}
                    </span>
                  </div>
                  <div className="t-alert-log-row-bottom">
                    <span className="t-alert-log-object">
                      {OBJECT_LABEL[alert.objectType] ?? alert.objectType}
                    </span>
                    <span className="t-alert-log-position">
                      {alert.distance.distanceM.toFixed(0)}m · {alert.distance.azimuthDeg.toFixed(0)}°
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
