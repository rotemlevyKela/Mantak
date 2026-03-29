import { useEffect, useMemo, useRef, useState } from 'react'
import { DETECTION_COLORS } from '../../../domain/constants'
import type { InterestArea, TrackedObject } from '../../../domain/types'
import { formatElapsed } from '../../../lib/time'

interface LidarViewportProps {
  tracks: TrackedObject[]
  focusedTrackId?: string
  now: number
  streamLabel: string
  colorScale: 'yellow-red' | 'black-white'
  zones: InterestArea[]
  streamAvailable: boolean
  onFocusResolved: (trackId: string) => void
}

interface CameraState {
  yaw: number
  pitch: number
  zoom: number
  panX: number
  panY: number
}

export function LidarViewport({
  tracks,
  focusedTrackId,
  now,
  streamLabel,
  colorScale,
  zones,
  streamAvailable,
  onFocusResolved,
}: LidarViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [camera, setCamera] = useState<CameraState>({
    yaw: 0.15,
    pitch: 0.24,
    zoom: 3.8,
    panX: 0,
    panY: 0,
  })
  const dragStateRef = useRef<{ active: boolean; x: number; y: number; panMode: boolean }>({
    active: false,
    x: 0,
    y: 0,
    panMode: false,
  })

  const cloudPoints = useMemo(() => buildCloudPoints(tracks), [tracks])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    let animationFrame = 0
    const render = () => {
      fitCanvas(canvas, context)
      drawScene(context, canvas, cloudPoints, tracks, focusedTrackId, camera, colorScale, zones, now)
      animationFrame = window.requestAnimationFrame(render)
    }
    render()

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [camera, cloudPoints, colorScale, focusedTrackId, now, tracks, zones])

  useEffect(() => {
    if (!focusedTrackId) {
      return
    }
    const track = tracks.find((candidate) => candidate.trackId === focusedTrackId)
    if (!track) {
      return
    }
    onFocusResolved(track.trackId)
    const frame = window.requestAnimationFrame(() => {
      setCamera((prev) => ({
        ...prev,
        panX: -track.position.x * 0.9,
        panY: -track.position.y * 0.6,
        zoom: clamp(prev.zoom + 0.15, 2.4, 10),
      }))
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [focusedTrackId, onFocusResolved, tracks])

  const applyPreset = (preset: 'top' | 'side' | 'reset') => {
    if (preset === 'top') {
      setCamera((prev) => ({ ...prev, pitch: 1.3, yaw: 0, zoom: 5.6 }))
      return
    }
    if (preset === 'side') {
      setCamera((prev) => ({ ...prev, pitch: 0.1, yaw: 1.4, zoom: 4.1 }))
      return
    }
    setCamera({ yaw: 0.15, pitch: 0.24, zoom: 3.8, panX: 0, panY: 0 })
  }

  return (
    <div className="viewport-wrap">
      <canvas
        className="viewport-canvas"
        ref={canvasRef}
        onPointerDown={(event) => {
          dragStateRef.current = {
            active: true,
            x: event.clientX,
            y: event.clientY,
            panMode: event.shiftKey,
          }
        }}
        onPointerMove={(event) => {
          if (!dragStateRef.current.active) {
            return
          }
          const dx = event.clientX - dragStateRef.current.x
          const dy = event.clientY - dragStateRef.current.y
          dragStateRef.current.x = event.clientX
          dragStateRef.current.y = event.clientY
          setCamera((prev) => {
            if (dragStateRef.current.panMode) {
              return {
                ...prev,
                panX: prev.panX + dx * 0.25,
                panY: prev.panY + dy * 0.25,
              }
            }
            return {
              ...prev,
              yaw: prev.yaw + dx * 0.005,
              pitch: clamp(prev.pitch + dy * 0.005, -1.45, 1.45),
            }
          })
        }}
        onPointerUp={() => {
          dragStateRef.current.active = false
        }}
        onPointerLeave={() => {
          dragStateRef.current.active = false
        }}
        onWheel={(event) => {
          event.preventDefault()
          const delta = Math.sign(event.deltaY) * -0.2
          setCamera((prev) => ({ ...prev, zoom: clamp(prev.zoom + delta, 2.2, 10) }))
        }}
      />
      <div className="viewport-overlay">
        <div className="overlay-line">{`Open stream - ${streamLabel}`}</div>
        <div className="overlay-line">
          Drag = orbit, <span className="kbd">Shift</span> + drag = pan, wheel = zoom
        </div>
      </div>
      <div className="toolbar" style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
        <div className="toolbar-group">
          <button className="small-btn" type="button" onClick={() => applyPreset('top')}>
            Top view
          </button>
          <button className="small-btn" type="button" onClick={() => applyPreset('side')}>
            Side view
          </button>
          <button className="small-btn" type="button" onClick={() => applyPreset('reset')}>
            Reset camera
          </button>
        </div>
      </div>
      {!streamAvailable && (
        <div className="offline-banner">
          <div className="offline-inner">
            <strong>Stream unavailable</strong>
            <div className="muted">Choose another LiDAR stream from the toolbar or alerts panel.</div>
          </div>
        </div>
      )}
    </div>
  )
}

interface CloudPoint {
  x: number
  y: number
  z: number
  intensity: number
  priorityColor: string
}

function buildCloudPoints(tracks: TrackedObject[]): CloudPoint[] {
  const points: CloudPoint[] = []
  for (const track of tracks) {
    const density = track.objectType === 'drone' ? 18 : 30
    for (let index = 0; index < density; index += 1) {
      points.push({
        x: track.position.x + randomSpread(track.objectType),
        y: track.position.y + randomSpread(track.objectType),
        z: track.position.z + randomSpread(track.objectType) * 0.2,
        intensity: Math.random(),
        priorityColor: DETECTION_COLORS[pickPriority(track)],
      })
    }
  }
  return points
}

function pickPriority(track: TrackedObject) {
  if (track.objectType === 'drone') {
    return 'critical'
  }
  if (track.motionState === 'dynamic') {
    return 'high'
  }
  return 'medium'
}

function randomSpread(type: TrackedObject['objectType']) {
  if (type === 'man') {
    return (Math.random() - 0.5) * 4
  }
  if (type === 'drone') {
    return (Math.random() - 0.5) * 2
  }
  return (Math.random() - 0.5) * 7
}

function fitCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const displayWidth = Math.floor(width * ratio)
  const displayHeight = Math.floor(height * ratio)
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth
    canvas.height = displayHeight
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
  }
}

function drawScene(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  cloudPoints: CloudPoint[],
  tracks: TrackedObject[],
  focusedTrackId: string | undefined,
  camera: CameraState,
  colorScale: 'yellow-red' | 'black-white',
  zones: InterestArea[],
  now: number,
) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#000'
  context.fillRect(0, 0, width, height)

  const centerX = width / 2 + camera.panX
  const centerY = height * 0.55 + camera.panY

  drawRadiusRings(context, centerX, centerY)
  drawZones(context, centerX, centerY, zones)

  for (const point of cloudPoints) {
    const projected = projectPoint(point.x, point.y, point.z, camera)
    const x = centerX + projected.x
    const y = centerY + projected.y
    if (x < 0 || y < 0 || x > width || y > height) {
      continue
    }
    context.fillStyle =
      colorScale === 'yellow-red'
        ? mixColor('#ffd142', point.priorityColor, point.intensity)
        : mixColor('#f5f5f5', '#1c1c1c', point.intensity)
    context.fillRect(x, y, 2, 2)
  }

  for (const track of tracks) {
    const projected = projectPoint(track.position.x, track.position.y, track.position.z, camera)
    const x = centerX + projected.x
    const y = centerY + projected.y
    const focused = track.trackId === focusedTrackId
    context.beginPath()
    context.arc(x, y, focused ? 7 : 4, 0, Math.PI * 2)
    context.strokeStyle = focused ? '#7cc2ff' : '#ffffff'
    context.lineWidth = focused ? 2.4 : 1
    context.stroke()

    context.fillStyle = '#ffffff'
    context.font = focused ? '12px "Helvetica Neue", sans-serif' : '11px "Helvetica Neue", sans-serif'
    context.fillText(
      `${formatElapsed(track.firstDetectedAt, now)} | Az ${track.distance.azimuthDeg.toFixed(0)} deg`,
      x + 9,
      y - 8,
    )
  }
}

function drawRadiusRings(context: CanvasRenderingContext2D, centerX: number, centerY: number) {
  const rings = [70, 130, 190, 250]
  for (const ring of rings) {
    context.beginPath()
    context.arc(centerX, centerY, ring, 0, Math.PI * 2)
    context.strokeStyle = 'rgba(255,255,255,0.2)'
    context.lineWidth = 1
    context.stroke()
  }
}

function drawZones(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  zones: InterestArea[],
) {
  for (const zone of zones) {
    if (zone.vertices.length < 3) {
      continue
    }
    context.beginPath()
    zone.vertices.forEach((vertex, index) => {
      const x = centerX + vertex.x * 2.5
      const y = centerY + vertex.y * 2.5
      if (index === 0) {
        context.moveTo(x, y)
      } else {
        context.lineTo(x, y)
      }
    })
    context.closePath()
    context.fillStyle = zone.mode === 'opt-out' ? 'rgba(224,33,47,0.18)' : 'rgba(104,176,106,0.18)'
    context.strokeStyle = zone.mode === 'opt-out' ? 'rgba(224,33,47,0.6)' : 'rgba(104,176,106,0.6)'
    context.lineWidth = 1
    context.fill()
    context.stroke()
  }
}

function projectPoint(x: number, y: number, z: number, camera: CameraState) {
  const cosYaw = Math.cos(camera.yaw)
  const sinYaw = Math.sin(camera.yaw)
  const cosPitch = Math.cos(camera.pitch)
  const sinPitch = Math.sin(camera.pitch)

  const x1 = x * cosYaw - y * sinYaw
  const y1 = x * sinYaw + y * cosYaw
  const z1 = z

  const y2 = y1 * cosPitch - z1 * sinPitch
  const z2 = y1 * sinPitch + z1 * cosPitch

  const perspective = camera.zoom / (1 + z2 * 0.02)
  return { x: x1 * perspective, y: y2 * perspective }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function mixColor(from: string, to: string, t: number) {
  const fromRgb = hexToRgb(from)
  const toRgb = hexToRgb(to)
  const r = Math.round(fromRgb.r + (toRgb.r - fromRgb.r) * t)
  const g = Math.round(fromRgb.g + (toRgb.g - fromRgb.g) * t)
  const b = Math.round(fromRgb.b + (toRgb.b - fromRgb.b) * t)
  return `rgb(${r},${g},${b})`
}

function hexToRgb(hex: string) {
  const input = hex.replace('#', '')
  const expanded =
    input.length === 3
      ? input
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : input
  const value = Number.parseInt(expanded, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}
