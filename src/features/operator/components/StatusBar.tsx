import { STREAM_ORDER } from '../../../domain/constants'
import type { StreamId, TrackedObject } from '../../../domain/types'

interface StatusBarProps {
  tracksByStream: Record<StreamId, TrackedObject[]>
  activeStreamId: StreamId
  now: number
  hasAlerts: boolean
}

const STREAM_LETTER: Record<StreamId, string> = {
  front: 'F',
  right: 'R',
  back: 'B',
  left: 'L',
}

export function StatusBar({ tracksByStream, activeStreamId, now, hasAlerts }: StatusBarProps) {
  const totalDetections = STREAM_ORDER.reduce(
    (sum, id) => sum + tracksByStream[id].length,
    0,
  )

  const mode = hasAlerts ? 'ALERT' : totalDetections > 0 ? 'SCANNING' : 'IDLE'
  const d = new Date(now)
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  return (
    <div className="t-statusbar">
      <div className="t-statusbar-left">
        <div className="t-stream-letters">
          {STREAM_ORDER.map((id) => (
            <span
              key={id}
              className={`t-stream-letter${id === activeStreamId ? ' t-stream-letter--active' : ''}${tracksByStream[id].length > 0 ? ' t-stream-letter--detecting' : ''}`}
            >
              {STREAM_LETTER[id]}
            </span>
          ))}
        </div>

        <span className={`t-mode-badge t-mode-badge--${mode.toLowerCase()}`}>
          {mode}
        </span>

        <div className="t-sensor-bars" aria-label="Sensor health">
          {STREAM_ORDER.map((id) => (
            <div
              key={id}
              className={`t-sensor-bar${id === activeStreamId ? ' t-sensor-bar--active' : ''}${tracksByStream[id].length > 0 ? ' t-sensor-bar--detecting' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="t-statusbar-right">
        {totalDetections > 0 && (
          <span className="t-statusbar-detections">
            {totalDetections} detection{totalDetections !== 1 ? 's' : ''}
          </span>
        )}
        <span className="t-statusbar-time">{timeStr}</span>
        <span className="t-statusbar-dot t-statusbar-dot--connected" />
      </div>
    </div>
  )
}
