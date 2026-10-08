/**
 * src/App.tsx
 *
 * Route table for the ported prototype (77 screens, FRONTEND-SPEC.md "Screen
 * list"). One PUBLIC list decides who gets the shell without signing in — a
 * guest, or anyone once they choose "Continue as guest" — everything else
 * bounces to /login, same as the prototype's `render()` guard.
 */
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { Toasts } from './components/kit/Toasts'
import { useLtms } from './shared/store'
import { isGuest } from './shared/selectors'
import { useMe } from './hooks/useAuth'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { HomePage } from './features/home/HomePage'

const TournamentPage = lazy(() => import('./features/tournament/TournamentPage').then(module => ({ default: module.TournamentPage })))
const MatchPage = lazy(() => import('./features/match/MatchPage').then(module => ({ default: module.MatchPage })))
const FixturePage = lazy(() => import('./features/match/FixturePage').then(module => ({ default: module.FixturePage })))
const CheckinPage = lazy(() => import('./features/checkin/CheckinPage').then(module => ({ default: module.CheckinPage })))
const MvpPage = lazy(() => import('./features/mvp/MvpPage').then(module => ({ default: module.MvpPage })))
const TeamPage = lazy(() => import('./features/team/TeamPage').then(module => ({ default: module.TeamPage })))
const PlayerPage = lazy(() => import('./features/player/PlayerPage').then(module => ({ default: module.PlayerPage })))
const WatchPage = lazy(() => import('./features/watch/WatchPage').then(module => ({ default: module.WatchPage })))
const TeamsPage = lazy(() => import('./features/team/TeamsPage').then(module => ({ default: module.TeamsPage })))
const MatchesPage = lazy(() => import('./features/matches/MatchesPage').then(module => ({ default: module.MatchesPage })))
const InboxPage = lazy(() => import('./features/inbox/InboxPage').then(module => ({ default: module.InboxPage })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then(module => ({ default: module.ProfilePage })))
const AdminPage = lazy(() => import('./features/admin/AdminPage').then(module => ({ default: module.AdminPage })))
const RequestPage = lazy(() => import('./features/request/RequestPage').then(module => ({ default: module.RequestPage })))
const SearchPage = lazy(() => import('./features/search/SearchPage').then(module => ({ default: module.SearchPage })))

/* every route a Guest may open without signing in — bracket, schedule, search,
   a squad or player profile, and the tournament page itself (visibleTo still
   gates a private draft) */
const PUBLIC_PATHS = [
  /^\/$/, /^\/home/, /^\/t\//, /^\/m\//, /^\/checkin\//, /^\/mvp\//,
  /^\/team\//, /^\/player\//, /^\/watch\//, /^\/search/, /^\/login$/,
]

function routeSection(pathname: string) {
  return /^\/m\/[^/]+\/fixture$/.test(pathname) ? 'fixture' : pathname.split('/')[1] || 'home'
}

function RouteLoading() {
  const { pathname } = useLocation()
  const names: Record<string, string> = {
    t: 'tournament', m: 'match', fixture: 'match fixture', checkin: 'check-in', mvp: 'match MVP',
    team: 'squad', player: 'player profile', watch: 'watch', teams: 'squads',
    matches: 'matches', inbox: 'inbox', me: 'profile', admin: 'admin',
    request: 'tournament request', search: 'search',
  }
  const name = names[routeSection(pathname)] ?? 'page'
  return <div className="panel" role="status"><b>Loading {name}…</b></div>
}

function Guard({ children, currentUser, isLoading }: {
  children: React.ReactNode
  currentUser: ReturnType<typeof useMe>['data']
  isLoading: boolean
}) {
  const s = useLtms()
  const location = useLocation()
  const signedIn = !!currentUser
  const guest = isGuest(s)
  const isPublic = PUBLIC_PATHS.some(p => p.test(location.pathname))
  if (isLoading) return null
  if (!signedIn && !guest && !isPublic) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { data: currentUser, isLoading } = useMe()
  const location = useLocation()

  if (location.pathname === '/login' || location.pathname === '/register') {
    return (
      <>
        {location.pathname === '/login' ? <LoginPage /> : <RegisterPage />}
        <Toasts />
      </>
    )
  }

  return (
    <Guard currentUser={currentUser} isLoading={isLoading}>
      <Shell>
        {/* กันหน้าจอดับทั้งหน้าเมื่อ component ใด component หนึ่ง render พัง
            (เมนู แถบบน และการนำทางยังอยู่ ผู้ใช้ไม่ต้องเดาว่าเกิดอะไรขึ้น) */}
        <ErrorBoundary resetKey={location.pathname} label="This page">
        <Suspense key={routeSection(location.pathname)} fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home/:tab" element={<HomePage />} />
          <Route path="/t/:id" element={<TournamentPage />} />
          <Route path="/t/:id/:tab" element={<TournamentPage />} />
          <Route path="/t/:id/:tab/:sub" element={<TournamentPage />} />
          <Route path="/m/:id" element={<MatchPage />} />
          <Route path="/m/:id/fixture" element={<FixturePage />} />
          <Route path="/m/:id/:tab" element={<MatchPage />} />
          <Route path="/checkin/:id" element={<CheckinPage />} />
          <Route path="/mvp/:id" element={<MvpPage />} />
          <Route path="/team/:id" element={<TeamPage />} />
          <Route path="/player/:id" element={<PlayerPage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/search/:q" element={<SearchPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/teams" element={currentUser ? <TeamsPage /> : <Navigate to="/login" replace />} />
          <Route path="/matches" element={currentUser ? <MatchesPage /> : <Navigate to="/login" replace />} />
          <Route path="/inbox" element={currentUser ? <InboxPage /> : <Navigate to="/login" replace />} />
          <Route path="/me" element={currentUser ? <ProfilePage /> : <Navigate to="/login" replace />} />
          <Route path="/request" element={currentUser ? <RequestPage /> : <Navigate to="/login" replace />} />
          <Route path="/admin" element={currentUser ? <AdminPage /> : <Navigate to="/login" replace />} />
          <Route path="/admin/:tab" element={currentUser ? <AdminPage /> : <Navigate to="/login" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </Shell>
      <Toasts />
    </Guard>
  )
}
