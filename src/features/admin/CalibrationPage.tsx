export function CalibrationPage() {
  return (
    <main className="admin-layout">
      <section className="card">
        <h2>Calibration (TBD)</h2>
        <p className="muted">
          Placeholder for LiDAR alignment, sensor offset correction, and calibration profile
          management.
        </p>
      </section>
      <section className="card">
        <h2>Planned Controls</h2>
        <ul>
          <li>Point-cloud alignment presets per stream</li>
          <li>Ground-plane correction and distance sanity check</li>
          <li>Drift diagnostics and profile export/import</li>
        </ul>
      </section>
    </main>
  )
}
