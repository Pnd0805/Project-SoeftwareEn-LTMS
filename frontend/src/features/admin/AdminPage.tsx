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
import { useState } from 'react'
import { Badge, Banner, Empty, Field, Panel, TableWrap, Tabs } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useNavigate, useParams } from 'react-router-dom'
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
import { AdminUsersTab } from './AdminUsersTab'
import { AdminFeedbackTab } from './AdminFeedbackTab'

const TABS = [
  { key: 'requests', label: 'Requests to organize' },
  { key: 'permanent', label: 'Permanent squads' },
  { key: 'referees', label: 'External referees' },
  { key: 'filters', label: 'Hard-filter changes' },
  { key: 'tournaments', label: 'All tournaments' },
  { key: 'users', label: 'Users' },
  { key: 'feedback', label: 'Feedback' },
]

export function AdminPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { tab: tabParam } = useParams()
  const tab = TABS.some(t => t.key === tabParam) ? tabParam! : 'requests'

  /* สิทธิ์แอดมิน: โหมด mock อ่านจาก store · โหมดจริงถาม backend (ดู useAdminAccess)
     เดิมเช็คแต่ store ทำให้คนที่ล็อกอินกับ backend จริงโดนเด้ง 403 ทุกคน */
  const adminAccess = useAdminAccess()
  const teamRequestsQuery = useTeamRequests()
  const tournamentRequestsQuery = usePendingTournamentRequests()
  const reviewTournamentReq = useReviewTournamentRequest()
  const [rejectingTournament, setRejectingTournament] = useState<{ id: number; name: string } | null>(null)
  const [tournamentReason, setTournamentReason] = useState('')
  const externalQuery = useExternalRefereeRequests()
  /* รายการทัวร์นาเมนต์ของ backend — GET /tournaments คืนเฉพาะที่เป็น public
     (ยังไม่มีเส้นที่ให้แอดมินเห็นทุกสถานะ ดู FEAT-1-REMAINING) */
  const publicTournaments = useTournaments()
  const amendments = useAmendmentRequests()
  const approveAmendment = useApproveAmendment()
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

  if (!USE_MOCK && adminAccess.isPending) {
    return <Empty icon="shield" title="Checking your admin rights…" />
  }

  const allowed = USE_MOCK ? isAdmin(s) : adminAccess.isSuccess
  if (!allowed) {
    const accessStatus = (adminAccess.error as { status?: number } | null)?.status
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
  const backendRequests = tournamentRequestsQuery.data?.items ?? []
  const requests = USE_MOCK ? s.tournaments.filter(t => t.status === 'pending') : []
  const requestCount = USE_MOCK ? requests.length : backendRequests.length

  const decideTournamentRequest = (id: number, approve: boolean, reason?: string) => {
    reviewTournamentReq.mutate(
      { requestId: id, input: { approve, rejectionReason: reason } },
      {
        onSuccess: () => {
          setRejectingTournament(null)
          setTournamentReason('')
        },
      },
    )
  }

  /* คำร้องทีม Official มาจาก GET /admin/team-requests เท่านั้น — route มีแล้วจึงไม่ถอยไป
     ใช้ store (FEAT-1-REMAINING: fallback เฉพาะที่ backend ยังไม่มี) */
  const permanentRows = (teamRequestsQuery.data?.items ?? []).filter(r => r.status === 'pending')
  const externalPending = externalQuery.data?.items.length ?? 0
  const teamReqStatus = (teamRequestsQuery.error as { status?: number } | null)?.status
  const busyRequestId = approveTeamReq.isPending ? approveTeamReq.variables
    : rejectTeamReq.isPending ? rejectTeamReq.variables?.requestId : undefined
  const approveError = approveTeamReq.error as (Error & { code?: string }) | null

  const approveOfficial = (r: OfficialTeamRequestDto) => {
    setTeamNotice(null)
    rejectTeamReq.reset()
    approveTeamReq.mutate(r.id, {
      onSuccess: () => setTeamNotice({ kind: 'ok', text: `${r.team.name} is now an Official squad.` }),
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
  const amendmentRows = amendments.data?.items.filter(a => a.status === 'pending') ?? []
  const filterCount = USE_MOCK ? filters.length : amendmentRows.length

  return (
    <>
      <div className="spread">
        <div>
          <div className="tag"><em>//</em> System administration</div>
          <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>Admin</h1>
        </div>
        <div className="hstack">
          {requestCount ? <Badge kind="crit">{`${requestCount} to organize`}</Badge> : null}
          {permanentRows.length ? <Badge kind="warn">{`${permanentRows.length} permanent`}</Badge> : null}
          {externalPending ? <Badge kind="warn">{`${externalPending} external referee${externalPending === 1 ? '' : 's'}`}</Badge> : null}
          {filterCount ? <Badge kind="warn">{`${filterCount} change request${filterCount === 1 ? '' : 's'}`}</Badge> : null}
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onPick={k => navigate(`/admin/${k}`)} />

      {tab === 'requests' && !USE_MOCK ? (
        <Panel>
          <span className="tag"><em>//</em> Requests to organize · {backendRequests.length}</span>
          {tournamentRequestsQuery.isPending ? <div className="sub">Loading requests…</div> : null}
          {tournamentRequestsQuery.isError ? (
            <Banner kind="crit">
              <b>Couldn't load the queue.</b> {(tournamentRequestsQuery.error as Error).message}{' '}
              <button className="btn" type="button" onClick={() => void tournamentRequestsQuery.refetch()}>Try again</button>
            </Banner>
          ) : null}
          {reviewTournamentReq.isError ? (
            <Banner kind="crit"><b>The decision did not go through.</b> {(reviewTournamentReq.error as Error).message}</Banner>
          ) : null}
          {backendRequests.map(r => (
            <div className="vstack" style={{ gap: 9 }} key={r.id}>
              <div className="spread">
                <span className="hstack"><b>{r.name}</b><Badge kind="neutral">{sportName(r.sportTypeId)}</Badge></span>
                <span className="tag">{fmtDate(r.eventStartDate)}</span>
              </div>
              <div className="sub">Requested by {r.requestedBy.fullName} · asked on {fmtDate(r.createdAt)}</div>
              <div className="sub">
                Approving grants Organizer over this tournament only, and it lands in their drafts as Private —
                they still have to appoint referees before it can go public.
              </div>
              <div className="hstack">
                <button className="btn danger" type="button" disabled={reviewTournamentReq.isPending}
                  onClick={() => { setTournamentReason(''); setRejectingTournament({ id: r.id, name: r.name }) }}>Decline</button>
                <button className="btn primary" type="button" disabled={reviewTournamentReq.isPending}
                  onClick={() => decideTournamentRequest(r.id, true)}>Approve</button>
              </div>
            </div>
          ))}
          {tournamentRequestsQuery.isSuccess && !backendRequests.length ? <div className="sub">Nothing waiting.</div> : null}
        </Panel>
      ) : null}

      <Modal open={!!rejectingTournament} onClose={() => setRejectingTournament(null)}
        label="Decline a request to organize" title={rejectingTournament?.name ?? ''}>
        <Field label="Reason — sent back to the person who asked" htmlFor="tournament-reject-reason">
          <textarea id="tournament-reject-reason" rows={3} value={tournamentReason}
            onChange={e => setTournamentReason(e.target.value)} />
        </Field>
        {reviewTournamentReq.isError ? <Banner kind="crit">{(reviewTournamentReq.error as Error).message}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setRejectingTournament(null)}>Cancel</button>
          <button className="btn danger" type="button"
            disabled={!tournamentReason.trim() || reviewTournamentReq.isPending}
            onClick={() => rejectingTournament && decideTournamentRequest(rejectingTournament.id, false, tournamentReason.trim())}>
            {reviewTournamentReq.isPending ? 'Declining…' : 'Decline the request'}
          </button>
        </div>
      </Modal>

      {tab === 'requests' && USE_MOCK ? (
        <Panel>
          <span className="tag"><em>//</em> Requests to organize · {requests.length}</span>
          {requests.length ? requests.map(t => (
            <div className="vstack" style={{ gap: 9 }} key={t.id}>
              <div className="spread">
                <span className="hstack">
                  <b>{t.name}</b>
                  <Badge kind="neutral">{t.sport}</Badge>
                  <Badge kind="neutral">{formatName(t)}</Badge>
                  <Badge kind="neutral">{t.channel}</Badge>
                </span>
                <span className="tag">{fmtDate(t.date)}</span>
              </div>
              <div className="sub">
                {user(s, t.organizer)?.name} · {t.venue} · cap {t.cap} · entry {ruleSummary(t.rules) || 'open to everybody'}
              </div>
              <div className="sub">
                Approving grants Organizer over this tournament only, and it lands in their drafts as Private —
                they still have to appoint referees before it can go public.
              </div>
              <div className="hstack">
                <button className="btn danger" type="button" onClick={() => decideTournament(t.id, false)}>Decline</button>
                <button className="btn primary" type="button" onClick={() => decideTournament(t.id, true)}>Approve</button>
              </div>
            </div>
          )) : <div className="sub">Nothing waiting.</div>}
        </Panel>
      ) : null}

      {tab === 'permanent' ? (
        <Panel>
          <span className="tag"><em>//</em> Permanent-squad requests · {permanentRows.length}</span>
          <div className="sub">
            For standing clubs, not for squads avoiding the deadline — exemption stays a judgement rather
            than a checkbox a squad ticks.
          </div>

          {teamNotice ? <Banner kind={teamNotice.kind}>{teamNotice.text}</Banner> : null}

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
            <TableWrap>
              <table>
                <thead><tr><th>Squad</th><th>Asked by</th><th>When</th><th /></tr></thead>
                <tbody>
                  {permanentRows.map(r => (
                    <tr key={r.id}>
                      <td><TeamLinkView team={{ id: r.team.id, name: r.team.name }} /></td>
                      <td className="sub">{r.requestedBy.fullName}</td>
                      <td className="tag">{fmtDate(r.createdAt)}</td>
                      <td>
                        <span className="hstack" style={{ gap: 6 }}>
                          <button className="btn ghost" type="button" disabled={busyRequestId !== undefined}
                            onClick={() => openReject(r)}>
                            Reject
                          </button>
                          <button className="btn primary" type="button" disabled={busyRequestId !== undefined}
                            onClick={() => approveOfficial(r)}>
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

          <Modal open={!!rejecting} onClose={() => setRejecting(null)} label="Reject a permanent-squad request"
            title={rejecting?.team.name ?? ''}>
            <Field label="Reason — sent back to the team leader" htmlFor="official-reject-reason">
              <textarea id="official-reject-reason" rows={3} value={rejectReason}
                onChange={e => setRejectReason(e.target.value)} />
            </Field>
            {rejectTeamReq.isError ? <Banner kind="crit">{(rejectTeamReq.error as Error).message}</Banner> : null}
            <div className="hstack">
              <button className="btn" type="button" onClick={() => setRejecting(null)}>Cancel</button>
              <button className="btn danger" type="button"
                disabled={!rejectReason.trim() || rejectTeamReq.isPending} onClick={confirmReject}>
                {rejectTeamReq.isPending ? 'Rejecting…' : 'Reject request'}
              </button>
            </div>
          </Modal>
        </Panel>
      ) : null}

      {tab === 'referees' ? <AdminRefereesTab /> : null}

      {tab === 'filters' && !USE_MOCK ? (
        <Panel>
          <span className="tag"><em>//</em> Change requests · {amendmentRows.length}</span>
          <div className="sub">
            Dates, squad limits and the entry conditions are set once and enforced with no override.
            Changing them after people have seen the rules is a decision, not an edit — so it lands here.
          </div>
          {amendments.isPending ? <div className="sub">Loading requests…</div> : null}
          {amendments.isError ? (
            <Banner kind="crit">
              <b>Couldn't load the queue.</b> {(amendments.error as Error).message}{' '}
              <button className="btn" type="button" onClick={() => void amendments.refetch()}>Try again</button>
            </Banner>
          ) : null}
          {approveAmendment.isError ? (
            <Banner kind="crit"><b>The decision did not go through.</b> {(approveAmendment.error as Error).message}</Banner>
          ) : null}
          {amendmentRows.map(request => (
            <div className="vstack" style={{ gap: 9 }} key={request.id}>
              <div className="spread">
                <b>{request.tournamentName}</b>
                <span className="tag">{fmtDate(request.requestedAt)}</span>
              </div>
              <div className="sub">Asked by {request.requestedBy.fullName}</div>
              <TableWrap>
                <table>
                  <thead><tr><th>Field</th><th>Asked for</th></tr></thead>
                  <tbody>
                    {Object.entries(request.requestedChanges).map(([field, value]) => (
                      <tr key={field}>
                        <td className="sub">{field}</td>
                        <td>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <div className="hstack">
                <button className="btn danger" type="button" disabled={rejectAmendment.isPending}
                  onClick={() => { setAmendmentReason(''); setRejectingAmendment({ id: request.id, name: request.tournamentName }) }}>
                  Decline
                </button>
                <button className="btn primary" type="button" disabled={approveAmendment.isPending}
                  onClick={() => approveAmendment.mutate(request.id)}>
                  {approveAmendment.isPending ? 'Approving…' : 'Approve the change'}
                </button>
              </div>
            </div>
          ))}
          {amendments.isSuccess && !amendmentRows.length ? <div className="sub">Nothing waiting.</div> : null}
        </Panel>
      ) : null}

      <Modal open={!!rejectingAmendment} onClose={() => setRejectingAmendment(null)}
        label="Decline a change request" title={rejectingAmendment?.name ?? ''}>
        <Field label="Reason — sent back to the organizer" htmlFor="amendment-reject-reason">
          <textarea id="amendment-reject-reason" rows={3} value={amendmentReason}
            onChange={e => setAmendmentReason(e.target.value)} />
        </Field>
        {rejectAmendment.isError ? <Banner kind="crit">{(rejectAmendment.error as Error).message}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setRejectingAmendment(null)}>Cancel</button>
          <button className="btn danger" type="button"
            disabled={!amendmentReason.trim() || rejectAmendment.isPending}
            onClick={() => rejectingAmendment && rejectAmendment.mutate(
              { amendmentId: rejectingAmendment.id, reason: amendmentReason.trim() },
              { onSuccess: () => { setRejectingAmendment(null); setAmendmentReason('') } },
            )}>
            {rejectAmendment.isPending ? 'Declining…' : 'Decline the request'}
          </button>
        </div>
      </Modal>

      {tab === 'filters' && USE_MOCK ? (
        <Panel>
          <span className="tag"><em>//</em> Hard-filter change requests · {filters.length}</span>
          <div className="sub">
            The conditions are set once and enforced with no override. This queue exists because the
            alternative is an organizer quietly widening the rules once they see who registered.
          </div>
          {filters.length ? filters.map(t => (
            <div className="vstack" style={{ gap: 9 }} key={t.id}>
              <div className="spread">
                <b>{t.name}</b>
                <span className="tag">{user(s, t.organizer)?.name}</span>
              </div>
              <div className="sub">Now: {ruleSummary(t.rules) || 'open to everybody'}</div>
              <div className="sub">Asked for: {ruleSummary(t.filterChangeRequest!.rules) || 'no conditions'}</div>
              <div className="sub">Why: {t.filterChangeRequest!.reason}</div>
              <div className="hstack">
                <button className="btn danger" type="button" onClick={() => decideFilterChange(t.id, false)}>Decline</button>
                <button className="btn primary" type="button" onClick={() => decideFilterChange(t.id, true)}>Approve the change</button>
              </div>
            </div>
          )) : <div className="sub">Nothing waiting.</div>}
        </Panel>
      ) : null}

      {tab === 'tournaments' && !USE_MOCK ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Published tournaments · {publicTournaments.data?.items.length ?? 0}</span>
          <div className="sub">
            Backend only lists published tournaments — drafts and rejected requests are not exposed yet.
          </div>
          {publicTournaments.isPending ? <div className="sub">Loading…</div> : null}
          {publicTournaments.isError ? (
            <Banner kind="crit">
              <b>Couldn't load the list.</b> {(publicTournaments.error as Error).message}{' '}
              <button className="btn" type="button" onClick={() => void publicTournaments.refetch()}>Try again</button>
            </Banner>
          ) : null}
          <TableWrap>
            <table>
              <thead><tr><th>Tournament</th><th>Sport</th><th>Starts</th><th>Venue</th><th>Registration</th><th /></tr></thead>
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
          <span className="tag"><em>//</em> Every tournament · {s.tournaments.length}</span>
          <TableWrap>
            <table>
              <thead><tr><th>Tournament</th><th>Sport</th><th>Format</th><th>Organizer</th><th>Status</th><th>Squads</th><th /></tr></thead>
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
      {tab === 'feedback' ? USE_MOCK ? <Panel quiet><span className="sub">Feedback moderation uses the real backend.</span></Panel> : <AdminFeedbackTab /> : null}
    </>
  )
}
