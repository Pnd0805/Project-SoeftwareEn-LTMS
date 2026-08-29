/**
 * src/features/tournament/LeaderboardTab.tsx
 *
 * Derived from the format and never stored. Single elimination reads as the
 * round a squad went out in; round robin swaps the whole table for Standings —
 * played, won, level, lost, units for and against, and points.
 */
import { Empty, FormGuide, TableWrap } from '../../components/kit/primitives'
import { PlayerLink, TeamLink } from '../../components/kit/chips'
import { toggleFollow, useLtms } from '../../shared/store'
import { isFollowing, matchesOf, me, team } from '../../shared/selectors'
import { formatOf, leaderboard, scoreUnit, statLabels } from '../../shared/rules'
import type { Tournament } from '../../shared/types'

/** Leading scorers, tallied off what referees actually recorded. */
function TopScorers({ t }: { t: Tournament }) {
  const s = useLtms()
  const tally: Record<string, { g: number; a: number; team: string }> = {}
  matchesOf(s, t.id).filter(m => m.status === 'confirmed').forEach(m =>
    Object.entries(m.stats || {}).forEach(([pid, st]) => {
      tally[pid] = tally[pid] || { g: 0, a: 0, team: st.team }
      tally[pid].g += st.goals
      tally[pid].a += st.assists
    }))
  const rows = Object.entries(tally)
    .filter(([, v]) => v.g || v.a)
    .sort((x, y) => y[1].g - x[1].g || y[1].a - x[1].a)
    .slice(0, 8)
  if (!rows.length) return null
  const L = statLabels(t.sport)
  return (
    <>
      <div className="tag" style={{ marginTop: 6 }}>
        <em>//</em> Leading {(L.g || 'scorers').toLowerCase()}
      </div>
      <TableWrap>
        <table>
          <thead><tr><th>Player</th><th>Squad</th><th>{L.g || 'Scored'}</th><th>{L.a || 'Assists'}</th></tr></thead>
          <tbody>
            {rows.map(([pid, v]) => (
              <tr key={pid}>
                <td><PlayerLink id={pid} /></td>
                <td><TeamLink id={v.team} /></td>
                <td className="num">{v.g}</td>
                <td className="num">{v.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </>
  )
}

export function LeaderboardTab({ t }: { t: Tournament }) {
  const s = useLtms()
  const rows = leaderboard(s, t)
  const u = me(s)
  if (!rows.length) return <Empty title="No standings yet" />

  const played = matchesOf(s, t.id).filter(m => m.status === 'confirmed' && m.note !== 'bye').length

  if (formatOf(t) === 'roundrobin') {
    return (
      <>
        <div className="statline">
          <div><span className="tag">Matches played</span><span className="v">{played}</span></div>
          <div><span className="tag">Squads</span><span className="v">{rows.length}</span></div>
          <div><span className="tag">Level results</span><span className="v">{rows.reduce((n, r) => n + r.d, 0) / 2}</span></div>
          <div>
            <span className="tag">Leader</span>
            <span className="v" style={{ fontSize: 19, paddingTop: 8 }}>{team(s, rows[0].team)?.name ?? '—'}</span>
          </div>
        </div>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Rank</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th>
                <th>{scoreUnit(t.sport)} for</th><th>Against</th><th>Diff</th><th>Pts</th><th>Form</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.team}>
                  <td className="num">{r.rank === rows[0].rank ? <b style={{ color: 'var(--teal)' }}>{r.rank}</b> : r.rank}</td>
                  <td><TeamLink id={r.team} /></td>
                  <td className="num">{r.p}</td><td className="num">{r.w}</td>
                  <td className="num">{r.d}</td><td className="num">{r.l}</td>
                  <td className="num">{r.gf}</td><td className="num">{r.ga}</td>
                  <td className="num">{r.gd > 0 ? '+' : ''}{r.gd}</td>
                  <td className="num"><b>{r.pts}</b></td>
                  <td>{r.form.length ? <FormGuide form={r.form} /> : <span className="sub">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <TopScorers t={t} />
      </>
    )
  }

  return (
    <>
      <div className="statline">
        <div><span className="tag">Matches played</span><span className="v">{played}</span></div>
        <div><span className="tag">Squads</span><span className="v">{rows.length}</span></div>
        <div><span className="tag">Disputes</span><span className="v">{matchesOf(s, t.id).filter(m => m.status === 'disputed').length}</span></div>
        <div><span className="tag">Still in</span><span className="v">{rows.filter(r => r.out === null).length}</span></div>
      </div>
      <TableWrap>
        <table>
          <thead><tr><th>Rank</th><th>Team</th><th>Went out in</th><th>P</th><th>W</th><th>Form</th><th /></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.team}>
                <td className="num">{r.rank === rows[0].rank ? <b style={{ color: 'var(--teal)' }}>{r.rank}</b> : r.rank}</td>
                <td><TeamLink id={r.team} /></td>
                <td className="sub">{r.outLabel}</td>
                <td className="num">{r.p}</td><td className="num">{r.w}</td>
                <td>{r.form.length ? <FormGuide form={r.form} /> : <span className="sub">—</span>}</td>
                <td>
                  {u ? (
                    <button className="btn ghost" type="button" onClick={() => toggleFollow(`team:${r.team}`)}>
                      {isFollowing(s, `team:${r.team}`) ? 'Following' : 'Follow'}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <TopScorers t={t} />
    </>
  )
}
