/**
 * src/features/mvp/MvpPage.tsx
 *
 * Real mode votes per match using the backend's eligibility and voting window.
 * The tournament route selects a match; the prototype retains its mock award.
 */
import { matchTime } from '../match/matchTime'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Panel } from '../../components/kit/primitives'
import { TeamChip } from '../../components/kit/chips'
import { useLtms } from '../../shared/store'
import { matchesOf, me, team, user } from '../../shared/selectors'
import { routeTour } from '../../mocks/routeIds'
import { useMvpVotes } from '../../hooks/useUser'
import { USE_MOCK } from '../../api/client'
import { parseBackendId } from '../../api/ids'
import { useMvpLive } from '../../hooks/useLiveEngagement'
import { useTournamentMatches } from '../../hooks/useMatch'
import { Avatar } from '../../components/kit/Avatar'
import { useMe } from '../../hooks/useAuth'

export function MvpPage() {
  return USE_MOCK ? <MockMvpPage /> : <LiveMvpPage />
}

function LiveMvpPage() {
  const { id: rawId } = useParams()
  const id = parseBackendId(rawId)
  return id ? <LiveTournamentMvp tournamentId={id} /> : <Empty icon="warn" title="No such tournament" />
}

function LiveTournamentMvp({ tournamentId }: { tournamentId: number }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const matches = useTournamentMatches(tournamentId)
  if (matches.isPending) return <Panel quiet>Loading matches...</Panel>
  if (matches.isError) return <Empty icon="warn" title="Unable to load matches">
    <button className="btn" type="button" onClick={() => void matches.refetch()}>Try again</button></Empty>
  const items = matches.data?.items ?? []
  const requested = parseBackendId(params.get('match') ?? undefined)
  const selected = requested ? items.find(match => match.id === requested)
    : items.find(match => ['finished', 'completed', 'disputed', 'result_rejected'].includes(match.status)) ?? items[0]
  return <>
    <Crumb back={{ label: 'Tournament', onClick: () => navigate(`/t/${tournamentId}`) }}>Match MVP</Crumb>
    <h1 className="disp" style={{ fontSize: 30 }}>Match MVP</h1>
    <p className="sub">One vote per match. Players on either competing team cannot vote in that match. Vote counts are published after voting closes.</p>
    {items.length ? <label className="field">Match<select aria-label="MVP match" value={selected?.id ?? ''}
      onChange={event => setParams({ match: event.target.value })}>
      {!selected ? <option value="">Choose a match</option> : null}
      {items.map(match => <option key={match.id} value={match.id}>#{match.id} | {match.teamA?.name ?? 'TBD'} vs {match.teamB?.name ?? 'TBD'}</option>)}
    </select></label> : <Empty icon="star" title="No matches yet" />}
    {requested && !selected ? <Empty icon="warn" title="This match does not belong to this tournament" /> : null}
    {selected ? <MatchMvpVoting key={selected.id} matchId={selected.id}
      teamNames={Object.fromEntries([selected.teamA, selected.teamB].filter(team => team !== null).map(team => [team.id, team.name]))} /> : null}
  </>
}

export function MatchMvpVoting({ matchId, teamNames = {} }: { matchId: number; teamNames?: Record<number, string> }) {
  const meQuery = useMe()
  const mvp = useMvpLive(matchId)
  if (mvp.query.isPending) return <Panel quiet>Loading MVP votes...</Panel>
  if (mvp.query.isError) return <Empty icon="warn" title="Unable to load MVP voting" sub={mvp.query.error instanceof Error ? mvp.query.error.message : undefined}>
    <button className="btn" type="button" onClick={() => void mvp.query.refetch()}>Try again</button></Empty>
  const data = mvp.query.data
  if (!data) return <Empty icon="star" title="No MVP data available" />
  return <>
    <Banner kind={data.window.isOpen ? 'ok' : 'warn'} icon="star">
      {data.window.isOpen ? `Voting closes ${data.window.closesAt ? matchTime(data.window.closesAt) : 'soon'}.`
        : data.window.opensAt ? 'Voting is closed.' : 'Voting is unavailable until the backend provides an eligible voting window. Matches decided without play are not eligible.'}
    </Banner>
    {mvp.vote.isError ? <p className="sub" role="alert">{mvp.vote.error instanceof Error ? mvp.vote.error.message : 'Could not save your vote.'}</p> : null}
    {data.candidates.length === 0 ? <Empty icon="star" title="No MVP candidates yet" /> : <Panel quiet className="match-mvp-candidates">
      {data.candidates.map(candidate => <div className="match-mvp-row" key={candidate.userId}>
        <span className="hstack"><Avatar name={candidate.fullName} avatarUrl={candidate.avatarUrl} />
          <span><b>{candidate.fullName}</b><br /><span className="sub">{teamNames[candidate.teamId] ?? `Team #${candidate.teamId}`}</span>
            {candidate.stats?.length ? <div className="sub">{candidate.stats.map(stat => `${stat.statLabelTh || stat.statKey}: ${stat.value}`).join(' | ')}</div> : null}</span></span>
        <span className="hstack">
          {!data.window.isOpen && candidate.votes !== undefined ? <span className="num">{candidate.votes} votes</span> : null}
          {!data.window.isOpen && data.winners.includes(candidate.userId) ? <Badge kind="ok">Winner</Badge> : null}
          {data.mine?.votedForUserId === candidate.userId ? <Badge kind="ok">Your vote</Badge> : null}
          {meQuery.data && data.canVote ? <button className="btn primary" type="button" disabled={mvp.vote.isPending}
            onClick={() => mvp.vote.mutate(candidate.userId)}>{data.mine ? 'Change vote' : 'Vote'}</button> : null}
        </span>
      </div>)}</Panel>}
    {!meQuery.data ? <p className="sub">Sign in to vote. Results are public after voting closes.</p>
      : data.window.isOpen && !data.canVote ? <p className="sub">Voting is unavailable for this account in this match.</p> : null}
  </>
}

function MockMvpPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id } = useParams()
  const t = routeTour(s, id)
  const u = me(s)
  const mvp = useMvpVotes(t?.id, u?.id)

  if (!t) return <Empty icon="warn" title="No such tournament" />

  if (!t.champion) {
    return (
      <Empty icon="star" title="MVP voting hasn't opened"
        sub="It opens the moment the final is confirmed — this is a tournament award, not a per-match one.">
        <button className="btn" type="button" onClick={() => navigate(`/t/${t.id}`)}>Back to the tournament</button>
      </Empty>
    )
  }

  /* candidates ranked on the statistics referees actually recorded */
  const tally: Record<string, { goals: number; assists: number; team: string }> = {}
  matchesOf(s, t.id).filter(m => m.status === 'confirmed').forEach(m =>
    Object.entries(m.stats || {}).forEach(([pid, st]) => {
      tally[pid] = tally[pid] || { goals: 0, assists: 0, team: st.team }
      tally[pid].goals += st.goals
      tally[pid].assists += st.assists
    }))

  let cands = Object.entries(tally)
    .sort((a, b) => (b[1].goals * 2 + b[1].assists) - (a[1].goals * 2 + a[1].assists))
    .slice(0, 8)
  if (!cands.length) {
    cands = (team(s, t.champion)?.members ?? []).map(p => [p, { goals: 0, assists: 0, team: t.champion! }] as const)
      .map(x => [x[0], { ...x[1] }] as [string, { goals: number; assists: number; team: string }])
  }

  const votes = mvp.data?.items ?? []
  const mine = mvp.data?.mine ?? null
  const pct = (pid: string) => (votes.length ? Math.round(votes.filter(v => v.playerId === pid).length / votes.length * 100) : 0)

  return (
    <>
      <Crumb back={{ label: t.name, onClick: () => navigate(`/t/${t.id}`) }}>MVP</Crumb>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 30 }}>Tournament MVP</h1>
        <Badge kind="ok">{`Champion · ${team(s, t.champion)?.name}`}</Badge>
      </div>

      <Banner kind={mine ? 'ok' : 'warn'} icon="star">
        {mine
          ? <>You voted for <b>{user(s, mine.playerId)?.name}</b>. One vote per person, and it can't be changed.</>
          : <>You have <b>one vote for the whole tournament</b>. Candidates are ranked on the statistics referees recorded.</>}
      </Banner>

      <Panel quiet className="match-mvp-candidates">
        {cands.map(([pid, st]) => {
          const p = user(s, pid)
          if (!p) return null
          return (
            <div className="match-mvp-row" key={pid}>
              <span className="avatar">{p.name.slice(0, 1)}</span>
              <span className="match-mvp-name">
                <b style={{ fontSize: 15 }}>{p.name}</b><br />
                <span className="tag">{st.goals} · {st.assists} assists</span>
              </span>
              <TeamChip id={st.team} />
              <span className="num" style={{ marginLeft: 'auto' }}>{pct(pid)}%</span>
              {u && !mine ? (
                <button className="btn primary" type="button" onClick={() => mvp.cast.mutate(pid)}
                  disabled={mvp.cast.isPending}>Vote</button>
              ) : mine?.playerId === pid ? <Badge kind="ok">Your vote</Badge> : null}
            </div>
          )
        })}
        {!u ? <span className="sub">Sign in to vote — a guest can read the standing but not add to it.</span> : null}
      </Panel>
    </>
  )
}
