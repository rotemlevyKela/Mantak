import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STREAM_ORDER } from '../../../domain/constants'
import type { StreamId } from '../../../domain/types'

interface LidarViewportProps {
  tracks: unknown[]
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
  front: { yaw: 0, pitch: -0.22 },
  right: { yaw: Math.PI * 0.5, pitch: -0.22 },
  back: { yaw: Math.PI, pitch: -0.22 },
  left: { yaw: -Math.PI * 0.5, pitch: -0.22 },
}

const CFG = {
  POINT_SIZE: 1.0,
  CAM_HEIGHT: 4.6,
  CAM_FOV: 128,
  DEPTH: 50,
  ANIM_MS: 1200,
}

const VIEWPORT_WEDGE_ROTATION: Record<StreamId, number> = {
  front: -20,
  right: 70,
  back: 160,
  left: 250,
}

export function LidarViewport({
  streamLabel,
  activeStreamId,
  streamAvailable,
  onSwitchStream,
}: LidarViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<SceneState | null>(null)

  const activeIndex = STREAM_ORDER.indexOf(activeStreamId)
  const leftStream = STREAM_ORDER[(activeIndex + 3) % 4]
  const rightStream = STREAM_ORDER[(activeIndex + 1) % 4]
  const backStream = STREAM_ORDER[(activeIndex + 2) % 4]

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
    const view = VIEWS[activeStreamId]
    let d = view.yaw - state.tYaw
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    smoothAnimate(state, state.tYaw + d, view.pitch)
  }, [activeStreamId])

  return (
    <div className="viewport-wrap" ref={containerRef}>
      <canvas className="viewport-canvas" ref={canvasRef} />

      <div className="viewport-hud-top">
        <span className="viewport-label">
          Open stream - {streamLabel.toLowerCase()}
        </span>
      </div>

      <div className="viewport-scanline-bar" />

      <div className="viewport-nav-overlay">
        <div className="nav-compass">
          <div className="compass-north">N</div>

          <svg viewBox="0 0 300 320" width="300" height="320" className="compass-svg">
            <circle cx="150" cy="170" r="130" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            <circle cx="150" cy="170" r="88" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

            <line x1="150" y1="40" x2="150" y2="170" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
            <line x1="150" y1="170" x2="150" y2="300" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
            <line x1="20" y1="170" x2="150" y2="170" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
            <line x1="150" y1="170" x2="280" y2="170" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />

            <line x1="150" y1="40" x2="150" y2="32" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <line x1="280" y1="170" x2="288" y2="170" stroke="rgba(255,255,255,0.2)" strokeWidth="0.7" />
            <line x1="150" y1="300" x2="150" y2="308" stroke="rgba(255,255,255,0.2)" strokeWidth="0.7" />
            <line x1="20" y1="170" x2="12" y2="170" stroke="rgba(255,255,255,0.2)" strokeWidth="0.7" />

            <g transform={`rotate(${VIEWPORT_WEDGE_ROTATION[activeStreamId]} 150 170)`}>
              <path
                d="M150 170 L120 50 A80 80 0 0 1 180 50 Z"
                fill="rgba(200, 20, 20, 0.75)"
              />
            </g>
          </svg>

          <svg className="compass-vehicle" viewBox="0 0 36 52" width="50" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="36" height="52" rx="6" ry="6" fill="rgba(80,80,80,0.6)" stroke="rgba(200,200,200,0.5)" strokeWidth="1"/>
            <rect x="4" y="4" width="28" height="20" rx="3" ry="3" fill="none" stroke="rgba(200,200,200,0.3)" strokeWidth="0.6"/>
            <rect x="4" y="28" width="28" height="20" rx="3" ry="3" fill="none" stroke="rgba(200,200,200,0.3)" strokeWidth="0.6"/>
            <line x1="18" y1="0" x2="18" y2="52" stroke="rgba(200,200,200,0.15)" strokeWidth="0.5"/>
          </svg>
        </div>

        <button
          className="nav-goto nav-goto-left"
          type="button"
          onClick={() => onSwitchStream(leftStream)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Go to</span>
        </button>

        <button
          className="nav-goto nav-goto-right"
          type="button"
          onClick={() => onSwitchStream(rightStream)}
        >
          <span>Go to</span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <button
          className="nav-goto nav-goto-down"
          type="button"
          onClick={() => onSwitchStream(backStream)}
        >
          <span>Go to</span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
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
  )
}

/* ================================================================
   Three.js scene — ported from lidar-scene.js
   ================================================================ */

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
}

function initScene(container: HTMLElement, canvas: HTMLCanvasElement): SceneState {
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

/* ── Point cloud generation ── */

function ptColor(y: number, dist: number, refl: number): [number, number, number] {
  const t = Math.min(Math.max(y, 0) / 11, 1)
  let r: number, g: number, b: number
  if (t < 0.04) {
    r = 0.80 + refl * 0.20
    g = 0.70 + refl * 0.22
    b = 0.0
  } else if (t < 0.13) {
    const s = (t - 0.04) / 0.09
    r = 1.0
    g = 0.62 - s * 0.14
    b = 0.0
  } else if (t < 0.30) {
    const s = (t - 0.13) / 0.17
    r = 1.0 - s * 0.06
    g = 0.48 - s * 0.20
    b = 0.0
  } else if (t < 0.55) {
    const s = (t - 0.30) / 0.25
    r = 0.94 - s * 0.24
    g = 0.28 - s * 0.14
    b = 0.0
  } else {
    const s = Math.min((t - 0.55) / 0.45, 1)
    r = 0.70 - s * 0.40
    g = 0.14 - s * 0.11
    b = 0.0
  }
  const df = Math.max(0.28, 1.0 - (dist / CFG.DEPTH) * 0.55)
  const rf = 0.65 + refl * 0.35
  return [r * df * rf, g * df * rf, b * df * rf]
}

function addGround(P: number[], C: number[]) {
  const N = 700000
  for (let i = 0; i < N; i++) {
    const a = (Math.random() - 0.5) * Math.PI * 1.25
    const d = Math.pow(Math.random(), 0.5) * CFG.DEPTH
    const x = Math.sin(a) * d
    const z = -Math.cos(a) * d
    const y = (Math.random() - 0.5) * 0.05
    const rf = d < 5 ? 0.85 + Math.random() * 0.15 : 0.45 + Math.random() * 0.55
    const c = ptColor(Math.max(y, 0), d, rf)
    P.push(x, y, z)
    C.push(c[0], c[1], c[2])
  }
}

function addCurb(P: number[], C: number[]) {
  for (let i = 0; i < 90000; i++) {
    const a = (Math.random() - 0.5) * Math.PI * 1.0
    const r = 9 + Math.random() * 4
    const x = Math.sin(a) * r + (Math.random() - 0.5) * 0.6
    const z = -Math.cos(a) * r + (Math.random() - 0.5) * 0.6
    const y = Math.random() * 0.20
    const bright = 0.88 + Math.random() * 0.12
    P.push(x, y, z)
    C.push(bright, bright * 0.82, 0.0)
  }
}

function addPatches(P: number[], C: number[]) {
  const ps: [number, number, number, number][] = [
    [-2, -7.5, 2.8, 1.6],
    [3.5, -14, 2, 1.3],
    [10, -11, 1.5, 1],
  ]
  for (const pa of ps) {
    for (let i = 0; i < 7000; i++) {
      const x = pa[0] + (Math.random() - 0.5) * pa[2]
      const z = pa[1] + (Math.random() - 0.5) * pa[3]
      P.push(x, 0.01, z)
      C.push(0.72 + Math.random() * 0.15, 0.06 + Math.random() * 0.05, 0.0)
    }
  }
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
    x += (Math.random() - 0.5) * 0.03
    y += (Math.random() - 0.5) * 0.03
    z += (Math.random() - 0.5) * 0.03
    const dist = Math.sqrt(x * x + z * z)
    const c = ptColor(y, dist, 0.6 + Math.random() * 0.4)
    P.push(x, y, z)
    C.push(c[0], c[1], c[2])
  }
}

function addCars(P: number[], C: number[]) {
  const list: [number, number, number, number, number][] = [
    [-18, -8.5, 4.2, 1.5, 1.9],
    [-15, -10, 4.0, 1.5, 1.8],
    [-12, -11.5, 4.5, 1.6, 2.0],
    [-9, -12.5, 4.0, 1.4, 1.8],
    [-21, -7.5, 4.3, 1.5, 1.9],
    [17, -14, 4.0, 1.6, 1.9],
    [20.5, -13, 3.8, 1.4, 1.8],
    [24, -11.5, 4.1, 1.5, 1.9],
    [27, -10, 4.0, 1.5, 1.8],
  ]
  for (const c of list) {
    addBox(c[0], 0, c[1], c[2], c[3], c[4], 20000, P, C)
  }
}

function addBuildings(P: number[], C: number[]) {
  addBox(5.5, 0, -16, 7, 3.5, 4, 65000, P, C)
  addBox(8, 0, -14.5, 2.5, 3.2, 2.5, 18000, P, C)
  addBox(-4, 0, -30, 10, 4.8, 5.5, 40000, P, C)
  addBox(16, 0, -28, 6, 3.5, 4.5, 25000, P, C)
  addBox(-16, 0, -26, 7, 4, 4, 22000, P, C)
  addBox(25, 0, -22, 5, 3, 3.5, 18000, P, C)
  addBox(30, 0, -18, 4, 2.8, 3, 14000, P, C)
}

function addTrees(P: number[], C: number[]) {
  const list: [number, number, number, number][] = [
    [-34, -18, 3.5, 7], [-31, -22, 4, 8],
    [-27, -27, 4.2, 9], [-23, -31, 4, 8],
    [-18, -34, 3.8, 9], [-13, -37, 3.5, 8],
    [-8, -39, 4, 9], [-3, -41, 4.5, 10],
    [2, -42, 4.5, 11], [7, -41, 4, 10],
    [12, -39, 3.8, 9], [17, -37, 3.5, 8],
    [22, -34, 4, 9], [27, -31, 4.2, 8],
    [31, -27, 3.8, 7], [34, -22, 3.5, 7],
    [36, -17, 3, 6], [-36, -15, 3, 6],
    [-32, -25, 3.5, 7], [33, -25, 3.5, 7],
    [-29, -19, 2.8, 6], [35, -20, 2.8, 6],
  ]
  for (const t of list) {
    const tx = t[0], tz = t[1], tr = t[2], th = t[3]
    const n = 14000
    for (let i = 0; i < n; i++) {
      const trH = th * 0.28
      const trunk = Math.random() < 0.05
      let x: number, y: number, z: number
      if (trunk) {
        x = tx + (Math.random() - 0.5) * 0.2
        y = Math.random() * trH
        z = tz + (Math.random() - 0.5) * 0.2
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
      P.push(x, y, z)
      C.push(c[0], c[1], c[2])
    }
  }
}

function addFences(P: number[], C: number[]) {
  const segments: [number, number, number, number, number][] = [
    [28, -3, 0, -35, 30000],
    [-28, -3, 0, -30, 25000],
    [15, -8, 18, 0, 10000],
    [-10, -8, -18, 0, 9000],
  ]
  for (const s of segments) {
    for (let i = 0; i < s[4]; i++) {
      const t = Math.random()
      const x = s[0] + s[2] * t + (Math.random() - 0.5) * 0.12
      const z = s[1] + s[3] * t + (Math.random() - 0.5) * 0.12
      const y = Math.random() * 2.2
      const d = Math.sqrt(x * x + z * z)
      const c = ptColor(y, d, 0.45 + Math.random() * 0.25)
      P.push(x, y, z)
      C.push(c[0], c[1], c[2])
    }
  }
}

function addPoles(P: number[], C: number[]) {
  const list: [number, number, number][] = [
    [-23, -14, 7], [13, -24, 6], [-7, -26, 7],
    [30, -16, 5], [-30, -10, 6], [32, -12, 5],
  ]
  for (const p of list) {
    for (let i = 0; i < 4000; i++) {
      const x = p[0] + (Math.random() - 0.5) * 0.1
      const y = Math.random() * p[2]
      const z = p[1] + (Math.random() - 0.5) * 0.1
      const d = Math.sqrt(x * x + z * z)
      const c = ptColor(y, d, 0.55)
      P.push(x, y, z)
      C.push(c[0], c[1], c[2])
    }
  }
}

function buildPointCloud(scene: THREE.Scene) {
  const P: number[] = []
  const C: number[] = []

  addGround(P, C)
  addCurb(P, C)
  addPatches(P, C)
  addCars(P, C)
  addBuildings(P, C)
  addTrees(P, C)
  addFences(P, C)
  addPoles(P, C)

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
}
