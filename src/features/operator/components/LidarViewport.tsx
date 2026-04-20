import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STREAM_LABELS } from '../../../domain/constants'
import type { StreamId, TrackedObject } from '../../../domain/types'
import { LidarNavWidget } from './LidarNavWidget'

interface LidarViewportProps {
  tracks: TrackedObject[]
  focusedTrackId?: string
  activeStreamId: StreamId
  variant?: 'hero' | 'inset'
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
  LOOK_DIST: 10,
  ZOOM_MIN: 4,
  ZOOM_MAX: 18,
}

interface MarkerMesh { ring: THREE.Mesh; trackId: string }
interface TrailLine { line: THREE.Line; trackId: string }

interface SceneState {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  yaw: number
  pitch: number
  tYaw: number
  tPitch: number
  lookOffset: THREE.Vector3
  zoom: number
  tZoom: number
  animating: boolean
  animId: number
  disposed: boolean
  container: HTMLElement
  markers: MarkerMesh[]
  trails: TrailLine[]
  markerGroup: THREE.Group
  trailGroup: THREE.Group
}

export function LidarViewport({ tracks, focusedTrackId, activeStreamId, variant = 'hero' }: LidarViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<SceneState | null>(null)
  const manuallyAdjustedRef = useRef(false)
  const [switching, setSwitching] = useState(false)
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)

  const nudgeYaw = useCallback((delta: number) => {
    const state = stateRef.current
    if (!state) return
    state.tYaw += delta
    manuallyAdjustedRef.current = true
    setManuallyAdjusted(true)
  }, [])
  const nudgePitch = useCallback((delta: number) => {
    const state = stateRef.current
    if (!state) return
    state.tPitch = Math.max(-0.9, Math.min(0.9, state.tPitch + delta))
    manuallyAdjustedRef.current = true
    setManuallyAdjusted(true)
  }, [])
  const nudgeZoom = useCallback((factor: number) => {
    const state = stateRef.current
    if (!state) return
    state.tZoom = Math.max(CFG.ZOOM_MIN, Math.min(CFG.ZOOM_MAX, state.tZoom * factor))
    manuallyAdjustedRef.current = true
    setManuallyAdjusted(true)
  }, [])
  const resetView = useCallback(() => {
    const state = stateRef.current
    if (!state) return
    const view = VIEWS[activeStreamId]
    state.tYaw = view.yaw
    state.tPitch = view.pitch
    state.tZoom = CFG.LOOK_DIST
    state.lookOffset.set(0, 0, 0)
    manuallyAdjustedRef.current = false
    setManuallyAdjusted(false)
  }, [activeStreamId])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const state = initScene(container, canvas)
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
    updateTrails(state, tracks)
  }, [tracks, focusedTrackId])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    if (manuallyAdjustedRef.current) return
    const view = VIEWS[activeStreamId]
    let d = view.yaw - state.tYaw
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    setSwitching(true)
    smoothAnimate(state, state.tYaw + d, view.pitch)
    const timer = setTimeout(() => setSwitching(false), 200)
    return () => clearTimeout(timer)
  }, [activeStreamId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || variant !== 'hero') return

    let dragging = false
    let panning = false
    let lastX = 0
    let lastY = 0

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging = true
      panning = e.shiftKey
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = panning ? 'grabbing' : 'move'
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const state = stateRef.current
      if (!state) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      if (panning) {
        const right = new THREE.Vector3(Math.cos(state.tYaw), 0, Math.sin(state.tYaw))
        const up = new THREE.Vector3(0, 1, 0)
        state.lookOffset.addScaledVector(right, -dx * 0.04)
        state.lookOffset.addScaledVector(up, dy * 0.04)
      } else {
        state.tYaw -= dx * 0.005
        state.tPitch = Math.max(-0.9, Math.min(0.9, state.tPitch - dy * 0.004))
      }
      manuallyAdjustedRef.current = true
      setManuallyAdjusted(true)
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      panning = false
      canvas.style.cursor = ''
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const state = stateRef.current
      if (!state) return
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1
      state.tZoom = Math.max(CFG.ZOOM_MIN, Math.min(CFG.ZOOM_MAX, state.tZoom * factor))
      manuallyAdjustedRef.current = true
      setManuallyAdjusted(true)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [variant])

  const insetLabel = STREAM_LABELS[activeStreamId].replace(/ Side$/i, ' View')

  return (
    <div className={`t-viewport t-viewport--${variant}`} ref={containerRef}>
      <canvas
        className={`t-viewport-canvas${switching ? ' t-viewport-canvas--switching' : ''}`}
        ref={canvasRef}
      />
      <div className="t-viewport-scanline" />
      {variant === 'inset' && (
        <div className="t-viewport-inset-caption">{insetLabel}</div>
      )}
      {variant === 'hero' && (
        <LidarNavWidget
          open={controlsOpen}
          onToggle={() => setControlsOpen((o) => !o)}
          onYaw={nudgeYaw}
          onPitch={nudgePitch}
          onZoom={nudgeZoom}
          onReset={resetView}
        />
      )}
      {variant === 'hero' && manuallyAdjusted && !controlsOpen && (
        <button type="button" className="t-viewport-reset" onClick={resetView}>
          Reset view
        </button>
      )}
    </div>
  )
}

/* ================================================================
   Three.js scene
   ================================================================ */

function initScene(container: HTMLElement, canvas: HTMLCanvasElement): SceneState {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const camera = new THREE.PerspectiveCamera(CFG.CAM_FOV, container.clientWidth / container.clientHeight, 0.1, 250)
  camera.position.set(0, CFG.CAM_HEIGHT, 0)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const markerGroup = new THREE.Group()
  scene.add(markerGroup)
  const trailGroup = new THREE.Group()
  scene.add(trailGroup)

  const view = VIEWS.front
  const state: SceneState = {
    scene, camera, renderer,
    yaw: view.yaw, pitch: view.pitch, tYaw: view.yaw, tPitch: view.pitch,
    lookOffset: new THREE.Vector3(0, 0, 0),
    zoom: CFG.LOOK_DIST, tZoom: CFG.LOOK_DIST,
    animating: false, animId: 0, disposed: false, container,
    markers: [], trails: [], markerGroup, trailGroup,
  }

  buildPointCloud(scene)
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
    state.zoom += (state.tZoom - state.zoom) * 0.12
    updateCamera(state)
    renderer.render(scene, camera)
    state.animId = requestAnimationFrame(loop)
  }
  state.animId = requestAnimationFrame(loop)
  return state
}

function updateCamera(state: SceneState) {
  const { camera, yaw, pitch, zoom, lookOffset } = state
  camera.position.set(lookOffset.x, CFG.CAM_HEIGHT + lookOffset.y, lookOffset.z)
  camera.lookAt(
    lookOffset.x + Math.sin(yaw) * Math.cos(pitch) * zoom,
    CFG.CAM_HEIGHT + lookOffset.y + Math.sin(pitch) * zoom,
    lookOffset.z - Math.cos(yaw) * Math.cos(pitch) * zoom,
  )
}

function smoothAnimate(state: SceneState, ny: number, np: number) {
  if (state.animating) return
  state.animating = true
  const sy = state.tYaw, sp = state.tPitch
  const start = performance.now()
  const step = (now: number) => {
    let t = Math.min((now - start) / CFG.ANIM_MS, 1)
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    state.tYaw = sy + (ny - sy) * e
    state.tPitch = sp + (np - sp) * e
    if (t < 1) requestAnimationFrame(step)
    else state.animating = false
  }
  requestAnimationFrame(step)
}

/* ── Detection markers ── */

const PRIORITY_COLOR_MAP: Record<string, number> = {
  critical: 0xe0212f, high: 0xff7a1a, medium: 0xf2cf52, low: 0x68b06a,
}
const markerGeo = new THREE.RingGeometry(0.6, 0.9, 16)
const markerFocusGeo = new THREE.RingGeometry(0.8, 1.2, 20)

function getMarkerMat(priority: string, focused: boolean): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: PRIORITY_COLOR_MAP[priority] ?? 0xffffff,
    transparent: true, opacity: focused ? 0.95 : 0.55,
    side: THREE.DoubleSide, depthTest: false,
  })
}

function guessTrackPriority(track: TrackedObject): string {
  if (track.velocityMps > 10) return 'critical'
  if (track.velocityMps > 5) return 'high'
  if (track.motionState === 'dynamic') return 'medium'
  return 'low'
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
    const ring = new THREE.Mesh(
      focused ? markerFocusGeo : markerGeo,
      getMarkerMat(guessTrackPriority(track), focused),
    )
    ring.position.set(track.position.x, 0.15, track.position.z)
    ring.rotation.x = -Math.PI / 2
    state.markerGroup.add(ring)
    state.markers.push({ ring, trackId: track.trackId })
  }
}

function updateTrails(state: SceneState, tracks: TrackedObject[]) {
  for (const t of state.trails) {
    state.trailGroup.remove(t.line)
    t.line.geometry.dispose()
    ;(t.line.material as THREE.Material).dispose()
  }
  state.trails = []
  for (const track of tracks) {
    const trail = track.trail
    if (!trail || trail.length < 2) continue
    const positions = new Float32Array(trail.length * 3)
    const colors = new Float32Array(trail.length * 3)
    const flags = track.flags
    const color = flags?.fastApproaching
      ? [0.94, 0.26, 0.26]
      : flags?.drone
        ? [0.55, 0.36, 0.96]
        : flags?.loitering
          ? [0.96, 0.62, 0.11]
          : [0.94, 0.26, 0.26]
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i]
      positions[i * 3] = p.x
      positions[i * 3 + 1] = 0.18
      positions[i * 3 + 2] = p.z
      const a = 0.1 + 0.75 * (i / Math.max(1, trail.length - 1))
      colors[i * 3] = color[0] * a
      colors[i * 3 + 1] = color[1] * a
      colors[i * 3 + 2] = color[2] * a
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false,
    })
    const line = new THREE.Line(geo, mat)
    state.trailGroup.add(line)
    state.trails.push({ line, trackId: track.trackId })
  }
}

/* ── Point cloud generation (360°) ── */

function ptColor(y: number, dist: number, refl: number): [number, number, number] {
  const t = Math.min(Math.max(y, 0) / 11, 1)
  let r: number, g: number, b: number
  if (t < 0.04) { r = 0.80 + refl * 0.20; g = 0.70 + refl * 0.22; b = 0.0 }
  else if (t < 0.13) { const s = (t - 0.04) / 0.09; r = 1.0; g = 0.62 - s * 0.14; b = 0.0 }
  else if (t < 0.30) { const s = (t - 0.13) / 0.17; r = 1.0 - s * 0.06; g = 0.48 - s * 0.20; b = 0.0 }
  else if (t < 0.55) { const s = (t - 0.30) / 0.25; r = 0.94 - s * 0.24; g = 0.28 - s * 0.14; b = 0.0 }
  else { const s = Math.min((t - 0.55) / 0.45, 1); r = 0.70 - s * 0.40; g = 0.14 - s * 0.11; b = 0.0 }
  const df = Math.max(0.28, 1.0 - (dist / CFG.DEPTH) * 0.55)
  const rf = 0.65 + refl * 0.35
  return [r * df * rf, g * df * rf, b * df * rf]
}

function addBox(cx: number, cy: number, cz: number, w: number, h: number, d: number, n: number, P: number[], C: number[]) {
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
    if (trunk) { x = tx + (Math.random() - 0.5) * 0.2; y = Math.random() * trH; z = tz + (Math.random() - 0.5) * 0.2 }
    else {
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
    const x = px + (Math.random() - 0.5) * 0.1, y = Math.random() * ph, z = pz + (Math.random() - 0.5) * 0.1
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
    const x = Math.sin(a) * d, z = Math.cos(a) * d
    const y = (Math.random() - 0.5) * 0.04
    const rf = d < 5 ? 0.85 + Math.random() * 0.15 : 0.45 + Math.random() * 0.55
    const c = ptColor(Math.max(y, 0), d, rf)
    P.push(x, y, z); C.push(c[0], c[1], c[2])
  }
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
    [-12, -10, 4.2, 1.5, 1.9], [-8, -14, 4.0, 1.5, 1.8], [-4, -18, 4.5, 1.6, 2.0],
    [0, -11, 4.0, 1.4, 1.8], [5, -9, 4.3, 1.5, 1.9], [10, -16, 4.0, 1.6, 1.9],
    [15, -12, 3.8, 1.4, 1.8], [-16, -8, 4.1, 1.5, 1.9], [18, -20, 4.0, 1.5, 1.8],
    [-20, -22, 3.8, 1.5, 1.8], [8, -25, 4.2, 1.4, 1.9], [-10, -28, 3.9, 1.5, 1.8],
  ]
  for (const c of cars) addBox(c[0], 0, c[1], c[2], c[3], c[4], 18000, P, C)
  addBox(-22, 0, -35, 10, 4.5, 7, 35000, P, C)
  addBox(20, 0, -38, 8, 4, 6, 25000, P, C)
  addBox(-5, 0, -45, 12, 5.5, 8, 45000, P, C)
  addFenceLine(-40, -6, 0, -50, 35000, P, C)
  addFenceLine(40, -6, 0, -50, 35000, P, C)
  addTree(-35, -35, 4, 9, 12000, P, C); addTree(35, -32, 3.5, 8, 10000, P, C)
  addTree(-25, -50, 3.5, 7, 10000, P, C); addTree(18, -55, 4, 8, 10000, P, C)
  addPole(-25, -8, 7, 4000, P, C); addPole(0, -22, 8, 4500, P, C); addPole(25, -12, 7, 4000, P, C)
}

function addRightQuadrant(P: number[], C: number[]) {
  addBox(18, 0, 0, 10, 4.5, 6, 50000, P, C)
  addBox(30, 0, -8, 8, 4, 6, 40000, P, C)
  addBox(24, 0, 12, 6, 3.5, 5, 25000, P, C)
  addBox(42, 0, -15, 7, 3.5, 5, 22000, P, C)
  addFenceLine(12, -30, 0, 60, 30000, P, C)
  addTree(50, 5, 3.5, 8, 10000, P, C); addTree(48, -18, 4, 9, 10000, P, C)
  addTree(42, 20, 3.5, 7, 8000, P, C)
  addPole(15, 0, 6, 3500, P, C); addPole(28, -15, 6, 3500, P, C); addPole(35, 10, 6, 3500, P, C)
}

function addLeftQuadrant(P: number[], C: number[]) {
  const trees: [number, number, number, number][] = [
    [-14, -8, 3.5, 7], [-18, 4, 4, 8], [-22, -5, 4.2, 9], [-26, 8, 4, 8],
    [-30, -3, 3.8, 9], [-34, 10, 3.5, 8], [-15, 12, 4, 9], [-20, -12, 3.5, 7],
    [-40, -15, 3, 6], [-44, 8, 3.5, 7], [-42, -8, 4, 8], [-48, 0, 3, 7],
  ]
  for (const t of trees) addTree(t[0], t[1], t[2], t[3], 10000, P, C)
  addFenceLine(-60, -25, 0, 50, 35000, P, C)
  addBox(-25, 0, -5, 6, 3.5, 5, 20000, P, C)
  addBox(-35, 0, 8, 5, 3, 4, 14000, P, C)
  addBox(-45, 0, -12, 7, 4, 5, 22000, P, C)
  addPole(-13, -15, 7, 3500, P, C); addPole(-20, 18, 7, 3500, P, C); addPole(-35, -18, 7, 3500, P, C)
}

function addBackQuadrant(P: number[], C: number[]) {
  addBox(-4, 0, 14, 12, 3.5, 2, 35000, P, C)
  addBox(20, 0, 28, 8, 4, 6, 25000, P, C)
  addBox(-18, 0, 32, 7, 3.5, 5, 22000, P, C)
  addBox(8, 0, 42, 10, 4.5, 7, 30000, P, C)
  addFenceLine(-35, 10, 70, 0, 30000, P, C)
  addTree(28, 22, 3.5, 8, 10000, P, C); addTree(-28, 25, 4, 9, 10000, P, C)
  addTree(22, 40, 3, 7, 8000, P, C); addTree(-22, 42, 3.5, 8, 8000, P, C)
  addPole(-25, 14, 7, 3500, P, C); addPole(0, 32, 8, 4000, P, C); addPole(25, 16, 7, 3500, P, C)
}

function buildPointCloud(scene: THREE.Scene) {
  const P: number[] = [], C: number[] = []
  addGround360(P, C)
  addFrontQuadrant(P, C)
  addRightQuadrant(P, C)
  addLeftQuadrant(P, C)
  addBackQuadrant(P, C)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
  const material = new THREE.PointsMaterial({ size: CFG.POINT_SIZE, sizeAttenuation: false, vertexColors: true, depthWrite: true })
  scene.add(new THREE.Points(geometry, material))
}
