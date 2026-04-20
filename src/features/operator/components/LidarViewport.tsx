import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STREAM_LABELS } from '../../../domain/constants'
import type { StreamId, TrackedObject } from '../../../domain/types'

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
}

interface MarkerMesh { ring: THREE.Mesh; trackId: string }

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

export function LidarViewport({ tracks, focusedTrackId, activeStreamId, variant = 'hero' }: LidarViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<SceneState | null>(null)
  const [switching, setSwitching] = useState(false)

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

  const view = VIEWS.front
  const state: SceneState = {
    scene, camera, renderer,
    yaw: view.yaw, pitch: view.pitch, tYaw: view.yaw, tPitch: view.pitch,
    animating: false, animId: 0, disposed: false, container,
    markers: [], markerGroup,
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
