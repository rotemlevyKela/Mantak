import { useEffect, useRef, useState } from 'react'
import { STREAM_LABELS } from '../../../domain/constants'
import type { AlertEvent, ObjectType, StreamId } from '../../../domain/types'
import lidarSensorImg from '../../../assets/lidar-sensor.png'

const STREAM_CONE_ROTATION: Record<StreamId, number> = {
  front: -90,
  right: 0,
  back: 90,
  left: 180,
}

const OBJECT_LABEL: Record<ObjectType, string> = {
  man: 'Person',
  drone: 'Drone',
  vehicle: 'Vehicle',
}

function DirectionIcon({ streamId }: { streamId: StreamId }) {
  const cone = STREAM_CONE_ROTATION[streamId]
  const s = 56
  const cx = s / 2
  const cy = s / 2
  const vehSize = 24
  const coneR = 26
  const halfAngle = 40
  const rad1 = ((cone - halfAngle) * Math.PI) / 180
  const rad2 = ((cone + halfAngle) * Math.PI) / 180
  const x1 = cx + Math.cos(rad1) * coneR
  const y1 = cy + Math.sin(rad1) * coneR
  const x2 = cx + Math.cos(rad2) * coneR
  const y2 = cy + Math.sin(rad2) * coneR
  const gradId = `feed-cone-${streamId}`
  const coneRad = (cone * Math.PI) / 180
  const gx2 = cx + Math.cos(coneRad) * coneR
  const gy2 = cy + Math.sin(coneRad) * coneR

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <defs>
        <linearGradient id={gradId} x1={cx} y1={cy} x2={gx2} y2={gy2} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#ef4444" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path
        d={`M${cx},${cy} L${x1},${y1} A${coneR},${coneR} 0 0,1 ${x2},${y2} Z`}
        fill={`url(#${gradId})`}
      />
      <image
        href={lidarSensorImg}
        x={cx - vehSize / 2}
        y={cy - vehSize / 2}
        width={vehSize}
        height={vehSize}
        preserveAspectRatio="xMidYMid meet"
        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
      />
    </svg>
  )
}

interface AlertFeedProps {
  alerts: AlertEvent[]
  activeStreamId: StreamId
  selectedAlertId: string | null
  onSelectAlert: (alert: AlertEvent) => void
}

const NEW_ALERT_DURATION_MS = 3000

export function AlertFeed({
  alerts,
  activeStreamId,
  selectedAlertId,
  onSelectAlert,
}: AlertFeedProps) {
  const seenIdsRef = useRef<Set<string>>(new Set())
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const newIds: string[] = []
    for (const alert of alerts) {
      if (!seenIdsRef.current.has(alert.alertId)) {
        seenIdsRef.current.add(alert.alertId)
        newIds.push(alert.alertId)
      }
    }
    if (newIds.length === 0) return

    setFlashingIds((prev) => {
      const next = new Set(prev)
      for (const id of newIds) next.add(id)
      return next
    })

    const timer = window.setTimeout(() => {
      setFlashingIds((prev) => {
        const next = new Set(prev)
        for (const id of newIds) next.delete(id)
        return next
      })
    }, NEW_ALERT_DURATION_MS)

    return () => window.clearTimeout(timer)
  }, [alerts])

  if (alerts.length === 0) {
    return (
      <div className="t-alert-feed">
        <div className="t-alert-feed-empty">No LiDAR Detections</div>
      </div>
    )
  }

  return (
    <div className="t-alert-feed">
      <div className="t-alert-feed-list">
        {alerts.map((alert, idx) => {
          const isSelected = alert.alertId === selectedAlertId
          const isActiveStream = alert.streamId === activeStreamId
          const isFlashing = flashingIds.has(alert.alertId)
          const label = STREAM_LABELS[alert.streamId].replace(/ Side$/i, '')
          const tag = alert.streamId.toUpperCase()
          const objectLabel = OBJECT_LABEL[alert.objectType] ?? alert.objectType
          const distance = Math.max(0, Math.round(alert.distance.distanceM))

          const classes = [
            't-alert-feed-card',
            isSelected ? 't-alert-feed-card--selected' : '',
            isActiveStream ? 't-alert-feed-card--active-stream' : '',
            isFlashing ? 't-alert-feed-card--new' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={alert.alertId}
              className={classes}
              style={{ animationDelay: `${Math.min(idx, 6) * 0.05}s` }}
              onClick={() => onSelectAlert(alert)}
            >
              <div className="t-alert-feed-card-accent" />

              <div className="t-alert-feed-card-direction">
                <DirectionIcon streamId={alert.streamId} />
              </div>

              <div className="t-alert-feed-card-body">
                <div className="t-alert-feed-card-label">
                  <span className="t-alert-feed-card-stream">{label}</span>
                  <span className="t-alert-feed-card-tag">{tag}</span>
                </div>
                <div className="t-alert-feed-card-object">{objectLabel}</div>
              </div>

              <div className="t-alert-feed-card-distance">
                <span>{distance}m</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
