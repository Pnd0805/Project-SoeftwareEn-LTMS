/**
 * src/features/tournament/LeaderboardTab.tsx — owned by slice 3
 *
 * SRS FR-DL-02: แสดงอันดับของทีมที่เข้าแข่งขัน อัปเดตอัตโนมัติทันทีที่มีการยืนยันผล
 * FR-RS-05 makes that the backend's job — confirming a result recomputes the
 * bracket, the standings and the leaderboard. So this table is read, never
 * derived here.
 *
 * ── ของเดิมคำนวณเองทั้งหมด ─────────────────────────────────────────────────
 * `leaderboard()` / `standings()` ใน rules.ts ไล่แมตช์ทุกนัดมาบวกเอง ซึ่งขัดกับ
 * FR-RS-05 และแปลว่ากติกาการจัดอันดับถูกเขียนสองที่ — ที่นี่กับที่ backend
 *
 * ⚠️ `tournament_standings` เก็บแค่ played / won / lost / points
 *    ตารางเดิมจัดอันดับ round robin ด้วยผลต่างประตู → ประตูได้ → mini-table
 *    และโชว์ฟอร์มห้านัดหลัง ซึ่ง **ไม่มีคอลัมน์รองรับสักตัว**
 *    ต้องตกลงกันว่า backend จะส่งเพิ่มไหม — ดู PLAN.md หัวข้อ Blocked ข้อ 2
 */
import { Empty, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamLinkView } from '../../components/kit/chips'
import { useStandings } from '../../hooks/useMatch'

export function LeaderboardTab({ tournamentId }: { tournamentId: number | string }) {
  const { data, isPending } = useStandings(tournamentId)


  if (isPending) return <Panel quiet><span className="sub">Loading the table…</span></Panel>

  const rows = data?.items ?? []
  if (!rows.length) {
    return <Empty icon="trophy" title="No table yet" sub="Positions appear once a result is confirmed." />
  }

  return (
    <>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Squad</th><th>Played</th><th>Won</th><th>Lost</th><th>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.team.id}>
                <td className="num">{r.rank}</td>
                <td><TeamLinkView team={r.team} /></td>
                <td className="num">{r.played}</td>
                <td className="num">{r.won}</td>
                <td className="num">{r.lost}</td>
                <td className="num"><b>{r.points}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <span className="sub">
        Teams level on points share a position. Goal difference, goals for and recent form are not in
        <code> tournament_standings</code> yet, so ties are not broken further here — the decision on
        whether the backend sends those columns is open.
      </span>
    </>
  )
}
