import { useMemo } from 'react'
import { STREAM_ORDER } from '../../../domain/constants'
import type { AlertEvent, StreamId, TrackedObject } from '../../../domain/types'
import lidarSensorImg from '../../../assets/lidar-sensor.png'

interface DetectionMapProps {
  tracksByStream: Record<StreamId, TrackedObject[]>
  activeStreamId: StreamId
  onSwitchStream: (streamId: StreamId) => void
  focusedTrackId?: string
  highlightedAlert?: AlertEvent | null
}

const CX = 300
const CY = 300
const OUTER_R = 225
const INNER_R = 150
const MAX_RANGE = 55
const VEH_W = 120
const VEH_H = 180

const STREAM_ANGLE: Record<StreamId, number> = {
  front: 0,
  right: 90,
  back: 180,
  left: 270,
}

const FOV_HALF = 45

function toSvg(angleDeg: number, r: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return [CX + Math.cos(rad) * r, CY + Math.sin(rad) * r]
}

function sectorPath(center: number, half: number, r: number): string {
  const [sx, sy] = toSvg(center - half, r)
  const [ex, ey] = toSvg(center + half, r)
  const large = half * 2 > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`
}

function horizDist(t: TrackedObject): number {
  return Math.sqrt(t.position.x ** 2 + t.position.z ** 2)
}

export function DetectionMap({
  tracksByStream,
  activeStreamId,
  onSwitchStream,
  focusedTrackId,
  highlightedAlert,
}: DetectionMapProps) {
  const allTracks = useMemo(
    () => STREAM_ORDER.flatMap((id) => tracksByStream[id]),
    [tracksByStream],
  )

  const labelledIds = useMemo(() => {
    const ids = new Set<string>()
    for (const sid of STREAM_ORDER) {
      const sorted = [...tracksByStream[sid]].sort((a, b) => horizDist(a) - horizDist(b))
      for (let i = 0; i < Math.min(3, sorted.length); i++) ids.add(sorted[i].trackId)
    }
    return ids
  }, [tracksByStream])

  const fov = STREAM_ANGLE[activeStreamId]
  const scale = OUTER_R / MAX_RANGE

  return (
    <div className="t-detection-map">
      <svg
        viewBox="0 0 600 600"
        className="t-detection-map-svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="dm-fov" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dm-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#232323" stopOpacity="1" />
            <stop offset="60%" stopColor="#1a1a1a" stopOpacity="1" />
            <stop offset="100%" stopColor="#111111" stopOpacity="1" />
          </radialGradient>
          <filter id="dm-blur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
          </filter>
        </defs>

        <rect x="0" y="0" width="600" height="600" fill="url(#dm-bg)" />

        {/* range ring - 25m */}
        <circle cx={CX} cy={CY} r={OUTER_R * 0.45} fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="3 4" />

        <path d={sectorPath(fov, FOV_HALF, OUTER_R + 50)} fill="url(#dm-fov)" />

        {[-FOV_HALF, FOV_HALF].map((off) => {
          const [lx, ly] = toSvg(fov + off, OUTER_R + 50)
          return (
            <line key={off} x1={CX} y1={CY} x2={lx} y2={ly}
              stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          )
        })}

        <circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={INNER_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.7" />

        {[0, 90, 180, 270].map((a) => {
          const [ix, iy] = toSvg(a, OUTER_R - 10)
          const [ox, oy] = toSvg(a, OUTER_R + 10)
          return (
            <line key={a} x1={ix} y1={iy} x2={ox} y2={oy}
              stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
          )
        })}

        <text x={CX} y={CY - OUTER_R - 20} textAnchor="middle"
          fill="rgba(255,255,255,0.6)" fontSize="16" fontFamily="var(--font-ui)" fontWeight="500">
          N
        </text>

        {STREAM_ORDER.map((id) => (
          <path key={id} d={sectorPath(STREAM_ANGLE[id], FOV_HALF, OUTER_R + 50)}
            fill="transparent" style={{ cursor: 'pointer' }}
            onClick={() => onSwitchStream(id)} />
        ))}

        <image
          href={lidarSensorImg}
          x={CX - VEH_W / 2} y={CY - VEH_H / 2}
          width={VEH_W} height={VEH_H}
          preserveAspectRatio="xMidYMid meet"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))' }}
        />

        {allTracks.map((track) => {
          const dx = CX + track.position.x * scale
          const dy = CY + track.position.z * scale
          const dist = horizDist(track)
          const focused = track.trackId === focusedTrackId
          const isHighlighted = highlightedAlert?.trackId === track.trackId
          const showLabel = labelledIds.has(track.trackId)

          return (
            <g key={track.trackId}>
              <circle cx={dx} cy={dy} r="14"
                fill="rgba(239,68,68,0.12)" filter="url(#dm-blur)" />
              {(focused || isHighlighted) && (
                <circle cx={dx} cy={dy} r="12"
                  fill="none" stroke={isHighlighted ? '#fff' : '#ef4444'} strokeWidth={isHighlighted ? 2 : 1.5} opacity={isHighlighted ? 0.9 : 0.5}>
                  <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {isHighlighted && (
                <>
                  <circle cx={dx} cy={dy} r="20"
                    fill="none" stroke="#fff" strokeWidth="1" opacity="0.3">
                    <animate attributeName="r" values="16;24;16" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={dx} cy={dy} r={7}
                    fill="#fff" opacity="0.95" />
                  <circle cx={dx} cy={dy} r={3.5}
                    fill="#ef4444" />
                </>
              )}
              {!isHighlighted && (
                <circle cx={dx} cy={dy} r={focused ? 6 : 4.5}
                  fill="#ef4444" opacity={focused ? 1 : 0.85} />
              )}
              {showLabel && (
                <text x={dx} y={dy - (isHighlighted ? 24 : 14)} textAnchor="middle"
                  fill={isHighlighted ? '#fff' : '#fff'} fontSize={isHighlighted ? 14 : 13} fontWeight="600"
                  fontFamily="var(--font-ui)" opacity="0.95"
                  style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
                  {Math.round(dist)}m
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
