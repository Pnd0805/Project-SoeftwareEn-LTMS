/**
 * src/features/match/StatSheet.tsx
 *
 * What was recorded, read back. Columns come from `sport_stat_definitions` for
 * this sport, so a sport nobody wrote code for still renders its own figures.
 *
 * ⚠️ ทุกค่าเป็นจำนวนเต็ม เพราะ `player_match_stat_values` มีแค่ `value_int`
 *    แม้ `sport_stat_definitions.data_type` จะรับ 'decimal' และ 'boolean' ก็ตาม
 *    — schema gap ที่ schema.sql เขียนเตือนตัวเองไว้แล้ว
 */
import { Empty, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamChipView } from '../../components/kit/chips'
import { useMatchStats, useStatDefinitions } from '../../hooks/useMatch'
import { toTeamView } from './matchView'
import type { MatchDto } from '../../types/match.dto'

export function StatSheet({ m }: { m: MatchDto }) {
  const { data: stats, isPending } = useMatchStats(m.id)
  const { data: defs } = useStatDefinitions(m.tournament.sportTypeId)

  if (isPending) return <Panel quiet><span className="sub">Loading statistics…</span></Panel>

  const rows = stats?.items ?? []
  const cols = defs?.items ?? []

  if (!rows.length) {
    return <Empty icon="match" title="No statistics yet" sub="Recorded once the result is entered." />
  }

  const teamOf = (teamId: number) =>
    m.teamA?.id === teamId ? m.teamA : m.teamB?.id === teamId ? m.teamB : null

  return (
    <Panel quiet>
      <span className="tag"><em>//</em> Recorded {m.tournament.sportName} statistics</span>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th>Player</th><th>Squad</th>
              {cols.map(c => <th key={c.statKey}>{c.statLabelTh}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.player.fullName}</td>
                <td><TeamChipView team={toTeamView(teamOf(r.teamId))} /></td>
                {cols.map(c => <td className="num" key={c.statKey}>{r.values[c.statKey] ?? 0}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <span className="sub">
        Recorded by {rows[0]?.recordedByReferee.fullName ?? '—'}. Corrections are audited
        (FR-RS-07) — they are not silent edits.
      </span>
    </Panel>
  )
}
