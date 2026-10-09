import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getComments, getReviews, removeFeedbackByAdmin, dismissCommentReport } from '../../api/liveEngagement'
import { getTournaments } from '../../api/tournament'
import { retryPolicy } from '../../api/client'
import { useMe } from '../../hooks/useAuth'
import { Banner, Field, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { RemovedFeedbackPanel } from './RemovedFeedbackPanel'

export function AdminFeedbackTab() {
  const qc = useQueryClient()
  const me = useMe()
  const allowed = me.data?.adminScope?.scopeType === 'university_wide'
  const [tournamentId, setTournamentId] = useState<number | undefined>()
  const [page, setPage] = useState(1)
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState<{ id: number; dismiss: boolean; content: string } | null>(null)
  const tournaments = useQuery({ queryKey: ['tournaments', 'moderation'], queryFn: () => getTournaments(), enabled: allowed, retry: retryPolicy })
  const comments = useQuery({ queryKey: ['liveComments', tournamentId, page, true], queryFn: () => getComments(tournamentId!, page, true), enabled: allowed && !!tournamentId, retry: retryPolicy })
  const reviews = useQuery({ queryKey: ['liveReviews', tournamentId], queryFn: () => getReviews(tournamentId!), enabled: allowed && !!tournamentId, retry: retryPolicy })
  const act = useMutation({ mutationFn: async (input: { id: number; dismiss: boolean; reason: string }) => { if (input.dismiss) await dismissCommentReport(tournamentId!, input.id); else await removeFeedbackByAdmin(input.id, input.reason || undefined) },
    onSuccess: () => { setSelected(null); void qc.invalidateQueries({ queryKey: ['liveComments'] }); void qc.invalidateQueries({ queryKey: ['liveReviews'] }); void qc.invalidateQueries({ queryKey: ['removedFeedback'] }) } })
  const choose = (id: number, content: string, dismiss = false) => { act.reset(); setReason(''); setSelected({ id, content, dismiss }) }
  if (!allowed) return <><Panel quiet>Feedback moderation requires University Admin rights.</Panel><RemovedFeedbackPanel /></>
  return <><Panel quiet><h3>Reported comments and reviews</h3>
    <p className="sub">Choose a tournament to read reports before deciding. Reported items are listed per tournament; removed feedback is listed separately below.</p>
    <Field label="Tournament" htmlFor="moderation-tournament"><select id="moderation-tournament" value={tournamentId ?? ''} disabled={act.isPending} onChange={e => { setTournamentId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}><option value="">Choose a tournament</option>{tournaments.data?.items.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
    {tournaments.isPending ? <p>Loading tournaments…</p> : null}
    {tournaments.isError ? <Banner kind="crit">Could not load tournaments. <button className="btn" onClick={() => void tournaments.refetch()}>Retry tournaments</button></Banner> : null}
    {tournamentId ? <>
      <Link to={`/t/${tournamentId}/community?reported=true`}>Open reported comments in this tournament</Link>
      <h4>Reported comments</h4>
      {comments.isPending ? <p>Loading comments…</p> : null}
      {comments.isError ? <Banner kind="crit">Could not load comments. <button className="btn" onClick={() => void comments.refetch()}>Retry comments</button></Banner> : null}
      {comments.data?.items.map(r => <article className="panel quiet" key={r.id}><b>{r.author.fullName} · Comment #{r.id}</b><p style={{ whiteSpace: 'pre-wrap' }}>{r.content}</p><div className="hstack"><button className="btn danger" disabled={act.isPending || !comments.data?.canModerate} onClick={() => choose(r.id, r.content)}>Review removal</button><button className="btn" disabled={act.isPending || !comments.data?.canModerate} onClick={() => choose(r.id, r.content, true)}>Dismiss report</button></div></article>)}
      {comments.isSuccess && !comments.data.items.length ? <p>No reported comments on this page.</p> : null}
      <div className="hstack"><button className="btn" disabled={page <= 1 || comments.isFetching} onClick={() => setPage(p => p - 1)}>Previous comments</button><span>Page {page}</span><button className="btn" disabled={comments.isFetching || page >= (comments.data?.pagination.totalPages ?? 1)} onClick={() => setPage(p => p + 1)}>Next comments</button></div>
      <h4>Reported reviews</h4>
      {reviews.isPending ? <p>Loading reviews…</p> : null}
      {reviews.isError ? <Banner kind="crit">Could not load reviews. <button className="btn" onClick={() => void reviews.refetch()}>Retry reviews</button></Banner> : null}
      {reviews.data?.items?.filter(r => r.isReported).map(r => <article className="panel quiet" key={r.id}><b>{r.rating}/5 · Review #{r.id}</b><p style={{ whiteSpace: 'pre-wrap' }}>{r.content || 'No written review'}</p><button className="btn danger" disabled={act.isPending} onClick={() => choose(r.id, r.content || 'No written review')}>Review removal</button></article>)}
      {reviews.isSuccess ? <p className="sub">{reviews.data.items === null ? 'Review details are unavailable for this account.' : reviews.data.items.some(r => r.isReported) ? 'Reviewer names remain private.' : 'No reported reviews.'}</p> : null}
    </> : null}
    <Modal open={!!selected} onClose={() => !act.isPending && setSelected(null)} title={selected?.dismiss ? 'Dismiss this report?' : 'Remove this feedback?'}>
      <p style={{ whiteSpace: 'pre-wrap' }}>{selected?.content}</p><p>{selected?.dismiss ? 'The comment stays visible and leaves the reported queue.' : 'The feedback will leave public counts. The action is recorded for review.'}</p>
      {!selected?.dismiss ? <Field label="Moderation reason (optional)" htmlFor="moderation-reason"><textarea id="moderation-reason" maxLength={255} value={reason} onChange={e => setReason(e.target.value)} /></Field> : null}
      {act.isError ? <Banner kind="crit">{act.error.message}</Banner> : null}
      <button className="btn" disabled={act.isPending} onClick={() => setSelected(null)}>Cancel</button>{' '}<button className="btn danger" disabled={act.isPending} onClick={() => selected && act.mutate({ ...selected, reason: reason.trim() })}>Confirm moderation</button>
    </Modal>
  </Panel><RemovedFeedbackPanel /></>
}
