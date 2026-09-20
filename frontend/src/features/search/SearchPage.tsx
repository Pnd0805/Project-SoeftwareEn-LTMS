/**
 * src/features/search/SearchPage.tsx
 *
 * Tournaments, squads and players in one list. It reads the same `visibleTo`
 * rule the pages do, so it can never offer a door that would then refuse to open.
 */
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

export function SearchPage() {
  const s = useLtms()
  const { data: currentUser } = useMe()
  const tournamentQuery = useTournaments()
  const sportTypes = useSportTypes()
  const navigate = useNavigate()
  const { q: qParam } = useParams()
  const [q, setQ] = useState(decodeURIComponent(qParam ?? ''))
  const needle = q.trim().toLowerCase()

  const tournamentSource = USE_MOCK
    ? s.tournaments.filter(t => visibleTo(s, t))
    : (tournamentQuery.data?.items ?? []).map(dto => tournamentView(dto, [], [], sportTypes.data?.items ?? []))
  const tournaments = needle
    ? tournamentSource.filter(t => `${t.name} ${t.sport} ${t.venue}`.toLowerCase().includes(needle))
    : []
  const teams = USE_MOCK && needle
    ? s.teams.filter(t => `${t.name} ${t.code}`.toLowerCase().includes(needle))
    : []
  const userSearch = useSearchUsers(q, !!currentUser)
  const players = userSearch.data?.items ?? []
  const total = tournaments.length + teams.length + players.length
  const userErrorStatus = typeof userSearch.error === 'object' && userSearch.error !== null && 'status' in userSearch.error
    ? (userSearch.error as { status?: number }).status
    : undefined

  return (
    <>
      <div className="spread">
        <div>
          <div className="tag"><em>//</em> Everything you can see</div>
          <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>Search</h1>
        </div>
      </div>

      <Panel>
        <Field label={needle ? `${total} result${total === 1 ? '' : 's'}` : 'Squads, players, tournaments'} htmlFor="se-q">
          <input id="se-q" autoFocus autoComplete="off" value={q}
            onChange={e => { setQ(e.target.value); navigate(`/search/${encodeURIComponent(e.target.value)}`, { replace: true }) }}
            placeholder="Name, sport, venue, faculty…" />
        </Field>
      </Panel>

      {!needle ? (
        <Empty icon="search" title="Type to search"
          sub="A private draft or a request still under review is not searchable — it is not a tournament yet." />
      ) : needle.length < 3 ? (
        <Empty icon="search" title="Keep typing" sub="Enter at least 3 characters to search for players." />
      ) : !total && !tournamentQuery.isPending && !userSearch.isPending && !tournamentQuery.isError && !userSearch.isError ? (
        <Empty icon="search" title={`Nothing matched “${q}”`} sub="Try a sport, a faculty, or part of a name." />
      ) : null}

      {!USE_MOCK && tournamentQuery.isPending ? (
        <Panel quiet><span className="sub">Loading tournaments…</span></Panel>
      ) : null}

      {!USE_MOCK && tournamentQuery.isError ? (
        <Panel quiet>
          <span className="error">Tournament search is unavailable because the server list could not be loaded.</span>
        </Panel>
      ) : null}

      {!USE_MOCK && needle ? (
        <Panel quiet>
          <span className="sub">Squad search is not available on the server yet.</span>
        </Panel>
      ) : null}

      {tournaments.length ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Tournaments · {tournaments.length}</span>
          {tournaments.map(t => (
            <button className="who" type="button" key={t.id} onClick={() => navigate(`/t/${t.id}`)}>
              <span className="avatar"><Icon name="trophy" size={13} /></span>
              <span className="meta"><b>{t.name}</b><span className="tag">{t.sport} · {formatName(t)} · {t.status}</span></span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </Panel>
      ) : null}

      {teams.length ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Squads · {teams.length}</span>
          {teams.map(t => (
            <button className="who" type="button" key={t.id} onClick={() => navigate(`/team/${t.id}`)}>
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

      {needle.length >= 3 && !!currentUser && userSearch.isPending ? (
        <Panel quiet><span className="sub">Searching players…</span></Panel>
      ) : userSearch.isError ? (
        <Panel quiet>
          <span className="error">
            {userErrorStatus === 401 ? 'Sign in again to search players.'
              : userErrorStatus === 403 ? 'Your account is not allowed to search players.'
                : 'Unable to search players right now. Please retry.'}
          </span>
        </Panel>
      ) : players.length ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Players · {players.length}</span>
          {players.map(u => (
            <button className="who" type="button" key={u.id} onClick={() => navigate(`/player/${u.id}`)}>
              <span className="avatar">{u.fullName.slice(0, 1)}</span>
              <span className="meta"><b>{u.fullName}</b></span>
              <Icon name="chev" size={13} />
            </button>
          ))}
        </Panel>
      ) : null}
    </>
  )
}
