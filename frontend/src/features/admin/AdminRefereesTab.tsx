/**
 * src/features/admin/AdminRefereesTab.tsx
 *
 * External referees waiting on an admin. Somebody from outside the university may
 * officiate only once an admin approves them (FR-RM-02) — accepting the
 * organizer's appointment is not enough on its own, so until then they do not
 * count towards the referees a tournament needs before it can go public.
 *
 * ── backend ───────────────────────────────────────────────────────────────
 * POST /tournaments/:id/referees รับ isExternal แล้ว และการตอบรับคืน requiresAdminApproval
 * แต่ยังไม่มี route ให้ Admin อนุมัติ (SDS PATCH /admin/requests/{id}) — นอกโหมด mock
 * ได้ 501 และหน้าจอบอกว่ายังใช้ไม่ได้
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useExternalRefereeRequests, useReviewExternalReferee } from '../../hooks/useAdmin'
import { tournamentRouteId } from '../../mocks/storeBridge'
import type { ExternalRefereeRequestDto } from '../../types/admin.dto'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'
const statusOf = (error: unknown) => (error as { status?: number } | null)?.status

export function AdminRefereesTab() {
  const navigate = useNavigate()
  const requests = useExternalRefereeRequests()
  const review = useReviewExternalReferee()
  const [rejecting, setRejecting] = useState<ExternalRefereeRequestDto | null>(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)

  const status = statusOf(requests.error)
  const rows = requests.data?.items ?? []
  const busyId = review.isPending ? review.variables?.requestId : undefined

  const decide = (r: ExternalRefereeRequestDto, approve: boolean, why?: string) => {
    setNotice(null)
    review.mutate({ requestId: r.id, input: { approve, reason: why } }, {
      onSuccess: () => {
        setNotice(approve
          ? { kind: 'ok', text: `${r.referee.fullName} can now officiate ${r.tournament.name}.` }
          : { kind: 'warn', text: `${r.referee.fullName} was not approved for ${r.tournament.name} — the reason goes to them and the organizer.` })
        setRejecting(null)
        setReason('')
      },
    })
  }

  return (
    <Panel>
      <span className="tag"><em>//</em> External referees · {rows.length}</span>
      <div className="sub">
        People from outside the university who accepted an appointment. They count as a referee only once
        you approve them, and a decline has to say why.
      </div>

      {notice ? <Banner kind={notice.kind}>{notice.text}</Banner> : null}
      {review.isError && !rejecting ? (
        <Banner kind="crit"><b>The decision did not go through.</b> {errorMessage(review.error)}</Banner>
      ) : null}

      {requests.isPending ? <div className="sub">Loading requests…</div> : null}
      {requests.isError ? (
        status === 501 ? (
          <Banner kind="warn"><b>Not available yet.</b> The backend has no route for approving external referees.</Banner>
        ) : status === 401 || status === 403 ? (
          <Banner kind="warn"><b>This queue is for admins.</b> Your account does not have access to it.</Banner>
        ) : (
          <Banner kind="crit">
            <b>Couldn't load the requests.</b> {errorMessage(requests.error)}{' '}
            <button className="btn" type="button" onClick={() => void requests.refetch()}>Try again</button>
          </Banner>
        )
      ) : null}

      {requests.isSuccess && !rows.length ? <div className="sub">Nothing waiting.</div> : null}

      {rows.length ? (
        <TableWrap>
          <table>
            <thead><tr><th>Referee</th><th>Tournament</th><th>Appointed by</th><th /></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <span className="hstack">
                      <span className="avatar">{r.referee.fullName.slice(0, 1)}</span>{r.referee.fullName}
                      <Badge kind="warn">External</Badge>
                    </span>
                  </td>
                  <td>
                    {/* id ใน DTO เป็นตัวเลข โหมด mock ต้องแปลงกลับเป็น id ของ store ก่อน
                        ไม่งั้นหน้าทัวร์นาเมนต์ไปอ่านรายชื่อทีมจาก fixture แล้วขึ้น 0 ทีม */}
                    <button className="btn ghost" type="button" onClick={() => navigate(`/t/${tournamentRouteId(r.tournament.id)}`)}>
                      {r.tournament.name}
                    </button>
                  </td>
                  <td className="sub">{r.invitedBy.fullName}</td>
                  <td>
                    <span className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn ghost" type="button" disabled={busyId !== undefined}
                        onClick={() => { review.reset(); setReason(''); setRejecting(r) }}>
                        Reject
                      </button>
                      <button className="btn primary" type="button" disabled={busyId !== undefined}
                        onClick={() => decide(r, true)}>
                        {busyId === r.id && review.variables?.input.approve ? 'Approving…' : 'Approve'}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : null}

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} label="Do not approve an external referee"
        title={rejecting?.referee.fullName ?? ''}>
        <Field label="Reason — sent to the referee and the organizer" htmlFor="ext-ref-reason">
          <textarea id="ext-ref-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        {review.isError ? <Banner kind="crit">{errorMessage(review.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setRejecting(null)}>Cancel</button>
          <button className="btn danger" type="button" disabled={!reason.trim() || review.isPending}
            onClick={() => { if (rejecting) decide(rejecting, false, reason.trim()) }}>
            {review.isPending ? 'Sending…' : 'Do not approve'}
          </button>
        </div>
      </Modal>
    </Panel>
  )
}
