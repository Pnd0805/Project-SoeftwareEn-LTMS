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
import { TeamChipView } from '../../components/kit/chips'
import { RefereeConflictLink } from '../match/RefereeConflictLink'

type Notice = { kind: 'ok' | 'warn' | 'crit'; text: string; error?: unknown } | null

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

  const invites = teamInvites.data?.items ?? []
  const appointments = refereeInvites.data?.items ?? []
  const incoming = refereeRequests.data?.incoming ?? []
  const outgoing = refereeRequests.data?.outgoing ?? []
  const decided = (applications.data?.items ?? []).filter(a => a.status !== 'pending')
  const waiting = (applications.data?.items ?? []).filter(a => a.status === 'pending')
  const nothing = !invites.length && !appointments.length && !incoming.length
    && !decided.length && !waiting.length && !outgoing.length

  const loading = teamInvites.isPending || refereeInvites.isPending || refereeRequests.isPending

  return (
    <>
      <div className="spread">
        <h2 className="disp" style={{ fontSize: 24 }}>Action requests</h2>
      </div>

      {notice ? <Banner kind={notice.kind}>{notice.text}<RefereeConflictLink error={notice.error} /></Banner> : null}

      {loading ? <Panel quiet><span className="sub">Loading…</span></Panel> : null}

      {invites.length ? (
        <Panel>
          <span className="tag"><em>//</em> Team invitations · {invites.length}</span>
          {invites.map(invite => (
            <div className="vstack" style={{ gap: 8 }} key={invite.id}>
              <div className="hstack">
                <TeamChipView team={invite.team} />
                <span className="sub">
                  invited by {invite.invitedBy.fullName} · expires {fmtDate(invite.expiresAt)}
                </span>
              </div>
              <div className="hstack">
                <button className="btn" type="button" disabled={answerInvite.isPending}
                  onClick={() => answerInvite.mutate({ invitationId: invite.id, accept: false }, {
                    onSuccess: () => setNotice({ kind: 'warn', text: `Declined the invitation from ${invite.team.name}.` }),
                  })}>Decline</button>
                <button className="btn primary" type="button" disabled={answerInvite.isPending}
                  onClick={() => answerInvite.mutate({ invitationId: invite.id, accept: true }, {
                    onSuccess: () => setNotice({ kind: 'ok', text: `You joined ${invite.team.name}.` }),
                  })}>Accept</button>
              </div>
            </div>
          ))}
        </Panel>
      ) : null}

      {appointments.length ? (
        <Panel>
          <span className="tag"><em>//</em> Referee appointments · {appointments.length}</span>
          {appointments.map(invite => (
            <div className="vstack" style={{ gap: 8 }} key={invite.id}>
              <div className="hstack">
                <b>{invite.tournament.name}</b>
                {invite.isExternal ? <Badge kind="warn">External — needs admin approval</Badge> : null}
                <span className="sub">invited {fmtDate(invite.createdAt)}</span>
              </div>
              <div className="hstack">
                <button className="btn" type="button" disabled={declineReferee.isPending}
                  onClick={() => declineReferee.mutate(invite.id, {
                    onSuccess: () => setNotice({ kind: 'warn', text: `Declined ${invite.tournament.name}.` }),
                  })}>Decline</button>
                <button className="btn primary" type="button" disabled={acceptReferee.isPending}
                  onClick={() => acceptReferee.mutate(invite.id, {
                    onSuccess: result => setNotice({ kind: 'ok', text: result?.requiresAdminApproval
                      ? `Accepted — an admin still needs to approve you for ${invite.tournament.name}.`
                      : `You are now eligible to officiate ${invite.tournament.name}.` }),
                    onError: error => setNotice({ kind: 'crit', text: answerError(error), error }),
                  })}>Accept</button>
              </div>
            </div>
          ))}
        </Panel>
      ) : null}

      {incoming.length ? (
        <Panel>
          <span className="tag"><em>//</em> Match assignments waiting on you · {incoming.length}</span>
          {incoming.map(request => (
            <div className="vstack" style={{ gap: 8 }} key={request.id}>
              <div className="hstack">
                <b>{request.matchA ? `Match #${request.matchA.id}` : `Tournament #${request.tournamentId}`}</b>
                <span className="sub">
                  {request.type === 'ref_withdraw' ? 'A referee asks the organizer to approve withdrawal'
                    : request.type === 'org_add_match' ? 'The organizer asks you to take this match'
                    : request.type === 'org_swap' ? 'The organizer proposes a swap'
                    : request.type === 'ref_swap' ? 'Another referee proposes a swap'
                      : 'Another referee proposes a transfer'}
                  {request.matchB ? ` with match #${request.matchB.id}` : ''}
                  {request.matchA?.scheduledTime ? ` · ${fmtDate(request.matchA.scheduledTime)}` : ''}
                </span>
              </div>
              {request.reason ? <p>Withdrawal reason: {request.reason}</p> : null}
              <div className="hstack">
                <button className="btn ghost" type="button"
                  onClick={() => navigate(request.matchA ? `/m/${request.matchA.id}` : `/t/${request.tournamentId}`)}>{request.matchA ? 'Open the match' : 'Open tournament'}</button>
                {request.matchB ? <button className="btn ghost" type="button"
                  onClick={() => navigate(`/m/${request.matchB!.id}`)}>Open second match</button> : null}
                <button className="btn" type="button" disabled={declineRequest.isPending}
                  onClick={() => declineRequest.mutate(request.id, {
                    onSuccess: () => setNotice({ kind: 'warn', text: `Declined request #${request.id}.` }),
                    onError: error => setNotice({ kind: 'crit', text: answerError(error), error }),
                  })}>Decline</button>
                {/* R18 — เดิมขึ้น "You are officiating" ทุกครั้งที่คำขอตอบกลับมา 200 แต่ FR06
                    คืนใบคำขอพร้อม `status` ซึ่งเป็น `cancelled` ได้ เมื่อมีใบอื่นบนแมตช์
                    เดียวกันถูก apply ไปก่อน (`refereeChangeRequest.repo.apply` ปิดใบที่
                    แตะแมตช์เดียวกันทั้งหมด) กรรมการจึงอ่านว่าได้คุมแล้วทั้งที่ไม่ได้คุม
                    — เชื่อสถานะที่ตอบกลับมา ไม่ใช่เชื่อว่าไม่ throw = สำเร็จ */}
                <button className="btn primary" type="button" disabled={acceptRequest.isPending}
                  onClick={() => acceptRequest.mutate(request.id, {
                    onSuccess: answered => setNotice(answered.status === 'applied'
                      ? { kind: 'ok', text: `Request #${answered.id} applied. Open the matches to see the updated assignments.` }
                      : { kind: 'warn', text: answered.status === 'open'
                        ? 'Your acceptance was recorded. The other referee still needs to answer.'
                        : `Request #${answered.id} is ${answered.status}. Assignments were not changed by this answer.` }),
                    onError: error => setNotice({ kind: 'crit', text: answerError(error), error }),
                  })}>Accept</button>
              </div>
            </div>
          ))}
        </Panel>
      ) : null}

      {refereeRequests.isError ? <Banner kind="crit">Could not load referee requests. {answerError(refereeRequests.error)}</Banner> : null}
      {outgoing.length ? <Panel quiet>
        <h3>Your referee requests</h3>
        {outgoing.map(request => <div className="vstack" style={{ gap: 8 }} key={request.id}>
          <div>Request #{request.id} | {request.type} | {request.matchA ? `Match #${request.matchA.id}` : `Tournament #${request.tournamentId}`}
            {request.matchB ? ` / #${request.matchB.id}` : ''} | <Badge kind={request.status === 'applied' ? 'ok' : request.status === 'open' ? 'warn' : 'neutral'}>{request.status}</Badge></div>
          <span className="sub">{request.refereeA.user.fullName}: {request.refereeA.status}
            {request.refereeB ? ` | ${request.refereeB.user.fullName}: ${request.refereeB.status}` : ''}</span>
          {request.reason ? <div style={{ whiteSpace: 'pre-wrap' }}>เหตุผล: {request.reason}</div> : null}
          <div className="hstack">
            <button className="btn ghost" onClick={() => navigate(request.matchA ? `/m/${request.matchA.id}` : `/t/${request.tournamentId}`)}>{request.matchA ? 'Open match' : 'Open tournament'}</button>
            {request.status === 'open' ? <button className="btn" disabled={cancelRequest.isPending}
              onClick={() => cancelRequest.mutate(request.id, {
                onSuccess: () => setNotice({ kind: 'ok', text: `Request #${request.id} withdrawn.` }),
                onError: error => setNotice({ kind: 'crit', text: answerError(error), error }),
              })}>Withdraw request</button> : null}
          </div>
        </div>)}
      </Panel> : null}

      {waiting.length || decided.length ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Your squad entries · {waiting.length + decided.length}</span>
          {[...waiting, ...decided].map(application => (
            <div className="spread" key={application.id}>
              <span className="sub">
                <TeamChipView team={application.team} /> → {application.tournament.name}
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

      {!loading && nothing ? (
        <Empty icon="bell" title="Nothing waiting on you"
          sub="Invitations, referee appointments and entry decisions land here." />
      ) : null}
    </>
  )
}
