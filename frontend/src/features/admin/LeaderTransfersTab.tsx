import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useLeaderTransfers, useReviewLeaderTransfer } from '../../hooks/useAdmin'
import type { LeaderTransferDto } from '../../api/admin'
export function LeaderTransfersTab() {
  const queue = useLeaderTransfers(); const decision = useReviewLeaderTransfer()
  const [review, setReview] = useState<{ row: LeaderTransferDto; approve: boolean } | null>(null); const [reason, setReason] = useState('')
  const pending = queue.data?.items.filter(row => row.status === 'pending') ?? []
  return <Panel quiet><h3>Leader transfer requests</h3><p>University Admin approval is required. The current captain keeps their rights until approval.</p>
    {queue.isPending ? <p>Loading requests...</p> : null}
    {queue.error ? <Banner kind="crit">{queue.error instanceof Error ? queue.error.message : 'Unable to read requests.'} <button className="btn" onClick={() => void queue.refetch()}>Retry</button></Banner> : null}
    {decision.isSuccess ? <Banner kind="ok">Transfer request decided.</Banner> : null}
    {queue.isSuccess && !pending.length ? <p>No pending transfers.</p> : null}
    {pending.map(row => <div className="spread" key={row.id}><span><Link to={`/team/${row.team.id}`}>{row.team.name}</Link> | {row.currentLeader.fullName} to {row.proposedLeader.fullName}</span><span className="hstack">{[true, false].map(approve => <button className="btn" key={String(approve)} disabled={decision.isPending} onClick={() => { decision.reset(); setReason(''); setReview({ row, approve }) }}>{approve ? 'Approve' : 'Reject'}</button>)}</span></div>)}
    <Modal open={!!review} onClose={() => !decision.isPending && setReview(null)} title={review?.approve ? 'Approve transfer?' : 'Reject transfer?'}>
      <p>{review?.row.team.name}: {review?.row.currentLeader.fullName} to {review?.row.proposedLeader.fullName}</p>
      {!review?.approve ? <Field label="Rejection reason" htmlFor="transfer-reason"><textarea id="transfer-reason" value={reason} onChange={e => setReason(e.target.value)} /></Field> : null}
      {decision.error ? <Banner kind="crit">{decision.error instanceof Error ? decision.error.message : 'Decision failed.'}</Banner> : null}
      <button className="btn" disabled={decision.isPending} onClick={() => setReview(null)}>Cancel</button><button className="btn primary" disabled={decision.isPending || (!review?.approve && !reason.trim())} onClick={() => review && decision.mutate({ id: review.row.id, approve: review.approve, reason: reason.trim() }, { onSuccess: () => setReview(null) })}>Confirm decision</button>
    </Modal>
  </Panel>
}
