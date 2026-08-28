import { MailPlus, Plus, Search, ShieldCheck, UsersRound } from 'lucide-react'

interface TeamDashboardProps {
    onNavigate: (label: string) => void
}

interface TeamSummary {
    name: string
    code: string
    sport: string
    members: number
    minimum: number
    status: 'Ready' | 'Forming'
    role: 'Captain' | 'Player'
    color: string
}

const teams: TeamSummary[] = [
    { name: 'Byte Force', code: 'BYT', sport: 'VALORANT', members: 5, minimum: 5, status: 'Ready', role: 'Captain', color: 'red' },
    { name: 'Engineering United', code: 'ENG', sport: 'Football', members: 9, minimum: 7, status: 'Ready', role: 'Player', color: 'green' },
    { name: 'Circuit Breakers', code: 'CIR', sport: 'Futsal', members: 3, minimum: 5, status: 'Forming', role: 'Player', color: 'gold' },
]

export function TeamDashboard({ onNavigate }: TeamDashboardProps) {
  return (
    <div className="page-stack teams-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Squad management · Your teams</span>
          <h1>Teams</h1>
          <p>Create a squad, manage its roster, and prepare it for tournament entry.</p>
        </div>
        <button className="primary-button" type="button">
          <Plus size={17} /> Create team
        </button>
      </div>

      <section className="teams-overview" aria-label="Team overview">
        <div className="teams-overview-copy">
          <span className="eyebrow">Your squad desk</span>
          <h2>Three teams, one next step</h2>
          <p>Byte Force is ready for registration. Circuit Breakers needs two more accepted members.</p>
        </div>
        <div className="teams-overview-stats">
          <div><strong>3</strong><span>Teams</span></div>
          <div><strong>17</strong><span>Members</span></div>
          <div><strong>2</strong><span>Ready</span></div>
        </div>
      </section>

      <div className="teams-toolbar">
        <label className="teams-search">
          <Search size={16} />
          <input aria-label="Search teams" placeholder="Search your teams" />
        </label>
        <div className="teams-filter" role="group" aria-label="Filter teams">
          <button className="teams-filter-active" type="button">All</button>
          <button type="button">Ready</button>
          <button type="button">Forming</button>
        </div>
      </div>

      <section className="teams-grid" aria-label="Your teams">
        {teams.map((team) => (
          <article className="team-card" key={team.name}>
            <div className={`team-card-mark team-mark-${team.color}`}>{team.code}</div>
            
            <div className="team-card-heading">
              <div>
                <span className="eyebrow">{team.sport}</span>
                <h2>{team.name}</h2>
              </div>
              <span className={`status-badge status-${team.status.toLowerCase()}`}>{team.status}</span>
            </div>

            <div className="team-card-meta">
              <span><UsersRound size={15} /> {team.members} members</span>
              <span><ShieldCheck size={15} /> {team.role}</span>
            </div>

            <div className="team-progress">
              <div className="team-progress-label">
                <span>Roster readiness</span>
                <strong>{team.members} / {team.minimum}</strong>
              </div>
              <div className="team-progress-track">
                <span style={{ width: `${Math.min(100, team.members / team.minimum * 100)}%` }} />
              </div>
            </div>

            <div className="team-card-footer">
              <button className="secondary-button" type="button">Manage team</button>
              {team.status === 'Ready' ? (
                <button className="team-text-button" type="button" onClick={() => onNavigate('Tournaments')}>
                  Find tournaments
                </button>
              ) : (
                <button className="team-text-button" type="button">
                  <MailPlus size={15} /> Invite members
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
