/**
 * src/features/mvp/MvpPage.tsx
 *
 * Vote MVP is a tournament award, not a per-match one. It opens at one moment
 * only — when the Champion is decided — and candidates are ranked on referee-
 * recorded statistics from the whole competition. One vote per user, final.
 */
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Panel } from '../../components/kit/primitives'
import { TeamChip } from '../../components/kit/chips'
import { useLtms } from '../../shared/store'
import { matchesOf, me, team, tour, user } from '../../shared/selectors'
import { useMvpVotes } from '../../hooks/useUser'

export function MvpPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { id } = useParams()
  const t = tour(s, id)
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

      <Panel quiet>
        {cands.map(([pid, st]) => {
          const p = user(s, pid)
          if (!p) return null
          return (
            <div className="hstack" style={{ gap: 14 }} key={pid}>
              <span className="avatar">{p.name.slice(0, 1)}</span>
              <span style={{ width: 190 }}>
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
