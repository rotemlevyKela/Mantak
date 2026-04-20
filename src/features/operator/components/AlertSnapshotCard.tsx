import { useState } from 'react'
import {
  RESOLUTION_LABELS,
  STREAM_LABELS,
  THREAT_ACCENT,
  THREAT_SHORT_LABEL,
} from '../../../domain/constants'
import type { AlertEvent, AlertResolution, ThreatKind } from '../../../domain/types'
import { formatClock, formatElapsed } from '../../../lib/time'

const OBJECT_LABEL: Record<string, string> = {
  man: 'Person',
  drone: 'Drone',
  vehicle: 'Vehicle',
}

const RESOLUTIONS: AlertResolution[] = ['handled', 'false-alarm', 'disappeared']

function threatKindsOf(alert: AlertEvent): ThreatKind[] {
  const kinds: ThreatKind[] = []
  if (alert.flags?.fastApproaching) kinds.push('fast-approaching')
  if (alert.flags?.loitering) kinds.push('loitering')
  if (alert.flags?.drone) kinds.push('drone')
  return kinds
}

interface AlertSnapshotCardProps {
  alert: AlertEvent
  now: number
  onFocusMap: (alert: AlertEvent) => void
  onArchive: (alert: AlertEvent, resolution: AlertResolution) => void
  onClose: () => void
}

export function AlertSnapshotCard({
  alert,
  now,
  onFocusMap,
  onArchive,
  onClose,
}: AlertSnapshotCardProps) {
  const [outcomeOpen, setOutcomeOpen] = useState(false)
  const kinds = threatKindsOf(alert)
  const abnormal = kinds.length > 0
  const streamLabel = STREAM_LABELS[alert.streamId].replace(/ Side$/i, '')
  const objectLabel = OBJECT_LABEL[alert.objectType] ?? alert.objectType

  return (
    <div className={`t-snapshot-card${abnormal ? ' t-snapshot-card--abnormal' : ''}`}>
      <div className="t-snapshot-card-header">
        <div className="t-snapshot-card-title">
          <span className="t-snapshot-card-stream">{streamLabel}</span>
          <span className="t-snapshot-card-dot" />
          <span className="t-snapshot-card-object">{objectLabel}</span>
        </div>
        <button
          type="button"
          className="t-snapshot-card-close"
          onClick={onClose}
          aria-label="Close snapshot"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {kinds.length > 0 && (
        <div className="t-snapshot-card-flags">
          {kinds.map((kind) => (
            <span
              key={kind}
              className="t-snapshot-card-flag"
              style={{ background: THREAT_ACCENT[kind] }}
            >
              {THREAT_SHORT_LABEL[kind]}
            </span>
          ))}
        </div>
      )}

      {alert.snapshotUrl && (
        <div className="t-snapshot-card-image">
          <img src={alert.snapshotUrl} alt={`${objectLabel} snapshot`} />
        </div>
      )}

      <dl className="t-snapshot-card-meta">
        <div>
          <dt>Distance</dt>
          <dd>{alert.distance.distanceM.toFixed(1)} m</dd>
        </div>
        <div>
          <dt>Azimuth</dt>
          <dd>{alert.distance.azimuthDeg.toFixed(0)}&deg;</dd>
        </div>
        <div>
          <dt>Velocity</dt>
          <dd>{alert.velocityMps.toFixed(1)} m/s</dd>
        </div>
        <div>
          <dt>First seen</dt>
          <dd>{formatClock(alert.firstDetectedAt)}</dd>
        </div>
        <div>
          <dt>Active for</dt>
          <dd>{formatElapsed(alert.firstDetectedAt, now)}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd className={`t-snapshot-card-priority t-snapshot-card-priority--${alert.priority}`}>
            {alert.priority}
          </dd>
        </div>
      </dl>

      <div className="t-snapshot-card-actions">
        <button
          type="button"
          className="t-snapshot-card-action t-snapshot-card-action--secondary"
          onClick={() => onFocusMap(alert)}
        >
          Focus on map
        </button>
        {outcomeOpen ? (
          <div className="t-alert-outcome">
            <span className="t-alert-outcome-label">Resolution</span>
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`t-alert-outcome-btn t-alert-outcome-btn--${r}`}
                onClick={() => { onArchive(alert, r); setOutcomeOpen(false) }}
              >
                {RESOLUTION_LABELS[r]}
              </button>
            ))}
            <button
              type="button"
              className="t-alert-outcome-cancel"
              onClick={() => setOutcomeOpen(false)}
              aria-label="Cancel close"
            >
              &times;
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="t-snapshot-card-action t-snapshot-card-action--primary"
            onClick={() => setOutcomeOpen(true)}
          >
            Close alert
          </button>
        )}
      </div>
    </div>
  )
}
