import { STREAM_LABELS } from '../../../domain/constants'
import type { AlertEvent, ObjectType, StreamId } from '../../../domain/types'
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

function ObjectIcon({ type }: { type: ObjectType }) {
  const size = 20
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor' }

  switch (type) {
    case 'man':
      return (
        <svg {...props}>
          <circle cx="12" cy="4" r="3" />
          <path d="M12 8c-3 0-5 1.5-5 3v2h3v7h4v-7h3v-2c0-1.5-2-3-5-3z" />
        </svg>
      )
    case 'drone':
      return (
        <svg {...props}>
          <path d="M4.5 7.5a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zM14.5 7.5a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z" opacity="0.5" />
          <rect x="8" y="10" width="8" height="5" rx="1.5" />
          <path d="M7 12.5H5M19 12.5h-2M12 10V7.5M9 7.5h6" strokeWidth="1.5" stroke="currentColor" fill="none" />
        </svg>
      )
    case 'vehicle':
      return (
        <svg {...props}>
          <path d="M5 16V9l2-4h10l2 4v7a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H8v1a1 1 0 01-1 1H6a1 1 0 01-1-1z" />
          <circle cx="7.5" cy="14" r="1.5" fill="#0a0a0a" />
          <circle cx="16.5" cy="14" r="1.5" fill="#0a0a0a" />
          <path d="M7 9l1.5-3h7L17 9H7z" fill="#0a0a0a" opacity="0.4" />
        </svg>
      )
    default:
      return null
  }
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
                      <span className="t-alert-log-icon">
                        <ObjectIcon type={alert.objectType} />
                      </span>
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
