import { useState } from 'react'

export function PoleControlPage() {
  const [status, setStatus] = useState<'open' | 'closed'>('closed')

  return (
    <main className="admin-layout">
      <section className="card">
        <h2>LiDAR Pole Control</h2>
        <p className="muted">
          Phase 1 provides guarded UI controls only. Hardware command integration is pending.
        </p>
      </section>
      <section className="card">
        <h2>Current Status</h2>
        <p>
          Pole state: <strong>{status}</strong>
        </p>
        <div className="input-row" style={{ marginTop: 10 }}>
          <button className="small-btn" type="button" onClick={() => setStatus('open')}>
            Open pole
          </button>
          <button className="small-btn" type="button" onClick={() => setStatus('closed')}>
            Close pole
          </button>
        </div>
      </section>
    </main>
  )
}
