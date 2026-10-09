import { useNow } from '../../hooks/useNow'
/**
 * src/features/admin/AdminPage.tsx
 *
 * The Admin approves or rejects requests and manages the system globally; they
 * do not manage individual tournaments. Four queues, all asked-and-decided —
 * requests to organize, permanent-squad exemptions, external referees, and
 * hard-filter changes — plus the accounts themselves.
 *
 * ── แหล่งข้อมูลของแต่ละแท็บ ─────────────────────────────────────────────
 * Permanent squads อ่าน/ตัดสินผ่าน /admin/team-requests ของ backend เท่านั้น
 * (university-wide admin · 403 INSUFFICIENT_ADMIN_SCOPE) · External referees และ Users
 * ผ่าน API ที่ backend ยังไม่มี (โหมด mock ใช้ได้ นอกนั้น 501) · แท็บที่เหลืออ่าน store
 * เพราะ backend ยังไม่มี route ของคำขอจัดการแข่งและการเปลี่ยน hard filter
 */
import { useEffect, useRef, useState } from 'react'
import { Badge, Banner, Empty, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { adminReadBlocked } from './adminView'
import { Modal } from '../../components/kit/Modal'
import { Icon } from '../../components/kit/Icon'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TeamLinkView } from '../../components/kit/chips'
import { decideFilterChange, decideTournament, useLtms } from '../../shared/store'
import { isAdmin, regsOf, user } from '../../shared/selectors'
import { fmtDate, formatName, ruleSummary } from '../../shared/rules'
import {
  useAdminAccess, useAmendmentRequests, useApproveAmendment, useApproveTeamRequest,
  useExternalRefereeRequests, usePendingTournamentRequests, useRejectAmendment,
  useRejectTeamRequest, useReviewTournamentRequest, useTeamRequests,
} from '../../hooks/useAdmin'
import { USE_MOCK } from '../../api/client'
import { useTournaments } from '../../hooks/useTournament'
import { useSportTypes } from '../../hooks/useReference'
import type { OfficialTeamRequestDto } from '../../types/admin.dto'
import { AdminRefereesTab } from './AdminRefereesTab'
import { AdminScopesTab, AdminAuditTab } from './AdminGovernanceTab'
import { LeaderTransfersTab } from './LeaderTransfersTab'
import { AdminUsersTab } from './AdminUsersTab'
import { AdminFeedbackTab } from './AdminFeedbackTab'
import { UserReportsTab } from './UserReportsTab'
import { StalledWorkTab } from './StalledWorkTab'
import { TournamentReviewDetails, TournamentReviewDisclosure } from './TournamentReviewDetails'
import { IdentityDocs } from './IdentityDocs'
import { AmendmentApprovalDialog } from './AmendmentApprovalDialog'
import { displayDate } from '../../shared/display'
import { ContractErrorDetails } from '../../components/kit/ContractErrorDetails'
import type { BackendAmendmentRequestDto } from '../../types/tournament.dto'
import { useMe } from '../../hooks/useAuth'
import { canReadTournamentQueues } from '../../shared/adminQueueAccess'

/** คำตอบที่ C02/C03 ปฏิเสธมา — อ่านเป็นภาษาของหน้านี้ ไม่ใช่ข้อความดิบของ backend */
const tournamentDecisionError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code
  if (code === 'INSUFFICIENT_ADMIN_SCOPE') return 'This request belongs to another faculty’s admin.'
  if (code === 'INVALID_STATUS_TRANSITION') return 'Somebody already decided this one. Reload the queue.'
  if (code === 'TOURNAMENT_NOT_FOUND') return 'That request is no longer in the queue.'
  return error instanceof Error ? error.message : 'Try again.'
}

const TABS = [
  { key: 'requests', label: 'Tournament requests' },
  { key: 'permanent', label: 'Permanent squads' },
  { key: 'referees', label: 'External referees' },
  { key: 'filters', label: 'Rule changes' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'users', label: 'Users' },
  { key: 'user-reports', label: 'User reports' },
  { key: 'stalled', label: 'Stalled work' },
  { key: 'scopes', label: 'Admin rights' },
  { key: 'transfers', label: 'Leader transfers' },
  { key: 'audit', label: 'Audit logs' },
  { key: 'feedback', label: 'Feedback' },
]

function AdminNavigation({ tab, tabs, onNavigate }: { tab: string; tabs: typeof TABS; onNavigate: () => void }) {
  const [compact, setCompact] = useState(() => window.matchMedia?.('(max-width: 700px)').matches ?? false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 700px)')
    if (!media) return
    const change = (event: MediaQueryListEvent) => { setCompact(event.matches); setOpen(false) }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  return <div className="admin-section-picker">
    {compact ? <button className="btn admin-sections-trigger" type="button" aria-controls="admin-sections"
      aria-expanded={open} aria-label={`Sections: ${TABS.find(item => item.key === tab)?.label}`}
      onClick={() => setOpen(value => !value)}>
      <span><span className="sub">Sections</span><strong>{TABS.find(item => item.key === tab)?.label}</strong></span>
      <Icon name="chev" size={18} />
    </button> : null}
    <nav id="admin-sections" className="admin-navigation" aria-label="Admin sections" hidden={compact && !open}>
      {[{ name: 'Reviews', keys: ['requests', 'permanent', 'referees', 'filters', 'transfers'] },
        { name: 'Directory', keys: ['tournaments', 'users'] },
        { name: 'Governance', keys: ['scopes', 'audit', 'feedback', 'user-reports', 'stalled'] }].map(group => <div className="admin-nav-group" role="group" aria-label={group.name} key={group.name}>
        <h2>{group.name}</h2>
        <div className="admin-nav-items">{tabs.filter(item => group.keys.includes(item.key)).map(item => <Link className={`tab ${tab === item.key ? 'on' : ''}`} key={item.key}
          aria-current={tab === item.key ? 'page' : undefined} to={`/admin/${item.key}`} onClick={event => {
            if (!compact || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            setOpen(false)
            requestAnimationFrame(onNavigate)
          }}>{item.label}</Link>)}</div>
      </div>)}
    </nav>
  </div>
}

export function AdminPage() {
  const clockNow = useNow()
  const s = useLtms()
  const navigate = useNavigate()
  const { tab: tabParam } = useParams()
  const me = useMe()
  const canReadQueues = USE_MOCK || canReadTournamentQueues(me.data?.adminScope)
  const queueViewerKey = JSON.stringify([me.data?.id, me.data?.adminScope])
  const [decisionViewerKey, setDecisionViewerKey] = useState('')
  const tabs = canReadQueues ? TABS : TABS.filter(t => t.key !== 'requests' && t.key !== 'filters')
  const tab = TABS.some(t => t.key === tabParam) ? tabParam! : canReadQueues ? 'requests' : 'tournaments'
  const workspace = useRef<HTMLElement>(null)

  /* สิทธิ์แอดมิน: โหมด mock อ่านจาก store · โหมดจริงถาม backend (ดู useAdminAccess)
     เดิมเช็คแต่ store ทำให้คนที่ล็อกอินกับ backend จริงโดนเด้ง 403 ทุกคน */
  const adminAccess = useAdminAccess()
  const teamRequestsQuery = useTeamRequests()
  const tournamentRequestsQuery = usePendingTournamentRequests(canReadQueues)
  const reviewTournamentReq = useReviewTournamentRequest()
  const [rejectingTournament, setRejectingTournament] = useState<{ id: number; name: string } | null>(null)
  const [approvingTournament, setApprovingTournament] = useState<{ id: number; name: string } | null>(null)
  const [approvingOfficial, setApprovingOfficial] = useState<OfficialTeamRequestDto | null>(null)
  const [tournamentReason, setTournamentReason] = useState('')
  /* คำขอที่ server บอกแล้วว่าเกินขอบเขตของเรา — เก็บไว้ต่อแถว ไม่ใช่แถบรวมที่บอกไม่ได้
     ว่าแถวไหนเพิ่งพัง */
  const [aboveScope, setAboveScope] = useState<number[]>([])
  const externalQuery = useExternalRefereeRequests()
  /* รายการทัวร์นาเมนต์ของ backend — GET /tournaments คืนเฉพาะที่เป็น public
     (ยังไม่มีเส้นที่ให้แอดมินเห็นทุกสถานะ ดู FEAT-1-REMAINING) */
  const publicTournaments = useTournaments()
  const amendments = useAmendmentRequests(canReadQueues)
  const approveAmendment = useApproveAmendment()
  const [approvingAmendment, setApprovingAmendment] = useState<BackendAmendmentRequestDto | null>(null)
  const rejectAmendment = useRejectAmendment()
  const [rejectingAmendment, setRejectingAmendment] = useState<{ id: number; name: string } | null>(null)
  const [amendmentReason, setAmendmentReason] = useState('')
  /* คิวของ backend ส่งมาแค่ sportTypeId — แปลงเป็นชื่อกีฬาให้อ่านออก */
  const sportTypes = useSportTypes()
  const sportName = (id: number) =>
    sportTypes.data?.items.find(sport => sport.id === id)?.name ?? `Sport #${id}`
  const approveTeamReq = useApproveTeamRequest()
  const rejectTeamReq = useRejectTeamRequest()
  /** คำร้องที่กำลังจะปฏิเสธ — backend บังคับเหตุผล (400 TEAM_REJECT_REASON_REQUIRED) */
  const [rejecting, setRejecting] = useState<OfficialTeamRequestDto | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [teamNotice, setTeamNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)
  const [decisionNotice, setDecisionNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)

  if (!USE_MOCK && adminAccess.isPending) {
    return <Empty icon="shield" title="Checking your admin rights…" />
  }

  const allowed = USE_MOCK ? isAdmin(s) : adminAccess.isSuccess
  if (!allowed) {
    const accessStatus = (adminAccess.error as { status?: number } | null)?.status
    if (!USE_MOCK && adminAccess.isError && ![401, 403].includes(accessStatus ?? 0)) return (
      <Empty icon="shield" title="Admin access unavailable" sub="Could not check your rights. Try again to open your queues.">
        <button className="btn" type="button" onClick={() => void adminAccess.refetch()}>Try again</button>
      </Empty>
    )
    return (
      <Empty icon="shield" title={accessStatus === 401 ? 'Sign in to continue' : '403 — admin only'}
        sub={accessStatus === 401
          ? 'Your session has expired — sign in again to reach the admin queues.'
          : 'Admin approves requests and manages the system. It is not a per-tournament right.'}>
        <button className="btn" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
      </Empty>
    )
  }

  /* คิวคำขอจัดทัวร์นาเมนต์: โหมดจริงมาจาก GET /admin/tournament-requests
     โหมด mock ยังอ่านจาก store เหมือนเดิม */
  const requestsBlocked = adminReadBlocked(tournamentRequestsQuery)
  const teamBlocked = adminReadBlocked(teamRequestsQuery)
  const amendmentsBlocked = adminReadBlocked(amendments)
  const backendRequests = !canReadQueues || requestsBlocked ? [] : tournamentRequestsQuery.data?.items ?? []
  const requests = USE_MOCK ? s.tournaments.filter(t => t.status === 'pending') : []
  const requestCount = USE_MOCK ? requests.length : backendRequests.length

  const decideTournamentRequest = (id: number, approve: boolean, reason?: string) => {
    const name = backendRequests.find(row => row.id === id)?.name ?? `Request #${id}`
    if (!canReadQueues || tournamentRequestsQuery.isError || decisionViewerKey !== queueViewerKey) return
    reviewTournamentReq.mutate(
      { requestId: id, input: { approve, rejectionReason: reason } },
      {
        onSuccess: () => {
          setDecisionNotice({ kind: approve ? 'ok' : 'warn', text: `${approve ? 'Approved' : 'Declined'} ${name}.` })
          setRejectingTournament(null)
          setApprovingTournament(null)
          setTournamentReason('')
          setAboveScope(current => current.filter(x => x !== id))
        },
        /* C02 ตอบ 403 ELIGIBILITY_OUT_OF_SCOPE เมื่อแอดมินคณะกดอนุมัติทัวร์ที่เปิดรับ
           นอกคณะตัวเอง — แต่คิวส่งแถวพวกนี้มาให้อยู่ดี (findPendingTournamentRequests
           กรองแค่ organizing_faculty_id ส่วน adminCoversEligibility ยังเช็คกฎคณะต่ออีกชั้น
           สองที่นี้ใช้กฎคนละชุดกัน) เราอ่านขอบเขตของคนที่ล็อกอินเองไม่ได้ จึงกรองล่วงหน้า
           ไม่ได้ — แต่พอ server ตอบมาแล้วก็ไม่มีเหตุให้ลืม: จำแถวนั้นไว้ ปิดปุ่ม Approve
           แล้วบอกว่าต้องให้ใครตัดสิน ดีกว่าปล่อยให้กดซ้ำแล้วได้คำตอบเดิมทุกครั้ง
           (ดู BACKEND-GAPS `FE-admin-queue-shows-undecidable-rows`) */
        onError: error => {
          if ((error as { code?: string }).code === 'INVALID_STATUS_TRANSITION') setApprovingTournament(null)
          if ((error as { code?: string }).code === 'ELIGIBILITY_OUT_OF_SCOPE') {
            setApprovingTournament(null)
            setAboveScope(current => current.includes(id) ? current : [...current, id])
          }
        },
      },
    )
  }

  /* คำร้องทีม Official มาจาก GET /admin/team-requests เท่านั้น — route มีแล้วจึงไม่ถอยไป
     ใช้ store (FEAT-1-REMAINING: fallback เฉพาะที่ backend ยังไม่มี) */
  const permanentRows = (teamBlocked ? [] : teamRequestsQuery.data?.items ?? []).filter(r => r.status === 'pending')
  const externalPending = adminReadBlocked(externalQuery) ? 0 : externalQuery.data?.items.length ?? 0
  const teamReqStatus = (teamRequestsQuery.error as { status?: number } | null)?.status
  const busyRequestId = approveTeamReq.isPending ? approveTeamReq.variables
    : rejectTeamReq.isPending ? rejectTeamReq.variables?.requestId : undefined
  const approveError = approveTeamReq.error as (Error & { code?: string }) | null

  const approveOfficial = (r: OfficialTeamRequestDto) => {
    setTeamNotice(null)
    rejectTeamReq.reset()
    approveTeamReq.mutate(r.id, {
      onSuccess: () => { setApprovingOfficial(null); setTeamNotice({ kind: 'ok', text: `${r.team.name} is now an Official squad.` }) },
    })
  }

  const openReject = (r: OfficialTeamRequestDto) => {
    rejectTeamReq.reset()
    setRejectReason('')
    setRejecting(r)
  }

  const confirmReject = () => {
    if (!rejecting || !rejectReason.trim()) return
    const target = rejecting
    setTeamNotice(null)
    approveTeamReq.reset()
    rejectTeamReq.mutate({ requestId: target.id, reason: rejectReason.trim() }, {
      onSuccess: () => {
        setTeamNotice({ kind: 'warn', text: `Rejected ${target.team.name}'s request — the reason goes back to the team leader.` })
        setRejecting(null)
        setRejectReason('')
      },
    })
  }

  const filters = s.tournaments.filter(t => t.filterChangeRequest)
  const amendmentRows = !canReadQueues || amendmentsBlocked ? [] : amendments.data?.items.filter(a => a.status === 'pending') ?? []
  const filterCount = USE_MOCK ? filters.length : amendmentRows.length

  return (
    <div className="admin-page">
      <div className="spread">
        <div>
          <h1 className="disp" style={{ fontSize: 32 }}>Admin</h1>
          <p className="sub">Review requests within your admin rights. Each queue keeps its own access rules.</p>
        </div>
        <div className="hstack">
          {requestCount ? <Badge kind="crit">{`${requestCount} to organize`}</Badge> : null}
          {permanentRows.length ? <Badge kind="warn">{`${permanentRows.length} permanent`}</Badge> : null}
          {externalPending ? <Badge kind="warn">{`${externalPending} external referee${externalPending === 1 ? '' : 's'}`}</Badge> : null}
          {filterCount ? <Badge kind="warn">{`${filterCount} change request${filterCount === 1 ? '' : 's'}`}</Badge> : null}
        </div>
      </div>

      <AdminNavigation tab={tab} tabs={tabs} onNavigate={() => workspace.current?.focus()} />
      {decisionNotice ? <div role="status"><Banner kind={decisionNotice.kind}>{decisionNotice.text}</Banner></div> : null}
      <section ref={workspace} id="admin-workspace" className="admin-workspace" tabIndex={-1} aria-label={TABS.find(item => item.key === tab)?.label}>
      {!canReadQueues && (tab === 'requests' || tab === 'filters') ? <Panel quiet>
        <h3>Tournament queue access unavailable</h3>
        {me.isPending ? <p>Checking your admin scope…</p> : me.isError ? <Banner kind="crit">Could not verify your admin scope. <button className="btn" onClick={() => void me.refetch()}>Retry admin scope</button></Banner>
          : <p>These queues require University Admin rights or Faculty Admin rights with an assigned faculty. Root cannot read or decide these requests.</p>}
      </Panel> : null}
      <Modal className="admin-decision-dialog" open={tab === 'requests' && canReadQueues && !requestsBlocked && decisionViewerKey === queueViewerKey && !!approvingTournament && backendRequests.some(row => row.id === approvingTournament.id)} title={`Approve ${approvingTournament?.name ?? ''}?`} onClose={() => !reviewTournamentReq.isPending && setApprovingTournament(null)}>
        <p>The applicant becomes Organizer and the tournament becomes Private. Publishing is a separate action.</p>
        {reviewTournamentReq.isError ? <Banner kind="crit">{tournamentDecisionError(reviewTournamentReq.error)}</Banner> : null}
        <button className="btn" disabled={reviewTournamentReq.isPending} onClick={() => setApprovingTournament(null)}>Cancel</button>{' '}<button className="btn primary" disabled={reviewTournamentReq.isPending} onClick={() => approvingTournament && decideTournamentRequest(approvingTournament.id, true)}>Confirm approval</button>
      </Modal>
      <Modal className="admin-decision-dialog" open={tab === 'permanent' && !teamBlocked && !!approvingOfficial && permanentRows.some(row => row.id === approvingOfficial.id)} title={`Approve Official status for ${approvingOfficial?.team.name ?? ''}?`} onClose={() => !approveTeamReq.isPending && setApprovingOfficial(null)}>
        <p>The team becomes Official after the server checks its members. Review the supporting documents first.</p>
        {approveTeamReq.isError ? <Banner kind="crit">{(approveTeamReq.error as Error).message}</Banner> : null}
        <button className="btn" disabled={approveTeamReq.isPending} onClick={() => setApprovingOfficial(null)}>Cancel</button>{' '}<button className="btn primary" disabled={approveTeamReq.isPending} onClick={() => approvingOfficial && approveOfficial(approvingOfficial)}>Confirm Official approval</button>
      </Modal>
      {tab === 'user-reports' ? <UserReportsTab /> : null}
      {tab === 'stalled' ? <StalledWorkTab /> : null}

      {tab === 'requests' && !USE_MOCK && canReadQueues ? (
        <Panel>
          <h2>Tournament requests <span className="sub">{tournamentRequestsQuery.data && !requestsBlocked ? backendRequests.length : '—'}</span></h2>
          <p className="sub admin-queue-explanation">Approval creates a private tournament for this Organizer. Appoint referees before publication.</p>
          {tournamentRequestsQuery.isPending ? <div className="sub">Loading requests…</div> : null}
          {tournamentRequestsQuery.isError ? (
            <Banner kind="crit">
              {(tournamentRequestsQuery.error as { status?: number }).status === 403 ? <><b>Queue access denied.</b> Your current admin scope cannot read this queue. Ask Root to check your admin assignment.</> : <><b>Couldn't load the queue.</b> {(tournamentRequestsQuery.error as Error).message}{' '}
              <button className="btn" type="button" onClick={() => void tournamentRequestsQuery.refetch()}>Try again</button></>}
            </Banner>
          ) : null}
          {reviewTournamentReq.isError && !reviewTournamentReq.isPending
            && (reviewTournamentReq.error as { code?: string }).code !== 'ELIGIBILITY_OUT_OF_SCOPE' ? (
              <Banner kind="crit">
                <b>The decision did not go through.</b> {tournamentDecisionError(reviewTournamentReq.error)}
              </Banner>
            ) : null}
          <div className="admin-review-list" role="region" aria-label="Tournament request queue" tabIndex={0}>
          {backendRequests.map(r => {
            const outOfScope = aboveScope.includes(r.id)
            return (
              <div className="vstack admin-review-item" role="article" aria-label={r.name} key={r.id}>
                <div className="spread">
                  <span className="hstack">
                    <h3>{r.name}</h3><Badge kind="neutral">{sportName(r.sportTypeId)}</Badge><Badge kind="warn">Pending</Badge>
                    {outOfScope ? <Badge kind="warn">Above your scope</Badge> : null}
                  </span>
                  <span className="tag">{displayDate(r.eventStartDate)}</span>
                </div>
                <div className="sub">Requested by {r.requestedBy.fullName} · asked on {fmtDate(r.createdAt)}</div>
                <TournamentReviewDisclosure id={r.id} />
                {outOfScope ? (
                  <Banner kind="warn" icon="clock">
                    <b>This one is not yours to approve.</b> It admits entrants from outside your faculty, or
                    from every faculty, which is above a faculty admin&apos;s scope — a university admin has to
                    approve it. Declining it is still permitted, so think twice before you do.
                  </Banner>
                ) : null}
                <div className="hstack">
                  <button className="btn danger" type="button" disabled={reviewTournamentReq.isPending}
                    onClick={() => { setDecisionViewerKey(queueViewerKey); setTournamentReason(''); setRejectingTournament({ id: r.id, name: r.name }) }}>Decline</button>
                  {/* ปุ่มที่รู้อยู่แล้วว่าจะได้ 403 เดิมกลับมา ไม่ควรยังกดได้ */}
                  <button className="btn primary" type="button" disabled={reviewTournamentReq.isPending || outOfScope}
                    title={outOfScope ? 'A university admin has to approve this one' : undefined}
                    onClick={() => { setDecisionViewerKey(queueViewerKey); setApprovingTournament({ id: r.id, name: r.name }) }}>Approve</button>
                </div>
              </div>
            )
          })}
          </div>
          {!requestsBlocked && tournamentRequestsQuery.isSuccess && !backendRequests.length ? <div className="sub">Nothing waiting.</div> : null}
        </Panel>
      ) : null}

      <Modal className="admin-decision-dialog" open={tab === 'requests' && canReadQueues && decisionViewerKey === queueViewerKey && !!rejectingTournament && backendRequests.some(row => row.id === rejectingTournament.id)} onClose={() => { if (!reviewTournamentReq.isPending) setRejectingTournament(null) }}
        label="Decline a request to organize" title={rejectingTournament?.name ?? ''}>
        <Field label="Reason — sent back to the person who asked" htmlFor="tournament-reject-reason">
          <textarea id="tournament-reject-reason" rows={3} disabled={reviewTournamentReq.isPending} value={tournamentReason}
            onChange={e => setTournamentReason(e.target.value)} />
        </Field>
        {reviewTournamentReq.isError ? <Banner kind="crit">{(reviewTournamentReq.error as Error).message}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" disabled={reviewTournamentReq.isPending} onClick={() => setRejectingTournament(null)}>Cancel</button>
          <button className="btn danger" type="button"
            disabled={!tournamentReason.trim() || reviewTournamentReq.isPending}
            onClick={() => rejectingTournament && decideTournamentRequest(rejectingTournament.id, false, tournamentReason.trim())}>
            {reviewTournamentReq.isPending ? 'Declining…' : 'Decline the request'}
          </button>
        </div>
      </Modal>

      {tab === 'requests' && USE_MOCK ? (
        <Panel>
          <h2>Tournament requests <span className="sub">{requests.length}</span></h2>
          <p className="sub admin-queue-explanation">Approval creates a private tournament for this Organizer. Appoint referees before publication.</p>
          <div className="admin-review-list" role="region" aria-label="Tournament request queue" tabIndex={0}>
          {requests.length ? requests.map(t => (
            <div className="vstack admin-review-item" role="article" aria-label={t.name} key={t.id}>
              <div className="spread">
                <span className="hstack">
                  <h3>{t.name}</h3><Badge kind="warn">Pending</Badge>
                  <Badge kind="neutral">{t.sport}</Badge>
                  <Badge kind="neutral">{formatName(t)}</Badge>
                  <Badge kind="neutral">{t.channel}</Badge>
                </span>
                <span className="tag">{fmtDate(t.date)}</span>
              </div>
              <div className="sub">
                {user(s, t.organizer)?.name} · {t.venue} · cap {t.cap} · entry {ruleSummary(t.rules) || 'open to everybody'}
              </div>
              <div className="hstack">
                <button className="btn danger" type="button" onClick={() => { decideTournament(t.id, false); setDecisionNotice({ kind: 'warn', text: `Declined ${t.name}.` }) }}>Decline</button>
                <button className="btn primary" type="button" onClick={() => { decideTournament(t.id, true); setDecisionNotice({ kind: 'ok', text: `Approved ${t.name}.` }) }}>Approve</button>
              </div>
            </div>
          )) : <div className="sub">Nothing waiting.</div>}
          </div>
        </Panel>
      ) : null}

      {tab === 'permanent' ? (
        <Panel>
          <h2>Permanent squads <span className="sub">{teamRequestsQuery.data && !teamBlocked ? permanentRows.length : '—'}</span></h2>
          <div className="sub">
            Review official status for standing clubs. University-wide Admin rights are required.
          </div>

          {teamNotice ? <div role="status"><Banner kind={teamNotice.kind}>{teamNotice.text}</Banner></div> : null}

          {approveError ? (
            <Banner kind="crit">
              <b>{approveError.code === 'ALREADY_DECIDED' ? 'Someone already decided this request.'
                : approveError.code === 'MEMBER_CONFLICT' ? 'Some members already play for another Official squad in this sport.'
                  : 'The approval did not go through.'}</b>{' '}
              {approveError.message}
            </Banner>
          ) : null}

          {teamRequestsQuery.isPending ? <div className="sub">Loading requests…</div> : null}

          {teamRequestsQuery.isError ? (
            teamReqStatus === 401 || teamReqStatus === 403 ? (
              <Banner kind="warn">
                <b>This queue is for university-wide admins.</b>{' '}
                {teamReqStatus === 401 ? 'Sign in again to continue.' : 'Your admin scope does not cover official-squad requests.'}
              </Banner>
            ) : (
              <Banner kind="crit">
                <b>Couldn't load the requests.</b> {(teamRequestsQuery.error as Error).message}{' '}
                <button className="btn" type="button" onClick={() => void teamRequestsQuery.refetch()}>Try again</button>
              </Banner>
            )
          ) : null}

          {teamRequestsQuery.isSuccess && !permanentRows.length ? <div className="sub">Nothing waiting.</div> : null}

          {permanentRows.length ? (
            <TableWrap label="Official squad requests">
              <table>
                <thead><tr><th>Squad</th><th>Asked by</th><th>When</th><th>Documents</th><th /></tr></thead>
                <tbody>
                  {permanentRows.map(r => (
                    <tr key={r.id}>
                      <td><TeamLinkView team={r.team} /></td>
                      <td className="sub">{r.requestedBy.fullName}</td>
                      <td className="tag">{fmtDate(r.createdAt)}</td>
                      <td><IdentityDocs docs={r.supportingDocs} docsSubmitted={!!r.supportingDocs?.length} fetchedAt={teamRequestsQuery.dataUpdatedAt} now={clockNow} onRefresh={() => void teamRequestsQuery.refetch()} refreshing={teamRequestsQuery.isFetching} /></td>
                      <td>
                        <span className="hstack" style={{ gap: 6 }}>
                          <button className="btn ghost" type="button" disabled={busyRequestId !== undefined}
                            onClick={() => openReject(r)}>
                            Reject
                          </button>
                          <button className="btn primary" type="button" disabled={busyRequestId !== undefined}
                            onClick={() => { approveTeamReq.reset(); setApprovingOfficial(r) }}>
                            {busyRequestId === r.id && approveTeamReq.isPending ? 'Approving…' : 'Approve'}
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : null}

          <Modal className="admin-decision-dialog" open={!!rejecting && permanentRows.some(row => row.id === rejecting.id)} onClose={() => { if (!rejectTeamReq.isPending) setRejecting(null) }} label="Reject a permanent-squad request"
            title={rejecting?.team.name ?? ''}>
            <Field label="Reason — sent back to the team leader" htmlFor="official-reject-reason">
              <textarea id="official-reject-reason" rows={3} disabled={rejectTeamReq.isPending} value={rejectReason}
                onChange={e => setRejectReason(e.target.value)} />
            </Field>
            {rejectTeamReq.isError ? <Banner kind="crit">{(rejectTeamReq.error as Error).message}</Banner> : null}
            <div className="hstack">
              <button className="btn" type="button" disabled={rejectTeamReq.isPending} onClick={() => setRejecting(null)}>Cancel</button>
              <button className="btn danger" type="button"
                disabled={!rejectReason.trim() || rejectTeamReq.isPending} onClick={confirmReject}>
                {rejectTeamReq.isPending ? 'Rejecting…' : 'Reject request'}
              </button>
            </div>
          </Modal>
        </Panel>
      ) : null}

      {tab === 'referees' ? <AdminRefereesTab /> : null}

      {tab === 'filters' && !USE_MOCK && canReadQueues ? (
        <Panel>
          <h2>Rule changes <span className="sub">{amendments.data && !amendmentsBlocked ? amendmentRows.length : '—'}</span></h2>
          <div className="sub">
            Review requested changes to dates, squad limits and entry conditions.
          </div>
          {amendments.isPending ? <div className="sub">Loading requests…</div> : null}
          {amendments.isError ? (
            <Banner kind="crit">
              {(amendments.error as { status?: number }).status === 403 ? <><b>Queue access denied.</b> Your current admin scope cannot read this queue. Ask Root to check your admin assignment.</> : <><b>Couldn't load the queue.</b> {(amendments.error as Error).message}{' '}
              <button className="btn" type="button" onClick={() => void amendments.refetch()}>Try again</button></>}
            </Banner>
          ) : null}
          {approveAmendment.isError ? (
            <Banner kind="crit"><b>The decision did not go through.</b> {(approveAmendment.error as Error).message}<ContractErrorDetails error={approveAmendment.error} /></Banner>
          ) : null}
          <div className="admin-review-list admin-change-list" role="region" aria-label="Rule change queue" tabIndex={0}>
          {amendmentRows.map(request => (
            <div className="vstack admin-review-item admin-change-item" role="article" aria-label={`Changes for ${request.tournamentName}`} key={request.id}>
              <div className="vstack admin-change-identity">
                <h3>{request.tournamentName}</h3>
                <div className="hstack"><Badge kind="warn">Pending changes</Badge><span className="tag">{fmtDate(request.requestedAt)}</span></div>
                <div className="sub">Asked by {request.requestedBy.fullName}</div>
              </div>
              {request.selfRequested ? <Badge kind="warn">You submitted this request</Badge> : null}
              <p style={{ whiteSpace: 'pre-wrap' }}>Reason: {request.reason ?? 'Not provided'}</p>
              <TournamentReviewDetails id={request.tournamentId} changes={request.requestedChanges} />

              <div className="hstack">
                <button className="btn danger" type="button" disabled={rejectAmendment.isPending}
                  onClick={() => { setDecisionViewerKey(queueViewerKey); setAmendmentReason(''); setRejectingAmendment({ id: request.id, name: request.tournamentName }) }}>
                  Decline
                </button>
                <button className="btn primary" type="button" disabled={approveAmendment.isPending}
                  onClick={() => { setDecisionViewerKey(queueViewerKey); approveAmendment.reset(); setApprovingAmendment(request) }}>
                  {approveAmendment.isPending ? 'Approving…' : 'Approve the change'}
                </button>
              </div>
            </div>
          ))}
          </div>
          {!amendmentsBlocked && amendments.isSuccess && !amendmentRows.length ? <div className="sub">Nothing waiting.</div> : null}
        </Panel>
      ) : null}

      {tab === 'filters' && canReadQueues && !amendmentsBlocked && decisionViewerKey === queueViewerKey && approvingAmendment ? <AmendmentApprovalDialog key={`${queueViewerKey}-${approvingAmendment.id}`} request={approvingAmendment} approval={approveAmendment} onApproved={() => setDecisionNotice({ kind: 'ok', text: `Approved changes for ${approvingAmendment.tournamentName}.` })} onClose={() => setApprovingAmendment(null)} /> : null}

      <Modal className="admin-decision-dialog" open={tab === 'filters' && canReadQueues && decisionViewerKey === queueViewerKey && !!rejectingAmendment && amendmentRows.some(row => row.id === rejectingAmendment.id)} onClose={() => { if (!rejectAmendment.isPending) setRejectingAmendment(null) }}
        label="Decline a change request" title={rejectingAmendment?.name ?? ''}>
        <Field label="Reason — sent back to the organizer" htmlFor="amendment-reject-reason">
          <textarea id="amendment-reject-reason" rows={3} disabled={rejectAmendment.isPending} value={amendmentReason}
            onChange={e => setAmendmentReason(e.target.value)} />
        </Field>
        {rejectAmendment.isError ? <Banner kind="crit">{(rejectAmendment.error as Error).message}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" disabled={rejectAmendment.isPending} onClick={() => setRejectingAmendment(null)}>Cancel</button>
          <button className="btn danger" type="button"
            disabled={!amendmentReason.trim() || rejectAmendment.isPending}
            onClick={() => rejectingAmendment && rejectAmendment.mutate(
              { amendmentId: rejectingAmendment.id, reason: amendmentReason.trim() },
              { onSuccess: () => { setDecisionNotice({ kind: 'warn', text: `Declined changes for ${rejectingAmendment.name}.` }); setRejectingAmendment(null); setAmendmentReason('') } },
            )}>
            {rejectAmendment.isPending ? 'Declining…' : 'Decline the request'}
          </button>
        </div>
      </Modal>

      {tab === 'filters' && USE_MOCK ? (
        <Panel>
          <h2>Rule changes <span className="sub">{filters.length}</span></h2>
          <div className="sub">
            Entry rules are enforced without overrides. Approval applies the requested rules shown below.
          </div>
          <div className="admin-review-list" role="region" aria-label="Rule change queue" tabIndex={0}>
          {filters.length ? filters.map(t => (
            <div className="vstack admin-review-item" role="article" aria-label={t.name} key={t.id}>
              <div className="spread">
                <h3>{t.name}</h3><Badge kind="warn">Pending changes</Badge>
                <span className="tag">{user(s, t.organizer)?.name}</span>
              </div>
              <div className="sub">Now: {ruleSummary(t.rules) || 'open to everybody'}</div>
              <div className="sub">Asked for: {ruleSummary(t.filterChangeRequest!.rules) || 'no conditions'}</div>
              <div className="sub">Why: {t.filterChangeRequest!.reason}</div>
              <div className="hstack">
                <button className="btn danger" type="button" onClick={() => { decideFilterChange(t.id, false); setDecisionNotice({ kind: 'warn', text: `Declined changes for ${t.name}.` }) }}>Decline</button>
                <button className="btn primary" type="button" onClick={() => { decideFilterChange(t.id, true); setDecisionNotice({ kind: 'ok', text: `Approved changes for ${t.name}.` }) }}>Approve the change</button>
              </div>
            </div>
          )) : <div className="sub">Nothing waiting.</div>}
          </div>
        </Panel>
      ) : null}

      {tab === 'tournaments' && !USE_MOCK ? (
        <Panel quiet>
          <h2>Published tournaments</h2>
          <div className="sub">
            Published tournaments only. Drafts and declined requests are not listed here.
          </div>
          {publicTournaments.isPending ? <div className="sub">Loading…</div> : null}
          {publicTournaments.isError ? (
            <Banner kind="crit">
              <b>Couldn't load the list.</b> {(publicTournaments.error as Error).message}{' '}
              <button className="btn" type="button" onClick={() => void publicTournaments.refetch()}>Try again</button>
            </Banner>
          ) : null}
          <TableWrap label="Published tournaments">
            <table>
              <thead><tr><th>Tournament</th><th>Sport</th><th>Starts</th><th>Venue</th><th>Registration</th><th>Actions</th></tr></thead>
              <tbody>
                {(publicTournaments.data?.items ?? []).map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td><span className="badge neutral">{sportName(item.sportTypeId)}</span></td>
                    <td className="sub">{fmtDate(item.eventStartDate)}</td>
                    <td className="sub">{item.venue ?? '—'}</td>
                    <td>{item.registrationOpen ? <Badge kind="ok">Open</Badge> : <Badge kind="neutral">Closed</Badge>}</td>
                    <td><button className="btn ghost" type="button" onClick={() => navigate(`/t/${item.id}`)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'tournaments' && USE_MOCK ? (
        <Panel quiet>
          <h2>Tournaments <span className="sub">{s.tournaments.length}</span></h2>
          <TableWrap label="All tournaments">
            <table>
              <thead><tr><th>Tournament</th><th>Sport</th><th>Format</th><th>Organizer</th><th>Status</th><th>Squads</th><th>Actions</th></tr></thead>
              <tbody>
                {s.tournaments.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td><span className="badge neutral">{t.sport}</span></td>
                    <td className="sub">{formatName(t)}</td>
                    <td className="sub">{user(s, t.organizer)?.name ?? '—'}</td>
                    <td>
                      {t.champion ? <Badge kind="ok">Finished</Badge>
                        : t.status === 'public' ? <Badge kind="ok">Public</Badge>
                          : t.status === 'private' ? <Badge kind="neutral">Private</Badge>
                            : <Badge kind="warn">Pending</Badge>}
                    </td>
                    <td className="num">{regsOf(s, t.id).filter(r => r.status === 'approved').length} / {t.cap}</td>
                    <td><button className="btn ghost" type="button" onClick={() => navigate(`/t/${t.id}`)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : null}

      {tab === 'users' ? <AdminUsersTab /> : null}
      {tab === 'scopes' ? <AdminScopesTab /> : null}
      {tab === 'transfers' ? <LeaderTransfersTab /> : null}
      {tab === 'audit' ? <AdminAuditTab /> : null}
      {tab === 'feedback' ? USE_MOCK ? <Panel quiet><span className="sub">Feedback moderation uses the real backend.</span></Panel> : <AdminFeedbackTab /> : null}
      </section>
    </div>
  )
}
