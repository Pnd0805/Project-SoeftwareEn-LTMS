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
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty, Field, MatchStateBadge, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamLinkView } from '../../components/kit/chips'
import { useTournamentMatches } from '../../hooks/useMatch'
import { matchStateOf, scoreText, toTeamView } from '../match/matchView'
import type { MatchState } from '../../components/kit/viewModels'
import { fmtDateTime } from '../../shared/dateFormat'

const stateLabels: Record<MatchState, string> = {
  scheduled: 'Scheduled', checkin: 'Check-in open', live: 'In progress', finished: 'Awaiting result',
  pending: 'Awaiting confirmation', confirmed: 'Confirmed', disputed: 'Disputed',
  rejected: 'Result thrown out', waiting: 'Waiting on teams', bye: 'Bye',
}

export function ScheduleTab({ tournamentId }: { tournamentId: number | string }) {
  const navigate = useNavigate()
  const { data, isPending, isError, error, refetch } = useTournamentMatches(tournamentId)
  const [search, setSearch] = useState('')
  const [round, setRound] = useState('')
  const [state, setState] = useState('')

  if (isPending && !data) return <Panel quiet><span className="sub">Loading the schedule…</span></Panel>

  const ms = data?.items ?? []
  const rounds = [...new Set(ms.flatMap(m => typeof m.roundNumber === 'number' ? [m.roundNumber] : []))].sort((a, b) => a - b)
  // กรองข้อมูลที่โหลดอยู่แล้ว ไม่เปลี่ยนคำขอหรือขอบเขตแมตช์ที่ server อนุญาต
  const filtered = ms.filter(m => (!search.trim() || [m.teamA?.name, m.teamB?.name]
    .some(name => name?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
    && (!round || String(m.roundNumber ?? 'null') === round) && (!state || matchStateOf(m) === state))
  const filtering = !!search || !!round || !!state
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined
  const failure = isError ? (
    <div className="vstack" role="alert">
      <span className="error">{status === 401 ? 'Sign in to view the schedule'
        : status === 403 ? 'You do not have access to this schedule'
          : 'Could not load the schedule'}</span>
      <button className="btn ghost" type="button" onClick={() => void refetch()}>Retry schedule</button>
    </div>
  ) : null
  // ข้อมูลเก่าช่วยตอนเครือข่ายล้มเหลวได้ แต่ห้ามแสดงต่อเมื่อ server ถอนสิทธิ์
  if (isError && (status === 401 || status === 403 || status === 404)) return failure
  if (!ms.length) {
    if (failure) return failure
    return <Empty icon="clock" title="Nothing scheduled yet" sub="Fixtures appear once the bracket is drawn." />
  }

  return (
    <Panel quiet className="tour-schedule">
      {failure}
      <div className="spread"><h2 className="journey-heading">Schedule</h2>
        <span className="sub" role="status">{filtered.length} of {ms.length} matches</span>
      </div>
      <div className="tour-schedule-filters">
        <Field label="Team" htmlFor="schedule-search"><input id="schedule-search" type="search" aria-label="Search schedule"
          placeholder="Team name" value={search} onChange={e => setSearch(e.target.value)} /></Field>
        <Field label="Round" htmlFor="schedule-round"><select id="schedule-round" aria-label="Round filter" value={round} onChange={e => setRound(e.target.value)}>
          <option value="">All rounds</option>{rounds.map(r => <option key={r} value={r}>Round {r}</option>)}
          {ms.some(m => m.roundNumber == null) ? <option value="null">Not assigned</option> : null}
        </select></Field>
        <Field label="State" htmlFor="schedule-state"><select id="schedule-state" aria-label="Match state filter" value={state} onChange={e => setState(e.target.value)}>
          <option value="">All states</option>{Object.entries(stateLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></Field>
      </div>
      {filtering ? <button className="btn ghost tour-clear" type="button" onClick={() => { setSearch(''); setRound(''); setState('') }}>Clear filters</button> : null}
      {!filtered.length ? <Empty icon="search" title="No matching matches" sub="Try another team, round or state." /> : (
      <TableWrap label="Tournament schedule">
      <table>
        <thead>
          <tr>
            <th>Kick-off</th><th>Round</th><th>Home</th><th aria-label="Versus" /><th>Away</th><th>Score</th><th>State</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(m => (
            <tr key={m.id}>
              <td className="num">{m.scheduledTime ? fmtDateTime(m.scheduledTime) : '—'}</td>
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
      )}
    </Panel>
  )
}
