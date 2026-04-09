import type { Priority, StreamId } from './types'

export const STREAM_ORDER: StreamId[] = ['front', 'right', 'left', 'back']

export const STREAM_LABELS: Record<StreamId, string> = {
  front: 'Front Side',
  left: 'Left Side',
  back: 'Back Side',
  right: 'Right Side',
}

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export const DETECTION_COLORS: Record<Priority, string> = {
  critical: '#e0212f',
  high: '#ff7a1a',
  medium: '#f2cf52',
  low: '#68b06a',
}

export const STREAM_COLORS: Record<StreamId, string> = {
  front: '#ef4444',
  right: '#f59e0b',
  left: '#3b82f6',
  back: '#a855f7',
}
