import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMyJoinRequests, cancelJoinRequest } from '../../api/qaFeatures'
import { retryPolicy } from '../../api/client'
import { Banner, Panel } from '../../components/kit/primitives'
export function MyJoinRequests() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['myJoinRequests'], queryFn: getMyJoinRequests, retry: retryPolicy })
  const cancel = useMutation({ mutationFn: cancelJoinRequest, onSuccess: () => void qc.invalidateQueries({ queryKey: ['myJoinRequests'] }) })
  return <Panel quiet><h3>Your join requests</h3>
    {query.isPending ? <p>Loading requests…</p> : null}
    {query.isError ? <Banner kind="crit">{query.error instanceof Error ? query.error.message : 'Request failed.'} <button className="btn" onClick={() => void query.refetch()}>Retry</button></Banner> : null}
    {cancel.isError ? <Banner kind="crit">{cancel.error.message}</Banner> : null}
    {query.data?.items.map(r => <div className="spread" key={r.id}><span><Link to={`/team/${r.team.id}`}>{r.team.name}</Link> · {r.status.charAt(0).toUpperCase() + r.status.slice(1)}{r.rejectReason ? <p>{r.rejectReason}</p> : null}</span>{r.status === 'pending' ? <button className="btn" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>Cancel request</button> : null}</div>)}
    {query.isSuccess && !query.data.items.length ? <p>No join requests yet. Find a public squad in Search.</p> : null}
  </Panel>
}
