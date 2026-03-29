import { NavLink } from 'react-router-dom'
import { AppRoutes } from './app/routes'

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand-dot" />
          <span className="topbar-title">Mantak Operational Console</span>
        </div>
        <nav className="topbar-nav" aria-label="Primary">
          <NavItem to="/operator">Operator</NavItem>
          <NavItem to="/admin/interest-areas">Interest Areas</NavItem>
          <NavItem to="/admin/calibration">Calibration</NavItem>
          <NavItem to="/admin/pole-control">Pole Control</NavItem>
        </nav>
      </header>
      <AppRoutes />
    </div>
  )
}

interface NavItemProps {
  to: string
  children: string
}

function NavItem({ to, children }: NavItemProps) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <button className="nav-btn" data-active={isActive} type="button">
          {children}
        </button>
      )}
    </NavLink>
  )
}

export default App
