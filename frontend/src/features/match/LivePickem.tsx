import { Badge, Empty, Panel } from '../../components/kit/primitives'
import { usePredictionLive } from '../../hooks/useLiveEngagement'
import type { MatchDto } from '../../types/match.dto'

export function LivePickem({ match }: { match: MatchDto }) {
  const prediction = usePredictionLive(match.id)
  const data = prediction.query.data
  if (prediction.query.isPending) return <Panel quiet><span className="sub">Loading Pick'em…</span></Panel>
  if (prediction.query.isError) return <Empty icon="warn" title="Unable to load Pick'em" sub={prediction.query.error instanceof Error ? prediction.query.error.message : undefined} />
  const busy = prediction.place.isPending || prediction.cancel.isPending
  const error = prediction.place.error ?? prediction.cancel.error
  return <Panel quiet>
    <div className="spread"><span className="tag"><em>//</em> Pick'em · {data?.total ?? 0} predictions</span>
      {data?.mine ? <Badge kind={data.mine.status === 'won' ? 'ok' : data.mine.status === 'lost' ? 'crit' : 'neutral'}>
        {data.mine.status === 'won' ? '+10 points' : data.mine.status === 'void' ? 'Void' : data.mine.status}
      </Badge> : null}</div>
    {!data?.isOpen ? <p className="sub">Predictions closed{data?.closedReason ? `: ${data.closedReason.replaceAll('_', ' ')}` : ''}.</p> : null}
    {data?.closesAt ? <p className="sub">Scheduled kick-off: {new Date(data.closesAt).toLocaleString()}</p> : null}
    {error ? <p className="sub" role="alert">{error instanceof Error ? error.message : 'Could not update prediction.'}</p> : null}
    <div className="grid2">{[match.teamA, match.teamB].filter(team => team !== null).map(team => {
      const share = data?.teams.find(row => row.teamId === team.id)
      return <button key={team.id} className={`btn ${data?.mine?.teamId === team.id ? 'primary' : ''}`}
        type="button" disabled={!data?.canPredict || busy} onClick={() => prediction.place.mutate(team.id)}>
        {team.name} · {share?.percent ?? 0}%
      </button>
    })}</div>
    {data?.mine && data.canPredict ? <button className="btn ghost" type="button" disabled={busy} onClick={() => prediction.cancel.mutate()}>Cancel prediction</button> : null}
    {!data?.canPredict && data?.isOpen ? <p className="sub">Sign in as an eligible spectator to predict this match.</p> : null}
  </Panel>
}
