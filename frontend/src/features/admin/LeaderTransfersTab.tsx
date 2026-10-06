import { useState } from 'react'
import { adminReadBlocked } from './adminView'
import { Link } from 'react-router-dom'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useLeaderTransfers, useReviewLeaderTransfer } from '../../hooks/useAdmin'
import type { LeaderTransferDto } from '../../api/admin'
export function LeaderTransfersTab() {
  const queue = useLeaderTransfers(); const decision = useReviewLeaderTransfer()
  const [review, setReview] = useState<{ row: LeaderTransferDto; approve: boolean } | null>(null); const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const pending = adminReadBlocked(queue) ? [] : queue.data?.items.filter(row => row.status === 'pending') ?? []
  return <Panel quiet className="admin-transfers"><h2>Leader transfers</h2><p className="sub">University Admin approval is required. The current leader keeps their rights until approval.</p>
    {queue.isPending ? <p>Loading requests...</p> : null}
    {queue.error ? <Banner kind="crit">{queue.error instanceof Error ? queue.error.message : 'Unable to read requests.'} <button className="btn" onClick={() => void queue.refetch()}>Retry</button></Banner> : null}
    {notice ? <div role="status"><Banner kind="ok">{notice}</Banner></div> : null}
    {queue.isSuccess && !pending.length ? <p>No pending transfers.</p> : null}
    <div className="admin-transfer-list" role="region" aria-label="Pending leader transfers" tabIndex={0}>
    {pending.map(row => <article className="admin-transfer-row" key={row.id}>
      <div><h3><Link to={`/team/${row.team.id}`}>{row.team.name}</Link></h3><p className="sub">{row.currentLeader.fullName} to {row.proposedLeader.fullName}</p></div>
      <span className="hstack">{[true, false].map(approve => <button type="button" className={`btn ${approve ? 'primary' : 'ghost'}`} key={String(approve)} disabled={decision.isPending} onClick={() => { decision.reset(); setReason(''); setReview({ row, approve }) }}>{approve ? 'Approve' : 'Reject'}</button>)}</span></article>)}
    </div>
    <Modal className="admin-decision-dialog" open={!!review && pending.some(row => row.id === review.row.id)} onClose={() => !decision.isPending && setReview(null)} title={review?.approve ? 'Approve transfer?' : 'Reject transfer?'}>
      <p>{review?.row.team.name}: {review?.row.currentLeader.fullName} to {review?.row.proposedLeader.fullName}</p>
      {!review?.approve ? <Field label="Rejection reason" htmlFor="transfer-reason"><textarea id="transfer-reason" disabled={decision.isPending} value={reason} onChange={e => setReason(e.target.value)} /></Field> : null}
      {decision.error ? <Banner kind="crit">{decision.error instanceof Error ? decision.error.message : 'Decision failed.'}</Banner> : null}
      <button className="btn" disabled={decision.isPending} onClick={() => setReview(null)}>Cancel</button><button className="btn primary" disabled={decision.isPending || (!review?.approve && !reason.trim())} onClick={() => review && decision.mutate({ id: review.row.id, approve: review.approve, reason: reason.trim() }, { onSuccess: () => { setNotice(review.approve ? `${review.row.team.name}: ${review.row.proposedLeader.fullName} is now the team leader.` : `Rejected the leader transfer for ${review.row.team.name}.`); setReview(null) } })}>{decision.isPending ? 'Saving…' : 'Confirm decision'}</button>
    </Modal>
  </Panel>
}
