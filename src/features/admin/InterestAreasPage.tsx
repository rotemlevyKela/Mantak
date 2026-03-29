import { useEffect, useMemo, useState } from 'react'
import type { InterestArea, ZoneMode } from '../../domain/types'
import { readZones, writeZones } from '../../lib/persistence'

const defaultVertices = [
  { x: -20, y: -20 },
  { x: 20, y: -20 },
  { x: 20, y: 20 },
  { x: -20, y: 20 },
]

export function InterestAreasPage() {
  const [zones, setZones] = useState<InterestArea[]>(() => readZones())
  const [name, setName] = useState('Rural perimeter')
  const [mode, setMode] = useState<ZoneMode>('opt-in')

  useEffect(() => {
    writeZones(zones)
  }, [zones])

  const summary = useMemo(() => {
    const optIn = zones.filter((zone) => zone.mode === 'opt-in').length
    const optOut = zones.length - optIn
    return { optIn, optOut }
  }, [zones])

  return (
    <main className="admin-layout">
      <div className="card">
        <h2>Interest Areas / Virtual Walls</h2>
        <p className="muted">
          Overlap policy: <strong>opt-out wins</strong>. If a point falls in both zones, alerts are
          suppressed.
        </p>
      </div>

      <section className="admin-grid">
        <article className="card">
          <h2>Create Zone</h2>
          <div className="input-row">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Zone name"
            />
            <select
              className="input"
              value={mode}
              onChange={(event) => setMode(event.target.value as ZoneMode)}
            >
              <option value="opt-in">Opt-in (allow alerts)</option>
              <option value="opt-out">Opt-out (suppress alerts)</option>
            </select>
            <button
              className="small-btn"
              type="button"
              onClick={() => {
                const id = `zone-${crypto.randomUUID().slice(0, 8)}`
                setZones((current) => [
                  ...current,
                  {
                    id,
                    name: name.trim() || `Zone ${current.length + 1}`,
                    mode,
                    vertices: defaultVertices.map((vertex) => ({ ...vertex })),
                  },
                ])
              }}
            >
              Add zone
            </button>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            Phase 1 uses projected polygons. Full 3D volume calibration is planned for calibration
            module.
          </p>
        </article>

        <article className="card">
          <h2>Summary</h2>
          <p>Opt-in zones: {summary.optIn}</p>
          <p>Opt-out zones: {summary.optOut}</p>
        </article>
      </section>

      <section className="card">
        <h2>Configured Zones</h2>
        <ul className="zone-list">
          {zones.map((zone) => (
            <li key={zone.id} className="zone-item">
              <strong>{zone.name}</strong>
              <div className="muted">
                {zone.mode} - {zone.vertices.length} points
              </div>
              <div className="input-row">
                <button
                  className="small-btn"
                  type="button"
                  onClick={() =>
                    setZones((current) =>
                      current.map((candidate) =>
                        candidate.id === zone.id
                          ? {
                              ...candidate,
                              mode:
                                candidate.mode === 'opt-in'
                                  ? 'opt-out'
                                  : 'opt-in',
                            }
                          : candidate,
                      ),
                    )
                  }
                >
                  Toggle mode
                </button>
                <button
                  className="small-btn"
                  type="button"
                  onClick={() =>
                    setZones((current) => current.filter((candidate) => candidate.id !== zone.id))
                  }
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {zones.length === 0 && <li className="zone-item">No areas configured yet.</li>}
        </ul>
      </section>
    </main>
  )
}
