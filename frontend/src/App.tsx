import { useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { TournamentHome } from './components/tournaments/TournamentHome'
import './App.css'

function App() {
  const [activeNav, setActiveNav] = useState('Tournaments')

  return (
    <AppShell activeNav={activeNav} onNavigate={setActiveNav}>
      <TournamentHome onRequest={() => setActiveNav('Request tournament')} />
    </AppShell>
  )
}

export default App
