import { useState } from 'react'
import { useLogout, useMe } from './hooks/useAuth'
import { AppShell } from './components/layout/AppShell'
import { AdminDashboard } from './components/admin/AdminDashboard'
import { RoleSelector } from './components/auth/RoleSelector'
import { TeamDashboard } from './components/teams/TeamDashboard'
import { TournamentHome } from './components/tournaments/TournamentHome'
import './App.css'

function App() {
  const [activeNav, setActiveNav] = useState('Tournaments')
  const { data: me, isPending } = useMe()
  const logout = useLogout()
  if (isPending) return <div className="role-loading">Loading workspace...</div>
  if (!me) return <RoleSelector onRoleSelected={(role) => setActiveNav(role === 'Admin' ? 'Admin' : 'Tournaments')} />

  const userType = me?.userType ?? 'student'
  const isAdmin = userType === 'staff'
  const safeNav = activeNav === 'Admin' && !isAdmin ? 'Tournaments' : activeNav

  return (
    <AppShell activeNav={safeNav} onNavigate={setActiveNav} userType={userType} user={me} onLogout={() => logout.mutate()}>
      {safeNav === 'Admin' && isAdmin
        ? <AdminDashboard onNavigate={setActiveNav} />
        : safeNav === 'Teams'
          ? <TeamDashboard onNavigate={setActiveNav} />
        : <TournamentHome onRequest={() => setActiveNav('Request tournament')} />}
    </AppShell>
  )
}

export default App
