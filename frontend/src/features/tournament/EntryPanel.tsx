/**
 * src/features/tournament/EntryPanel.tsx
 *
 * Entry, read from the tournament rather than from the squad. A leader who has
 * just read the rules and the entry notes is already here; sending them to their
 * squad page to start again is the long way round to the same form.
 */
import { useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Facts, Panel } from '../../components/kit/primitives'
import { useLtms } from '../../shared/store'
import { me, regsOf, squadsFor, team } from '../../shared/selectors'
import { minSquad, ruleSummary, teamReady } from '../../shared/rules'
import type { Tournament } from '../../shared/types'
import type { TournamentApplicationDto } from '../../types/tournament.dto'
import { USE_MOCK } from '../../api/client'
import { useMe } from '../../hooks/useAuth'
import { useBackendMyTeams } from '../../hooks/useTeam'
import { useMyTournamentApplications } from '../../hooks/useTournament'
import { RegisterForm } from './RegisterForm'
import { registrationClosedReason } from './tournamentView'

/**
 * ใครสมัครได้: โหมด mock อ่านจาก store · โหมดจริงอ่านจาก backend
 *   ตัวตน       → GET /me            (store ไม่มี session ในโหมดจริง)
 *   ทีมที่นำอยู่ → GET /me/teams      (ต้องเป็นหัวหน้าทีม · Ready · กีฬาตรงกับรายการ)
 *   ใบสมัครเดิม → GET /me/applications
 * เดิมหน้านี้อ่านจาก store อย่างเดียว หัวหน้าทีมในโหมดจริงจึงไม่เห็นปุ่มสมัครเลย
 */
export function EntryPanel({ t, applications, approvedCount, sportTypeId, confirmation, feedback, organizer = false }: {
  t: Tournament
  organizer?: boolean
  applications?: TournamentApplicationDto[]
  /** ยอดทีมที่ผู้จัดอนุมัติแล้ว จาก GET /tournaments/:id/teams (โหมดจริงเท่านั้น) */
  approvedCount?: number
  sportTypeId?: number
  /** Optional public-read metadata; callers without it keep the existing confirmed-rules behavior. */
  confirmation?: { rules: boolean; capacity: boolean; accessLost?: boolean }
  feedback?: ReactNode
}) {
  const s = useLtms()
  const storeUser = me(s)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const entryFeedbackRef = useRef<HTMLDivElement>(null)
  const meQuery = useMe()
  const privateApplicable = !USE_MOCK && !!meQuery.data
  const backendTeams = useBackendMyTeams(privateApplicable)
  const myApplications = useMyTournamentApplications(privateApplicable)
  const u = USE_MOCK ? storeUser : (meQuery.data ? { id: String(meQuery.data.id) } : null)

  /* Real entry capacity comes from the confirmed public approved-team read.
     Missing data must not become an empty prototype count. */
  const approved = USE_MOCK ? approvedCount
    ?? (applications
      ? applications.filter(application => application.status === 'approved').length
      : regsOf(s, t.id).filter(r => r.status === 'approved').length) : approvedCount
  const closed = approved === undefined ? null : registrationClosedReason(t, approved, !USE_MOCK)
  const rulesConfirmed = confirmation?.rules ?? true
  const capacityConfirmed = confirmation?.capacity ?? approved !== undefined
  const entryConfirmed = rulesConfirmed && capacityConfirmed && approved !== undefined

  /* every squad of mine already in this one, whatever the organizer decided */
  const mineIn = USE_MOCK && u
    ? s.registrations.filter(r => r.tour === t.id && r.status !== 'withdrawn' && team(s, r.team)?.leader === u.id)
    : []
  const can = USE_MOCK && u ? squadsFor(s, t).filter(teamReady) : []
  const forming = USE_MOCK && u ? squadsFor(s, t).filter(x => !teamReady(x)) : []

  /* โหมดจริง — ทีมที่เรานำอยู่และพร้อมแข่งในกีฬาเดียวกับรายการนี้ */
  const myTeams = privateApplicable ? (backendTeams.data?.items ?? [])
    .filter(x => x.role === 'leader' && (sportTypeId === undefined || x.sportTypeId === sportTypeId))
    : []
  const backendReady = myTeams.filter(x => x.readinessStatus === 'Ready')
  const backendForming = myTeams.filter(x => x.readinessStatus !== 'Ready')
  const backendEntries = privateApplicable ? (myApplications.data?.items ?? [])
    .filter(a => a.tournament.id === Number(t.id) && a.status !== 'withdrawn' && a.status !== 'cancelled')
    : []
  const teamErrorStatus = typeof backendTeams.error === 'object' && backendTeams.error !== null
    && 'status' in backendTeams.error ? backendTeams.error.status : undefined
  const entryErrorStatus = typeof myApplications.error === 'object' && myApplications.error !== null
    && 'status' in myApplications.error ? myApplications.error.status : undefined
  const teamAccessLost = privateApplicable && backendTeams.isError
    && (teamErrorStatus === 401 || teamErrorStatus === 403 || teamErrorStatus === 404)
  const teamFailure = privateApplicable && backendTeams.isError ? <>
    <span className="error">{teamErrorStatus === 401 ? 'Sign in again to view the squads you lead.'
      : teamErrorStatus === 403 ? 'Your account is not allowed to view these squads.'
        : 'Could not load the squads you lead.'}</span>
    <button className="btn ghost" type="button" onClick={() => void backendTeams.refetch()}>Retry your squads</button>
  </> : null
  const draftFeedback = !entryConfirmed || teamFailure ? <div role="alert">
    <p className="sub">Entry availability is unconfirmed. Your selected players are kept; the server checks registration when you submit.</p>
    {feedback}
    {teamFailure}
  </div> : null

  return (
    <>
      <div ref={entryFeedbackRef} className="tour-entry-surface" role="region" aria-label="Entry feedback" tabIndex={-1}>
      <Panel className="tour-entry">
        <div className="spread">
          <h2 className="journey-heading">Entry</h2>
          {!entryConfirmed ? <Badge kind="neutral">Unconfirmed</Badge> : closed
            ? <Badge kind="neutral">{t.drawn ? 'Closed' : approved !== undefined && approved >= t.cap ? 'Full' : 'Not open'}</Badge>
            : <Badge kind="ok">Open</Badge>}
        </div>
        <Facts rows={[
          ['Squads in', !capacityConfirmed || approved === undefined ? 'Capacity unavailable'
            : <><b className="num">{approved}</b> <span className="sub">of {t.cap}</span></>],
          ['Entry rules', rulesConfirmed ? ruleSummary(t.rules) || 'open to everybody' : 'Eligibility unconfirmed'],
        ]} />
        {entryConfirmed && closed ? <p className="sub">{closed}</p> : null}

        {mineIn.map(r => (
          <div className="spread" key={r.id}>
            <span className="sub">{team(s, r.team)?.name}</span>
            {r.status === 'approved' ? <Badge kind="ok">In</Badge>
              : r.status === 'rejected' ? <Badge kind="crit">Rejected by the hard filter</Badge>
                : <Badge kind="warn">Waiting on the organizer</Badge>}
          </div>
        ))}

        {backendEntries.map(a => (
          <div className="spread" key={a.id}>
            <span className="sub">{a.team.name}</span>
            {a.status === 'approved' ? <Badge kind="ok">In</Badge>
              : a.status === 'rejected' ? <Badge kind="crit">{a.rejectionReason ?? 'Rejected'}</Badge>
                : <Badge kind="warn">Waiting on the organizer</Badge>}
          </div>
        ))}

        {privateApplicable && myApplications.isPending ? <span className="sub">Loading your entries…</span> : null}
        {privateApplicable && myApplications.isError ? <>
          <span className="error">{entryErrorStatus === 401 ? 'Sign in again to view your entries.'
            : entryErrorStatus === 403 ? 'Your account is not allowed to view these entries.'
              : 'Could not load your entries.'}</span>
          <button className="btn ghost" type="button" onClick={() => void myApplications.refetch()}>Retry your entries</button>
        </> : null}

        {organizer ? <div className="vstack">
          <p className="sub">Review registrations and entry rules in Manage.</p>
          <Link className="btn" to={`/t/${t.id}/manage/registrations`}>Manage registrations</Link>
        </div> : !entryConfirmed ? <span className="sub">Entry availability is unconfirmed.</span>
          : closed ? null : !u ? (
          <div className="hstack">
            <button className="btn primary" type="button" onClick={() => navigate('/login')}>Sign in to enter a squad</button>
          </div>
        ) : teamFailure ? teamFailure : can.length || backendReady.length ? (
          <div className="hstack">
            <button className="btn primary" type="button" onClick={() => setOpen(true)}>Register a squad</button>
          </div>
        ) : forming.length ? (
          <div className="sub">
            {forming[0].name} is still Forming — it needs {minSquad(forming[0])} players before it can enter.
          </div>
        ) : backendForming.length ? (
          <div className="sub">
            {backendForming[0].name} is still Forming — it needs more players before it can enter.
          </div>
        ) : privateApplicable && backendTeams.isPending ? (
          <div className="sub">Loading the squads you lead…</div>
        ) : !USE_MOCK ? (
          <div className="sub">You need a squad you lead, in this sport, with Ready status before you can enter.</div>
        ) : null}
      </Panel>
      </div>

      {open && u && !confirmation?.accessLost && !teamAccessLost
        && (USE_MOCK ? can.length : backendReady.length || backendTeams.isError) ? (
        <RegisterForm team={can[0]} options={[t]} tournament={t} sportTypeId={sportTypeId}
          open={open} onClose={() => {
            setOpen(false)
            /* โหลดซ้ำล้มเหลวอาจถอดปุ่มเดิม จึงคืนโฟกัสไปยังข้อความแก้ไขแทน */
            if (!entryConfirmed || teamFailure) requestAnimationFrame(() => entryFeedbackRef.current?.focus())
          }} feedback={draftFeedback} />
      ) : null}
    </>
  )
}
