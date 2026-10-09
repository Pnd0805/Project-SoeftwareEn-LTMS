import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRemovedFeedback, restoreFeedbackByAdmin } from '../../api/liveEngagement'
import { retryPolicy } from '../../api/client'
import { useMe } from '../../hooks/useAuth'
import { Banner, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import type { RemovedFeedbackItem } from '../../types/liveEngagement.dto'

export function RemovedFeedbackPanel() {
  const qc = useQueryClient()
  const me = useMe()
  const scope = me.data?.adminScope?.scopeType
  const allowed = scope === 'university_wide' || scope === 'faculty'
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<RemovedFeedbackItem | null>(null)
  const removed = useQuery({ queryKey: ['removedFeedback', me.data?.id, scope, me.data?.adminScope?.facultyId, page], queryFn: () => getRemovedFeedback(page), enabled: allowed, retry: retryPolicy })
  const restore = useMutation({ mutationFn: (id: number) => restoreFeedbackByAdmin(id), onSuccess: async () => {
    setSelected(null)
    await Promise.all(['removedFeedback', 'liveComments', 'liveReviews'].map(key => qc.invalidateQueries({ queryKey: [key] })))
  } })
  if (!allowed) return <Panel quiet>Removed feedback is available to Faculty and University Admin only. Root cannot read this content.</Panel>
  return <Panel quiet><h3>Removed feedback</h3>
    <p className="sub">Removal history within your admin scope. Content deleted by its author is permanently removed and does not appear here.</p>
    {scope === 'faculty' ? <p className="sub">Your faculty can inspect this history. Ask a University Admin to restore feedback.</p> : null}
    {removed.isPending ? <p>Loading removed feedback…</p> : null}
    {removed.isError ? <Banner kind="crit">Could not load removed feedback. {removed.error instanceof Error ? removed.error.message : 'The service is unavailable.'} <button className="btn" onClick={() => void removed.refetch()}>Retry removed feedback</button></Banner> : null}
    {removed.isSuccess && !removed.data.items.length ? <p>No removed feedback on this page.</p> : null}
    {removed.isSuccess ? removed.data.items.map(row => <article className="panel quiet" key={row.id}>
      <div><b>Feedback #{row.id} · {row.feedbackType}</b> · <Link to={`/t/${row.tournamentId}`}>{row.tournamentName}</Link></div>
      <p>Author: {row.author.fullName}{row.rating !== null ? ` · Rating ${row.rating}/5` : ''}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{row.content ?? 'No written content'}</p>
      <p className="sub">Removed {new Date(row.removedAt).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} (UTC+7) by {row.removedBy?.fullName ?? 'Not recorded'} · {row.removedByRole ?? 'Role not recorded'}</p>
      <p>Reason: {row.removalReason ?? 'Not recorded'}</p>
      {row.canRestore ? <button className="btn" disabled={restore.isPending} onClick={() => { restore.reset(); setSelected(row) }}>Review restoration</button> : null}
    </article>) : null}
    <div className="hstack"><button className="btn" disabled={page <= 1 || removed.isFetching || restore.isPending} onClick={() => setPage(p => p - 1)}>Previous removed feedback</button><span>Page {page} of {removed.data?.pagination.totalPages ?? 1}</span><button className="btn" disabled={!removed.isSuccess || removed.isFetching || restore.isPending || page >= removed.data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next removed feedback</button></div>
    <Modal open={!!selected} onClose={() => !restore.isPending && setSelected(null)} title="Restore this feedback?">
      <p>Feedback #{selected?.id} · {selected?.tournamentName}</p><p style={{ whiteSpace: 'pre-wrap' }}>{selected?.content ?? 'No written content'}</p>
      <p>Removal reason: {selected?.removalReason ?? 'Not recorded'}</p><p>This feedback will become visible again and its report flag will clear.</p>
      {restore.isError ? <Banner kind="crit">Restoration failed. {restore.error.message}</Banner> : null}
      <button className="btn" disabled={restore.isPending} onClick={() => setSelected(null)}>Cancel</button>{' '}<button className="btn primary" disabled={restore.isPending || !selected?.canRestore} onClick={() => selected?.canRestore && restore.mutate(selected.id)}>Confirm restoration</button>
    </Modal>
  </Panel>
}
