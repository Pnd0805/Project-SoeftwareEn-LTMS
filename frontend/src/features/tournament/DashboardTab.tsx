/**
 * src/features/tournament/DashboardTab.tsx — owned by slice 3
 *
 * The tournament at a glance: how far it has got, what is on now, what is
 * waiting on a decision, what comes next, and who leads the table — or, while
 * an elimination bracket is still running, who is still in it.
 *
 * SDS FR-DL-01 (GET /tournaments/{id}/dashboard) — backend ยังไม่มี route นี้
 * หน้านี้จึงสรุปจาก useTournamentMatches + useStandings ซึ่ง Schedule กับ
 * Leaderboard อ่านอยู่แล้ว ไม่ได้ดึงข้อมูลชุดใหม่ (ดู dashboardView.ts)
 */
import { useNavigate } from 'react-router-dom'
import { Banner, Empty, MatchStateBadge, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamLinkView } from '../../components/kit/chips'
import { useStandings, useTournamentMatches } from '../../hooks/useMatch'
import { toTeamView } from '../match/matchView'
import { fmtDate } from '../../shared/rules'
import {
  STATE_ORDER, scoreOf, stateOf, summarizeMatches, topOfTable, type DashboardMatch,
} from './dashboardView'

function MatchList({ title, list, empty, showScore }: {
  title: string
  list: DashboardMatch[]
  empty?: string
  showScore?: boolean
}) {
  const navigate = useNavigate()
  if (!list.length && !empty) return null
  return (
    <Panel quiet>
      <span className="tag"><em>//</em> {title} · {list.length}</span>
      {list.length ? (
        <TableWrap>
          <table>
            <tbody>
              {list.map(m => (
                <tr key={m.id}>
                  <td className="num">{m.scheduledTime ? fmtDate(m.scheduledTime) : '—'}</td>
                  <td className="tag">{m.tag || m.stage}</td>
                  <td><TeamLinkView team={toTeamView(m.teamA)} /></td>
                  <td className="tag">vs</td>
                  <td><TeamLinkView team={toTeamView(m.teamB)} /></td>
                  <td>{showScore ? <span className="num">{scoreOf(m)}</span> : <MatchStateBadge state={stateOf(m)} />}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn ghost" type="button" onClick={() => navigate(`/m/${m.id}`)}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : <span className="sub">{empty}</span>}
    </Panel>
  )
}

export function DashboardTab({ tournamentId }: { tournamentId: number | string }) {
  const navigate = useNavigate()
  const matches = useTournamentMatches(tournamentId)
  const standings = useStandings(tournamentId)

  if (matches.isPending) return <Panel quiet><span className="sub">Loading the dashboard…</span></Panel>
  if (matches.isError) {
    return (
      <Banner kind="crit">
        <b>Couldn't load the dashboard.</b> {matches.error instanceof Error ? matches.error.message : ''}{' '}
        <button className="btn ghost" type="button" onClick={() => void matches.refetch()}>Try again</button>
      </Banner>
    )
  }

  const s = summarizeMatches(matches.data?.items ?? [])
  if (!s.total) {
    return <Empty icon="clock" title="Nothing to summarise yet" sub="The dashboard fills in once the bracket is drawn." />
  }

  const pct = Math.round((s.finished / s.total) * 100)
  const decisions = s.byState.disputed + s.byState.pending
  const top = standings.data ? topOfTable(standings.data.rows, standings.data.format) : null

  return (
    <>
      <div className="statline">
        <div><span className="tag">Matches</span><span className="v">{s.total}</span></div>
        <div><span className="tag">Confirmed</span><span className="v">{s.finished}</span></div>
        <div><span className="tag">On now</span><span className="v">{s.onNow.length}</span></div>
        <div><span className="tag">Awaiting a decision</span><span className="v">{decisions}</span></div>
      </div>

      <Panel quiet>
        <div className="spread">
          <span className="tag"><em>//</em> Progress</span>
          <span className="sub">{s.finished} of {s.total} confirmed · {pct}%</span>
        </div>
        <div role="progressbar" aria-label="Matches confirmed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
          style={{ height: 8, background: 'var(--panel-3)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)' }} />
        </div>
        <span className="sub">{s.stage ? `Now playing: ${s.stage}` : 'Every match is confirmed.'}</span>
      </Panel>

      <Panel quiet>
        <span className="tag"><em>//</em> Match status</span>
        <div className="hstack" style={{ flexWrap: 'wrap', gap: 12 }}>
          {STATE_ORDER.filter(k => s.byState[k] > 0).map(k => (
            <span className="hstack" style={{ gap: 6 }} key={k}>
              <MatchStateBadge state={k} /><b className="num">{s.byState[k]}</b>
            </span>
          ))}
        </div>
      </Panel>

      <MatchList title="On now" list={s.onNow} />
      <MatchList title="Awaiting a decision" list={s.attention} />
      <MatchList title="Up next" list={s.upNext} empty="No fixtures left to play." />
      <MatchList title="Latest results" list={s.latest} empty="No confirmed results yet." showScore />

      <Panel quiet>
        <div className="spread">
          <span className="tag">
            <em>//</em> {top?.kind === 'still-in' ? `Still in the running · ${top.teams.length}` : 'Top of the table'}
          </span>
          <button className="btn ghost" type="button" onClick={() => navigate(`/t/${tournamentId}/leaderboard`)}>
            Full leaderboard
          </button>
        </div>
        {standings.isPending ? <span className="sub">Loading the table…</span>
          : standings.isError ? <span className="sub">The table isn't available right now.</span>
            : top?.kind === 'still-in' ? (
              <>
                <span className="sub">
                  An elimination bracket ranks squads by how far they got, so everyone still in shares first
                  place until the next results decide it.
                </span>
                <div className="hstack" style={{ flexWrap: 'wrap', gap: 10 }}>
                  {top.teams.map(r => <TeamLinkView key={r.team.id} team={r.team} />)}
                </div>
              </>
            ) : top?.rows.length ? (
              <TableWrap>
                <table>
                  <tbody>
                    {top.rows.map(r => (
                      <tr key={r.team.id}>
                        <td className="num">{r.rank}</td>
                        <td><TeamLinkView team={r.team} /></td>
                        <td className="sub">{r.outLabel || `${r.won} won · ${r.points} pts`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : <span className="sub">Positions appear once a result is confirmed.</span>}
      </Panel>
    </>
  )
}
