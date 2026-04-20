import { useState } from 'react'
import type { InterestArea, ZoneMode } from '../../../domain/types'

const CX = 300
const CY = 300
const OUTER_R = 225
const MAX_RANGE = 55
const scale = OUTER_R / MAX_RANGE

function svgToMeters(sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - CX) / scale, y: (sy - CY) / scale }
}

function metersToSvg(x: number, y: number): { sx: number; sy: number } {
  return { sx: CX + x * scale, sy: CY + y * scale }
}

function zoneColor(mode: ZoneMode, alpha: number): string {
  return mode === 'opt-out'
    ? `rgba(239, 68, 68, ${alpha})`
    : `rgba(59, 130, 246, ${alpha})`
}

function polygonPath(vertices: Array<{ x: number; y: number }>): string {
  if (!vertices.length) return ''
  const pts = vertices.map((v) => {
    const { sx, sy } = metersToSvg(v.x, v.y)
    return `${sx.toFixed(1)},${sy.toFixed(1)}`
  })
  return `M ${pts[0]} ${pts.slice(1).map((p) => `L ${p}`).join(' ')} Z`
}

interface ZonesOverlayProps {
  zones: InterestArea[]
  onChange: (zones: InterestArea[]) => void
  onClose: () => void
}

export function ZonesOverlay({ zones, onChange, onClose }: ZonesOverlayProps) {
  const [drawing, setDrawing] = useState<Array<{ x: number; y: number }>>([])
  const [dragState, setDragState] = useState<
    | { zoneId: string; vertexIndex: number }
    | null
  >(null)

  const commitZone = () => {
    if (drawing.length < 3) { setDrawing([]); return }
    const id = `zone-${Date.now().toString(36)}`
    const next: InterestArea = {
      id,
      name: `Zone ${zones.length + 1}`,
      mode: 'opt-out',
      vertices: drawing,
    }
    onChange([...zones, next])
    setDrawing([])
  }

  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragState) return
    const svg = e.currentTarget
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const loc = pt.matrixTransform(ctm.inverse())
    const meters = svgToMeters(loc.x, loc.y)
    setDrawing((prev) => [...prev, meters])
  }

  const onSvgDblClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation()
    commitZone()
  }

  const onVertexPointerDown = (
    e: React.PointerEvent<SVGCircleElement>,
    zoneId: string,
    vertexIndex: number,
  ) => {
    e.stopPropagation()
    ;(e.target as SVGCircleElement).setPointerCapture(e.pointerId)
    setDragState({ zoneId, vertexIndex })
  }

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) return
    const svg = e.currentTarget
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const loc = pt.matrixTransform(ctm.inverse())
    const meters = svgToMeters(loc.x, loc.y)
    const next = zones.map((z) => {
      if (z.id !== dragState.zoneId) return z
      const verts = z.vertices.map((v, i) =>
        i === dragState.vertexIndex ? meters : v,
      )
      return { ...z, vertices: verts }
    })
    onChange(next)
  }

  const onSvgPointerUp = () => setDragState(null)

  const onVertexRightClick = (
    e: React.MouseEvent<SVGCircleElement>,
    zoneId: string,
    vertexIndex: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const next = zones
      .map((z) => {
        if (z.id !== zoneId) return z
        if (z.vertices.length <= 3) return null
        return { ...z, vertices: z.vertices.filter((_, i) => i !== vertexIndex) }
      })
      .filter((z): z is InterestArea => z !== null)
    onChange(next)
  }

  const toggleMode = (zoneId: string) => {
    onChange(
      zones.map((z) =>
        z.id === zoneId
          ? { ...z, mode: z.mode === 'opt-out' ? 'opt-in' : 'opt-out' }
          : z,
      ),
    )
  }

  const deleteZone = (zoneId: string) => {
    onChange(zones.filter((z) => z.id !== zoneId))
  }

  return (
    <div className="t-zones-overlay">
      <svg
        viewBox="0 0 600 600"
        className="t-zones-overlay-svg"
        preserveAspectRatio="xMidYMid slice"
        onClick={onSvgClick}
        onDoubleClick={onSvgDblClick}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
      >
        {zones.map((zone) => (
          <g key={zone.id}>
            <path
              d={polygonPath(zone.vertices)}
              fill={zoneColor(zone.mode, 0.18)}
              stroke={zoneColor(zone.mode, 0.9)}
              strokeWidth="1.5"
              className={`t-zone-polygon t-zone-polygon--${zone.mode}`}
            />
            {zone.vertices.map((v, i) => {
              const { sx, sy } = metersToSvg(v.x, v.y)
              return (
                <circle
                  key={`${zone.id}-v-${i}`}
                  cx={sx}
                  cy={sy}
                  r="5"
                  className="t-zone-vertex"
                  fill="#fff"
                  stroke={zoneColor(zone.mode, 0.9)}
                  strokeWidth="1.5"
                  onPointerDown={(e) => onVertexPointerDown(e, zone.id, i)}
                  onContextMenu={(e) => onVertexRightClick(e, zone.id, i)}
                  style={{ cursor: 'grab' }}
                />
              )
            })}
          </g>
        ))}

        {drawing.length > 0 && (
          <g>
            {drawing.length >= 2 && (
              <path
                d={polygonPath(drawing)}
                fill="rgba(239, 68, 68, 0.12)"
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            )}
            {drawing.map((v, i) => {
              const { sx, sy } = metersToSvg(v.x, v.y)
              return (
                <circle
                  key={`draft-${i}`}
                  cx={sx}
                  cy={sy}
                  r="4.5"
                  fill="#ef4444"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              )
            })}
          </g>
        )}
      </svg>

      <div className="t-zones-panel">
        <div className="t-zones-panel-header">
          <span className="t-zones-panel-title">Zones</span>
          <button
            type="button"
            className="t-zones-panel-close"
            onClick={onClose}
            aria-label="Close zones editor"
          >
            &times;
          </button>
        </div>
        <div className="t-zones-panel-hint">
          Click to add vertices · double-click to finish · right-click vertex to remove
        </div>
        {drawing.length > 0 && (
          <div className="t-zones-panel-draft">
            <span>Drafting ({drawing.length} pts)</span>
            <button
              type="button"
              className="t-zones-panel-btn"
              onClick={commitZone}
              disabled={drawing.length < 3}
            >
              Finish
            </button>
            <button
              type="button"
              className="t-zones-panel-btn t-zones-panel-btn--ghost"
              onClick={() => setDrawing([])}
            >
              Cancel
            </button>
          </div>
        )}
        {zones.length === 0 && drawing.length === 0 && (
          <div className="t-zones-panel-empty">No zones yet</div>
        )}
        {zones.map((zone) => (
          <div key={zone.id} className="t-zones-panel-item">
            <span className="t-zones-panel-name">{zone.name}</span>
            <button
              type="button"
              className={`t-zones-panel-mode t-zones-panel-mode--${zone.mode}`}
              onClick={() => toggleMode(zone.id)}
            >
              {zone.mode === 'opt-out' ? 'Opt-out' : 'Opt-in'}
            </button>
            <button
              type="button"
              className="t-zones-panel-btn t-zones-panel-btn--ghost"
              onClick={() => deleteZone(zone.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
