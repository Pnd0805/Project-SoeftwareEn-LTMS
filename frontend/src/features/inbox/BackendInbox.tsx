/**
 * src/features/inbox/BackendInbox.tsx
 *
 * กล่องข้อความในโหมดที่ต่อ backend จริง
 *
 * คำขอที่ต้องตอบอ่านจาก endpoint ของแต่ละงาน ส่วนประวัติแจ้งเตือนอ่านจาก C1:
 *
 *   GET /me/invitations         คำเชิญเข้าทีม            → ตอบรับ/ปฏิเสธได้ที่นี่
 *   GET /me/referee-invitations คำเชิญเป็นกรรมการ        → ตอบรับ/ปฏิเสธได้ที่นี่
 *   GET /me/referee-requests    คำขอเปลี่ยน/เพิ่มแมตช์    → ตอบรับ/ปฏิเสธได้ที่นี่
 *   GET /me/applications        ผลการพิจารณาใบสมัครทีม   → อ่านอย่างเดียว
 *
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Empty, Panel } from '../../components/kit/primitives'
import { fmtDate } from '../../shared/rules'
import { useAnswerBackendInvitation, useBackendMyInvitations } from '../../hooks/useTeam'
import {
  useAcceptRefereeInvitation, useAcceptRefereeRequest, useDeclineRefereeInvitation,
  useDeclineRefereeRequest, useMyRefereeInvitations, useMyRefereeRequests, useCancelRefereeRequest,
} from '../../hooks/useAdmin'
import { useMyTournamentApplications } from '../../hooks/useTournament'
import { ApiError } from '../../api/client'
import '../search/search-inbox-workspace.css'

type Notice = { kind: 'ok' | 'warn' | 'crit'; text: string } | null
const denied = (error: unknown) => typeof error === 'object' && error !== null && 'status' in error && (error.status === 401 || error.status === 403)

/** ตอบคำขอแล้วเด้ง — บอกให้ตรงว่าเพราะอะไร ไม่ใช่ปล่อยเงียบ (R18) */
const answerError = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : null
  if (code === 'REQUEST_CLOSED') return 'That request has already been answered or withdrawn.'
  if (code === 'REFEREE_TIME_CONFLICT') return 'You already have a match that overlaps this one.'
  if (code === 'MATCH_NOT_CHANGEABLE') return 'That match has started, so its referees are fixed now.'
  if (code === 'REFEREE_NOT_ACTIVE') return 'You are not active in that tournament yet.'
  return error instanceof Error ? error.message : 'That did not go through. Try again.'
}

export function BackendInbox() {
  const navigate = useNavigate()
  const [notice, setNotice] = useState<Notice>(null)

  const teamInvites = useBackendMyInvitations()
  const answerInvite = useAnswerBackendInvitation()
  const refereeInvites = useMyRefereeInvitations()
  const acceptReferee = useAcceptRefereeInvitation()
  const declineReferee = useDeclineRefereeInvitation()
  const refereeRequests = useMyRefereeRequests()
  const acceptRequest = useAcceptRefereeRequest()
  const declineRequest = useDeclineRefereeRequest()
  const cancelRequest = useCancelRefereeRequest()
  const applications = useMyTournamentApplications()

  const invites = denied(teamInvites.error) ? [] : teamInvites.data?.items ?? []
  const appointments = denied(refereeInvites.error) ? [] : refereeInvites.data?.items ?? []
  const incoming = denied(refereeRequests.error) ? [] : refereeRequests.data?.incoming ?? []
  const outgoing = denied(refereeRequests.error) ? [] : refereeRequests.data?.outgoing ?? []
  const entries = denied(applications.error) ? [] : applications.data?.items ?? []
  const decided = entries.filter(a => a.status !== 'pending')
  const waiting = entries.filter(a => a.status === 'pending')
  const nothing = !invites.length && !appointments.length && !incoming.length
    && !decided.length && !waiting.length && !outgoing.length

  const sources = [
    { label: 'team invitations', query: teamInvites },
    { label: 'referee invitations', query: refereeInvites },
    { label: 'referee requests', query: refereeRequests },
    { label: 'entry decisions', query: applications },
  ]
  const settled = sources.every(({ query }) => !!query.data && !query.isPending && !query.isError)
  const pending = answerInvite.isPending || acceptReferee.isPending || declineReferee.isPending
    || acceptRequest.isPending || declineRequest.isPending || cancelRequest.isPending

  return (
    <section className="inbox-requests" aria-label="Action requests">
      <div className="spread">
        <h2 className="disp">Action requests</h2>
      </div>

      {notice ? <div role={notice.kind === 'crit' ? 'alert' : 'status'}><Banner kind={notice.kind}>{notice.text}</Banner></div> : null}
      {pending ? <p className="sub" role="status">Saving your answer…</p> : null}
      {sources.map(({ label, query }) => query.isPending ? <Panel quiet key={label}><span className="sub" role="status">Loading {label}…</span></Panel>
        : query.isError ? <Panel quiet key={label}><div role="alert"><b>Unable to load {label}</b><p className="sub">{answerError(query.error)}</p></div>
          <button className="btn ghost" type="button" onClick={() => void query.refetch()}>Retry {label}</button></Panel> : null)}

      {invites.length ? (
        <Panel>
          <h3>Team invitations <span className="tag">{invites.length}</span></h3>
          {invites.map(invite => (
            <div className="inbox-request-row" key={invite.id}>
              <div className="hstack">
                <b>{invite.team.name}</b>
                <span className="sub">
                  invited by {invite.invitedBy.fullName} · expires {fmtDate(invite.expiresAt)}
                </span>
              </div>
              <div className="hstack">
                <button className="btn" type="button" aria-label={`Decline team invitation: ${invite.team.name}`} disabled={answerInvite.isPending}
                  onClick={() => answerInvite.mutate({ invitationId: invite.id, accept: false }, {
                    onSuccess: () => setNotice({ kind: 'warn', text: `Declined the invitation from ${invite.team.name}.` }),
                    onError: error => setNotice({ kind: 'crit', text: answerError(error) }),
                  })}>Decline</button>
                <button className="btn primary" type="button" aria-label={`Accept team invitation: ${invite.team.name}`} disabled={answerInvite.isPending}
                  onClick={() => answerInvite.mutate({ invitationId: invite.id, accept: true }, {
                    onSuccess: () => setNotice({ kind: 'ok', text: `You joined ${invite.team.name}.` }),
                    onError: error => setNotice({ kind: 'crit', text: answerError(error) }),
                  })}>Accept</button>
              </div>
            </div>
          ))}
        </Panel>
      ) : null}

      {appointments.length ? (
        <Panel>
          <h3>Referee appointments <span className="tag">{appointments.length}</span></h3>
          {appointments.map(invite => (
            <div className="inbox-request-row" key={invite.id}>
              <div className="hstack">
                <b>{invite.tournament.name}</b>
                {invite.isExternal ? <Badge kind="warn">External — needs admin approval</Badge> : null}
                <span className="sub">invited {fmtDate(invite.createdAt)}</span>
              </div>
              <div className="hstack">
                <button className="btn" type="button" aria-label={`Decline referee invitation: ${invite.tournament.name}`} disabled={declineReferee.isPending || acceptReferee.isPending}
                  onClick={() => declineReferee.mutate(invite.id, {
                    onSuccess: () => setNotice({ kind: 'warn', text: `Declined ${invite.tournament.name}.` }),
                    onError: error => setNotice({ kind: 'crit', text: answerError(error) }),
                  })}>Decline</button>
                <button className="btn primary" type="button" aria-label={`Accept referee invitation: ${invite.tournament.name}`} disabled={acceptReferee.isPending || declineReferee.isPending}
                  onClick={() => acceptReferee.mutate(invite.id, {
                    onSuccess: answered => setNotice({ kind: answered.requiresAdminApproval ? 'warn' : 'ok', text: answered.requiresAdminApproval
                      ? `Accepted ${invite.tournament.name}. Admin approval is still required.`
                      : `You are now eligible to officiate ${invite.tournament.name}.` }),
                    onError: error => setNotice({ kind: 'crit', text: answerError(error) }),
                  })}>Accept</button>
              </div>
            </div>
          ))}
        </Panel>
      ) : null}

      {incoming.length ? (
        <Panel>
          <h3>Match assignments <span className="tag">{incoming.length} waiting on you</span></h3>
          {incoming.map(request => (
            <div className="inbox-request-row" key={request.id}>
              <div className="hstack">
                <b>Match #{request.matchA.id}</b>
                <span className="sub">
                  {request.type === 'org_add_match' ? 'The organizer asks you to take this match'
                    : request.type === 'org_swap' ? 'The organizer proposes a swap'
                    : request.type === 'ref_swap' ? 'Another referee proposes a swap'
                      : 'Another referee proposes a transfer'}
                  {request.matchB ? ` with match #${request.matchB.id}` : ''}
                  {request.matchA.scheduledTime ? ` · ${fmtDate(request.matchA.scheduledTime)}` : ''}
                </span>
              </div>
              <div className="hstack">
                <button className="btn ghost" type="button"
                  aria-label={`Open match #${request.matchA.id}`} onClick={() => navigate(`/m/${request.matchA.id}`)}>Open match</button>
                {request.matchB ? <button className="btn ghost" type="button"
                  aria-label={`Open second match #${request.matchB.id}`} onClick={() => navigate(`/m/${request.matchB!.id}`)}>Open second match</button> : null}
                <button className="btn" type="button" aria-label={`Decline request #${request.id} for match #${request.matchA.id}`} disabled={declineRequest.isPending || acceptRequest.isPending}
                  onClick={() => declineRequest.mutate(request.id, {
                    onSuccess: () => setNotice({ kind: 'warn', text: `Declined match #${request.matchA.id}.` }),
                    onError: error => setNotice({ kind: 'crit', text: answerError(error) }),
                  })}>Decline</button>
                {/* R18 — เดิมขึ้น "You are officiating" ทุกครั้งที่คำขอตอบกลับมา 200 แต่ FR06
                    คืนใบคำขอพร้อม `status` ซึ่งเป็น `cancelled` ได้ เมื่อมีใบอื่นบนแมตช์
                    เดียวกันถูก apply ไปก่อน (`refereeChangeRequest.repo.apply` ปิดใบที่
                    แตะแมตช์เดียวกันทั้งหมด) กรรมการจึงอ่านว่าได้คุมแล้วทั้งที่ไม่ได้คุม
                    — เชื่อสถานะที่ตอบกลับมา ไม่ใช่เชื่อว่าไม่ throw = สำเร็จ */}
                <button className="btn primary" type="button" aria-label={`Accept request #${request.id} for match #${request.matchA.id}`} disabled={acceptRequest.isPending || declineRequest.isPending}
                  onClick={() => acceptRequest.mutate(request.id, {
                    onSuccess: answered => setNotice(answered.status === 'applied'
                      ? { kind: 'ok', text: `Request #${answered.id} applied. Open the matches to see the updated assignments.` }
                      : { kind: 'warn', text: answered.status === 'open'
                        ? 'Your acceptance was recorded. The other referee still needs to answer.'
                        : `Request #${answered.id} is ${answered.status}. Assignments were not changed by this answer.` }),
                    onError: error => setNotice({ kind: 'crit', text: answerError(error) }),
                  })}>Accept</button>
              </div>
            </div>
          ))}
        </Panel>
      ) : null}

      {outgoing.length ? <Panel quiet>
        <h3>Your referee requests</h3>
        {outgoing.map(request => <div className="inbox-request-row" key={request.id}>
          <div>Request #{request.id} · {request.type === 'org_add_match' ? 'Match assignment'
            : request.type === 'ref_transfer' ? 'Match transfer' : 'Match swap'} · Match #{request.matchA.id}
            {request.matchB ? ` / #${request.matchB.id}` : ''} | <Badge kind={request.status === 'applied' ? 'ok' : request.status === 'open' ? 'warn' : 'neutral'}>{request.status}</Badge></div>
          <span className="sub">{request.refereeA.user.fullName}: {request.refereeA.status}
            {request.refereeB ? ` | ${request.refereeB.user.fullName}: ${request.refereeB.status}` : ''}</span>
          <div className="hstack">
            <button className="btn ghost" type="button" aria-label={`Open match #${request.matchA.id} for request #${request.id}`} onClick={() => navigate(`/m/${request.matchA.id}`)}>Open match</button>
            {request.status === 'open' ? <button className="btn" type="button" aria-label={`Withdraw request #${request.id}`} disabled={cancelRequest.isPending}
              onClick={() => cancelRequest.mutate(request.id, {
                onSuccess: () => setNotice({ kind: 'ok', text: `Request #${request.id} withdrawn.` }),
                onError: error => setNotice({ kind: 'crit', text: answerError(error) }),
              })}>Withdraw request</button> : null}
          </div>
        </div>)}
      </Panel> : null}

      {waiting.length || decided.length ? (
        <Panel quiet>
          <h3>Your team entries <span className="tag">{waiting.length + decided.length}</span></h3>
          {[...waiting, ...decided].map(application => (
            <div className="inbox-request-row spread" key={application.id}>
              <span className="sub">
                <b>{application.team.name}</b> → {application.tournament.name}
                {application.rejectionReason ? ` · ${application.rejectionReason}` : ''}
              </span>
              {application.status === 'approved' ? <Badge kind="ok">In</Badge>
                : application.status === 'rejected' ? <Badge kind="crit">Rejected</Badge>
                  : application.status === 'pending' ? <Badge kind="warn">Waiting on the organizer</Badge>
                    : <Badge kind="neutral">{application.status}</Badge>}
            </div>
          ))}
        </Panel>
      ) : null}

      {settled && nothing ? (
        <Empty icon="bell" title="Nothing waiting on you"
          sub="Invitations, referee appointments and entry decisions land here." />
      ) : null}
    </section>
  )
}
