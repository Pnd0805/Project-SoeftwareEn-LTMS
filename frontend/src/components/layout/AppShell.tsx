import { Bell, ChevronDown, Home, LogOut, Search, Shield, Trophy, Users, CalendarDays, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MeDto } from '../../types/dto'

interface AppShellProps {
  activeNav: string
  onNavigate: (label: string) => void
  userType: 'student' | 'staff' | 'external'
  user: MeDto
  onLogout: () => void
  children: ReactNode
}

const navItems = [
  { label: 'Tournaments', icon: Trophy },
  { label: 'Teams', icon: Users },
  { label: 'Matches', icon: CalendarDays },
  { label: 'Inbox', icon: Bell, badge: 3 },
]

export function AppShell({ activeNav, onNavigate, userType, user, onLogout, children }: AppShellProps) {
  const isAdmin = userType === 'staff'
  const roleLabel = isAdmin ? 'Admin' : userType === 'external' ? 'External user' : 'Student'
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark"><Trophy size={17} /></span>
          <span>LTMS</span>
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <button className="nav-item nav-item-muted" type="button" onClick={() => onNavigate('Home')}>
            <Home size={17} /> Home
          </button>
          {navItems.map(({ label, icon: Icon, badge }) => (
            <button
              className={`nav-item ${activeNav === label ? 'nav-item-active' : ''}`}
              key={label}
              type="button"
              onClick={() => onNavigate(label)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {badge && <span className="nav-badge">{badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item nav-item-muted" type="button" onClick={() => onNavigate('Profile')}>
            <UserRound size={17} /> Profile
          </button>
          {isAdmin && <button className="nav-item nav-item-muted" type="button" onClick={() => onNavigate('Admin')}>
            <Shield size={17} /> Admin
          </button>}
        </div>
      </aside>

      <div className="content-column">
        <header className="topbar">
          <div className="topbar-inner">
            <label className="global-search">
              <Search size={17} />
              <input aria-label="Search" placeholder="Search tournaments, teams, players" />
              <kbd>⌘ K</kbd>
            </label>
            <div className="topbar-actions">
              <button className="icon-button" type="button" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
              <button className="account-button" type="button" onClick={() => onNavigate('Profile')}>
                <span className="avatar avatar-red">{user.fullName.slice(0, 2).toUpperCase()}</span>
                <span className="account-copy"><strong>{user.fullName}</strong><small>{roleLabel}</small></span>
                <ChevronDown size={16} />
              </button>
              <button className="icon-button" type="button" aria-label="Switch role" title="Switch role" onClick={onLogout}><LogOut size={17} /></button>
            </div>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}