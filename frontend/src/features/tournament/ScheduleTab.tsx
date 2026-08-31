/**
 * src/features/tournament/ScheduleTab.tsx — owned by slice 3
 *
 * Every fixture in one table. Wide tables still scroll inside .tblwrap when the
 * rail narrows their column. The organizer gets a Fixture control on any match
 * that has not started — kick-off, venue and officials are set there.
 *
 * SRS FR-MM-03: แสดงตารางแข่งขันของทัวร์นาเมนต์ พร้อมสถานะแมตช์
 *
 * ── อยู่ในโฟลเดอร์สไลซ์ 2 แต่เป็นของสไลซ์ 3 ────────────────────────────────
 * มันวาดจากตาราง `matches` ล้วนๆ หน้าจอควรอยู่กับข้อมูลของมัน (ดู PLAN.md)
 * `TournamentPage` ของสไลซ์ 2 เป็นคน render และส่ง id มาให้
 */
import { useNavigate } from 'react-router-dom'
import { Empty, MatchStateBadge, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamLinkView } from '../../components/kit/chips'
import { useTournamentMatches } from '../../hooks/useMatch'
import { matchStateOf, toTeamView } from '../match/matchView'

export function ScheduleTab({ tournamentId }: { tournamentId: number | string }) {
  const navigate = useNavigate()
  const id = Number(tournamentId)
  const usable = Number.isFinite(id)
  const { data, isPending } = useTournamentMatches(usable ? id : undefined)

  /* สไลซ์ 2 ยังส่ง id ของ store (เช่น "t-vb") มาอยู่ ซึ่งค้นจาก API ไม่ได้
     บอกตรงๆ ดีกว่าโชว์ตารางว่างที่ดูเหมือนยังไม่มีแมตช์ */
  if (!usable) {
    return (
      <Panel quiet>
        <span className="tag"><em>//</em> Schedule</span>
        <div className="sub">
          This tab reads the <code>matches</code> table through the API and needs the tournament's
          numeric id. The tournament page still holds a prototype id — it starts working when slice 2
          migrates. See PLAN.md, the two id spaces.
        </div>
      </Panel>
    )
  }

  if (isPending) return <Panel quiet><span className="sub">Loading the schedule…</span></Panel>

  const ms = data?.items ?? []
  if (!ms.length) {
    return <Empty icon="clock" title="Nothing scheduled yet" sub="Fixtures appear once the bracket is drawn." />
  }

  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th>Kick-off</th><th>Round</th><th>Home</th><th /><th>Away</th><th>State</th><th />
          </tr>
        </thead>
        <tbody>
          {ms.map(m => (
            <tr key={m.id}>
              <td className="num">{m.scheduledTime ? new Date(m.scheduledTime).toLocaleString() : '—'}</td>
              <td className="tag">{m.tag}</td>
              <td><TeamLinkView team={toTeamView(m.teamA)} /></td>
              <td className="tag">vs</td>
              <td><TeamLinkView team={toTeamView(m.teamB)} /></td>
              <td><MatchStateBadge state={matchStateOf({ ...m, resultStatus: null })} /></td>
              <td>
                <span className="hstack" style={{ gap: 8 }}>
                  <button className="btn ghost" type="button" onClick={() => navigate(`/m/${m.id}`)}>Open</button>
                  {m.viewer.can.editFixture
                    ? <button className="btn ghost" type="button" onClick={() => navigate(`/m/${m.id}/fixture`)}>Fixture</button>
                    : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  )
}
