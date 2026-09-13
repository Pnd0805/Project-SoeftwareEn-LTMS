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
  useApproveTeamRequest, useExternalRefereeRequests, useRejectTeamRequest, useTeamRequests,
} from '../../hooks/useAdmin'
import type { OfficialTeamRequestDto } from '../../types/admin.dto'
import { AdminRefereesTab } from './AdminRefereesTab'
import { AdminUsersTab } from './AdminUsersTab'

const TABS = [
  { key: 'requests', label: 'Requests to organize' },
  { key: 'permanent', label: 'Permanent squads' },
  { key: 'referees', label: 'External referees' },
  { key: 'filters', label: 'Hard-filter changes' },
  { key: 'tournaments', label: 'All tournaments' },
  { key: 'users', label: 'Users' },
]

export function AdminPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const { tab: tabParam } = useParams()
  const tab = TABS.some(t => t.key === tabParam) ? tabParam! : 'requests'

  const teamRequestsQuery = useTeamRequests()
  const externalQuery = useExternalRefereeRequests()
  const approveTeamReq = useApproveTeamRequest()
  const rejectTeamReq = useRejectTeamRequest()
  /** คำร้องที่กำลังจะปฏิเสธ — backend บังคับเหตุผล (400 TEAM_REJECT_REASON_REQUIRED) */
  const [rejecting, setRejecting] = useState<OfficialTeamRequestDto | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [teamNotice, setTeamNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)

  if (!isAdmin(s)) {
    return (
      <Empty icon="shield" title="403 — admin only"
        sub="Admin approves requests and manages the system. It is not a per-tournament right.">
        <button className="btn" type="button" onClick={() => navigate('/')}>Back to tournaments</button>
      </Empty>
    )
  }

  const requests = s.tournaments.filter(t => t.status === 'pending')

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

  return (
    <>
      <div className="spread">
        <div>
          <div className="tag"><em>//</em> System administration</div>
          <h1 className="disp" style={{ fontSize: 32, marginTop: 6 }}>Admin</h1>
        </div>
        <div className="hstack">
          {requests.length ? <Badge kind="crit">{`${requests.length} to organize`}</Badge> : null}
          {permanentRows.length ? <Badge kind="warn">{`${permanentRows.length} permanent`}</Badge> : null}
          {externalPending ? <Badge kind="warn">{`${externalPending} external referee${externalPending === 1 ? '' : 's'}`}</Badge> : null}
          {filters.length ? <Badge kind="warn">{`${filters.length} filter change${filters.length === 1 ? '' : 's'}`}</Badge> : null}
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onPick={k => navigate(`/admin/${k}`)} />

      {tab === 'requests' ? (
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

      {tab === 'filters' ? (
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

      {tab === 'tournaments' ? (
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
    </>
  )
}
