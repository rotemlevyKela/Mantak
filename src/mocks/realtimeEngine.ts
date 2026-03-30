import { STREAM_LABELS, STREAM_ORDER } from '../domain/constants'
import type {
  AlertEvent, AppSnapshot, LidarStream,
  ObjectType, Priority, StreamId, TrackedObject,
} from '../domain/types'
import { shouldAlertForPoint } from '../lib/zonePolicy'
import type { InterestArea } from '../domain/types'

type Subscriber = (snapshot: AppSnapshot) => void

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low']
const OBJECT_TYPES: ObjectType[] = ['man', 'drone', 'vehicle']

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

const QUADRANT_RANGES: Record<StreamId, { xMin: number; xMax: number; zMin: number; zMax: number }> = {
  front: { xMin: -20, xMax: 20, zMin: -42, zMax: -8 },
  right: { xMin: 8, xMax: 42, zMin: -15, zMax: 15 },
  back:  { xMin: -20, xMax: 20, zMin: 8, zMax: 42 },
  left:  { xMin: -42, xMax: -8, zMin: -15, zMax: 15 },
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

  constructor() {
    this.state = {
      streams: STREAM_ORDER.map((id) => ({
        id, label: STREAM_LABELS[id], available: true,
      })),
      tracksByStream: { front: [], left: [], back: [], right: [] },
      alerts: [],
    }
    this.state.tracksByStream.front = this.seedTracks('front', 1)
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

    if (elapsed > 8000 && this.state.tracksByStream.left.length === 0) {
      this.state.tracksByStream.left = this.seedTracks('left', 2)
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

    const emitted = this.maybeEmitAlerts(now)
    if (emitted.length) {
      this.state.alerts = [...emitted, ...this.state.alerts].slice(0, 120)
    }

    for (const subscriber of this.subscribers) subscriber(this.snapshot())
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

  private maybeEmitAlerts(now: number): AlertEvent[] {
    const emitted: AlertEvent[] = []
    for (const streamId of STREAM_ORDER) {
      const streamTracks = this.state.tracksByStream[streamId]
      if (!streamTracks.length) continue
      if (Math.random() < 0.03) {
        const target = pick(streamTracks)
        const alert = this.createAlertFromTrack(target, now)
        if (shouldAlertForPoint(target.position.x, target.position.y, this.zones)) {
          emitted.push(alert)
        }
      }
    }
    return emitted
  }

  private createAlertFromTrack(track: TrackedObject, now: number): AlertEvent {
    this.seq += 1
    const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)]
    const maybeOutOfOrder = Math.random() < 0.1 ? now - rand(350, 1400) : now
    return {
      alertId: `alert-${this.seq}`,
      trackId: track.trackId,
      streamId: track.streamId,
      objectType: track.objectType,
      priority,
      motionState: track.motionState,
      velocityMps: Number(track.velocityMps.toFixed(1)),
      firstDetectedAt: track.firstDetectedAt,
      detectedAt: maybeOutOfOrder,
      distance: { ...track.distance, distanceM: Number(track.distance.distanceM.toFixed(1)), azimuthDeg: Number(track.distance.azimuthDeg.toFixed(1)) },
      dimensions: track.dimensions,
      snapshotUrl: Math.random() > 0.25 ? createMockSnapshot(track.objectType, track.streamId) : undefined,
    }
  }

  private seedTracks(streamId: StreamId, count: number): TrackedObject[] {
    const now = Date.now() - rand(12_000, 60_000)
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
        firstDetectedAt: now - rand(1000, 45_000),
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
