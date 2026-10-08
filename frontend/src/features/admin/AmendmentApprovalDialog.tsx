import { ApiError } from '../../api/client'
import { ContractErrorDetails } from '../../components/kit/ContractErrorDetails'
import { Modal } from '../../components/kit/Modal'
import { Banner } from '../../components/kit/primitives'
import { useAmendmentImpact, type useApproveAmendment } from '../../hooks/useAdmin'
import type { BackendAmendmentRequestDto } from '../../types/tournament.dto'
import { TournamentReviewDetails } from './TournamentReviewDetails'

export function AmendmentApprovalDialog({ request, approval, onClose }: {
  request: BackendAmendmentRequestDto;
  approval: ReturnType<typeof useApproveAmendment>;
  onClose: () => void;
}) {
  const impact = useAmendmentImpact(request.id)
  const data = impact.isSuccess && !impact.isError && !impact.isFetching
    && impact.data.requestId === request.id && impact.data.tournamentId === request.tournamentId ? impact.data : undefined
  const canApprove = data?.canApprove === true && data.status === 'pending' && !data.alreadyDecided && data.blockers.length === 0
  return <Modal open onClose={() => !approval.isPending && onClose()} title="Approve amendment?">
    <p>{data?.tournamentName ?? request.tournamentName}</p>
    {impact.isPending || impact.isFetching ? <p role="status">Checking amendment impact…</p> : null}
    {impact.isError ? <Banner kind="crit">Unable to check amendment impact. {impact.error instanceof Error ? impact.error.message : 'Please try again.'}</Banner> : null}
    {impact.isSuccess && !impact.isFetching && !data ? <Banner kind="crit">The impact response does not match this request. Refresh before approving.</Banner> : null}
    <button className="btn ghost" disabled={impact.isFetching || approval.isPending} onClick={() => void impact.refetch()}>Refresh amendment impact</button>
    {data ? <>
      <p>Status: {data.status}</p>
      {data.alreadyDecided || data.status !== 'pending' ? <Banner kind="warn">This request has already been decided. Refresh the queue.</Banner> : null}
      {data.selfRequested ? <Banner kind="warn">You submitted this request. Approving it yourself will be recorded as approval by the requester.</Banner> : null}
      {data.reason ? <p>Reason: {data.reason}</p> : null}
      <TournamentReviewDetails id={data.tournamentId} changes={data.requestedChanges} />
      {data.blockers.map((blocker, index) => <Banner kind="crit" key={`${blocker.code}-${index}`}>
        {blocker.message} <span className="tag">{blocker.code}</span>
        <ContractErrorDetails error={new ApiError(422, { ...blocker.details, code: blocker.code, message: blocker.message })} />
      </Banner>)}
      {!data.canApprove && !data.alreadyDecided && data.blockers.length === 0 ? <Banner kind="warn">Approval is currently unavailable. Refresh the impact or queue.</Banner> : null}
    </> : null}
    {approval.isError ? <Banner kind="crit">{approval.error instanceof Error ? approval.error.message : 'Approval failed.'}<ContractErrorDetails error={approval.error} /></Banner> : null}
    <button className="btn" disabled={approval.isPending} onClick={onClose}>Cancel</button>{' '}
    <button className="btn primary" disabled={!canApprove || approval.isPending} onClick={() => {
      if (!canApprove || approval.isPending) return
      approval.mutate(request.id, { onSuccess: onClose, onError: () => { void impact.refetch() } })
    }}>Confirm amendment approval</button>
  </Modal>
}
