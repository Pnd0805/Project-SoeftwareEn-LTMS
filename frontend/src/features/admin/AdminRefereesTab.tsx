/**
 * src/features/admin/AdminRefereesTab.tsx
 *
 * External referees waiting on an admin. Somebody from outside the university may
 * officiate only once an admin approves them (FR-RM-02) — accepting the
 * organizer's appointment is not enough on its own, so until then they do not
 * count towards the referees a tournament needs before it can go public.
 *
 * ── backend ───────────────────────────────────────────────────────────────
 * AR01 reads the per-person queue; AR02/AR03 decide all pending tournaments
 * for that person. A successful decision refreshes the queue and referee reads.
 */
import { Avatar } from '../../components/kit/Avatar'
import { adminReadBlocked } from './adminView'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useExternalRefereeRequests, useReviewExternalReferee, useRequestExternalRefereeDocs } from '../../hooks/useAdmin'
import { USE_MOCK } from '../../api/client'
import { tournamentRouteId } from '../../mocks/storeBridge'
import { useNow } from '../../hooks/useNow'
import { IdentityDocs } from './IdentityDocs'
import type { ExternalRefereeRequestDto } from '../../types/admin.dto'

/* migration 036 — AR02 อนุมัติ "คน" = ทุกแถวของคนนั้น ถ้ามีสองใบรอในทัวร์เดียวกันจะกลายเป็นใช้งานพร้อมกัน
   ฐานจึงปฏิเสธเป็น 409 REFEREE_DUPLICATE_ROWS (เดิม 500) — แอดมินแก้เองไม่ได้ ต้องให้ผู้จัดถอดใบที่เกินก่อน */
const errorMessage = (error: unknown) =>
  (error as { code?: string } | null)?.code === 'DOCS_NOT_SUBMITTED'
    ? 'ผู้ใช้นี้ยังไม่ได้ส่งเอกสารยืนยันตัวตน อนุมัติไม่ได้ — ต้องรอให้ส่งเอกสารก่อน หรือกด Request documents เพื่อทวงเอกสาร'
    :
  (error as { code?: string } | null)?.code === 'REFEREE_DUPLICATE_ROWS'
    ? "This person has two overlapping invitations in the same tournament. Ask that tournament's organizer to remove the extra one, then approve again."
    : error instanceof Error ? error.message : 'Something went wrong.'
const statusOf = (error: unknown) => (error as { status?: number } | null)?.status

export function AdminRefereesTab() {
  const navigate = useNavigate()
  const now = useNow()
  const requests = useExternalRefereeRequests()
  const review = useReviewExternalReferee()
  const requestDocs = useRequestExternalRefereeDocs()
  const [askingDocs, setAskingDocs] = useState(false)
  const [rejecting, setRejecting] = useState<ExternalRefereeRequestDto | null>(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null)

  const status = statusOf(requests.error)
  const rows = adminReadBlocked(requests) ? [] : requests.data?.items ?? []
  const busyId = review.isPending ? review.variables?.requestId : requestDocs.isPending ? requestDocs.variables?.userId : undefined

  const decide = (r: ExternalRefereeRequestDto, approve: boolean, why?: string) => {
    if (approve && r.docsSubmitted !== true) return
    setNotice(null)
    review.mutate({ requestId: r.id, input: { approve, reason: why } }, {
      onSuccess: () => {
        setNotice(approve
          ? { kind: 'ok', text: `${r.referee.fullName} can now officiate ${r.tournament.name}.` }
          : { kind: 'warn', text: `${r.referee.fullName} was not approved for ${r.tournament.name} — the reason goes to them and the organizer.` })
        setRejecting(null)
        setReason('')
      },
      onError: error => {
        if ((error as { code?: string } | null)?.code === 'DOCS_NOT_SUBMITTED') void requests.refetch()
      },
    })
  }

  return (
    <Panel className="admin-referees">
      <h2>External referees</h2>
      <div className="sub">
        People from outside the university who accepted an appointment. They count as a referee only once
        you approve them, and a decline has to say why.
      </div>
      {!USE_MOCK ? <p className="sub">Approval or rejection applies to every pending tournament for that referee.</p> : null}

      {notice ? <div role="status"><Banner kind={notice.kind}>{notice.text}</Banner></div> : null}
      {review.isError && !rejecting ? (
        <Banner kind="crit"><b>The decision did not go through.</b> {errorMessage(review.error)}</Banner>
      ) : null}

      {requests.isPending ? <div className="sub">Loading requests…</div> : null}
      {requests.isError ? (
        status === 501 ? (
          <Banner kind="warn"><b>Review unavailable.</b> External referee approval is not available yet.</Banner>
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
      {rows.some(r => r.docsSubmitted === undefined) ? <Banner kind="warn">
        ยังไม่ได้รับสถานะการส่งเอกสาร จึงยังอนุมัติไม่ได้
        <button className="btn" type="button" onClick={() => void requests.refetch()}>Retry</button>
      </Banner> : null}

      {rows.length ? (
        <TableWrap label="External referee requests">
          <table>
            <thead><tr><th>Referee</th><th>Tournament</th><th>Appointed by</th><th>Documents</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${r.id}-${r.tournament.id}`}>
                  <td>
                    <span className="hstack">
                      <Avatar name={r.referee.fullName} avatarUrl={r.referee.avatarUrl} />{r.referee.fullName}
                      <Badge kind="warn">External</Badge>
                      <Badge kind={r.docsSubmitted === true ? 'neutral' : 'warn'}>{r.docsSubmitted === true ? 'รอตรวจ' : r.docsSubmitted === false ? 'รอเอกสารจากผู้สมัคร' : 'ตรวจสถานะเอกสารไม่ได้'}</Badge>
                    </span>
                  </td>
                  <td>
                    {/* id ใน DTO เป็นตัวเลข โหมด mock ต้องแปลงกลับเป็น id ของ store ก่อน
                        ไม่งั้นหน้าทัวร์นาเมนต์ไปอ่านรายชื่อทีมจาก fixture แล้วขึ้น 0 ทีม */}
                    <button className="btn ghost" type="button" onClick={() => navigate(`/t/${tournamentRouteId(r.tournament.id)}`)}>
                      {r.tournament.name}
                    </button>
                  </td>
                  <td className="sub">{r.invitedBy?.fullName ?? '—'}</td>
                  <td>
                    <IdentityDocs docs={r.docs} docsSubmitted={r.docsSubmitted} fetchedAt={requests.dataUpdatedAt}
                      now={now} refreshing={requests.isFetching} onRefresh={() => void requests.refetch()} />
                  </td>
                  <td>
                    <span className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      {!USE_MOCK ? <button className="btn" type="button" disabled={busyId !== undefined} onClick={() => { requestDocs.reset(); review.reset(); setAskingDocs(true); setReason(''); setRejecting(r) }}>Request documents</button> : null}
                      <button className="btn ghost" type="button" disabled={busyId !== undefined}
                        onClick={() => { review.reset(); requestDocs.reset(); setAskingDocs(false); setReason(''); setRejecting(r) }}>
                        Reject
                      </button>
                      <button className="btn primary" type="button" disabled={busyId !== undefined || r.docsSubmitted !== true}
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

      <Modal className="admin-decision-dialog" open={!!rejecting && rows.some(row => row.id === rejecting.id)} onClose={() => { if (busyId === undefined) setRejecting(null) }} label={askingDocs ? 'Request additional identity documents' : 'Do not approve an external referee'}
        title={rejecting?.referee.fullName ?? ''}>
        <Field label="Reason — sent to the referee and the organizer" htmlFor="ext-ref-reason">
          <textarea id="ext-ref-reason" rows={3} maxLength={500} disabled={busyId !== undefined} value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        {review.isError ? <Banner kind="crit">{errorMessage(review.error)}</Banner> : null}
        {requestDocs.isError ? <Banner kind="crit">{errorMessage(requestDocs.error)}</Banner> : null}
        <div className="hstack">
          <button className="btn" type="button" disabled={busyId !== undefined} onClick={() => setRejecting(null)}>Cancel</button>
          <button className="btn danger" type="button" disabled={!reason.trim() || reason.trim().length > 500 || busyId !== undefined}
            onClick={() => {
              if (!rejecting || busyId !== undefined || !reason.trim()) return
              if (askingDocs) requestDocs.mutate({ userId: rejecting.id, reason: reason.trim() }, { onSuccess: () => {
                setNotice({ kind: 'ok', text: 'ขอเอกสารเพิ่มแล้ว กรรมการยังรอการตรวจและยังไม่ได้รับอนุมัติ' }); setRejecting(null); setReason('')
              } })
              else decide(rejecting, false, reason.trim())
            }}>
            {busyId !== undefined ? 'Sending…' : askingDocs ? 'Send document request' : 'Do not approve'}
          </button>
        </div>
      </Modal>
    </Panel>
  )
}
