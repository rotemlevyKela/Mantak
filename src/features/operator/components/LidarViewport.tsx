import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STREAM_LABELS, STREAM_ORDER } from '../../../domain/constants'
import type { StreamId, TrackedObject } from '../../../domain/types'
import lidarSensorImg from '../../../assets/lidar-sensor.png'

interface LidarViewportProps {
  tracks: TrackedObject[]
  focusedTrackId?: string
  now: number
  streamLabel: string
  activeStreamId: StreamId
  colorScale: 'yellow-red' | 'black-white'
  zones: unknown[]
  streamAvailable: boolean
  onFocusResolved: (trackId: string) => void
  onSwitchStream: (streamId: StreamId) => void
}

const VIEWS: Record<StreamId, { yaw: number; pitch: number }> = {
  front: { yaw: 0, pitch: -0.18 },
  right: { yaw: Math.PI * 0.5, pitch: -0.18 },
  back: { yaw: Math.PI, pitch: -0.18 },
  left: { yaw: -Math.PI * 0.5, pitch: -0.18 },
}

const CFG = {
  POINT_SIZE: 1.5,
  CAM_HEIGHT: 5.0,
  CAM_FOV: 75,
  DEPTH: 80,
  ANIM_MS: 1200,
}

const VIEWPORT_WEDGE_ROTATION: Record<StreamId, number> = {
  front: -20,
  right: 70,
  back: 160,
  left: 250,
}

export function LidarViewport({
  tracks,
  focusedTrackId,
  activeStreamId,
  streamAvailable,
  onSwitchStream,
}: LidarViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<SceneState | null>(null)
  const [pointCount, setPointCount] = useState(0)
  const [switching, setSwitching] = useState(false)

  const activeIndex = STREAM_ORDER.indexOf(activeStreamId)
  const leftStream = STREAM_ORDER[(activeIndex + 3) % 4]
  const rightStream = STREAM_ORDER[(activeIndex + 1) % 4]
  const backStream = STREAM_ORDER[(activeIndex + 2) % 4]

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const state = initScene(container, canvas, setPointCount)
    stateRef.current = state

    return () => {
      state.disposed = true
      cancelAnimationFrame(state.animId)
      state.renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    updateMarkers(state, tracks, focusedTrackId)
  }, [tracks, focusedTrackId])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    const view = VIEWS[activeStreamId]
    let d = view.yaw - state.tYaw
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    setSwitching(true)
    smoothAnimate(state, state.tYaw + d, view.pitch)
    const timer = setTimeout(() => setSwitching(false), 200)
    return () => clearTimeout(timer)
  }, [activeStreamId])

  return (
    <div className="viewport-wrap">
      {/* ── Upper: LiDAR stream ── */}
      <div className="viewport-stream" ref={containerRef}>
        <canvas
          className={`viewport-canvas${switching ? ' viewport-canvas--switching' : ''}`}
          ref={canvasRef}
        />
        <div className="viewport-scanline-bar" />

        <div className="viewport-stream-label">
          {STREAM_LABELS[activeStreamId]}
          {tracks.length > 0 && (
            <span className="viewport-stream-count"> — {tracks.length} detection{tracks.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="viewport-stats">
          {pointCount > 0 && `${(pointCount / 1000).toFixed(0)}K pts`}
        </div>

        {!streamAvailable && (
          <div className="offline-banner">
            <div className="offline-inner">
              <strong>Stream unavailable</strong>
              <div className="muted">Choose another LiDAR stream from the sidebar or navigation buttons.</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Lower: Vehicle controller ── */}
      <div className="viewport-controls">
        <button
          className="nav-goto nav-goto-left"
          type="button"
          onClick={() => onSwitchStream(leftStream)}
        >
          <svg className="nav-goto-arrow nav-goto-arrow--flip" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span>{STREAM_LABELS[leftStream]}</span>
        </button>

        <div className="compass-line compass-line--left" />

        <div className="nav-compass">
          <div className="compass-north">N</div>

          <svg viewBox="0 0 200 200" className="compass-svg">
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
            <line x1="100" y1="8" x2="100" y2="16" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
            <line x1="192" y1="100" x2="184" y2="100" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
            <line x1="100" y1="192" x2="100" y2="184" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
            <line x1="8" y1="100" x2="16" y2="100" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />

            <g
              className="compass-wedge-group"
              style={{ transform: `rotate(${VIEWPORT_WEDGE_ROTATION[activeStreamId]}deg)`, transformOrigin: '100px 100px' }}
            >
              <path d="M100,100 L120,30 A75,75 0 0,0 100,25 Z" fill="rgba(200,30,30,0.6)" />
              <path d="M100,100 L120,30 A75,75 0 0,0 100,25 Z" fill="none" stroke="rgba(255,60,60,0.4)" strokeWidth="0.5" />
            </g>

            <image href={lidarSensorImg} x="75" y="72" width="50" height="60" preserveAspectRatio="xMidYMid meet" />
          </svg>
        </div>

        <div className="compass-line compass-line--right" />

        <button
          className="nav-goto nav-goto-right"
          type="button"
          onClick={() => onSwitchStream(rightStream)}
        >
          <span>{STREAM_LABELS[rightStream]}</span>
          <svg className="nav-goto-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <button
          className="nav-goto nav-goto-back"
          type="button"
          onClick={() => onSwitchStream(backStream)}
        >
          <svg className="nav-goto-arrow nav-goto-arrow--down" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span>{STREAM_LABELS[backStream]}</span>
        </button>
      </div>
    </div>
  )
}

/* ================================================================
   Three.js scene — ported from lidar-scene.js
   ================================================================ */

interface MarkerMesh {
  ring: THREE.Mesh
  trackId: string
}

interface SceneState {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  yaw: number
  pitch: number
  tYaw: number
  tPitch: number
  animating: boolean
  animId: number
  disposed: boolean
  container: HTMLElement
  markers: MarkerMesh[]
  markerGroup: THREE.Group
}

function initScene(container: HTMLElement, canvas: HTMLCanvasElement, onPointCount?: (n: number) => void): SceneState {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  const camera = new THREE.PerspectiveCamera(
    CFG.CAM_FOV,
    container.clientWidth / container.clientHeight,
    0.1,
    250,
  )
  camera.position.set(0, CFG.CAM_HEIGHT, 0)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const markerGroup = new THREE.Group()
  scene.add(markerGroup)

  const view = VIEWS.front
  const state: SceneState = {
    scene,
    camera,
    renderer,
    yaw: view.yaw,
    pitch: view.pitch,
    tYaw: view.yaw,
    tPitch: view.pitch,
    animating: false,
    animId: 0,
    disposed: false,
    container,
    markers: [],
    markerGroup,
  }

  const count = buildPointCloud(scene)
  if (onPointCount) onPointCount(count)
  updateCamera(state)

  const onResize = () => {
    if (state.disposed) return
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  window.addEventListener('resize', onResize)

  const loop = () => {
    if (state.disposed) return
    state.yaw += (state.tYaw - state.yaw) * 0.07
    state.pitch += (state.tPitch - state.pitch) * 0.07
    updateCamera(state)
    renderer.render(scene, camera)
    state.animId = requestAnimationFrame(loop)
  }
  state.animId = requestAnimationFrame(loop)

  return state
}

function updateCamera(state: SceneState) {
  const { camera, yaw, pitch } = state
  camera.lookAt(
    Math.sin(yaw) * Math.cos(pitch) * 10,
    CFG.CAM_HEIGHT + Math.sin(pitch) * 10,
    -Math.cos(yaw) * Math.cos(pitch) * 10,
  )
}

function smoothAnimate(state: SceneState, ny: number, np: number) {
  if (state.animating) return
  state.animating = true
  const sy = state.tYaw
  const sp = state.tPitch
  const start = performance.now()
  const step = (now: number) => {
    let t = Math.min((now - start) / CFG.ANIM_MS, 1)
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    state.tYaw = sy + (ny - sy) * e
    state.tPitch = sp + (np - sp) * e
    if (t < 1) {
      requestAnimationFrame(step)
    } else {
      state.animating = false
    }
  }
  requestAnimationFrame(step)
}

/* ── Detection markers ── */

const PRIORITY_COLOR_MAP: Record<string, number> = {
  critical: 0xe0212f,
  high: 0xff7a1a,
  medium: 0xf2cf52,
  low: 0x68b06a,
}

const markerGeometry = new THREE.RingGeometry(0.6, 0.9, 16)
const markerFocusGeometry = new THREE.RingGeometry(0.8, 1.2, 20)

function getMarkerMaterial(priority: string, focused: boolean): THREE.MeshBasicMaterial {
  const color = PRIORITY_COLOR_MAP[priority] ?? 0xffffff
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: focused ? 0.95 : 0.55,
    side: THREE.DoubleSide,
    depthTest: false,
  })
}

function updateMarkers(state: SceneState, tracks: TrackedObject[], focusedTrackId?: string) {
  for (const m of state.markers) {
    state.markerGroup.remove(m.ring)
    m.ring.geometry.dispose()
    ;(m.ring.material as THREE.Material).dispose()
  }
  state.markers = []

  for (const track of tracks) {
    const focused = track.trackId === focusedTrackId
    const geo = focused ? markerFocusGeometry : markerGeometry
    const mat = getMarkerMaterial(
      guessTrackPriority(track),
      focused,
    )
    const ring = new THREE.Mesh(geo, mat)
    ring.position.set(track.position.x, 0.15, track.position.z)
    ring.rotation.x = -Math.PI / 2
    state.markerGroup.add(ring)
    state.markers.push({ ring, trackId: track.trackId })
  }
}

function guessTrackPriority(track: TrackedObject): string {
  if (track.velocityMps > 10) return 'critical'
  if (track.velocityMps > 5) return 'high'
  if (track.motionState === 'dynamic') return 'medium'
  return 'low'
}

/* ── Point cloud generation ── */

function ptColor(y: number, dist: number, refl: number): [number, number, number] {
  const t = Math.min(Math.max(y, 0) / 11, 1)
  let r: number, g: number, b: number
  if (t < 0.04) {
    r = 0.80 + refl * 0.20; g = 0.70 + refl * 0.22; b = 0.0
  } else if (t < 0.13) {
    const s = (t - 0.04) / 0.09; r = 1.0; g = 0.62 - s * 0.14; b = 0.0
  } else if (t < 0.30) {
    const s = (t - 0.13) / 0.17; r = 1.0 - s * 0.06; g = 0.48 - s * 0.20; b = 0.0
  } else if (t < 0.55) {
    const s = (t - 0.30) / 0.25; r = 0.94 - s * 0.24; g = 0.28 - s * 0.14; b = 0.0
  } else {
    const s = Math.min((t - 0.55) / 0.45, 1); r = 0.70 - s * 0.40; g = 0.14 - s * 0.11; b = 0.0
  }
  const df = Math.max(0.28, 1.0 - (dist / CFG.DEPTH) * 0.55)
  const rf = 0.65 + refl * 0.35
  return [r * df * rf, g * df * rf, b * df * rf]
}

function addBox(
  cx: number, cy: number, cz: number,
  w: number, h: number, d: number,
  n: number, P: number[], C: number[],
) {
  for (let i = 0; i < n; i++) {
    const f = Math.floor(Math.random() * 6)
    let x: number, y: number, z: number
    switch (f) {
      case 0: x = cx + w / 2; y = cy + Math.random() * h; z = cz + (Math.random() - 0.5) * d; break
      case 1: x = cx - w / 2; y = cy + Math.random() * h; z = cz + (Math.random() - 0.5) * d; break
      case 2: x = cx + (Math.random() - 0.5) * w; y = cy + h; z = cz + (Math.random() - 0.5) * d; break
      case 3: x = cx + (Math.random() - 0.5) * w; y = cy; z = cz + (Math.random() - 0.5) * d; break
      case 4: x = cx + (Math.random() - 0.5) * w; y = cy + Math.random() * h; z = cz + d / 2; break
      default: x = cx + (Math.random() - 0.5) * w; y = cy + Math.random() * h; z = cz - d / 2
    }
    x += (Math.random() - 0.5) * 0.03; y += (Math.random() - 0.5) * 0.03; z += (Math.random() - 0.5) * 0.03
    const dist = Math.sqrt(x * x + z * z)
    const c = ptColor(y, dist, 0.6 + Math.random() * 0.4)
    P.push(x, y, z); C.push(c[0], c[1], c[2])
  }
}

function addTree(tx: number, tz: number, tr: number, th: number, n: number, P: number[], C: number[]) {
  for (let i = 0; i < n; i++) {
    const trH = th * 0.28
    const trunk = Math.random() < 0.05
    let x: number, y: number, z: number
    if (trunk) {
      x = tx + (Math.random() - 0.5) * 0.2; y = Math.random() * trH; z = tz + (Math.random() - 0.5) * 0.2
    } else {
      const phi = Math.random() * Math.PI * 2
      const theta = Math.random() * Math.PI * 0.5
      const rad = tr * (0.25 + Math.random() * 0.75)
      x = tx + Math.sin(phi) * Math.sin(theta) * rad
      y = trH + Math.cos(theta) * tr * 0.7 + Math.random() * 1.5
      z = tz + Math.cos(phi) * Math.sin(theta) * rad
    }
    const d = Math.sqrt(x * x + z * z)
    const c = ptColor(y, d, 0.25 + Math.random() * 0.35)
    P.push(x, y, z); C.push(c[0], c[1], c[2])
  }
}

function addPole(px: number, pz: number, ph: number, n: number, P: number[], C: number[]) {
  for (let i = 0; i < n; i++) {
    const x = px + (Math.random() - 0.5) * 0.1
    const y = Math.random() * ph
    const z = pz + (Math.random() - 0.5) * 0.1
    const d = Math.sqrt(x * x + z * z)
    const c = ptColor(y, d, 0.55)
    P.push(x, y, z); C.push(c[0], c[1], c[2])
  }
}

function addFenceLine(x0: number, z0: number, dx: number, dz: number, n: number, P: number[], C: number[]) {
  for (let i = 0; i < n; i++) {
    const t = Math.random()
    const x = x0 + dx * t + (Math.random() - 0.5) * 0.12
    const z = z0 + dz * t + (Math.random() - 0.5) * 0.12
    const y = Math.random() * 2.2
    const d = Math.sqrt(x * x + z * z)
    const c = ptColor(y, d, 0.45 + Math.random() * 0.25)
    P.push(x, y, z); C.push(c[0], c[1], c[2])
  }
}

function addGround360(P: number[], C: number[]) {
  for (let i = 0; i < 1800000; i++) {
    const a = Math.random() * Math.PI * 2
    const d = Math.pow(Math.random(), 0.45) * CFG.DEPTH
    const x = Math.sin(a) * d
    const z = Math.cos(a) * d
    const y = (Math.random() - 0.5) * 0.04
    const rf = d < 5 ? 0.85 + Math.random() * 0.15 : 0.45 + Math.random() * 0.55
    const c = ptColor(Math.max(y, 0), d, rf)
    P.push(x, y, z); C.push(c[0], c[1], c[2])
  }

  addCurb360(P, C)
}

function addCurb360(P: number[], C: number[]) {
  for (let side = 0; side < 4; side++) {
    const angle = (side * Math.PI) / 2
    for (let i = 0; i < 30000; i++) {
      const along = (Math.random() - 0.5) * CFG.DEPTH * 1.6
      const across = 5.5 + (Math.random() - 0.5) * 0.3
      const y = 0.08 + Math.random() * 0.12
      const x = Math.cos(angle) * across + Math.sin(angle) * along
      const z = Math.sin(angle) * across - Math.cos(angle) * along
      const d = Math.sqrt(x * x + z * z)
      const c = ptColor(y, d, 0.7 + Math.random() * 0.2)
      P.push(x, y, z); C.push(c[0], c[1], c[2])
    }
  }
}

function addFrontQuadrant(P: number[], C: number[]) {
  const cars: [number, number, number, number, number][] = [
    [-12, -10, 4.2, 1.5, 1.9], [-8, -14, 4.0, 1.5, 1.8],
    [-4, -18, 4.5, 1.6, 2.0], [0, -11, 4.0, 1.4, 1.8],
    [5, -9, 4.3, 1.5, 1.9], [10, -16, 4.0, 1.6, 1.9],
    [15, -12, 3.8, 1.4, 1.8], [-16, -8, 4.1, 1.5, 1.9],
    [18, -20, 4.0, 1.5, 1.8], [-20, -22, 3.8, 1.5, 1.8],
    [8, -25, 4.2, 1.4, 1.9], [-10, -28, 3.9, 1.5, 1.8],
    [-30, -15, 4.0, 1.5, 1.8], [28, -18, 3.8, 1.4, 1.9],
    [-35, -25, 4.2, 1.5, 2.0], [32, -22, 4.0, 1.6, 1.8],
  ]
  for (const c of cars) addBox(c[0], 0, c[1], c[2], c[3], c[4], 18000, P, C)

  for (let i = 0; i < 100000; i++) {
    const lane = Math.floor(Math.random() * 4)
    const z = -6 - lane * 5 + (Math.random() - 0.5) * 0.3
    const x = (Math.random() - 0.5) * 80
    P.push(x, 0.01, z)
    C.push(0.85 + Math.random() * 0.1, 0.78 + Math.random() * 0.08, 0.0)
  }

  addBox(-22, 0, -35, 10, 4.5, 7, 35000, P, C)
  addBox(20, 0, -38, 8, 4, 6, 25000, P, C)
  addBox(-5, 0, -45, 12, 5.5, 8, 45000, P, C)
  addBox(28, 0, -48, 7, 3.5, 5, 20000, P, C)
  addBox(-38, 0, -28, 6, 3.5, 5, 20000, P, C)
  addBox(38, 0, -30, 5, 3, 4, 15000, P, C)
  addBox(-45, 0, -40, 8, 4, 6, 25000, P, C)
  addBox(42, 0, -42, 6, 3, 5, 18000, P, C)

  addFenceLine(-40, -6, 0, -50, 35000, P, C)
  addFenceLine(40, -6, 0, -50, 35000, P, C)

  addTree(-35, -35, 4, 9, 12000, P, C)
  addTree(35, -32, 3.5, 8, 10000, P, C)
  addTree(-25, -50, 3.5, 7, 10000, P, C)
  addTree(18, -55, 4, 8, 10000, P, C)
  addTree(-50, -20, 3, 7, 10000, P, C)
  addTree(48, -25, 3, 6, 8000, P, C)
  addTree(-48, -45, 3.5, 8, 10000, P, C)
  addTree(45, -48, 3, 7, 8000, P, C)

  addPole(-25, -8, 7, 4000, P, C)
  addPole(0, -22, 8, 4500, P, C)
  addPole(25, -12, 7, 4000, P, C)
  addPole(-15, -40, 7, 4000, P, C)
  addPole(18, -42, 7, 4000, P, C)
  addPole(-40, -15, 6, 3500, P, C)
  addPole(40, -18, 6, 3500, P, C)
}

function addRightQuadrant(P: number[], C: number[]) {
  addBox(18, 0, 0, 10, 4.5, 6, 60000, P, C)
  addBox(30, 0, -8, 8, 4, 6, 45000, P, C)
  addBox(24, 0, 12, 6, 3.5, 5, 30000, P, C)
  addBox(38, 0, 5, 5, 3, 4, 20000, P, C)
  addBox(42, 0, -15, 7, 3.5, 5, 25000, P, C)
  addBox(15, 0, -3, 3, 3, 2, 14000, P, C)
  addBox(50, 0, 0, 8, 4, 6, 30000, P, C)
  addBox(45, 0, 18, 6, 3.5, 5, 22000, P, C)
  addBox(35, 0, -22, 5, 3, 4, 18000, P, C)
  addBox(55, 0, -10, 6, 3, 5, 20000, P, C)

  for (let i = 0; i < 60000; i++) {
    const lane = Math.floor(Math.random() * 3)
    const x = 8 + lane * 5 + (Math.random() - 0.5) * 0.3
    const z = (Math.random() - 0.5) * 70
    P.push(x, 0.01, z)
    C.push(0.85 + Math.random() * 0.1, 0.78 + Math.random() * 0.08, 0.0)
  }

  addFenceLine(12, -30, 0, 60, 35000, P, C)
  addFenceLine(12, 25, 50, 0, 28000, P, C)

  addTree(50, 5, 3.5, 8, 12000, P, C)
  addTree(48, -18, 4, 9, 12000, P, C)
  addTree(42, 20, 3.5, 7, 10000, P, C)
  addTree(55, -25, 3, 7, 10000, P, C)
  addTree(60, 12, 3, 6, 8000, P, C)
  addTree(38, -30, 3.5, 8, 10000, P, C)

  addPole(15, 0, 6, 4000, P, C)
  addPole(28, -15, 6, 4000, P, C)
  addPole(35, 10, 6, 4000, P, C)
  addPole(22, 20, 7, 4000, P, C)
  addPole(45, -20, 6, 3500, P, C)
  addPole(40, 25, 6, 3500, P, C)
}

function addLeftQuadrant(P: number[], C: number[]) {
  const trees: [number, number, number, number][] = [
    [-14, -8, 3.5, 7], [-18, 4, 4, 8], [-22, -5, 4.2, 9],
    [-26, 8, 4, 8], [-30, -3, 3.8, 9], [-34, 10, 3.5, 8],
    [-15, 12, 4, 9], [-20, -12, 3.5, 7], [-25, 15, 4.5, 10],
    [-32, -10, 4, 8], [-38, 3, 3.8, 7], [-36, 14, 3.5, 7],
    [-40, -15, 3, 6], [-44, 8, 3.5, 7], [-42, -8, 4, 8],
    [-16, 18, 3.5, 7], [-28, 12, 4, 8],
    [-48, 0, 3, 7], [-52, -10, 3.5, 8], [-50, 12, 3, 6],
    [-55, -5, 3.5, 7], [-46, 20, 3, 6], [-58, 5, 3, 7],
  ]
  for (const t of trees) addTree(t[0], t[1], t[2], t[3], 12000, P, C)

  addFenceLine(-60, -25, 0, 50, 40000, P, C)
  addBox(-62, 0, -25, 1.5, 3.5, 50, 45000, P, C)

  addBox(-25, 0, -5, 6, 3.5, 5, 22000, P, C)
  addBox(-35, 0, 8, 5, 3, 4, 16000, P, C)
  addBox(-45, 0, -12, 7, 4, 5, 25000, P, C)

  for (let i = 0; i < 40000; i++) {
    const lane = Math.floor(Math.random() * 3)
    const x = -8 - lane * 5 + (Math.random() - 0.5) * 0.3
    const z = (Math.random() - 0.5) * 60
    P.push(x, 0.01, z)
    C.push(0.6 + Math.random() * 0.15, 0.55 + Math.random() * 0.1, 0.0)
  }

  addPole(-13, -15, 7, 4000, P, C)
  addPole(-20, 18, 7, 4000, P, C)
  addPole(-35, -18, 7, 4000, P, C)
  addPole(-28, 20, 7, 4000, P, C)
  addPole(-45, 0, 6, 3500, P, C)
  addPole(-50, -15, 6, 3500, P, C)
}

function addBackQuadrant(P: number[], C: number[]) {
  for (let i = 0; i < 80000; i++) {
    const x = (Math.random() - 0.5) * 70
    const z = 8 + Math.random() * 40
    P.push(x, 0.01, z)
    C.push(0.7 + Math.random() * 0.15, 0.6 + Math.random() * 0.1, 0.0)
  }

  addBox(-4, 0, 14, 12, 3.5, 2, 40000, P, C)
  addBox(5, 0, 14, 2, 4, 2, 14000, P, C)
  addBox(-5, 0, 14, 2, 4, 2, 14000, P, C)

  addBox(20, 0, 28, 8, 4, 6, 30000, P, C)
  addBox(-18, 0, 32, 7, 3.5, 5, 25000, P, C)
  addBox(8, 0, 42, 10, 4.5, 7, 35000, P, C)
  addBox(-12, 0, 48, 6, 4, 4, 20000, P, C)
  addBox(-35, 0, 22, 6, 3, 5, 18000, P, C)
  addBox(35, 0, 25, 5, 3.5, 4, 16000, P, C)
  addBox(-42, 0, 35, 7, 3.5, 5, 22000, P, C)
  addBox(42, 0, 38, 6, 3, 5, 18000, P, C)

  addFenceLine(-35, 10, 70, 0, 35000, P, C)

  addTree(28, 22, 3.5, 8, 12000, P, C)
  addTree(-28, 25, 4, 9, 12000, P, C)
  addTree(22, 40, 3, 7, 10000, P, C)
  addTree(-22, 42, 3.5, 8, 10000, P, C)
  addTree(40, 18, 3, 7, 10000, P, C)
  addTree(-40, 20, 3, 6, 8000, P, C)
  addTree(48, 30, 3, 6, 8000, P, C)
  addTree(-48, 28, 3.5, 7, 8000, P, C)

  addPole(-25, 14, 7, 4000, P, C)
  addPole(-15, 24, 7, 4000, P, C)
  addPole(0, 32, 8, 4500, P, C)
  addPole(15, 26, 7, 4000, P, C)
  addPole(25, 16, 7, 4000, P, C)
  addPole(-8, 42, 6, 3500, P, C)
  addPole(10, 40, 6, 3500, P, C)
  addPole(-40, 18, 6, 3500, P, C)
  addPole(40, 20, 6, 3500, P, C)
}

function buildPointCloud(scene: THREE.Scene): number {
  const P: number[] = []
  const C: number[] = []

  addGround360(P, C)
  addFrontQuadrant(P, C)
  addRightQuadrant(P, C)
  addLeftQuadrant(P, C)
  addBackQuadrant(P, C)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))

  const material = new THREE.PointsMaterial({
    size: CFG.POINT_SIZE,
    sizeAttenuation: false,
    vertexColors: true,
    depthWrite: true,
  })

  scene.add(new THREE.Points(geometry, material))
  return P.length / 3
}
