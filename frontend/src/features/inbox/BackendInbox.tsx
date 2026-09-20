/**
 * src/features/inbox/BackendInbox.tsx
 *
 * กล่องข้อความในโหมดที่ต่อ backend จริง
 *
 * backend ยังไม่มีตาราง/เส้นของ "การแจ้งเตือน" (GET /me/notifications) — แต่สิ่งที่คน
 * เข้ามาดูกล่องนี้จริงๆ คือ "มีอะไรรอให้ฉันตอบบ้าง" ซึ่งอ่านได้จากเส้นที่มีอยู่แล้ว:
 *
 *   GET /me/invitations         คำเชิญเข้าทีม            → ตอบรับ/ปฏิเสธได้ที่นี่
 *   GET /me/referee-invitations คำเชิญเป็นกรรมการ        → ตอบรับ/ปฏิเสธได้ที่นี่
 *   GET /me/referee-requests    คำขอเปลี่ยน/เพิ่มแมตช์    → ตอบรับ/ปฏิเสธได้ที่นี่
 *   GET /me/applications        ผลการพิจารณาใบสมัครทีม   → อ่านอย่างเดียว
 *
 * พอ backend มี /me/notifications จริงเมื่อไร ค่อยเอามารวมเป็นรายการเดียว
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Empty, Panel } from '../../components/kit/primitives'
import { fmtDate } from '../../shared/rules'
import { useAnswerBackendInvitation, useBackendMyInvitations } from '../../hooks/useTeam'
import {
  useAcceptRefereeInvitation, useAcceptRefereeRequest, useDeclineRefereeInvitation,
  useDeclineRefereeRequest, useMyRefereeInvitations, useMyRefereeRequests,
} from '../../hooks/useAdmin'
import { useMyTournamentApplications } from '../../hooks/useTournament'

type Notice = { kind: 'ok' | 'warn' | 'crit'; text: string } | null

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
  const applications = useMyTournamentApplications()

  const invites = teamInvites.data?.items ?? []
  const appointments = refereeInvites.data?.items ?? []
  const incoming = refereeRequests.data?.incoming ?? []
  const decided = (applications.data?.items ?? []).filter(a => a.status !== 'pending')
  const waiting = (applications.data?.items ?? []).filter(a => a.status === 'pending')
  const nothing = !invites.length && !appointments.length && !incoming.length
    && !decided.length && !waiting.length

  const loading = teamInvites.isPending || refereeInvites.isPending || refereeRequests.isPending

  return (
    <>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 32 }}>Inbox</h1>
      </div>

      <Banner kind="warn">
        <b>System notifications are not on the server yet.</b>{' '}
        This is everything waiting on your answer, read from the endpoints that do exist.
      </Banner>

      {notice ? <Banner kind={notice.kind}>{notice.text}</Banner> : null}

      {loading ? <Panel quiet><span className="sub">Loading…</span></Panel> : null}

      {invites.length ? (
        <Panel>
          <span className="tag"><em>//</em> Team invitations · {invites.length}</span>
          {invites.map(invite => (
            <div className="vstack" style={{ gap: 8 }} key={invite.id}>
              <div className="hstack">
                <b>{invite.team.name}</b>
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
                    onSuccess: () => setNotice({ kind: 'ok', text: `You are now eligible to officiate ${invite.tournament.name}.` }),
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
                <b>Match #{request.matchA.id}</b>
                <span className="sub">
                  {request.type === 'org_add_match' ? 'The organizer asks you to take this match'
                    : request.type === 'org_swap' ? 'The organizer proposes a swap'
                      : 'Another referee proposes a transfer'}
                  {request.matchA.scheduledTime ? ` · ${fmtDate(request.matchA.scheduledTime)}` : ''}
                </span>
              </div>
              <div className="hstack">
                <button className="btn ghost" type="button"
                  onClick={() => navigate(`/m/${request.matchA.id}`)}>Open the match</button>
                <button className="btn" type="button" disabled={declineRequest.isPending}
                  onClick={() => declineRequest.mutate(request.id, {
                    onSuccess: () => setNotice({ kind: 'warn', text: `Declined match #${request.matchA.id}.` }),
                  })}>Decline</button>
                <button className="btn primary" type="button" disabled={acceptRequest.isPending}
                  onClick={() => acceptRequest.mutate(request.id, {
                    onSuccess: () => setNotice({ kind: 'ok', text: `You are officiating match #${request.matchA.id}.` }),
                  })}>Accept</button>
              </div>
            </div>
          ))}
        </Panel>
      ) : null}

      {waiting.length || decided.length ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Your squad entries · {waiting.length + decided.length}</span>
          {[...waiting, ...decided].map(application => (
            <div className="spread" key={application.id}>
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

      {!loading && nothing ? (
        <Empty icon="bell" title="Nothing waiting on you"
          sub="Invitations, referee appointments and entry decisions land here." />
      ) : null}
    </>
  )
}
