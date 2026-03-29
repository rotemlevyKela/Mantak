import { useState } from 'react'
import { AppRoutes } from './app/routes'
import kelaLogo from './assets/kela-symbol.svg'

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <img src={kelaLogo} alt="Kela" width="20" height="20" className="topbar-logo" />
          <button
            className="topbar-hamburger"
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span /><span /><span />
          </button>
          <span className="topbar-label">Alerts</span>
        </div>
        <button className="topbar-settings" type="button" aria-label="Settings">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9.04642 2.3125L8.60415 4.54058C7.86664 4.81462 7.1847 5.19747 6.58587 5.68049L4.40788 4.94239L2.31238 8.51215L4.05512 10.0004C3.99333 10.373 3.95333 10.7523 3.95333 11.142C3.95333 11.5318 3.99333 11.9111 4.05512 12.2837L2.31238 13.7719L4.40788 17.3417L6.58587 16.6036C7.1847 17.0866 7.86664 17.4695 8.60415 17.7435L9.04642 19.9716H13.2374L13.6797 17.7435C14.4172 17.4695 15.0992 17.0866 15.698 16.6036L17.876 17.3417L19.9715 13.7719L18.2287 12.2837C18.2905 11.9111 18.3305 11.5318 18.3305 11.142C18.3305 10.7523 18.2905 10.373 18.2287 10.0004L19.9715 8.51215L17.876 4.94239L15.698 5.68049C15.0992 5.19747 14.4172 4.81462 13.6797 4.54058L13.2374 2.3125H9.04642ZM11.1419 7.61023C13.1269 7.61023 14.7362 9.1916 14.7362 11.142C14.7362 13.0925 13.1269 14.6739 11.1419 14.6739C9.15697 14.6739 7.54763 13.0925 7.54763 11.142C7.54763 9.1916 9.15697 7.61023 11.1419 7.61023Z" fill="white" />
          </svg>
        </button>
      </header>

      {menuOpen && (
        <nav className="dropdown-menu" onClick={() => setMenuOpen(false)}>
          <a href="/operator" className="dropdown-item">Operator</a>
          <a href="/admin/interest-areas" className="dropdown-item">Interest Areas</a>
          <a href="/admin/calibration" className="dropdown-item">Calibration</a>
          <a href="/admin/pole-control" className="dropdown-item">Pole Control</a>
        </nav>
      )}

      <AppRoutes />
    </div>
  )
}

export default App
