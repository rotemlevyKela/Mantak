interface LidarNavWidgetProps {
  open: boolean
  onToggle: () => void
  onYaw: (delta: number) => void
  onPitch: (delta: number) => void
  onZoom: (factor: number) => void
  onReset: () => void
}

const YAW_STEP = 0.25
const PITCH_STEP = 0.12
const ZOOM_IN = 1 / 1.18
const ZOOM_OUT = 1.18

export function LidarNavWidget({
  open,
  onToggle,
  onYaw,
  onPitch,
  onZoom,
  onReset,
}: LidarNavWidgetProps) {
  return (
    <>
      <button
        type="button"
        className={`t-viewport-controls-toggle${open ? ' t-viewport-controls-toggle--open' : ''}`}
        onClick={onToggle}
        aria-label={open ? 'Hide LiDAR controls' : 'Show LiDAR controls'}
        aria-pressed={open}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <div className="t-lidar-nav-widget" role="group" aria-label="LiDAR controls">
          <div className="t-lidar-nav-row">
            <button
              type="button"
              className="t-lidar-nav-btn"
              onClick={() => onZoom(ZOOM_OUT)}
              aria-label="Zoom out"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              className="t-lidar-nav-btn"
              onClick={() => onZoom(ZOOM_IN)}
              aria-label="Zoom in"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          <div className="t-lidar-nav-row t-lidar-nav-row--tilt-up">
            <button
              type="button"
              className="t-lidar-nav-btn"
              onClick={() => onPitch(-PITCH_STEP)}
              aria-label="Tilt up"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 15l6-6 6 6" />
              </svg>
            </button>
          </div>

          <div className="t-lidar-nav-row">
            <button
              type="button"
              className="t-lidar-nav-btn"
              onClick={() => onYaw(-YAW_STEP)}
              aria-label="Rotate left"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14l-4-4 4-4" />
                <path d="M5 10h9a5 5 0 015 5v1" />
              </svg>
            </button>
            <button
              type="button"
              className="t-lidar-nav-btn t-lidar-nav-btn--reset"
              onClick={onReset}
              aria-label="Reset view"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
            <button
              type="button"
              className="t-lidar-nav-btn"
              onClick={() => onYaw(YAW_STEP)}
              aria-label="Rotate right"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 14l4-4-4-4" />
                <path d="M19 10h-9a5 5 0 00-5 5v1" />
              </svg>
            </button>
          </div>

          <div className="t-lidar-nav-row t-lidar-nav-row--tilt-down">
            <button
              type="button"
              className="t-lidar-nav-btn"
              onClick={() => onPitch(PITCH_STEP)}
              aria-label="Tilt down"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
