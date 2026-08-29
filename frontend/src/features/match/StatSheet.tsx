/**
 * src/features/match/StatSheet.tsx
 *
 * What was recorded, once it is recorded: the players, then the team row. The
 * figures that are sums are added up here rather than stored, so they cannot
 * drift from the player rows they came from — a number enterable two ways is a
 * disagreement waiting to happen.
 */
import { Panel, TableWrap } from '../../components/kit/primitives'
import { PlayerLink, TeamLink } from '../../components/kit/chips'
import { useLtms } from '../../shared/store'
import { statExtra, statLabels, statTeam, teamTotals } from '../../shared/rules'
import type { Match, Tournament } from '../../shared/types'

export function StatSheet({ m, t }: { m: Match; t: Tournament }) {
  useLtms()
  const L = statLabels(t.sport)
  const extra = statExtra(t.sport)
  const tm = statTeam(t.sport)
  const rows = Object.entries(m.stats || {})
  const teamRows = [m.a, m.b].filter(Boolean) as string[]
  const entered = m.teamStats || {}

  if (!rows.length && !Object.keys(entered).length) return null

  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Recorded {t.sport} statistics</span>

      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Player</th><th>Squad</th><th>{L.g || 'Scored'}</th><th>{L.a || 'Assists'}</th>
                {extra.map(([k, lab]) => <th key={k}>{lab}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(([pid, st]) => (
                <tr key={pid}>
                  <td><PlayerLink id={pid} /></td>
                  <td><TeamLink id={st.team} /></td>
                  <td className="num">{st.goals}</td>
                  <td className="num">{st.assists}</td>
                  {extra.map(([k]) => <td className="num" key={k}>{(st.x || {})[k] || 0}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : null}

      {teamRows.length ? (
        <>
          <span className="tag"><em>//</em> Per team — the first columns are added up from the players above</span>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Squad</th>
                  {L.g ? <th>{L.g}</th> : null}
                  {L.a ? <th>{L.a}</th> : null}
                  {extra.map(([k, lab]) => <th key={k}>{lab}</th>)}
                  {tm.map(([k, lab]) => <th key={k}>{lab}</th>)}
                </tr>
              </thead>
              <tbody>
                {teamRows.map(tid => {
                  const tot = teamTotals(m, tid)
                  const got = entered[tid] || {}
                  return (
                    <tr key={tid}>
                      <td><TeamLink id={tid} /></td>
                      {L.g ? <td className="num">{tot.goals}</td> : null}
                      {L.a ? <td className="num">{tot.assists}</td> : null}
                      {extra.map(([k]) => <td className="num" key={k}>{tot.x[k] || 0}</td>)}
                      {tm.map(([k]) => <td className="num" key={k}>{got[k] === undefined ? '—' : String(got[k])}</td>)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : null}
    </Panel>
  )
}
