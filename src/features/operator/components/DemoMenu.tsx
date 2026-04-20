import { useEffect, useRef, useState } from 'react'
import { THREAT_LABELS } from '../../../domain/constants'
import type { ThreatKind } from '../../../domain/types'

const THREATS: ThreatKind[] = ['fast-approaching', 'loitering', 'drone']

interface DemoMenuProps {
  onFireThreat: (kind: ThreatKind) => void
  onResetDemo: () => void
}

export function DemoMenu({ onFireThreat, onResetDemo }: DemoMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="t-demo-menu" ref={ref}>
      <button
        type="button"
        className={`t-demo-menu-trigger${open ? ' t-demo-menu-trigger--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Threats
      </button>
      {open && (
        <div className="t-demo-menu-popover" role="menu">
          <div className="t-demo-menu-title">Simulate threat</div>
          {THREATS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`t-demo-menu-item t-demo-menu-item--${kind}`}
              role="menuitem"
              onClick={() => { onFireThreat(kind); setOpen(false) }}
            >
              {THREAT_LABELS[kind]}
            </button>
          ))}
          <div className="t-demo-menu-divider" />
          <button
            type="button"
            className="t-demo-menu-item t-demo-menu-item--reset"
            role="menuitem"
            onClick={() => { onResetDemo(); setOpen(false) }}
          >
            Reset scenario
          </button>
        </div>
      )}
    </div>
  )
}
