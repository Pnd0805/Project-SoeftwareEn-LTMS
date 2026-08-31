/**
 * src/features/tournament/LeaderboardTab.tsx — owned by slice 3
 *
 * Three formats, three tables, because the same columns do not mean the same
 * thing in each (FRONTEND-SPEC, Leaderboard):
 *
 *   single elimination  ranked by the round a squad went out in. No Lost
 *                       column — it is 0 or 1 and carries no information.
 *   double elimination  ranked by the round of the second loss. Lost is 0 or 2,
 *                       so it stays out for the same reason.
 *   round robin         the full standings table. Here Lost and Level earn
 *                       their place, because they vary.
 *
 * SRS FR-RS-05 / FR-DL-02: the backend recomputes on every confirmed result,
 * so this reads and never derives. Deriving it here as well would put the
 * ranking rules in two places.
 */
import { Empty, FormGuide, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamLinkView } from '../../components/kit/chips'
import { useStandings } from '../../hooks/useMatch'
import type { StandingRowDto, StandingsDto } from '../../types/match.dto'

/** Round robin — everything varies, so everything is shown. */
function RoundRobinTable({ s }: { s: StandingsDto }) {
  const unit = s.scoreUnit.toLowerCase()
  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Squad</th><th>P</th><th>W</th><th>L</th><th>D</th>
            <th title={`${s.scoreUnit} for`}>F</th>
            <th title={`${s.scoreUnit} against`}>A</th>
            <th title={`${s.scoreUnit} difference`}>+/−</th>
            <th>Pts</th><th>Form</th>
          </tr>
        </thead>
        <tbody>
          {s.rows.map(r => (
            <tr key={r.team.id}>
              <td className="num">{r.rank}</td>
              <td><TeamLinkView team={r.team} /></td>
              <td className="num">{r.played}</td>
              <td className="num">{r.won}</td>
              <td className="num">{r.lost}</td>
              <td className="num">{r.level}</td>
              <td className="num">{r.scoredFor}</td>
              <td className="num">{r.scoredAgainst}</td>
              <td className="num">{r.scoreDifference > 0 ? `+${r.scoreDifference}` : r.scoreDifference}</td>
              <td className="num"><b>{r.points}</b></td>
              <td><FormGuide form={r.form} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sub">
        Level on points is separated by {unit} difference, then {unit} scored, then the results between
        the tied squads. Squads still level share a position.
      </span>
    </TableWrap>
  )
}

/**
 * Elimination — the ranking is how far you got, so the column that matters is
 * where you went out. Lost is omitted on purpose, not forgotten: it is 0 or 1
 * in single elimination and 0 or 2 in double, and never separates anybody.
 */
function EliminationTable({ rows }: { rows: StandingRowDto[] }) {
  return (
    <TableWrap>
      <table>
        <thead>
          <tr><th>#</th><th>Squad</th><th>Went out</th><th>P</th><th>W</th><th>Form</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.team.id}>
              <td className="num">{r.rank}</td>
              <td><TeamLinkView team={r.team} /></td>
              <td>{r.outLabel || '—'}</td>
              <td className="num">{r.played}</td>
              <td className="num">{r.won}</td>
              <td><FormGuide form={r.form} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sub">
        Ranked by how far a squad went, not by points. Squads out in the same round share a position,
        and there is no tiebreaker between them.
      </span>
    </TableWrap>
  )
}

export function LeaderboardTab({ tournamentId }: { tournamentId: number | string }) {
  const { data, isPending } = useStandings(tournamentId)

  if (isPending) return <Panel quiet><span className="sub">Loading the table…</span></Panel>
  if (!data || !data.rows.length) {
    return <Empty icon="trophy" title="No table yet" sub="Positions appear once a result is confirmed." />
  }

  return data.format === 'round_robin'
    ? <RoundRobinTable s={data} />
    : <EliminationTable rows={data.rows} />
}
