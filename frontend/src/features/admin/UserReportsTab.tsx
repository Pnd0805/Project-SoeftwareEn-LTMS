import { useNow } from '../../hooks/useNow'
import { useState } from 'react'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { useMe } from '../../hooks/useAuth'
import { useUserReports } from '../../hooks/useQaFeatures'
import type { UserReport } from '../../api/qaFeatures'
import { IdentityDocs } from './IdentityDocs'
export function UserReportsTab() {
  const clockNow = useNow()
  const { data: me } = useMe()
  const allowed = me?.adminScope?.scopeType === 'university_wide' || me?.adminScope?.scopeType === 'faculty'
  const [page, setPage] = useState(1)
  const { query, decide } = useUserReports(page, allowed)
  const [selected, setSelected] = useState<{ row: UserReport; approve: boolean } | null>(null)
  const [reason, setReason] = useState('')
  const [days, setDays] = useState('7')
  const [permanent, setPermanent] = useState(false)
  const [category, setCategory] = useState('other')
  const validDays = permanent || (/^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 90)
  if (!allowed) return <Panel quiet>User report review requires Faculty or University Admin rights.</Panel>
  return <Panel quiet><h3>User reports</h3>
    {query.isPending ? <p>Loading reports…</p> : null}
    {query.isError ? <Banner kind="crit">{query.error instanceof Error ? query.error.message : 'Request failed.'} <button className="btn" onClick={() => void query.refetch()}>Retry</button></Banner> : null}
    {query.isSuccess && !query.data.items.length ? <p>No reports on this page.</p> : null}
    {query.data?.items.map(r => <article className="panel quiet" key={r.id}>
      <b>{r.target.fullName}</b> · Report #{r.id} · {r.status}<p>Reported by {r.reporter.fullName}</p><p style={{ whiteSpace: 'pre-wrap' }}>{r.reason}</p>
      <IdentityDocs docs={r.evidence} docsSubmitted={r.evidence.length > 0} fetchedAt={query.dataUpdatedAt} now={clockNow} onRefresh={() => void query.refetch()} refreshing={query.isFetching} />
      {r.reviewedByName ? <p>Reviewed by {r.reviewedByName}{r.rejectionReason ? `: ${r.rejectionReason}` : ''}</p> : null}
      {r.status === 'pending' ? <div className="hstack"><button className="btn" disabled={decide.isPending || r.target.id === me?.id} onClick={() => { decide.reset(); setReason(''); setSelected({ row: r, approve: false }) }}>Reject report</button><button className="btn danger" disabled={decide.isPending || r.target.id === me?.id} onClick={() => { decide.reset(); setPermanent(false); setDays('7'); setCategory('other'); setSelected({ row: r, approve: true }) }}>Review suspension</button></div> : null}
    </article>)}
    <div className="hstack"><button className="btn" disabled={page === 1 || query.isFetching} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button className="btn" disabled={query.isFetching || page >= (query.data?.pagination.totalPages ?? 1)} onClick={() => setPage(p => p + 1)}>Next</button></div>
    <Modal open={!!selected} title={`${selected?.approve ? 'Suspend' : 'Reject report about'} ${selected?.row.target.fullName ?? ''}?`} onClose={() => !decide.isPending && setSelected(null)}>
      {selected?.approve ? <><Banner kind="warn">Approval immediately suspends this account. Root cannot be suspended; University Admin rights must be revoked by Root first.</Banner>
        <Field label="Suspension category" htmlFor="report-category"><select id="report-category" value={category} onChange={e => setCategory(e.target.value)}>{['abusive_language', 'cheating', 'false_information', 'spam', 'other'].map(c => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}</select></Field>
        <label><input type="checkbox" checked={permanent} onChange={e => setPermanent(e.target.checked)} /> Permanent suspension</label>
        {!permanent ? <Field label="Days (1–90)" htmlFor="report-days"><input id="report-days" type="number" min={1} max={90} value={days} onChange={e => setDays(e.target.value)} /></Field> : null}
      </> : <Field label="Rejection reason" htmlFor="report-rejection"><textarea id="report-rejection" value={reason} onChange={e => setReason(e.target.value)} /></Field>}
      {decide.isError ? <Banner kind="crit">{decide.error.message}</Banner> : null}
      <button className="btn" disabled={decide.isPending} onClick={() => setSelected(null)}>Cancel</button>{' '}
      <button className="btn danger" disabled={decide.isPending || (selected?.approve ? !validDays : !reason.trim())} onClick={() => selected && decide.mutate({ id: selected.row.id, approve: selected.approve, ...(selected.approve ? { category, ...(permanent ? {} : { days: Number(days) }) } : { reason: reason.trim() }) }, { onSuccess: () => setSelected(null) })}>Confirm decision</button>
    </Modal>
  </Panel>
}
