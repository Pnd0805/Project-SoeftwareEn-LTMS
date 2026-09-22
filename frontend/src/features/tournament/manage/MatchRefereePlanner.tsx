/**
 * src/features/tournament/manage/MatchRefereePlanner.tsx
 *
 * จัดกรรมการลงทุกแมตช์ตั้งแต่หน้าจับสาย — รวมถึงนัดรอบหลังที่ยังไม่รู้ว่าใครจะเข้ามา
 *
 * เดิมงานนี้ทำได้ที่หน้า Fixture ทีละแมตช์เท่านั้น ผู้จัดที่เพิ่งจับสายเสร็จจึงต้องเดา
 * ว่ามีกี่นัด แล้วไล่เปิดทีละหน้า และไม่มีที่ไหนเห็นภาพรวมว่ายังเหลือนัดไหนไม่มีคนคุม
 *
 * ── ทำไมนัดในอนาคตถึงจัดล่วงหน้าได้ ────────────────────────────────────────
 * FR02 (`assertMatchChangeable`) ขอแค่สองอย่าง: แมตช์ยัง `scheduled` และมีเวลาเริ่ม/จบ
 * ที่ยังไม่ถึง — **ไม่ได้ขอให้รู้ว่าทีมไหนแข่ง** ช่องรอบถัดไปที่ยังว่างจึงยื่นคำขอได้
 * ตามปกติ ขอแค่ตั้งเวลาให้มันก่อน (M06) ซึ่งเป็นเหตุผลที่แถวที่ยังไม่มีเวลาบอกให้ไปตั้งก่อน
 *
 * คำขอไม่ใช่การมอบหมาย — FR02 สร้างคำขอที่กรรมการต้องกดรับเอง (FR06) จนกว่าจะรับ
 * สถานะคือ "รอตอบ" ไม่ใช่ "คุมนัดนี้แล้ว" หน้านี้จึงแยกสองคำนี้ออกจากกันทุกที่
 */
import { Badge, Banner, Panel, TableWrap } from '../../../components/kit/primitives'
import { useMatchReferees, useTournamentMatches, useUnassignMatchReferee } from '../../../hooks/useMatch'
import {
  useCancelTournamentRefereeRequest, useRequestMatchReferee, useTournamentRefereeRequests,
  useTournamentReferees,
} from '../../../hooks/useAdmin'
import { ApiError } from '../../../api/client'
import type { BackendRefereeRequestDto, TournamentRefereeDto } from '../../../types/admin.dto'
import type { MatchListItemDto } from '../../../types/match.dto'

const requestError = (error: unknown) => {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : 'Could not send that request.'
  if (error.code === 'REFEREE_SCHEDULE_CONFLICT' || error.code === 'REFEREE_TIME_CONFLICT') {
    return 'That referee already has a match overlapping this one.'
  }
  if (error.code === 'REQUEST_ALREADY_OPEN') return 'A request to that referee for this match is already waiting.'
  if (error.code === 'REFEREE_ALREADY_ASSIGNED') return 'That referee already has this match.'
  if (error.code === 'REFEREE_NOT_ACTIVE') return 'That referee has not accepted the tournament invitation yet.'
  if (error.code === 'MATCH_NOT_CHANGEABLE') return 'Give this match a future start and end time first.'
  return error.message
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : null)

/** ชื่อคู่แข่ง — นัดรอบหลังยังไม่มีทีม เขียนว่ารออยู่แทนที่จะปล่อยว่าง */
const pairing = (m: MatchListItemDto) =>
  m.teamA && m.teamB ? `${m.teamA.name} v ${m.teamB.name}`
    : m.teamA ? `${m.teamA.name} v winner of an earlier match`
      : m.teamB ? `winner of an earlier match v ${m.teamB.name}`
        : 'both places still to be filled'

function MatchRow({ tournamentId, match, pool, openRequests, busy }: {
  tournamentId: number
  match: MatchListItemDto
  pool: TournamentRefereeDto[]
  openRequests: BackendRefereeRequestDto[]
  busy: boolean
}) {
  const assigned = useMatchReferees(match.id)
  const request = useRequestMatchReferee(tournamentId)
  const cancel = useCancelTournamentRefereeRequest(tournamentId)
  const unassign = useUnassignMatchReferee(match.id, tournamentId)

  const acceptedIds = new Set((assigned.data?.items ?? []).map(row => row.tournamentRefereeId))
  const waiting = new Map(openRequests.map(row => [row.refereeA.tournamentRefereeId, row]))
  const scheduled = !!match.scheduledTime && !!match.scheduledEndTime
  /* กฎเดียวกับ assertMatchChangeable — เปลี่ยนคนคุมได้เฉพาะนัดที่ยังไม่เริ่ม */
  const changeable = match.status === 'scheduled' && scheduled
  const working = busy || request.isPending || cancel.isPending || unassign.isPending
  const failed = request.error ?? cancel.error ?? unassign.error

  return (
    <tr>
      <td>
        <b>Match {match.id}</b>
        <div className="sub">Round {match.roundNumber ?? '—'} · {pairing(match)}</div>
        <div className="sub">{when(match.scheduledTime) ?? 'No kick-off set'}</div>
      </td>
      <td>
        {assigned.isPending ? <span className="sub">Loading…</span> : null}
        {assigned.isError ? <span className="sub">Could not read the assignments.</span> : null}
        <span className="vstack" style={{ gap: 4 }}>
          {pool.filter(r => acceptedIds.has(r.id)).map(r => (
            <span key={`a-${r.id}`} className="hstack" style={{ gap: 6 }}>
              <Badge kind="ok">Accepted</Badge>{r.user.fullName}
              {changeable ? (
                <button className="btn ghost" type="button" disabled={working}
                  onClick={() => unassign.mutate(r.id)}>Remove</button>
              ) : null}
            </span>
          ))}
          {pool.filter(r => waiting.has(r.id) && !acceptedIds.has(r.id)).map(r => (
            <span key={`w-${r.id}`} className="hstack" style={{ gap: 6 }}>
              <Badge kind="warn">Waiting for their answer</Badge>{r.user.fullName}
              <button className="btn ghost" type="button" disabled={working}
                onClick={() => cancel.mutate(waiting.get(r.id)!.id)}>Cancel</button>
            </span>
          ))}
          {!acceptedIds.size && !waiting.size && !assigned.isPending
            ? <span className="sub">Nobody yet.</span> : null}
        </span>
        {failed ? <Banner kind="crit">{requestError(failed)}</Banner> : null}
      </td>
      <td style={{ minWidth: 200 }}>
        {!changeable ? (
          <span className="sub">
            {scheduled ? 'This match has started — referees are fixed now.'
              : 'Set a kick-off and end time on the fixture page first.'}
          </span>
        ) : (
          <select
            aria-label={`Ask a referee to take match ${match.id}`}
            disabled={working}
            value=""
            onChange={e => {
              const id = Number(e.target.value)
              if (id) request.mutate({ tournamentRefereeId: id, matchId: match.id })
              e.target.value = ''
            }}
          >
            <option value="">Ask a referee…</option>
            {pool
              .filter(r => !acceptedIds.has(r.id) && !waiting.has(r.id))
              .map(r => <option key={r.id} value={r.id}>{r.user.fullName}</option>)}
          </select>
        )}
      </td>
    </tr>
  )
}

export function MatchRefereePlanner({ tournamentId }: { tournamentId: number | undefined }) {
  const matches = useTournamentMatches(tournamentId)
  const pool = useTournamentReferees(tournamentId)
  const requests = useTournamentRefereeRequests(tournamentId)

  if (tournamentId === undefined) return null

  const rows = (matches.data?.items ?? []).slice()
    .sort((a, b) => (a.roundNumber ?? 0) - (b.roundNumber ?? 0) || a.id - b.id)
  const activePool = (pool.data?.items ?? []).filter(r => r.isActive)
  const openOf = (matchId: number) => (requests.data?.items ?? []).filter(row =>
    row.type === 'org_add_match' && row.matchA.id === matchId && row.status === 'open')
  const busy = matches.isPending || pool.isPending || requests.isPending

  return (
    <Panel quiet>
      <div className="spread">
        <span className="tag"><em>//</em> Referees for every match</span>
        <span className="tag">{rows.length} {rows.length === 1 ? 'match' : 'matches'}</span>
      </div>

      {matches.isError || pool.isError || requests.isError ? (
        <Banner kind="crit">
          <b>Could not load the referee plan.</b> Reopen this tab to retry.
        </Banner>
      ) : null}

      {busy ? <div className="sub">Loading the referee plan…</div> : null}

      {!busy && !rows.length ? (
        <div className="sub">Draw the bracket first — there are no matches to staff yet.</div>
      ) : null}

      {!busy && rows.length && !activePool.length ? (
        <Banner kind="warn">
          <b>No referee has accepted this tournament yet.</b> Invite them on the Referees tab; only
          an active referee can be asked to take a match.
        </Banner>
      ) : null}

      {rows.length && activePool.length ? (
        <>
          <div className="sub">
            Asking a referee sends them a request — it counts only once they accept. Later rounds
            can be staffed now, before anyone knows who plays in them, as long as the slot has a
            kick-off time.
          </div>
          <TableWrap>
            <table>
              <thead><tr><th>Match</th><th>Referees</th><th>Add</th></tr></thead>
              <tbody>
                {rows.map(match => (
                  <MatchRow key={match.id} tournamentId={tournamentId} match={match}
                    pool={activePool} openRequests={openOf(match.id)} busy={busy} />
                ))}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : null}
    </Panel>
  )
}
