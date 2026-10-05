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
import { matchStateOf, scoreText, toTeamView } from '../match/matchView'

export function ScheduleTab({ tournamentId }: { tournamentId: number | string }) {
  const navigate = useNavigate()
  const { data, isPending, isError, error, refetch } = useTournamentMatches(tournamentId)

  if (isPending && !data) return <Panel quiet><span className="sub">Loading the schedule…</span></Panel>

  const ms = data?.items ?? []
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined
  const failure = isError ? (
    <Panel quiet>
      <span className="error">{status === 401 ? 'Sign in to view the schedule'
        : status === 403 ? 'You do not have access to this schedule'
          : 'Could not load the schedule'}</span>
      <button className="btn ghost" type="button" onClick={() => void refetch()}>Retry schedule</button>
    </Panel>
  ) : null
  if (!ms.length) {
    if (failure) return failure
    return <Empty icon="clock" title="Nothing scheduled yet" sub="Fixtures appear once the bracket is drawn." />
  }

  return (
    <>
      {failure}
      <TableWrap>
      <table>
        <thead>
          <tr>
            <th>Kick-off</th><th>Round</th><th>Home</th><th /><th>Away</th><th>Score</th><th>State</th><th />
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
              <td className="num">{scoreText(m)}</td>
              {/* รายการแมตช์แนบ resultStatus มาแล้ว — เดิมบังคับเป็น null ทุกแถว
                  นัดที่ยืนยันผลไปแล้วเลยขึ้น "Awaiting confirmation" ค้างตลอด */}
              <td><MatchStateBadge state={matchStateOf(m)} /></td>
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
    </>
  )
}
