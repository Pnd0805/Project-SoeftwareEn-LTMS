/**
 * src/features/search/SearchPage.tsx
 *
 * Tournaments, squads and players in one list. It reads the same `visibleTo`
 * rule the pages do, so it can never offer a door that would then refuse to open.
 */
import { Avatar } from '../../components/kit/Avatar'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Empty, Field, Panel, Tabs } from '../../components/kit/primitives'
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
import { useFaculties, useSportTypes } from '../../hooks/useReference'
import type { TournamentFilters } from '../../api/tournamentFilters'
import { useNow } from '../../hooks/useNow'
import { useSearchTeams } from '../../hooks/useTeam'
import './search-inbox-workspace.css'
import { searchUserLabel } from '../../shared/display'

export function SearchPage() {
  const s = useLtms()
  const now = useNow()
  const { data: currentUser } = useMe()
  const [category, setCategory] = useState('all')
  const sportTypes = useSportTypes()
  const faculties = useFaculties()
  const navigate = useNavigate()
  const { q: qParam } = useParams()
  const q = qParam ?? ''
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(q.trim())
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 350)
    return () => clearTimeout(timer)
  }, [q])
  const debouncing = search !== q.trim()
  const tournamentStatus = (['completed', 'cancelled'].includes(params.get('status') ?? '') ? params.get('status') : 'public') as TournamentFilters['status']
  const filters: TournamentFilters = {
    status: tournamentStatus, q: search,
    sportTypeId: Number(params.get('sportTypeId')) || undefined,
    facultyId: Number(params.get('facultyId')) || undefined,
    registration: (params.get('registration') || undefined) as TournamentFilters['registration'],
    startFrom: params.get('startFrom') ?? '', startTo: params.get('startTo') ?? '',
  }
  const hasTournamentFilters = tournamentStatus !== 'public' || !!(filters.sportTypeId || filters.facultyId || filters.registration || filters.startFrom || filters.startTo)
  const searched = !!search || hasTournamentFilters
  const filter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  const tournamentQuery = useTournaments(filters, searched && !debouncing)
  const validation = tournamentQuery.error && typeof tournamentQuery.error === 'object' && 'status' in tournamentQuery.error
    && tournamentQuery.error.status === 400 && 'code' in tournamentQuery.error && tournamentQuery.error.code === 'VALIDATION_FAILED'
    && 'fields' in tournamentQuery.error ? tournamentQuery.error.fields as Record<string, string> | undefined : undefined
  const fieldError = (key: string) => !debouncing && validation?.[key]
  const needle = search.toLowerCase()
  const publicApplicable = !!needle && !USE_MOCK
  const playerApplicable = !!currentUser && needle.length >= 3
  const teamSearch = useSearchTeams(search, publicApplicable && !debouncing)

  const tournamentSource = USE_MOCK
    ? s.tournaments.filter(t => visibleTo(s, t))
    : (tournamentQuery.data?.items ?? []).map(dto => tournamentView(dto, [], [], sportTypes.data?.items ?? []))
  const tournaments = searched && !debouncing
    ? USE_MOCK ? tournamentSource.filter(t => {
      const open = t.registrationOpen === true && (!t.registrationStart || Date.parse(t.registrationStart) <= now)
        && (!t.registrationEnd || Date.parse(t.registrationEnd) >= now)
      return t.name.toLowerCase().includes(needle)
        && (t.serverStatus ?? t.status) === tournamentStatus
        && (!filters.sportTypeId || t.sport === sportTypes.data?.items.find(sport => sport.id === filters.sportTypeId)?.name)
        && (!filters.facultyId || s.users.find(user => user.id === t.organizer)?.faculty === faculties.data?.items.find(faculty => faculty.id === filters.facultyId)?.name)
        && (!filters.registration || open === (filters.registration === 'open'))
        && (!filters.startFrom || t.date >= filters.startFrom) && (!filters.startTo || t.date <= filters.startTo)
    }) : tournamentSource
    : []
  const teams = USE_MOCK && needle && !debouncing
    ? s.teams.filter(t => `${t.name} ${t.code}`.toLowerCase().includes(needle))
    : []
  const backendTeams = !USE_MOCK && needle && !debouncing ? (teamSearch.data?.items ?? []) : []
  const userSearch = useSearchUsers(search, playerApplicable && !debouncing)
  const players = playerApplicable && !debouncing ? userSearch.data?.items ?? [] : []
  const total = tournaments.length + teams.length + backendTeams.length + players.length
  const teamsPending = publicApplicable && teamSearch.isPending
  const teamsError = publicApplicable && teamSearch.isError
  const publicSettled = !debouncing && (USE_MOCK || (
    !!tournamentQuery.data && !tournamentQuery.isPending && !tournamentQuery.isError
    && (!needle || !!teamSearch.data && !teamSearch.isPending && !teamSearch.isError)
  ))
  const playersSettled = !playerApplicable || (!!userSearch.data && !userSearch.isPending && !userSearch.isError)
  const categoryCount = category === 'tournaments' ? tournaments.length
    : category === 'teams' ? teams.length + backendTeams.length : players.length
  const categorySettled = category === 'tournaments'
    ? USE_MOCK || (!!tournamentQuery.data && !tournamentQuery.isPending && !tournamentQuery.isError)
    : category === 'teams' ? USE_MOCK || (!!teamSearch.data && !teamSearch.isPending && !teamSearch.isError)
      : playerApplicable && playersSettled
  const userErrorStatus = typeof userSearch.error === 'object' && userSearch.error !== null && 'status' in userSearch.error
    ? (userSearch.error as { status?: number }).status
    : undefined

  return (
    <div className="search-page">
      <header><h1 className="disp">Search</h1><p className="sub">Find tournaments, teams and players.</p></header>

      <Panel className="search-controls">
        <Field label="Search terms" htmlFor="se-q">
          <input id="se-q" type="search" autoFocus autoComplete="off" value={q}
            onChange={e => navigate({ pathname: `/search/${encodeURIComponent(e.target.value)}`, search: params.toString() }, { replace: true })}
            placeholder="Tournament, team or player name…" />
        </Field>
        <Field label="Tournament status" htmlFor="se-status">
          <select id="se-status" value={tournamentStatus}
            onChange={e => filter('status', e.target.value)}>
            <option value="public">Open and active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Sport" htmlFor="se-sport"><select id="se-sport" value={filters.sportTypeId ?? ''} onChange={e => filter('sportTypeId', e.target.value)}>
          <option value="">All sports</option>{sportTypes.data?.items.map(sport => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
        </select></Field>
        <Field label="Organizing faculty" htmlFor="se-faculty"><select id="se-faculty" value={filters.facultyId ?? ''} onChange={e => filter('facultyId', e.target.value)}>
          <option value="">All faculties</option>{faculties.data?.items.map(faculty => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
        </select></Field>
        <Field label="Registration" htmlFor="se-registration"><select id="se-registration" value={filters.registration ?? ''} onChange={e => filter('registration', e.target.value)}>
          <option value="">Any registration status</option><option value="open">Open</option><option value="closed">Closed</option>
        </select></Field>
        {(['startFrom', 'startTo'] as const).map(key => <Field key={key} label={key === 'startFrom' ? 'Starts on or after' : 'Starts on or before'} htmlFor={`se-${key}`}>
          <input id={`se-${key}`} type="date" value={filters[key]} onChange={e => filter(key, e.target.value)}
            aria-invalid={!!fieldError(key)} aria-describedby={fieldError(key) ? `se-${key}-error` : undefined} />
          {fieldError(key) ? <span id={`se-${key}-error`} className="error" role="alert">{fieldError(key)}</span> : null}
        </Field>)}
        <p className="sub search-filter-help">Filters apply to tournaments.</p>
        {faculties.isError || sportTypes.isError ? <p className="error" role="alert">Some filter choices could not be loaded. <button type="button" className="btn ghost" onClick={() => { void faculties.refetch(); void sportTypes.refetch() }}>Retry filter choices</button></p> : null}
      </Panel>
      {debouncing ? <p className="sub" role="status">Searching…</p> : null}
      {searched ? <p className="sub search-summary" role="status">{total} result{total === 1 ? '' : 's'}{publicSettled && playersSettled ? '' : ' loaded · Search in progress or incomplete'}</p> : null}
      {needle ? <div className="search-categories" role="group" aria-label="Search categories">
        <Tabs active={category} onPick={setCategory} tabs={[
          { key: 'all', label: `All ${total}` },
          { key: 'tournaments', label: `Tournaments ${tournaments.length}` },
          { key: 'teams', label: `Teams ${teams.length + backendTeams.length}` },
          { key: 'players', label: `Players ${players.length}` },
        ]} />
      </div> : null}

      {!currentUser && needle ? <Panel quiet>Sign in to search for players. <Link to="/login">Sign in</Link></Panel> : null}

      {!searched && !debouncing ? (
        <Empty icon="search" title="Type to search"
          sub="Search public tournaments and teams. Sign in to search players." />
      ) : category === 'all' && !total && publicSettled && playersSettled ? (
        <Empty icon="search" title={q ? `Nothing matched “${q}”` : 'No tournaments match these filters'} sub="Try another tournament filter or name." />
      ) : null}
      {needle && !debouncing && category !== 'all' && !categoryCount && categorySettled ? <Empty icon="search"
        title={`No ${category} matched “${q}”`} sub="Try another category or search term." /> : null}
      {needle && category === 'players' && !currentUser ? <p className="sub">Sign in to search players.</p> : null}

      {needle && currentUser && needle.length < 3 ? (
        <p className="sub">Enter at least 3 characters to search for players.</p>
      ) : null}

      {!USE_MOCK && searched && !debouncing && tournamentQuery.isPending ? (
        <Panel quiet><span className="sub" role="status">Loading tournaments…</span></Panel>
      ) : null}

      {!USE_MOCK && searched && !debouncing && tournamentQuery.isError && !(fieldError('startFrom') || fieldError('startTo')) ? (
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

      {tournaments.length && (category === 'all' || category === 'tournaments') ? (
        <Panel quiet className="search-results">
          <h2>Tournaments <span className="tag">{tournaments.length}</span></h2>
          {tournaments.map(t => (
            <button className="who" type="button" key={t.id} aria-label={`Open tournament: ${t.name}`} onClick={() => navigate(`/t/${t.id}`)}>
              <span className="avatar"><Icon name="trophy" size={13} /></span>
              <span className="meta"><b>{t.name}</b><span className="tag">{/^Sport \d+$/.test(t.sport) ? 'Sport unavailable' : t.sport} · {formatName(t)} · {t.status}</span></span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </Panel>
      ) : null}

      {teams.length && (category === 'all' || category === 'teams') ? (
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

      {backendTeams.length && (category === 'all' || category === 'teams') ? (
        <Panel quiet className="search-results">
          <h2>Teams <span className="tag">{backendTeams.length}</span></h2>
          {backendTeams.map(t => (
            <button className="who" type="button" key={t.id} aria-label={`Open team: ${t.name}`} onClick={() => navigate(`/team/${t.id}`)}>
              <TeamCrestView team={{ id: t.id, name: t.name, code: t.name.slice(0, 3).toUpperCase(), color: null, logoUrl: t.logoUrl ?? null }} size={24} />
              <span className="meta">
                <b>{t.name}</b>
                <span className="tag">{sportTypes.data?.items.find(sport => sport.id === t.sportTypeId)?.name ?? 'Sport unavailable'} · {t.readinessStatus} · {t.memberCount} players</span>
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
      {players.length && (category === 'all' || category === 'players') ? (
        <Panel quiet className="search-results">
          <h2>Players <span className="tag">{players.length}</span></h2>
          {players.map(u => (
            <button className="who" type="button" key={u.id} aria-label={`Open player: ${u.fullName}`} onClick={() => navigate(`/player/${u.id}`)}>
              <Avatar name={u.fullName} avatarUrl={u.avatarUrl} />
              <span className="meta"><b>{u.fullName}</b><span className="sub">{searchUserLabel(u)}</span></span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </Panel>
      ) : null}
    </div>
  )
}
