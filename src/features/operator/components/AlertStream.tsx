import { STREAM_LABELS, STREAM_ORDER } from '../../../domain/constants'
import type { AlertEvent, StreamId, TrackedObject } from '../../../domain/types'
import { formatClock } from '../../../lib/time'
import lidarSensorImg from '../../../assets/lidar-sensor.png'

const STREAM_CONE_ROTATION: Record<StreamId, number> = {
  front: -90,
  right: 0,
  back: 90,
  left: 180,
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
  const gradId = `cone-g-${streamId}`
  const coneRad = (cone * Math.PI) / 180
  const gx2 = cx + Math.cos(coneRad) * coneR
  const gy2 = cy + Math.sin(coneRad) * coneR

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <defs>
        <linearGradient id={gradId} x1={cx} y1={cy} x2={gx2} y2={gy2} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#ef4444" stopOpacity="0.5" />
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
              className={`t-alert-card${isSelected ? ' t-alert-card--selected' : ''}`}
              style={{ animationDelay: `${idx * 0.08}s` }}
              onClick={() => onGoToStream(streamId)}
            >
              <div className="t-alert-card-accent" />

              <div className="t-alert-card-direction">
                <DirectionIcon streamId={streamId} />
              </div>

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
