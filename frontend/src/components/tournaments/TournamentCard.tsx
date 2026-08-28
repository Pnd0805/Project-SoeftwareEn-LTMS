import { ArrowUpRight, CalendarDays, MapPin, Users } from 'lucide-react'

export interface TournamentSummary {
  id: string
  title: string
  sport: string
  status: 'Open' | 'Competing' | 'Finished'
  date: string
  venue: string
  teams: number
  capacity: number
  accent?: 'green' | 'red' | 'gold' | 'blue'
}

interface TournamentCardProps {
  tournament: TournamentSummary
  featured?: boolean
}

const accents = ['green', 'red', 'gold', 'blue'] as const

function accentFor(tournament: TournamentSummary) {
  if (tournament.accent) return tournament.accent

  const hash = [...tournament.id].reduce((total, character) => total + character.charCodeAt(0), 0)
  return accents[hash % accents.length]
}

export function TournamentCard({ tournament, featured = false }: TournamentCardProps) {
  const accent = accentFor(tournament)

  return (
    <article className={`tournament-card accent-${accent} ${featured ? 'tournament-card-featured' : ''}`}>
      <div className="card-topline">
        <span className={`status-badge status-${tournament.status.toLowerCase()}`}>{tournament.status}</span>
        <span className="sport-label">{tournament.sport}</span>
      </div>
      <h3>{tournament.title}</h3>
      <div className="card-details">
        <span><CalendarDays size={15} /> {tournament.date}</span>
        <span><MapPin size={15} /> {tournament.venue}</span>
      </div>
      <div className="card-footer">
        <span><Users size={15} /> {tournament.teams} / {tournament.capacity} teams</span>
        <button type="button" className="open-link" aria-label={`Open ${tournament.title}`}><ArrowUpRight size={17} /></button>
      </div>
    </article>
  )
}