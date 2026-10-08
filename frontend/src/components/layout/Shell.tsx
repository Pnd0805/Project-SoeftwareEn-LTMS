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
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../kit/Icon'
import { Modal } from '../kit/Modal'
import type { IconName } from '../kit/Icon'
import { signout, useLtms } from '../../shared/store'
import { me } from '../../shared/selectors'
import { useLogout, useMe } from '../../hooks/useAuth'
import { useNotifications } from '../../hooks/useNotifications'
import type { MeDto } from '../../types/dto'
import { USE_MOCK } from '../../api/client'
import { useAdminAccess } from '../../hooks/useAdmin'
import { canShowAdminNav } from './adminNav'
import { navSection } from './navSection'
import { GlobalScanDialog, GlobalScanPhoto } from '../../features/checkin/GlobalScanDialog'

interface NavItem { to: string; icon: IconName; label: string; pill?: number }

function useNav(unreadCount: number, currentUser: MeDto | undefined, backendHasAdminAccess: boolean): NavItem[] {
  const s = useLtms()
  const u = USE_MOCK ? me(s) : undefined
  if (!u && !currentUser) return []
  const invites = u ? s.invites.filter(i => i.user === u.id && i.status === 'pending').length : 0
  const items: NavItem[] = [
    { to: '/', icon: 'home', label: 'Home' },
    { to: '/home/all', icon: 'trophy', label: 'Tournaments' },
  ]
  if (canShowAdminNav(USE_MOCK, u?.role, backendHasAdminAccess)) {
    items.push({
      to: '/admin',
      icon: 'shield',
      label: 'Admin',
      pill: USE_MOCK ? s.tournaments.filter(t => t.status === 'pending').length : undefined,
    })
  }
  items.push({ to: '/teams', icon: 'team', label: 'Teams', pill: USE_MOCK ? invites : undefined })
  items.push({ to: '/matches', icon: 'match', label: 'Matches' })
  items.push({ to: '/inbox', icon: 'bell', label: 'Inbox', pill: unreadCount })
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
    <form role="search" aria-label="Global search" onSubmit={submit} style={{ display: 'contents' }}>
      <input className="search" value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search tournaments, teams, players…" aria-label="Search" />
    </form>
  )
}

function ProfileAvatarLink({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false)
  // Use the public avatar URL; keep a fallback for malformed or unavailable images.
  const imageUrl = avatarUrl && (/^https?:\/\//i.test(avatarUrl) || (avatarUrl.startsWith('/') && !avatarUrl.startsWith('//')) || avatarUrl.startsWith('data:image/'))
    ? avatarUrl : null

  return (
    <Link className="avatar" to="/me" aria-label="Open my profile"
      style={{ textDecoration: 'none', overflow: 'hidden' }}>
      {imageUrl && !imageFailed
        ? <img src={imageUrl} alt="" onError={() => setImageFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (name.trim().slice(0, 1) || '?')}
    </Link>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [compact, setCompact] = useState(() => window.matchMedia?.('(max-width: 820px)').matches ?? false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 820px)')
    if (!media) return
    const change = (event: MediaQueryListEvent) => {
      setCompact(event.matches)
      setMenuOpen(false)
    }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  const [scanOpen, setScanOpen] = useState(false)
  const [scanPhoto, setScanPhoto] = useState<File | null>(null)
  const scanPhotoInput = useRef<HTMLInputElement | null>(null)
  const s = useLtms()
  const u = USE_MOCK ? me(s) : undefined
  const { data: currentUser } = useMe()
  /* `userType: staff` describes employment, not admin authorization. The
     backend queue is guarded by admin_scopes and is the current capability
     check until GET /me exposes scopes directly. */
  const adminAccess = useAdminAccess(!!currentUser)
  const logout = useLogout()
  const { data: notificationData } = useNotifications(currentUser?.id)
  const unreadCount = notificationData?.unreadCount
    ?? notificationData?.items?.filter(notification => !(notification.isRead ?? notification.read)).length ?? 0
  const nav = useNav(unreadCount, currentUser, adminAccess.data === true)
  const location = useLocation()
  const navigate = useNavigate()
  const n = unreadCount
  const displayName = currentUser?.fullName ?? (USE_MOCK ? u?.name : '') ?? ''

  /* the first tab stop — standard on GitHub, Wikipedia, gov.uk */
  const skip = (
    <button className="skip" type="button" onClick={() => document.getElementById('main')?.focus()}>
      Skip to the main content
    </button>
  )

  if (!currentUser && !u) {
    const accountActions = <><ThemeButton /><button className="btn primary" type="button" onClick={() => { signout(); navigate('/login') }}>Sign in</button></>
    return (
      <>
        {skip}
        <div className="shell guest">
          <header className="topnav">
            <span className="hstack" style={{ gap: 9 }}>
              <span style={{ width: 26, height: 26, background: 'var(--red)', display: 'grid', placeItems: 'center', clipPath: 'polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)' }}>
                <Icon name="trophy" size={14} />
              </span>
              <span className="disp" style={{ fontSize: 20 }}>LTMS</span>
            </span>
            {compact ? <span className="guest-actions">{accountActions}</span> : null}
            <nav className="links" aria-label="Public navigation">
              <Link to="/" aria-current={location.pathname === '/' ? 'page' : undefined}>Tournaments</Link>
              <Link to="/search" aria-current={location.pathname.startsWith('/search') ? 'page' : undefined}>Search</Link>
              {!compact ? accountActions : null}
            </nav>
          </header>
          <main className="main" id="main" tabIndex={-1}>{children}</main>
        </div>
      </>
    )
  }

  const activeSection = navSection(location.pathname)
  const sectionName = nav.find(item => item.to === activeSection)?.label
    ?? (location.pathname.startsWith('/search') ? 'Search' : location.pathname === '/request' ? 'Requests' : 'Player')
  const navigation = (
    <nav className="sb" aria-label="Main navigation">
      {!compact ? <div className="brand"><span className="g"><Icon name="trophy" size={14} /></span><span>LTMS</span></div> : null}
      {nav.map(item => (
        <Link key={item.to} to={item.to} className={`item ${activeSection === item.to ? 'on' : ''}`}
          aria-current={activeSection === item.to ? 'page' : undefined}
          onClick={() => setMenuOpen(false)}
          >
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {item.pill ? <span className="pill">{item.pill}</span> : null}
        </Link>
      ))}
      <div className="foot">
        <div className="sub" style={{ fontSize: 12 }}>Signed in as</div>
        <div className="account-name" style={{ fontSize: 15, fontWeight: 700, margin: '4px 0 8px' }}>{displayName}</div>
        {compact ? <div className="menu-theme"><span>Appearance</span><ThemeButton /></div> : null}
        <button className="btn ghost" type="button" style={{ width: '100%' }}
          onClick={() => { setMenuOpen(false); void logout.mutateAsync().finally(() => navigate('/login')) }}>
          <Icon name="out" size={13} /> Log out
        </button>
      </div>
    </nav>
  )
  const search = <SearchBox key="global-search" />
  const actions = (
    <span className="right" key="global-actions">
      <button className="scan-trigger" type="button" onClick={() => {
        if (window.isSecureContext === false) scanPhotoInput.current?.click()
        else setScanOpen(true)
      }}>
        <Icon name="scan" size={18} /> Scan
      </button>
      {!compact ? <><ThemeButton />
        <button className="bell" type="button" onClick={() => navigate('/inbox')}
          aria-label={`Notifications, ${n} unread`}>
          <Icon name="bell" size={17} />{n ? <i>{n}</i> : null}
        </button></> : null}
      <ProfileAvatarLink key={currentUser?.avatarUrl ?? ''} name={displayName} avatarUrl={currentUser?.avatarUrl} />
    </span>
  )

  return (
    <>
      {skip}
      <div className="shell">
        {!compact ? navigation : null}
        <div>
          <header className="tb"><div className="tbin">
            {compact ? <><button className="mobile-menu-trigger" type="button" aria-label="Open navigation menu"
              aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>Menu</button>
              <span className="mobile-context"><span className="disp">LTMS</span><span className="mobile-section">{sectionName}</span></span></> : null}
            {compact ? actions : search}
            {compact ? search : actions}
          </div></header>
          <main className="main" id="main" tabIndex={-1}>{children}</main>
        </div>
        {compact ? <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="LTMS menu" className="shell-menu">
          <button className="btn shell-menu-close" type="button" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)}>Close</button>
          {navigation}
        </Modal> : null}
        <input ref={scanPhotoInput} type="file" accept="image/*" capture="environment" hidden
          onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) setScanPhoto(file)
          }} />
        {scanOpen ? <GlobalScanDialog onClose={() => setScanOpen(false)} /> : null}
        {scanPhoto ? <GlobalScanPhoto file={scanPhoto} onClose={() => setScanPhoto(null)}
          onRetry={() => { setScanPhoto(null); scanPhotoInput.current?.click() }} /> : null}
      </div>
    </>
  )
}
