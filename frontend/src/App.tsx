/**
 * src/App.tsx
 *
 * Route table for the ported prototype (77 screens, FRONTEND-SPEC.md "Screen
 * list"). One PUBLIC list decides who gets the shell without signing in — a
 * guest, or anyone once they choose "Continue as guest" — everything else
 * bounces to /login, same as the prototype's `render()` guard.
 */
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import { Toasts } from './components/kit/Toasts'
import { useLtms } from './shared/store'
import { isGuest } from './shared/selectors'
import { useMe } from './hooks/useAuth'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { HomePage } from './features/home/HomePage'
import { TournamentPage } from './features/tournament/TournamentPage'
import { MatchPage } from './features/match/MatchPage'
import { FixturePage } from './features/match/FixturePage'
import { CheckinPage } from './features/checkin/CheckinPage'
import { MvpPage } from './features/mvp/MvpPage'
import { TeamPage } from './features/team/TeamPage'
import { PlayerPage } from './features/player/PlayerPage'
import { WatchPage } from './features/watch/WatchPage'
import { TeamsPage } from './features/team/TeamsPage'
import { MatchesPage } from './features/matches/MatchesPage'
import { InboxPage } from './features/inbox/InboxPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { AdminPage } from './features/admin/AdminPage'
import { RequestPage } from './features/request/RequestPage'
import { SearchPage } from './features/search/SearchPage'

/* every route a Guest may open without signing in — bracket, schedule, search,
   a squad or player profile, and the tournament page itself (visibleTo still
   gates a private draft) */
const PUBLIC_PATHS = [
  /^\/$/, /^\/home/, /^\/t\//, /^\/m\//, /^\/checkin\//, /^\/mvp\//,
  /^\/team\//, /^\/player\//, /^\/watch\//, /^\/search/, /^\/login$/,
]

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
      </Shell>
      <Toasts />
    </Guard>
  )
}
