import type { Priority, StreamId } from './types'

export const STREAM_ORDER: StreamId[] = ['front', 'left', 'back', 'right']

export const STREAM_LABELS: Record<StreamId, string> = {
  front: 'Front side',
  left: 'Left side',
  back: 'Back side',
  right: 'Right side',
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
