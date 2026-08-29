import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useLogout, useMe } from './hooks/useAuth'
import { AppShell } from './components/layout/AppShell'
import { RoleSelector } from './components/auth/RoleSelector'
import { HomePage } from './pages/HomePage'
import { TournamentsPage } from './pages/TournamentsPage'
import { TeamsPage } from './pages/TeamsPage'
import { MatchesPage } from './pages/MatchesPage'
import { InboxPage } from './pages/InboxPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminPage } from './pages/AdminPage'
import './App.css'

const navToPath: Record<string, string> = {
  Home: '/home',
  Tournaments: '/tournaments',
  Teams: '/teams',
  Matches: '/matches',
  Inbox: '/inbox',
  Profile: '/profile',
  Admin: '/admin',
}

const pathToNav: Record<string, string> = Object.fromEntries(
  Object.entries(navToPath).map(([label, path]) => [path, label]),
)

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: me, isPending } = useMe()
  const logout = useLogout()

  const activeNav = pathToNav[location.pathname] ?? 'Tournaments'

  const handleNavigate = (label: string) => {
    const nextPath = navToPath[label] ?? '/tournaments'
    navigate(nextPath)
  }

  if (isPending) return <div className="role-loading">Loading workspace...</div>
  if (!me) {
    return (
      <RoleSelector
        onRoleSelected={(role) => navigate(role === 'Admin' ? '/admin' : '/tournaments')}
      />
    )
  }

  const userType = me?.userType ?? 'student'
  const isAdmin = userType === 'staff'
  const safeNav = activeNav === 'Admin' && !isAdmin ? 'Tournaments' : activeNav

  return (
    <AppShell
      activeNav={safeNav}
      onNavigate={handleNavigate}
      userType={userType}
      user={me}
      onLogout={() => logout.mutate()}
    >
      <Routes>
        <Route path="/" element={<Navigate to={isAdmin ? '/admin' : '/tournaments'} replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/tournaments" element={<TournamentsPage onNavigate={handleNavigate} />} />
        <Route path="/teams" element={<TeamsPage onNavigate={handleNavigate} />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/profile" element={<ProfilePage user={me} />} />
        <Route
          path="/admin"
          element={isAdmin ? <AdminPage onNavigate={handleNavigate} /> : <Navigate to="/tournaments" replace />}
        />
        <Route path="*" element={<Navigate to={isAdmin ? '/admin' : '/tournaments'} replace />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  return <AppContent />
}

export default App
