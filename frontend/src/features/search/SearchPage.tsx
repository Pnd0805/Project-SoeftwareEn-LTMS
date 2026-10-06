/**
 * src/features/search/SearchPage.tsx
 *
 * Tournaments, squads and players in one list. It reads the same `visibleTo`
 * rule the pages do, so it can never offer a door that would then refuse to open.
 */
import { Avatar } from '../../components/kit/Avatar'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Empty, Field, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { useLtms } from '../../shared/store'
import { visibleTo } from '../../shared/selectors'
import { TeamCrestView } from '../../components/kit/chips'
import { toTeamView } from '../../components/kit/viewModels'
import { formatName, teamReady } from '../../shared/rules'
import { useMe } from '../../hooks/useAuth'
import { useSearchUsers } from '../../hooks/useUser'
import { useTournaments } from '../../hooks/useTournament'
import { USE_MOCK } from '../../api/client'
import { tournamentView } from '../tournament/tournamentView'
import { useSportTypes } from '../../hooks/useReference'
import { useSearchTeams } from '../../hooks/useTeam'
import './search-inbox-workspace.css'

export function SearchPage() {
  const s = useLtms()
  const { data: currentUser } = useMe()
  const [tournamentStatus, setTournamentStatus] = useState<'public' | 'completed'>('public')
  const tournamentQuery = useTournaments({ status: tournamentStatus })
  const sportTypes = useSportTypes()
  const navigate = useNavigate()
  const { q: qParam } = useParams()
  const [q, setQ] = useState(decodeURIComponent(qParam ?? ''))
  const needle = q.trim().toLowerCase()
  const publicApplicable = !!needle && !USE_MOCK
  const playerApplicable = !!currentUser && needle.length >= 3
  const teamSearch = useSearchTeams(q, publicApplicable)

  const tournamentSource = USE_MOCK
    ? s.tournaments.filter(t => visibleTo(s, t))
    : (tournamentQuery.data?.items ?? []).map(dto => tournamentView(dto, [], [], sportTypes.data?.items ?? []))
  const tournaments = needle
    ? tournamentSource.filter(t => `${t.name} ${t.sport} ${t.venue}`.toLowerCase().includes(needle))
    : []
  const teams = USE_MOCK && needle
    ? s.teams.filter(t => `${t.name} ${t.code}`.toLowerCase().includes(needle))
    : []
  const backendTeams = !USE_MOCK && needle ? (teamSearch.data?.items ?? []) : []
  const userSearch = useSearchUsers(q, playerApplicable)
  const players = playerApplicable ? userSearch.data?.items ?? [] : []
  const total = tournaments.length + teams.length + backendTeams.length + players.length
  const teamsPending = publicApplicable && teamSearch.isPending
  const teamsError = publicApplicable && teamSearch.isError
  const publicSettled = USE_MOCK || (
    !!tournamentQuery.data && !tournamentQuery.isPending && !tournamentQuery.isError
    && !!teamSearch.data && !teamSearch.isPending && !teamSearch.isError
  )
  const playersSettled = !playerApplicable || (!!userSearch.data && !userSearch.isPending && !userSearch.isError)
  const userErrorStatus = typeof userSearch.error === 'object' && userSearch.error !== null && 'status' in userSearch.error
    ? (userSearch.error as { status?: number }).status
    : undefined

  return (
    <div className="search-page">
      <header><h1 className="disp">Search</h1><p className="sub">Find tournaments, teams and players.</p></header>

      <Panel className="search-controls">
        <Field label="Search terms" htmlFor="se-q">
          <input id="se-q" type="search" autoFocus autoComplete="off" value={q}
            onChange={e => { setQ(e.target.value); navigate(`/search/${encodeURIComponent(e.target.value)}`, { replace: true }) }}
            placeholder="Name, sport, venue, faculty…" />
        </Field>
        <Field label="Tournament status" htmlFor="se-status">
          <select id="se-status" value={tournamentStatus}
            onChange={e => setTournamentStatus(e.target.value as 'public' | 'completed')}>
            <option value="public">Open and active</option>
            <option value="completed">Completed</option>
          </select>
        </Field>
      </Panel>
      {needle ? <p className="sub search-summary" role="status">{total} result{total === 1 ? '' : 's'}{publicSettled && playersSettled ? '' : ' loaded · Search in progress or incomplete'}</p> : null}

      {!needle ? (
        <Empty icon="search" title="Type to search"
          sub="Search public tournaments and teams. Sign in to search players." />
      ) : !total && publicSettled && playersSettled ? (
        <Empty icon="search" title={`Nothing matched “${q}”`} sub="Try a sport, a faculty, or part of a name." />
      ) : null}

      {needle && currentUser && needle.length < 3 ? (
        <p className="sub">Enter at least 3 characters to search for players.</p>
      ) : null}

      {publicApplicable && tournamentQuery.isPending ? (
        <Panel quiet><span className="sub" role="status">Loading tournaments…</span></Panel>
      ) : null}

      {publicApplicable && tournamentQuery.isError ? (
        <Panel quiet>
          <span className="error" role="alert">Unable to load tournaments. Try again.</span>
          <button className="btn ghost" type="button" onClick={() => void tournamentQuery.refetch()}>Retry tournaments</button>
        </Panel>
      ) : null}

      {needle && teamsPending ? (
        <Panel quiet><span className="sub" role="status">Searching teams…</span></Panel>
      ) : teamsError ? (
        <Panel quiet>
          <span className="error" role="alert">Unable to search teams right now.</span>
          <button className="btn ghost" type="button" onClick={() => void teamSearch.refetch()}>Retry teams</button>
        </Panel>
      ) : null}

      {tournaments.length ? (
        <Panel quiet className="search-results">
          <h2>Tournaments <span className="tag">{tournaments.length}</span></h2>
          {tournaments.map(t => (
            <button className="who" type="button" key={t.id} aria-label={`Open tournament: ${t.name}`} onClick={() => navigate(`/t/${t.id}`)}>
              <span className="avatar"><Icon name="trophy" size={13} /></span>
              <span className="meta"><b>{t.name}</b><span className="tag">{t.sport} · {formatName(t)} · {t.status}</span></span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </Panel>
      ) : null}

      {teams.length ? (
        <Panel quiet className="search-results">
          <h2>Teams <span className="tag">{teams.length}</span></h2>
          {teams.map(t => (
            <button className="who" type="button" key={t.id} aria-label={`Open team: ${t.name}`} onClick={() => navigate(`/team/${t.id}`)}>
              <TeamCrestView team={toTeamView(t)} size={24} />
              <span className="meta">
                <b>{t.name}</b>
                <span className="tag">{t.sport ?? 'no sport named'} · {teamReady(t) ? 'Ready' : 'Forming'} · {t.members.length} players</span>
              </span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </Panel>
      ) : null}

      {backendTeams.length ? (
        <Panel quiet className="search-results">
          <h2>Teams <span className="tag">{backendTeams.length}</span></h2>
          {backendTeams.map(t => (
            <button className="who" type="button" key={t.id} aria-label={`Open team: ${t.name}`} onClick={() => navigate(`/team/${t.id}`)}>
              <TeamCrestView team={{ id: t.id, name: t.name, code: t.name.slice(0, 3).toUpperCase(), color: null, logoUrl: t.logoUrl ?? null }} size={24} />
              <span className="meta">
                <b>{t.name}</b>
                <span className="tag">Sport #{t.sportTypeId} · {t.readinessStatus} · {t.memberCount} players</span>
              </span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </Panel>
      ) : null}

      {playerApplicable && userSearch.isPending ? (
        <Panel quiet><span className="sub" role="status">Searching players…</span></Panel>
      ) : null}
      {playerApplicable && userSearch.isError ? (
        <Panel quiet>
          <span className="error" role="alert">
            {userErrorStatus === 401 ? 'Sign in again to search players.'
              : userErrorStatus === 403 ? 'Your account is not allowed to search players.'
                : 'Unable to search players right now. Please retry.'}
          </span>
          <button className="btn ghost" type="button" onClick={() => void userSearch.refetch()}>Retry players</button>
        </Panel>
      ) : null}
      {players.length ? (
        <Panel quiet className="search-results">
          <h2>Players <span className="tag">{players.length}</span></h2>
          {players.map(u => (
            <button className="who" type="button" key={u.id} aria-label={`Open player: ${u.fullName}`} onClick={() => navigate(`/player/${u.id}`)}>
              <Avatar name={u.fullName} avatarUrl={u.avatarUrl} />
              <span className="meta"><b>{u.fullName}</b></span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </Panel>
      ) : null}
    </div>
  )
}
