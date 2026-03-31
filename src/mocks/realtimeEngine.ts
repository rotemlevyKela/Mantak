import { STREAM_LABELS, STREAM_ORDER } from '../domain/constants'
import type {
  AlertEvent, AppSnapshot, LidarStream,
  ObjectType, Priority, StreamId, TrackedObject,
} from '../domain/types'
import type { InterestArea } from '../domain/types'

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

  private start() { this.timer = window.setInterval(() => this.tick(), 240) }
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

    for (const streamId of STREAM_ORDER) {
      for (const track of this.state.tracksByStream[streamId]) {
        const jitter = track.motionState === 'dynamic' ? 1.4 : 0.2
        track.position.x += rand(-jitter, jitter)
        track.position.z += rand(-jitter, jitter)
        track.position.y += rand(-0.2, 0.2)
        track.distance.distanceM = Math.max(2, Math.sqrt(track.position.x ** 2 + track.position.z ** 2))
        track.distance.azimuthDeg = ((Math.atan2(track.position.z, track.position.x) * 180) / Math.PI + 360) % 360
        track.velocityMps = track.motionState === 'dynamic' ? rand(1.2, 13.8) : rand(0, 0.7)
        track.lastSeenAt = now
      }
    }

    for (const subscriber of this.subscribers) subscriber(this.snapshot())
  }

  private forceEmitAlerts(streamId: StreamId, now: number) {
    for (const track of this.state.tracksByStream[streamId]) {
      const alert = this.createAlertFromTrack(track, now)
      this.state.alerts = [alert, ...this.state.alerts].slice(0, 120)
    }
  }

  private snapshot(): AppSnapshot {
    const copy = (t: TrackedObject) => ({
      ...t, distance: { ...t.distance }, dimensions: { ...t.dimensions }, position: { ...t.position },
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

  private createAlertFromTrack(track: TrackedObject, now: number): AlertEvent {
    this.seq += 1
    const priority: Priority = this.seq === 1 ? 'high' : pick(PRIORITIES)
    return {
      alertId: `alert-${this.seq}`,
      trackId: track.trackId,
      streamId: track.streamId,
      objectType: track.objectType,
      priority,
      motionState: track.motionState,
      velocityMps: Number(track.velocityMps.toFixed(1)),
      firstDetectedAt: track.firstDetectedAt,
      detectedAt: now,
      distance: { ...track.distance, distanceM: Number(track.distance.distanceM.toFixed(1)), azimuthDeg: Number(track.distance.azimuthDeg.toFixed(1)) },
      dimensions: track.dimensions,
      snapshotUrl: createMockSnapshot(track.objectType, track.streamId),
    }
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
        distance: {
          distanceM: Math.sqrt(x * x + z * z),
          azimuthDeg: ((Math.atan2(z, x) * 180) / Math.PI + 360) % 360,
        },
      }
    })
  }
}

function createMockSnapshot(objectType: ObjectType, streamId: StreamId) {
  const fill = objectType === 'drone' ? '#c63a3a' : objectType === 'vehicle' ? '#8d6f1f' : '#3a6f93'
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='128'><rect width='100%' height='100%' fill='#050505'/><rect x='16' y='24' width='96' height='80' fill='${fill}'/><text x='126' y='52' fill='#ececec' font-family='Arial' font-size='18'>${streamId.toUpperCase()}</text><text x='126' y='80' fill='#9fa4a3' font-family='Arial' font-size='14'>${objectType.toUpperCase()}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
