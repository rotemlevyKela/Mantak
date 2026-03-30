import { STREAM_LABELS, STREAM_ORDER } from '../domain/constants'
import type {
  AlertEvent,
  AppSnapshot,
  LidarStream,
  ObjectType,
  Priority,
  StreamId,
  TrackedObject,
} from '../domain/types'
import { shouldAlertForPoint } from '../lib/zonePolicy'
import type { InterestArea } from '../domain/types'

type Subscriber = (snapshot: AppSnapshot) => void

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low']
const OBJECT_TYPES: ObjectType[] = ['man', 'drone', 'vehicle']

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

const QUADRANT_RANGES: Record<StreamId, { xDir: number; xMin: number; xMax: number; zDir: number; zMin: number; zMax: number }> = {
  front: { xDir: 1, xMin: -20, xMax: 20, zDir: -1, zMin: 8, zMax: 42 },
  right: { xDir: 1, xMin: 8, xMax: 42, zDir: 1, zMin: -15, zMax: 15 },
  back:  { xDir: 1, xMin: -20, xMax: 20, zDir: 1, zMin: 8, zMax: 42 },
  left:  { xDir: -1, xMin: 8, xMax: 42, zDir: 1, zMin: -15, zMax: 15 },
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

  constructor() {
    this.state = {
      streams: STREAM_ORDER.map((id) => ({
        id,
        label: STREAM_LABELS[id],
        available: true,
      })),
      tracksByStream: {
        front: [],
        left: [],
        back: [],
        right: [],
      },
      alerts: [],
    }
    for (const streamId of STREAM_ORDER) {
      this.state.tracksByStream[streamId] = this.seedTracks(streamId, 14)
    }
  }

  setZones(zones: InterestArea[]) {
    this.zones = zones
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber)
    subscriber(this.snapshot())
    if (!this.timer) {
      this.start()
    }
    return () => {
      this.subscribers.delete(subscriber)
      if (!this.subscribers.size) {
        this.stop()
      }
    }
  }

  private start() {
    this.timer = window.setInterval(() => this.tick(), 240)
  }

  private stop() {
    if (this.timer) {
      window.clearInterval(this.timer)
      this.timer = undefined
    }
  }

  private tick() {
    const now = Date.now()

    for (const streamId of STREAM_ORDER) {
      const streamTracks = this.state.tracksByStream[streamId]
      for (const track of streamTracks) {
        const jitter = track.motionState === 'dynamic' ? 1.4 : 0.2
        track.position.x += rand(-jitter, jitter)
        track.position.y += rand(-jitter, jitter)
        track.position.z += rand(-0.2, 0.2)
        track.distance.distanceM = Math.max(
          2,
          Math.sqrt(track.position.x ** 2 + track.position.y ** 2),
        )
        track.distance.azimuthDeg = ((Math.atan2(track.position.y, track.position.x) * 180) / Math.PI + 360) % 360
        track.velocityMps = track.motionState === 'dynamic' ? rand(1.2, 13.8) : rand(0, 0.7)
        track.lastSeenAt = now
      }
    }

    const emitted = this.maybeEmitAlerts(now)
    if (emitted.length) {
      this.state.alerts = [...emitted, ...this.state.alerts].slice(0, 120)
    }

    for (const subscriber of this.subscribers) {
      subscriber(this.snapshot())
    }
  }

  private snapshot(): AppSnapshot {
    return {
      now: Date.now(),
      streams: this.state.streams.map((stream) => ({ ...stream })),
      tracksByStream: {
        front: this.state.tracksByStream.front.map((track) => ({ ...track, distance: { ...track.distance }, dimensions: { ...track.dimensions }, position: { ...track.position } })),
        left: this.state.tracksByStream.left.map((track) => ({ ...track, distance: { ...track.distance }, dimensions: { ...track.dimensions }, position: { ...track.position } })),
        back: this.state.tracksByStream.back.map((track) => ({ ...track, distance: { ...track.distance }, dimensions: { ...track.dimensions }, position: { ...track.position } })),
        right: this.state.tracksByStream.right.map((track) => ({ ...track, distance: { ...track.distance }, dimensions: { ...track.dimensions }, position: { ...track.position } })),
      },
      rawAlerts: [...this.state.alerts],
    }
  }

  private maybeEmitAlerts(now: number): AlertEvent[] {
    const emitted: AlertEvent[] = []
    for (const streamId of STREAM_ORDER) {
      const stream = this.state.streams.find((candidate) => candidate.id === streamId)
      if (!stream?.available) {
        continue
      }
      const streamTracks = this.state.tracksByStream[streamId]
      const chance = Math.random()
      if (chance < 0.3) {
        const target = pick(streamTracks)
        const duplicateChance = Math.random()
        const alert = this.createAlertFromTrack(target, now)
        const allowed = shouldAlertForPoint(target.position.x, target.position.y, this.zones)
        if (allowed) {
          emitted.push(alert)
          if (duplicateChance < 0.15) {
            // intentional duplicate payload to validate dedupe handling.
            emitted.push({ ...alert })
          }
        }
      }
    }
    return emitted
  }

  private createAlertFromTrack(track: TrackedObject, now: number): AlertEvent {
    this.seq += 1
    const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)]
    const maybeOutOfOrder = Math.random() < 0.1 ? now - rand(350, 1400) : now
    const includeSnapshot = Math.random() > 0.25
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
      snapshotUrl: includeSnapshot
        ? createMockSnapshot(track.objectType, track.streamId)
        : undefined,
    }
  }

  private seedTracks(streamId: StreamId, count: number): TrackedObject[] {
    const now = Date.now() - rand(12_000, 60_000)
    const quadrant = QUADRANT_RANGES[streamId]
    return Array.from({ length: count }).map((_, index) => {
      const objectType = pick(OBJECT_TYPES)
      const dynamic = Math.random() > 0.35
      const dist = rand(8, 45)
      const x = quadrant.xDir * rand(quadrant.xMin, quadrant.xMax)
      const z = quadrant.zDir * rand(quadrant.zMin, quadrant.zMax)
      return {
        trackId: `${streamId}-track-${index + 1}`,
        streamId,
        objectType,
        motionState: dynamic ? 'dynamic' : 'static',
        velocityMps: dynamic ? rand(1.5, 13.5) : rand(0, 0.4),
        firstDetectedAt: now - rand(1000, 45_000),
        lastSeenAt: now,
        dimensions: {
          heightM: Number(rand(1.4, 6.2).toFixed(1)),
          lengthM: Number(rand(1.8, 9.5).toFixed(1)),
        },
        position: { x, y: rand(0, 5), z },
        distance: {
          distanceM: dist,
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
