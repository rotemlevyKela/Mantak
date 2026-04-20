import { STREAM_LABELS, STREAM_ORDER } from '../domain/constants'
import type {
  AlertEvent, AppSnapshot, InterestArea, LidarStream,
  ObjectType, Priority, StreamId, ThreatFlags, ThreatKind, TrackedObject,
} from '../domain/types'

type Subscriber = (snapshot: AppSnapshot) => void

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low']
const OBJECT_TYPES: ObjectType[] = ['man', 'drone', 'vehicle']

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

const QUADRANT_RANGES: Record<StreamId, { xMin: number; xMax: number; zMin: number; zMax: number }> = {
  front: { xMin: -15, xMax: 15, zMin: -52, zMax: -30 },
  right: { xMin: 30, xMax: 52, zMin: -15, zMax: 15 },
  back:  { xMin: -15, xMax: 15, zMin: 30, zMax: 52 },
  left:  { xMin: -52, xMax: -30, zMin: -15, zMax: 15 },
}

const STAGE_1_MS = 12_000
const STAGE_2_MS = 24_000
const STAGE_3_MS = 30_000

const TRAIL_CAP = 25
const TICK_MS = 240
const FAST_APPROACH_MPS = 9
const LOITER_BBOX_M = 3
const LOITER_MIN_SAMPLES = 12

interface TrackRuntime {
  lastDistanceM: number
  threatKind?: ThreatKind
}

interface EngineState {
  tracksByStream: Record<StreamId, TrackedObject[]>
  streams: LidarStream[]
  alerts: AlertEvent[]
}

export class MockRealtimeEngine {
  private subscribers = new Set<Subscriber>()
  private timer?: number
  private state: EngineState
  private seq = 0
  private zones: InterestArea[] = []
  private startTime = Date.now()
  private stage1Fired = false
  private stage2Fired = false
  private stage3Fired = false
  private runtime = new Map<string, TrackRuntime>()

  constructor() {
    this.state = {
      streams: STREAM_ORDER.map((id) => ({
        id, label: STREAM_LABELS[id], available: true,
      })),
      tracksByStream: { front: [], left: [], back: [], right: [] },
      alerts: [],
    }
  }

  setZones(zones: InterestArea[]) { this.zones = zones }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber)
    subscriber(this.snapshot())
    if (!this.timer) this.start()
    return () => {
      this.subscribers.delete(subscriber)
      if (!this.subscribers.size) this.stop()
    }
  }

  resetDemo() {
    this.state.tracksByStream = { front: [], left: [], back: [], right: [] }
    this.state.alerts = []
    this.stage1Fired = false
    this.stage2Fired = false
    this.stage3Fired = false
    this.startTime = Date.now()
    this.runtime.clear()
    for (const subscriber of this.subscribers) subscriber(this.snapshot())
  }

  fireThreat(kind: ThreatKind, streamId?: StreamId) {
    const now = Date.now()
    const stream = streamId ?? pick(STREAM_ORDER)
    const track = this.buildThreatTrack(kind, stream, now)
    this.state.tracksByStream[stream] = [...this.state.tracksByStream[stream], track]
    this.runtime.set(track.trackId, {
      lastDistanceM: track.distance.distanceM,
      threatKind: kind,
    })
    const flags = flagsForKind(kind)
    const alert = this.createAlertFromTrack(track, now, flags)
    if (alert) {
      this.state.alerts = [alert, ...this.state.alerts].slice(0, 120)
    }
    for (const subscriber of this.subscribers) subscriber(this.snapshot())
  }

  private buildThreatTrack(kind: ThreatKind, streamId: StreamId, now: number): TrackedObject {
    this.seq += 1
    const trackId = `threat-${kind}-${this.seq}-${now}`
    const q = QUADRANT_RANGES[streamId]
    const cx = (q.xMin + q.xMax) / 2
    const cz = (q.zMin + q.zMax) / 2
    const baseDims = { heightM: 2.0, lengthM: 3.0 }

    if (kind === 'fast-approaching') {
      return {
        trackId, streamId,
        objectType: 'vehicle',
        motionState: 'dynamic',
        velocityMps: 12,
        firstDetectedAt: now,
        lastSeenAt: now,
        dimensions: baseDims,
        position: { x: cx, y: 1.2, z: cz },
        distance: vecFrom(cx, cz),
        trail: [{ x: cx, z: cz, t: now }],
        flags: { fastApproaching: true },
      }
    }
    if (kind === 'loitering') {
      return {
        trackId, streamId,
        objectType: 'man',
        motionState: 'dynamic',
        velocityMps: 1.2,
        firstDetectedAt: now,
        lastSeenAt: now,
        dimensions: { heightM: 1.8, lengthM: 0.6 },
        position: { x: cx, y: 0.0, z: cz },
        distance: vecFrom(cx, cz),
        trail: [{ x: cx, z: cz, t: now }],
        flags: { loitering: true },
      }
    }
    return {
      trackId, streamId,
      objectType: 'drone',
      motionState: 'dynamic',
      velocityMps: rand(4, 8),
      firstDetectedAt: now,
      lastSeenAt: now,
      dimensions: { heightM: 0.4, lengthM: 0.6 },
      position: { x: cx, y: rand(6, 10), z: cz },
      distance: vecFrom(cx, cz),
      trail: [{ x: cx, z: cz, t: now }],
      flags: { drone: true },
    }
  }

  private start() { this.timer = window.setInterval(() => this.tick(), TICK_MS) }
  private stop() { if (this.timer) { window.clearInterval(this.timer); this.timer = undefined } }

  private tick() {
    const now = Date.now()
    const elapsed = now - this.startTime

    if (!this.stage1Fired && elapsed >= STAGE_1_MS) {
      this.stage1Fired = true
      this.state.tracksByStream.front = this.seedTracks('front', 1)
      this.forceEmitAlerts('front', now)
    }

    if (!this.stage2Fired && elapsed >= STAGE_2_MS) {
      this.stage2Fired = true
      this.state.tracksByStream.left = this.seedTracks('left', 1)
      this.state.tracksByStream.back = this.seedTracks('back', 1)
      this.forceEmitAlerts('left', now)
      this.forceEmitAlerts('back', now)
    }

    if (!this.stage3Fired && elapsed >= STAGE_3_MS) {
      this.stage3Fired = true
      const extraBack = this.seedTracks('back', 1)
      extraBack.forEach((t, i) => { t.trackId = `back-track-${this.state.tracksByStream.back.length + i + 1}` })
      this.state.tracksByStream.back = [...this.state.tracksByStream.back, ...extraBack]
      this.forceEmitAlerts('back', now)
    }

    for (const streamId of STREAM_ORDER) {
      for (const track of this.state.tracksByStream[streamId]) {
        this.stepTrack(track, now)
      }
    }

    for (const subscriber of this.subscribers) subscriber(this.snapshot())
  }

  private stepTrack(track: TrackedObject, now: number) {
    const runtime = this.runtime.get(track.trackId) ?? (() => {
      const r: TrackRuntime = { lastDistanceM: track.distance.distanceM }
      this.runtime.set(track.trackId, r)
      return r
    })()
    const kind = runtime.threatKind

    if (kind === 'fast-approaching') {
      const { x, z } = track.position
      const len = Math.max(0.001, Math.sqrt(x * x + z * z))
      const step = (12 * TICK_MS) / 1000
      track.position.x = x - (x / len) * step
      track.position.z = z - (z / len) * step
      if (Math.sqrt(track.position.x ** 2 + track.position.z ** 2) < 2) {
        track.position.x = track.position.x * 20
        track.position.z = track.position.z * 20
      }
      track.velocityMps = 12
    } else if (kind === 'loitering') {
      const phase = ((now - track.firstDetectedAt) / 1000) * 1.6
      const qr = QUADRANT_RANGES[track.streamId]
      const cx = (qr.xMin + qr.xMax) / 2
      const cz = (qr.zMin + qr.zMax) / 2
      track.position.x = cx + Math.cos(phase) * 1.2
      track.position.z = cz + Math.sin(phase * 1.3) * 1.2
      track.velocityMps = 1.2
    } else if (kind === 'drone') {
      const phase = ((now - track.firstDetectedAt) / 1000) * 0.4
      const qr = QUADRANT_RANGES[track.streamId]
      const cx = (qr.xMin + qr.xMax) / 2
      const cz = (qr.zMin + qr.zMax) / 2
      track.position.x = cx + Math.cos(phase) * 8
      track.position.z = cz + Math.sin(phase) * 8
      track.position.y = 6 + Math.sin(phase * 2) * 2
    } else {
      const jitter = track.motionState === 'dynamic' ? 1.4 : 0.2
      track.position.x += rand(-jitter, jitter)
      track.position.z += rand(-jitter, jitter)
      track.position.y += rand(-0.2, 0.2)
      track.velocityMps = track.motionState === 'dynamic' ? rand(1.2, 13.8) : rand(0, 0.7)
    }

    track.distance.distanceM = Math.max(2, Math.sqrt(track.position.x ** 2 + track.position.z ** 2))
    track.distance.azimuthDeg = ((Math.atan2(track.position.z, track.position.x) * 180) / Math.PI + 360) % 360
    track.lastSeenAt = now

    const trail = track.trail ?? []
    trail.push({ x: track.position.x, z: track.position.z, t: now })
    while (trail.length > TRAIL_CAP) trail.shift()
    track.trail = trail

    const flags: ThreatFlags = { ...(track.flags ?? {}) }
    const radialMps = (runtime.lastDistanceM - track.distance.distanceM) * (1000 / TICK_MS)
    runtime.lastDistanceM = track.distance.distanceM
    if (!kind && radialMps > FAST_APPROACH_MPS) flags.fastApproaching = true
    if (!kind && track.motionState === 'dynamic' && trail.length >= LOITER_MIN_SAMPLES) {
      const xs = trail.slice(-LOITER_MIN_SAMPLES).map((p) => p.x)
      const zs = trail.slice(-LOITER_MIN_SAMPLES).map((p) => p.z)
      const bw = Math.max(...xs) - Math.min(...xs)
      const bh = Math.max(...zs) - Math.min(...zs)
      if (bw < LOITER_BBOX_M && bh < LOITER_BBOX_M) flags.loitering = true
    }
    if (track.objectType === 'drone') flags.drone = true
    track.flags = hasAnyFlag(flags) ? flags : undefined
  }

  private forceEmitAlerts(streamId: StreamId, now: number) {
    for (const track of this.state.tracksByStream[streamId]) {
      const alert = this.createAlertFromTrack(track, now, track.flags)
      if (alert) this.state.alerts = [alert, ...this.state.alerts].slice(0, 120)
    }
  }

  private snapshot(): AppSnapshot {
    const copy = (t: TrackedObject): TrackedObject => ({
      ...t,
      distance: { ...t.distance },
      dimensions: { ...t.dimensions },
      position: { ...t.position },
      trail: t.trail ? t.trail.map((p) => ({ ...p })) : undefined,
      flags: t.flags ? { ...t.flags } : undefined,
    })
    return {
      now: Date.now(),
      streams: this.state.streams.map((s) => ({ ...s })),
      tracksByStream: {
        front: this.state.tracksByStream.front.map(copy),
        left: this.state.tracksByStream.left.map(copy),
        back: this.state.tracksByStream.back.map(copy),
        right: this.state.tracksByStream.right.map(copy),
      },
      rawAlerts: [...this.state.alerts],
    }
  }

  private createAlertFromTrack(track: TrackedObject, now: number, flags?: ThreatFlags): AlertEvent | null {
    if (!this.passesZones(track)) return null
    this.seq += 1
    const hasFlag = flags && hasAnyFlag(flags)
    const priority: Priority = hasFlag
      ? (flags.fastApproaching || flags.drone ? 'critical' : 'high')
      : (this.seq === 1 ? 'high' : pick(PRIORITIES))
    return {
      alertId: `alert-${this.seq}-${now}`,
      trackId: track.trackId,
      streamId: track.streamId,
      objectType: track.objectType,
      priority,
      motionState: track.motionState,
      velocityMps: Number(track.velocityMps.toFixed(1)),
      firstDetectedAt: track.firstDetectedAt,
      detectedAt: now,
      distance: {
        distanceM: Number(track.distance.distanceM.toFixed(1)),
        azimuthDeg: Number(track.distance.azimuthDeg.toFixed(1)),
      },
      dimensions: track.dimensions,
      snapshotUrl: createMockSnapshot(track.objectType, track.streamId),
      flags: hasFlag ? { ...flags } : undefined,
      status: 'active',
    }
  }

  private passesZones(track: TrackedObject): boolean {
    if (!this.zones.length) return true
    const point = { x: track.position.x, y: track.position.z }
    const optIn = this.zones.filter((z) => z.mode === 'opt-in')
    const optOut = this.zones.filter((z) => z.mode === 'opt-out')
    if (optOut.some((z) => pointInPolygon(point, z.vertices))) return false
    if (optIn.length > 0 && !optIn.some((z) => pointInPolygon(point, z.vertices))) return false
    return true
  }

  private seedTracks(streamId: StreamId, count: number): TrackedObject[] {
    const now = Date.now()
    const q = QUADRANT_RANGES[streamId]
    return Array.from({ length: count }).map((_, i) => {
      const objectType = pick(OBJECT_TYPES)
      const dynamic = Math.random() > 0.35
      const x = rand(q.xMin, q.xMax)
      const z = rand(q.zMin, q.zMax)
      return {
        trackId: `${streamId}-track-${i + 1}`,
        streamId, objectType,
        motionState: dynamic ? 'dynamic' as const : 'static' as const,
        velocityMps: dynamic ? rand(1.5, 13.5) : rand(0, 0.4),
        firstDetectedAt: now,
        lastSeenAt: now,
        dimensions: { heightM: Number(rand(1.4, 6.2).toFixed(1)), lengthM: Number(rand(1.8, 9.5).toFixed(1)) },
        position: { x, y: rand(0, 5), z },
        distance: vecFrom(x, z),
        trail: [{ x, z, t: now }],
      }
    })
  }
}

function vecFrom(x: number, z: number) {
  return {
    distanceM: Math.sqrt(x * x + z * z),
    azimuthDeg: ((Math.atan2(z, x) * 180) / Math.PI + 360) % 360,
  }
}

function flagsForKind(kind: ThreatKind): ThreatFlags {
  if (kind === 'fast-approaching') return { fastApproaching: true }
  if (kind === 'loitering') return { loitering: true }
  return { drone: true }
}

function hasAnyFlag(flags: ThreatFlags): boolean {
  return Boolean(flags.fastApproaching || flags.loitering || flags.drone)
}

function pointInPolygon(
  point: { x: number; y: number },
  vertices: Array<{ x: number; y: number }>,
): boolean {
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y
    const xj = vertices[j].x, yj = vertices[j].y
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function createMockSnapshot(objectType: ObjectType, streamId: StreamId) {
  const fill = objectType === 'drone' ? '#c63a3a' : objectType === 'vehicle' ? '#8d6f1f' : '#3a6f93'
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='128'><rect width='100%' height='100%' fill='#050505'/><rect x='16' y='24' width='96' height='80' fill='${fill}'/><text x='126' y='52' fill='#ececec' font-family='Arial' font-size='18'>${streamId.toUpperCase()}</text><text x='126' y='80' fill='#9fa4a3' font-family='Arial' font-size='14'>${objectType.toUpperCase()}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
