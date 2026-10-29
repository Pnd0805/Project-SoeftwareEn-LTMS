/**
 * src/features/mvp/MvpPage.tsx
 *
 * Real mode votes per match using the backend's eligibility and voting window.
 * The mock preview shows recorded match facts without inventing a voting window.
 */
import { matchTime } from '../match/matchTime'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Panel } from '../../components/kit/primitives'
import { TeamChip } from '../../components/kit/chips'
import { useLtms } from '../../shared/store'
import { matchesOf, team, user } from '../../shared/selectors'
import { routeTour } from '../../mocks/routeIds'
import { USE_MOCK } from '../../api/client'
import { parseBackendId } from '../../api/ids'
import { useMvpLive } from '../../hooks/useLiveEngagement'
import { useTournamentMatches } from '../../hooks/useMatch'
import { Avatar } from '../../components/kit/Avatar'
import { useMe } from '../../hooks/useAuth'
import { statLabels } from '../../shared/rules'

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
  const [params, setParams] = useSearchParams()
  const t = routeTour(s, id)
  if (!t) return <Empty icon="warn" title="No such tournament" />

  const items = matchesOf(s, t.id)
  const requested = params.get('match')
  const selected = requested ? items.find(match => match.id === requested)
    : items.find(match => match.status === 'confirmed' && match.note !== 'bye') ?? items[0]
  const played = selected?.status === 'confirmed' && selected.note !== 'bye' && selected.a && selected.b
  const recorded = played ? Object.entries(selected.stats).filter(([, stat]) => stat.team === selected.a || stat.team === selected.b) : []
  const labels = statLabels(t.sport)

  return <>
    <Crumb back={{ label: t.name, onClick: () => navigate(`/t/${t.id}`) }}>Match MVP</Crumb>
    <h1 className="disp" style={{ fontSize: 30 }}>Match MVP</h1>
    <p className="sub">One vote per match. Players on either competing team cannot vote in that match. Vote counts are published after voting closes.</p>
    {items.length ? <label className="field">Match<select aria-label="MVP match" value={selected?.id ?? ''}
      onChange={event => setParams({ match: event.target.value })}>
      {!selected ? <option value="">Choose a match</option> : null}
      {items.map(match => <option key={match.id} value={match.id}>#{match.id} | {team(s, match.a)?.name ?? 'TBD'} vs {team(s, match.b)?.name ?? 'TBD'}</option>)}
    </select></label> : <Empty icon="star" title="No matches yet" />}
    {requested && !selected ? <Empty icon="warn" title="This match does not belong to this tournament" /> : null}
    {selected ? <>
      <Banner kind="warn" icon="star">
        Voting is unavailable in this preview. No eligible per-match voting window, vote counts or winner are available. Matches decided without play are not eligible.
      </Banner>
      <Panel quiet className="match-mvp-candidates">
        <span className="tag"><em>//</em> Recorded statistics for this match</span>
        {recorded.map(([pid, stat]) => {
          const player = user(s, pid)
          if (!player) return null
          return <div className="match-mvp-row" key={pid}>
            <span className="hstack"><Avatar name={player.name} />
              <span><b>{player.name}</b><br /><span className="sub">{[
                labels.g ? `${stat.goals} ${labels.g.toLowerCase()}` : null,
                labels.a ? `${stat.assists} ${labels.a.toLowerCase()}` : null,
              ].filter(Boolean).join(' · ')}</span></span></span>
            <TeamChip id={stat.team} />
          </div>
        })}
        {!recorded.length ? <p className="sub">{played ? 'No player statistics recorded for this match.' : 'No confirmed played result for this match.'}</p> : null}
      </Panel>
    </> : null}
  </>
}
