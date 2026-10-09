import { Banner, Panel } from '../../components/kit/primitives'
import { useMe } from '../../hooks/useAuth'
import { useStalledWork } from '../../hooks/useQaFeatures'
export function StalledWorkTab() {
  const { data: me } = useMe()
  const allowed = me?.adminScope?.scopeType === 'root' || me?.adminScope?.scopeType === 'university_wide'
  const query = useStalledWork(allowed)
  const data = query.data
  return <Panel quiet><h3>Stalled work overview</h3><p className="sub">Read-only counts and IDs. Review decisions remain with the authorized admin or organizer.</p>
    {!allowed ? <p>Root or University Admin rights required.</p> : null}
    {allowed && query.isPending ? <p>Loading overview…</p> : null}
    {query.isError ? <Banner kind="crit">{query.error instanceof Error ? query.error.message : 'Request failed.'} <button className="btn" onClick={() => void query.refetch()}>Retry</button></Banner> : null}
    {data ? <><p>Disputes past {data.thresholdHours} hours: {data.disputesPastDeadline.count} · Match IDs: {data.disputesPastDeadline.matchIds.join(', ') || 'None'}</p><p>Complaints awaiting admin: {data.complaintsAwaitingAdmin.count} · IDs: {data.complaintsAwaitingAdmin.complaintIds.join(', ') || 'None'}</p><p>Active University Admins: {data.universityAdmins.active} of {data.universityAdmins.total}</p>{data.needsAttention ? <Banner kind="warn">Pending work has no active University Admin. Root needs to appoint an admin.</Banner> : null}<button className="btn" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh overview</button></> : null}
  </Panel>
}
