import { STREAM_LABELS, STREAM_ORDER } from '../../../domain/constants'
import type { StreamId, ThreatKind } from '../../../domain/types'
import { DemoMenu } from './DemoMenu'

interface DockBarProps {
  activeStreamId: StreamId
  totalDetections: number
  onSwitchStream: (streamId: StreamId) => void
  onFireThreat: (kind: ThreatKind) => void
  onResetDemo: () => void
  onToggleZones: () => void
  zonesActive: boolean
}

export function DockBar({
  activeStreamId,
  totalDetections,
  onSwitchStream,
  onFireThreat,
  onResetDemo,
  onToggleZones,
  zonesActive,
}: DockBarProps) {
  return (
    <div className="t-dock">
      <div className="t-dock-left">
        <svg className="t-dock-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <div className="t-dock-count">
          <span className="t-dock-count-num">{totalDetections}</span>
        </div>
      </div>

      <div className="t-dock-center">
        <div className="t-dock-streams">
          {STREAM_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`t-dock-pill${id === activeStreamId ? ' t-dock-pill--active' : ''}`}
              onClick={() => onSwitchStream(id)}
            >
              {STREAM_LABELS[id].replace(/ Side$/i, '')}
            </button>
          ))}
        </div>
      </div>

      <div className="t-dock-right">
        <button
          type="button"
          className={`t-dock-action${zonesActive ? ' t-dock-action--active' : ''}`}
          onClick={onToggleZones}
          aria-pressed={zonesActive}
        >
          Zones
        </button>
        <DemoMenu onFireThreat={onFireThreat} onResetDemo={onResetDemo} />
        <button className="t-dock-settings" type="button" aria-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
