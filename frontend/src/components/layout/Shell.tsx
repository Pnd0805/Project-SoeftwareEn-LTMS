/**
 * src/components/layout/Shell.tsx
 *
 * One shell, its menu filtered by role (FRONTEND-SPEC "Nav shell"). A guest gets
 * the public topnav and no sidebar; every signed-in role gets the fixed left
 * sidebar plus a topbar carrying search, the bell and the avatar.
 *
 * The bar bleeds the full width so its lower edge reads as an edge, but its
 * contents carry the same max-width as <main> — otherwise the avatar sits against
 * the window while the content it belongs to stops hundreds of pixels short.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../kit/Icon'
import type { IconName } from '../kit/Icon'
import { signout, useLtms } from '../../shared/store'
import { me, unread } from '../../shared/selectors'

interface NavItem { to: string; icon: IconName; label: string; pill?: number }

function useNav(): NavItem[] {
  const s = useLtms()
  const u = me(s)
  if (!u) return []
  const invites = s.invites.filter(i => i.user === u.id && i.status === 'pending').length
  const items: NavItem[] = [{ to: '/', icon: 'trophy', label: 'Tournaments' }]
  if (u.role === 'Admin') {
    items.push({ to: '/admin', icon: 'shield', label: 'Admin', pill: s.tournaments.filter(t => t.status === 'pending').length })
  }
  items.push({ to: '/teams', icon: 'team', label: 'Teams', pill: invites })
  items.push({ to: '/matches', icon: 'match', label: 'Matches' })
  items.push({ to: '/inbox', icon: 'bell', label: 'Inbox', pill: unread(s) })
  items.push({ to: '/me', icon: 'user', label: 'Profile' })
  return items
}

/**
 * The theme is already stamped on <html> by the boot script in index.html, so
 * this reads it rather than deciding it — that is what keeps the button label
 * honest for someone whose OS is light and who never touched the toggle.
 * The choice persists under the same key the prototype used.
 */
const THEME_KEY = 'ltms-theme'

function useThemeToggle() {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light')
  const toggle = () => {
    const next = !light
    document.documentElement.dataset.theme = next ? 'light' : 'dark'
    try { localStorage.setItem(THEME_KEY, next ? 'light' : 'dark') } catch { /* private mode */ }
    setLight(next)
  }
  return { light, toggle }
}

function ThemeButton() {
  const { light, toggle } = useThemeToggle()
  return (
    <button className="theme-toggle" type="button" onClick={toggle}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}>
      <Icon name={light ? 'moon' : 'sun'} size={17} />
    </button>
  )
}

function SearchBox() {
  const navigate = useNavigate()
  const location = useLocation()
  const initial = location.pathname.startsWith('/search')
    ? decodeURIComponent(location.pathname.slice('/search/'.length))
    : ''
  const [q, setQ] = useState(initial)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/search/${encodeURIComponent(q.trim())}` : '/search')
  }
  return (
    <form onSubmit={submit} style={{ display: 'contents' }}>
      <input className="search" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search tournaments, teams, players…" aria-label="Search" />
    </form>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const s = useLtms()
  const u = me(s)
  const nav = useNav()
  const location = useLocation()
  const navigate = useNavigate()
  const n = unread(s)

  /* the first tab stop — standard on GitHub, Wikipedia, gov.uk */
  const skip = (
    <button className="skip" type="button" onClick={() => document.getElementById('main')?.focus()}>
      Skip to the main content
    </button>
  )

  if (!u) {
    return (
      <>
        {skip}
        <div className="shell guest">
          <div className="topnav">
            <span className="hstack" style={{ gap: 9 }}>
              <span style={{ width: 26, height: 26, background: 'var(--red)', display: 'grid', placeItems: 'center', clipPath: 'polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)' }}>
                <Icon name="trophy" size={14} />
              </span>
              <span className="disp" style={{ fontSize: 20 }}>LTMS</span>
            </span>
            <span className="links">
              <Link to="/">Tournaments</Link>
              <Link to="/search">Search</Link>
              <ThemeButton />
              <button className="btn primary" type="button" onClick={() => { signout(); navigate('/login') }}>Sign in</button>
            </span>
          </div>
          <main className="main" id="main" tabIndex={-1}>{children}</main>
        </div>
      </>
    )
  }

  const active = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <>
      {skip}
      <div className="shell">
        <nav className="sb">
          <div className="brand"><span className="g"><Icon name="trophy" size={14} /></span><span>LTMS</span></div>
          {nav.map(item => (
            <button key={item.to} className={`item ${active(item.to) ? 'on' : ''}`} type="button"
              onClick={() => navigate(item.to)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.pill ? <span className="pill">{item.pill}</span> : null}
            </button>
          ))}
          <div className="foot">
            <div className="tag"><em>//</em> Signed in as</div>
            <div style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 8px' }}>{u.name}</div>
            <button className="btn ghost" type="button" style={{ width: '100%' }}
              onClick={() => { signout(); navigate('/login') }}>
              <Icon name="out" size={13} /> Switch role
            </button>
          </div>
        </nav>
        <div>
          <div className="tb"><div className="tbin">
            <SearchBox />
            <span className="right">
              <ThemeButton />
              <button className="bell" type="button" onClick={() => navigate('/inbox')}
                aria-label={`Notifications, ${n} unread`}>
                <Icon name="bell" size={17} />{n ? <i>{n}</i> : null}
              </button>
              <span className="avatar">{u.name.slice(0, 1)}</span>
            </span>
          </div></div>
          <main className="main" id="main" tabIndex={-1}>{children}</main>
        </div>
      </div>
    </>
  )
}
