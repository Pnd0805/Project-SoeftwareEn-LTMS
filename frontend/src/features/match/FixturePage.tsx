/**
 * src/features/match/FixturePage.tsx
 *
 * A fixture is set on its own page: one card with labelled fields (kick-off,
 * venue, officials), and the same facts read-only once check-in has started.
 * Appointment to the tournament makes somebody eligible; assignment here makes
 * them responsible, and only an assigned referee may record the result.
 *
 * SRS FR-MM-02: จัดวันเวลาและสนามให้แต่ละแมตช์
 *
 * ⚠️ FR-MM-02 ยังสั่งให้ระบบ **ตรวจไม่ให้ทีมเดียวกันมีนัดเวลาทับซ้อน และไม่ให้
 *    สนามเดียวกันถูกใช้ซ้อนเวลา** ซึ่งต้องรู้ตารางทั้งทัวร์นาเมนต์ — เป็นการตรวจ
 *    ฝั่ง server ที่ยังไม่มี endpoint รองรับ หน้านี้จึงยังบันทึกทับกันได้อยู่
 *    เป็นช่องว่างจริง ไม่ใช่เรื่องที่ลืม
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Banner, Crumb, Empty, Facts, Field, Panel, TableWrap } from '../../components/kit/primitives'
import {
  useAssignReferees, useMatch, useMatchReferees, useUnassignMatchReferee, useUpdateMatch,
} from '../../hooks/useMatch'
import {
  useCancelTournamentRefereeRequest, useRequestMatchReferee, useTournamentRefereeRequests,
  useTournamentReferees,
} from '../../hooks/useAdmin'
import { ApiError, USE_MOCK } from '../../api/client'
import { tournamentRouteId } from '../../mocks/storeBridge'
import { MatchStatusLabel } from '../../types/enums'
import type { MatchDto } from '../../types/match.dto'

/** datetime-local wants a local wall clock, not an ISO instant. */
const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const refereeRequestError = (error: unknown) => {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : 'Could not request this referee.'
  if (error.code === 'REFEREE_SCHEDULE_CONFLICT') return 'This referee already has a match that overlaps this time.'
  if (error.code === 'REQUEST_ALREADY_OPEN') return 'A request to this referee is already waiting for an answer.'
  if (error.code === 'REFEREE_NOT_ACTIVE') return 'This referee is not active in the tournament yet.'
  if (error.code === 'MATCH_NOT_CHANGEABLE') return 'Set a future start and end time before requesting a referee.'
  return error.message
}

/** Real mode uses the consent-based FR02 flow; it never calls the removed bulk assignment route. */
function RealRefereeAssignments({ match }: { match: MatchDto }) {
  const pool = useTournamentReferees(match.tournamentId)
  const assigned = useMatchReferees(match.id)
  const requests = useTournamentRefereeRequests(match.tournamentId)
  const request = useRequestMatchReferee(match.tournamentId)
  const cancel = useCancelTournamentRefereeRequest(match.tournamentId)
  const unassign = useUnassignMatchReferee(match.id, match.tournamentId)
  /* BR-10: on-site + กีฬาที่มีสถิติ = 2 · อื่น = 1 · เราไม่รู้ว่ากีฬานี้มีสถิติไหมตรงนี้
     จึงใช้ค่าสูงของโหมดไปก่อน — เป็น "อย่างน้อย" ไม่ใช่เพดาน */
  const needed = match.mode === 'onsite' ? 2 : 1
  const acceptedIds = new Set((assigned.data?.items ?? []).map(row => row.tournamentRefereeId))
  const openRequests = (requests.data?.items ?? []).filter(row =>
    row.type === 'org_add_match' && row.matchA.id === match.id && row.status === 'open')
  const pendingByReferee = new Map(openRequests.map(row => [row.refereeA.tournamentRefereeId, row]))
  const activePool = (pool.data?.items ?? []).filter(row => row.isActive)
  const scheduled = !!match.scheduledTime && !!match.scheduledEndTime
  const loading = pool.isPending || assigned.isPending || requests.isPending
  const readError = pool.isError || assigned.isError || requests.isError

  return (
    <Field label={`Referees — ${needed} accepted ${needed === 1 ? 'referee' : 'referees'} required`}>
      {!scheduled ? (
        <Banner kind="warn"><b>Schedule this match first.</b> Referee requests require a future start and end time.</Banner>
      ) : null}
      {loading ? <div className="sub">Loading referee assignments…</div> : null}
      {readError ? (
        <Banner kind="crit"><b>Could not load referee assignments.</b> Retry by reopening this fixture.</Banner>
      ) : null}
      {request.isError ? <Banner kind="crit"><b>Request not sent.</b> {refereeRequestError(request.error)}</Banner> : null}
      {cancel.isError || unassign.isError ? (
        <Banner kind="crit"><b>Could not update this assignment.</b>{' '}
          {refereeRequestError(cancel.error ?? unassign.error)}</Banner>
      ) : null}
      {!loading && !readError && !activePool.length ? (
        <div className="sub">No active referee is available. Invite one in the tournament Referees tab first.</div>
      ) : null}
      {activePool.length ? (
        <TableWrap>
          <table>
            <thead><tr><th>Referee</th><th>State</th><th /></tr></thead>
            <tbody>
              {activePool.map(referee => {
                const isAccepted = acceptedIds.has(referee.id)
                const pending = pendingByReferee.get(referee.id)
                const busy = request.isPending || cancel.isPending || unassign.isPending
                return (
                  <tr key={referee.id}>
                    <td>{referee.user.fullName}</td>
                    <td>{isAccepted
                      ? <Badge kind="ok">Accepted</Badge>
                      : pending ? <Badge kind="warn">Waiting for acceptance</Badge>
                        : <Badge kind="neutral">Available</Badge>}</td>
                    <td style={{ textAlign: 'right' }}>
                      {isAccepted ? (
                        <button className="btn ghost" type="button" disabled={busy}
                          onClick={() => unassign.mutate(referee.id)}>Remove</button>
                      ) : pending ? (
                        <button className="btn ghost" type="button" disabled={busy}
                          onClick={() => cancel.mutate(pending.id)}>Cancel request</button>
                      ) : (
                        /* เดิมปิดปุ่มทันทีที่ครบ `needed` — แต่ `needed` เป็นขั้นต่ำของ BR-10
                           ไม่ใช่เพดาน ผู้จัดที่อยากมีกรรมการสำรองอีกคนจึงกดไม่ได้เฉยๆ
                           โดยไม่มีอะไรบอก · ที่ block จริงคือเวลาซ้อน ซึ่ง server ตรวจให้ */
                        <button className="btn primary" type="button"
                          disabled={busy || !scheduled}
                          title={scheduled ? undefined : 'Set a start and end time first'}
                          onClick={() => request.mutate({ tournamentRefereeId: referee.id, matchId: match.id })}>
                          Request this match
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      ) : null}
      <div className="sub">
        {acceptedIds.size} accepted · {pendingByReferee.size} waiting · {needed} required.
        Requests are confirmed only after the referee accepts; time conflicts are checked by the server.
      </div>
    </Field>
  )
}

export function FixturePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const matchId = id
  const { data: m, isPending, isError } = useMatch(matchId)
  const update = useUpdateMatch(matchId ?? 0, m?.tournamentId)
  const assign = useAssignReferees(matchId ?? 0, m?.tournamentId)

  const [kickoff, setKickoff] = useState<string | null>(null)
  const [finish, setFinish] = useState<string | null>(null)
  const [venue, setVenue] = useState<string | null>(null)
  const [refs, setRefs] = useState<number[] | null>(null)

  if (!matchId || isError) return <Empty icon="warn" title="No such match" />
  if (isPending) return <Panel quiet><span className="sub">Loading the fixture…</span></Panel>

  /* ค่าที่แก้อยู่ยังไม่ commit — ยังไม่แตะช่องไหนก็ใช้ค่าจาก server */
  const kickoffVal = kickoff ?? toLocal(m.scheduledTime)
  const finishVal = finish ?? toLocal(m.scheduledEndTime ?? null)
  const venueVal = venue ?? (m.venue ?? '')
  const refsVal = refs ?? m.referees.map(r => r.id)

  /* `can.editFixture` รวมสองเรื่องไว้ด้วยกัน: เป็นผู้จัดไหม และแมตช์ยังแก้ได้ไหม
     เขียน "403 — not yours to set" ให้ผู้จัดตัวจริงที่มาช้าไปคือบอกผิดเรื่อง เขามีสิทธิ์
     แต่หมดเวลาแล้ว — แยกสองกรณีออกจากกัน แล้วกรณีหลังปล่อยให้ไหลลงไปหน้าอ่านอย่างเดียว */
  const isOrganizer = m.viewer.roles.includes('organizer')
  if (!isOrganizer) {
    return (
      <>
        <Crumb back={{ label: m.tournament.name, onClick: () => navigate(`/t/${tournamentRouteId(m.tournament.id)}`) }}>Fixture</Crumb>
        <Empty icon="warn" title="403 — not yours to set"
          sub="Kick-off, venue and officials are the organizer's to place." />
      </>
    )
  }

  /**
   * เปิดให้แก้ได้ตอนไหน — ตามกฎจริงของ M06 คือแมตช์ต้องยัง `scheduled` เท่านั้น
   *
   * เดิมดูที่ "ยังไม่มีใครเช็คอิน" ซึ่งเป็นคนละเรื่อง: แมตช์ที่เปิดเช็คอินแล้วแต่ยังไม่มีใครมา
   * `checkedIn` ยังเป็น 0 หน้าจึงโชว์ฟอร์มให้แก้ แล้วกด Save ไปเจอ 409 MATCH_NOT_CHANGEABLE
   * ส่วนคำขอกรรมการ (FR02) ก็ใช้เงื่อนไขเดียวกันนี้ที่ `assertMatchChangeable`
   */
  const open = m.status === 'scheduled'
  const toggle = (uid: number) =>
    setRefs(cur => {
      const now = cur ?? m.referees.map(r => r.id)
      return now.includes(uid) ? now.filter(x => x !== uid) : [...now, uid]
    })

  const save = async () => {
    await update.mutateAsync({
      scheduledTime: kickoffVal ? new Date(kickoffVal).toISOString() : null,
      scheduledEndTime: finishVal ? new Date(finishVal).toISOString() : null,
      venue: venueVal || null,
    })
    if (USE_MOCK) {
      await assign.mutateAsync(refsVal)
      navigate(`/t/${tournamentRouteId(m.tournament.id)}/schedule`)
    }
  }

  const saving = update.isPending || assign.isPending

  return (
    <>
      <Crumb back={{ label: m.tournament.name, onClick: () => navigate(`/t/${tournamentRouteId(m.tournament.id)}/schedule`) }}>Fixture</Crumb>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 28 }}>{m.stage}</h1>
        {open
          ? <Badge kind="warn">Open until check-in starts</Badge>
          : <Badge kind="neutral">Locked — {MatchStatusLabel[m.status]}</Badge>}
      </div>

      <Panel quiet>
        <div className="spread">
          <span className="hstack" style={{ gap: 8 }}>
            <span className="badge neutral">{m.tag}</span>
            <b>{m.teamA && m.teamB ? `${m.teamA.name} v ${m.teamB.name}` : m.stage}</b>
          </span>
        </div>

        {open ? (
          <>
            <div className="grid2">
              <Field label="Kick-off" htmlFor={`as-k-${m.id}`}>
                <input id={`as-k-${m.id}`} type="datetime-local" value={kickoffVal}
                  onChange={e => setKickoff(e.target.value)} />
              </Field>
              <Field label="End" htmlFor={`as-e-${m.id}`}>
                <input id={`as-e-${m.id}`} type="datetime-local" value={finishVal}
                  onChange={e => setFinish(e.target.value)} />
              </Field>
              <Field label="Venue" htmlFor={`as-v-${m.id}`}>
                <input id={`as-v-${m.id}`} value={venueVal} onChange={e => setVenue(e.target.value)}
                  placeholder="Court 9" />
              </Field>
            </div>

            {/* TODO(schema): FR-MM-05 อยากให้ผู้เล่นหาสนามเจอ แต่ `matches` ไม่มีคอลัมน์พิกัด
                ช่อง Map pin ของ prototype จึงยังไม่มีที่เก็บ */}

            {USE_MOCK ? <Field label="Referees — appointment makes them eligible, this makes them responsible">
              <TableWrap>
                <table>
                  <thead><tr><th>On</th><th>Referee</th></tr></thead>
                  <tbody>
                    {m.availableReferees.map(r => (
                      <tr key={r.id}>
                        <td>
                          <input type="checkbox" checked={refsVal.includes(r.id)} onChange={() => toggle(r.id)}
                            aria-label={`Put ${r.fullName} on this match`} />
                        </td>
                        <td>{r.fullName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              {!m.availableReferees.length ? (
                <div className="sub">
                  Nobody has accepted an appointment to this tournament yet — invite them from the
                  Referees tab first.
                </div>
              ) : null}
            </Field> : <RealRefereeAssignments match={m} />}

            {update.isError || assign.isError ? (
              <Banner kind="crit">Could not save the fixture. Nothing was changed.</Banner>
            ) : null}

            <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
              disabled={saving} onClick={save}>
              {saving ? 'Saving…' : USE_MOCK ? 'Save this fixture' : 'Save schedule'}
            </button>
            {!USE_MOCK && update.isSuccess ? <Banner kind="ok">Schedule saved. Referee requests can now be sent separately.</Banner> : null}
          </>
        ) : (
          <>
            <Banner kind="neutral">
              <b>This fixture is set.</b> The server only lets the kick-off, venue and match
              referees change while the match is still scheduled — this one is{' '}
              {MatchStatusLabel[m.status].toLowerCase()}.{' '}
              {m.status === 'checkin_open'
                ? 'Close check-in from the match page first if it needs to move.'
                : 'It cannot be moved any more.'}
            </Banner>
            <Facts rows={[
              ['Kick-off', m.scheduledTime ? new Date(m.scheduledTime).toLocaleString() : '—'],
              ['End', m.scheduledEndTime ? new Date(m.scheduledEndTime).toLocaleString() : '—'],
              ['Venue', m.venue || '—'],
              ['Referees', m.referees.map(r => r.fullName).join(', ') || 'nobody named'],
            ]} />
          </>
        )}
      </Panel>
    </>
  )
}
