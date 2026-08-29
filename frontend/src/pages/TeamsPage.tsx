import { TeamDashboard } from '../components/teams/TeamDashboard'

interface TeamsPageProps {
  onNavigate: (label: string) => void
}

export function TeamsPage({ onNavigate }: TeamsPageProps) {
  return <TeamDashboard onNavigate={onNavigate} />
}
