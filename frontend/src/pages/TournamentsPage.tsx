import { TournamentHome } from '../components/tournaments/TournamentHome'

interface TournamentsPageProps {
  onNavigate: (label: string) => void
}

export function TournamentsPage({ onNavigate }: TournamentsPageProps) {
  return <TournamentHome onRequest={() => onNavigate('Tournaments')} />
}
