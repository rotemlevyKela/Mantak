export type StreamId = 'front' | 'left' | 'back' | 'right'

export type ObjectType = 'man' | 'drone' | 'vehicle'

export type Priority = 'critical' | 'high' | 'medium' | 'low'

export type MotionState = 'static' | 'dynamic'

export type ZoneMode = 'opt-in' | 'opt-out'

export type SortMode = 'priority' | 'time'

export interface Dimensions {
  heightM: number
  lengthM: number
}

export interface DistanceVector {
  distanceM: number
  azimuthDeg: number
}

export interface TrackedObject {
  trackId: string
  streamId: StreamId
  objectType: ObjectType
  motionState: MotionState
  velocityMps: number
  firstDetectedAt: number
  lastSeenAt: number
  dimensions: Dimensions
  position: { x: number; y: number; z: number }
  distance: DistanceVector
}

export interface AlertEvent {
  alertId: string
  trackId: string
  streamId: StreamId
  objectType: ObjectType
  priority: Priority
  motionState: MotionState
  velocityMps: number
  firstDetectedAt: number
  detectedAt: number
  distance: DistanceVector
  dimensions: Dimensions
  snapshotUrl?: string
}

export interface LidarStream {
  id: StreamId
  label: string
  available: boolean
}

export interface InterestArea {
  id: string
  name: string
  mode: ZoneMode
  vertices: Array<{ x: number; y: number }>
}

export interface Preferences {
  selectedStreamId: StreamId
  sortMode: SortMode
  soundEnabled: boolean
  colorScale: 'yellow-red' | 'black-white'
  showVelocity: boolean
}

export interface AppSnapshot {
  now: number
  streams: LidarStream[]
  tracksByStream: Record<StreamId, TrackedObject[]>
  rawAlerts: AlertEvent[]
}
