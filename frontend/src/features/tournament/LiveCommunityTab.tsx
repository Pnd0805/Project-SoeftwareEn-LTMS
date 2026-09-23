import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Badge, Empty, Field, Panel } from '../../components/kit/primitives'
import { ApiError } from '../../api/client'
import { removeFeedbackByAdmin, restoreFeedbackByAdmin } from '../../api/liveEngagement'
import { useMe } from '../../hooks/useAuth'
import { useCommentsLive, usePickemLeaderboard, useReviews } from '../../hooks/useLiveEngagement'
import type { TournamentComment } from '../../types/liveEngagement.dto'

const messageOf = (error: unknown) => error instanceof ApiError ? error.message : 'Request failed. Please try again.'

export function LiveCommunityTab({ tournamentId, organizer }: { tournamentId: number; organizer: boolean }) {
  const me = useMe()
  const qc = useQueryClient()
  const [lastRemovedId, setLastRemovedId] = useState<number | null>(null)
  const adminRemove = useMutation({ mutationFn: (id: number) => removeFeedbackByAdmin(id), onSuccess: (_, id) => {
    setLastRemovedId(id); void qc.invalidateQueries({ queryKey: ['liveComments', tournamentId] }); void qc.invalidateQueries({ queryKey: ['liveReviews', tournamentId] })
  } })
  const adminRestore = useMutation({ mutationFn: restoreFeedbackByAdmin, onSuccess: () => {
    setLastRemovedId(null); void qc.invalidateQueries({ queryKey: ['liveComments', tournamentId] }); void qc.invalidateQueries({ queryKey: ['liveReviews', tournamentId] })
  } })
  const reviews = useReviews(tournamentId)
  const leaderboard = usePickemLeaderboard(tournamentId)
  const [params, setParams] = useSearchParams()
  const reported = params.get('reported') === 'true'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const comments = useCommentsLive(tournamentId, page, reported)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [commentText, setCommentText] = useState('')
  const [removing, setRemoving] = useState<TournamentComment | null>(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')

  const review = reviews.query.data
  const thread = comments.query.data
  const entries = thread?.mine && !reported
    ? [thread.mine, ...thread.items.filter(item => !item.isMine)]
    : thread?.items ?? []
  const busy = comments.post.isPending || comments.removeMine.isPending || comments.moderate.isPending || comments.report.isPending

  const setFilter = (nextReported: boolean, nextPage = 1) => {
    const next = new URLSearchParams()
    if (nextReported) next.set('reported', 'true')
    if (nextPage > 1) next.set('page', String(nextPage))
    setParams(next)
  }

  return <>
    <div className="grid2">
      <Panel quiet>
        <div className="spread"><span className="tag"><em>//</em> Tournament reviews</span>
          {review ? <Badge kind="neutral">{review.summary.average ?? '—'} / 5 · {review.summary.count} reviews</Badge> : null}
        </div>
        {reviews.query.isPending ? <span className="sub">Loading reviews…</span> : null}
        {reviews.query.isError ? <span className="sub">Unable to load reviews. {messageOf(reviews.query.error)}</span> : null}
        {review ? <>
          <div className="statline"><div><span className="tag">Average</span><span className="v">{review.summary.average ?? '—'}</span></div>
            <div><span className="tag">Ratings</span><span className="v">{review.summary.count}</span></div></div>
          <div className="sub">{[5, 4, 3, 2, 1].map(stars => `${stars}★ ${review.summary.distribution[String(stars)] ?? 0}`).join(' · ')}</div>
          {review.status === 'not_started' ? <p className="sub">Reviews open {review.opensAt ? new Date(review.opensAt).toLocaleString() : 'when the tournament starts'}.</p> : null}
          {review.status === 'closed' ? <p className="sub">Reviews are closed.</p> : null}
          {review.mine ? <p className="sub">Your review: {review.mine.rating}/5 {review.mine.content}</p> : null}
          {!organizer && review.items?.map(item => <div className="notif" key={item.id}>
            <span className="txt"><b>#{item.id} · {item.rating}/5</b> {item.author?.fullName}<br />{item.content}</span>
            <button className="btn ghost" type="button" disabled={adminRemove.isPending} onClick={() => adminRemove.mutate(item.id)}>Remove</button>
          </div>)}
          {review.canSubmit ? <form className="vstack" onSubmit={async event => {
            event.preventDefault()
            try { await reviews.submit.mutateAsync({ rating, content: reviewText }); setNotice('Your review was saved.') }
            catch (error) { setNotice(messageOf(error)) }
          }}>
            <Field label="Rating — 1 to 5" htmlFor="live-rating"><select id="live-rating" value={rating} onChange={event => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} out of 5</option>)}
            </select></Field>
            <Field label="Review for the organizer (optional)" htmlFor="live-review"><textarea id="live-review" maxLength={1000} value={reviewText} onChange={event => setReviewText(event.target.value)} /></Field>
            <button className="btn primary" type="submit" disabled={reviews.submit.isPending}>{review.mine ? 'Update review' : 'Send review'}</button>
            {review.mine ? <button className="btn ghost" type="button" onClick={() => { setRating(review.mine!.rating); setReviewText(review.mine!.content ?? '') }}>Load my review to edit</button> : null}
          </form> : !me.data && review.status === 'open' ? <p className="sub">Sign in to review this tournament.</p> : null}
        </> : null}
      </Panel>
      <Panel quiet>
        <span className="tag"><em>//</em> Pick'em leaderboard</span>
        {leaderboard.isPending ? <p className="sub">Loading leaderboard…</p> : null}
        {leaderboard.isError ? <p className="sub">Unable to load leaderboard.</p> : null}
        {leaderboard.data?.items.length === 0 ? <p className="sub">No settled predictions yet.</p> : null}
        {leaderboard.data?.items.map(row => <div className="spread" key={row.user.id}>
          <span>#{row.rank} {row.user.fullName}</span><span>{row.points} points · {row.correct}/{row.settled}</span>
        </div>)}
      </Panel>
    </div>
    <Panel quiet>
      <div className="spread"><span className="tag"><em>//</em> Tournament comments · {thread?.pagination.totalItems ?? 0}</span>
        {thread?.canModerate ? <button className="btn ghost" type="button" onClick={() => setFilter(!reported)}>{reported ? 'All comments' : 'Reported only'}</button> : null}
      </div>
      {comments.query.isPending ? <p className="sub">Loading comments…</p> : null}
      {comments.query.isError ? <Empty icon="warn" title="Unable to load comments" sub={messageOf(comments.query.error)} /> : null}
      {thread && entries.length === 0 ? <p className="sub">No comments here yet.</p> : null}
      {entries.map(item => <div className="notif" key={item.id}>
        <span className="avatar">{item.author.fullName.slice(0, 1)}</span>
        <span className="txt"><b>{item.author.fullName}</b> {thread?.canModerate ? <span className="tag">#{item.id}</span> : null} {item.isMine ? <Badge kind="neutral">Yours</Badge> : null}
          {thread?.canModerate && item.isReported ? <Badge kind="warn">Reported</Badge> : null}<br />{item.content}<br />
          <span className="tag">{new Date(item.createdAt).toLocaleString()}</span></span>
        {item.isMine ? <button className="btn ghost" type="button" disabled={busy} onClick={async () => {
          try { await comments.removeMine.mutateAsync(); setNotice('Your comment was removed.') } catch (error) { setNotice(messageOf(error)) }
        }}>Delete mine</button> : <>
          {me.data ? <button className="btn ghost" type="button" disabled={busy} onClick={async () => {
            try { await comments.report.mutateAsync(item.id); setNotice('Comment reported.') } catch (error) { setNotice(messageOf(error)) }
          }}>Report</button> : null}
          {thread?.canModerate ? <button className="btn ghost" type="button" onClick={() => {
            if (organizer) { setRemoving(item); setReason('') }
            else adminRemove.mutate(item.id)
          }}>Remove</button> : null}
        </>}
      </div>)}
      {removing ? <form className="vstack" onSubmit={async event => {
        event.preventDefault()
        try { await comments.moderate.mutateAsync({ commentId: removing.id, reason: reason.trim() }); setRemoving(null); setNotice('Comment removed.') }
        catch (error) { setNotice(messageOf(error)) }
      }}>
        <b>Remove {removing.author.fullName}'s comment</b>
        <Field label="Reason (required, 1–255 characters)" htmlFor="remove-reason"><textarea id="remove-reason" maxLength={255} value={reason} onChange={event => setReason(event.target.value)} /></Field>
        <span className="sub">The author will see this reason in their notification.</span>
        <span className="hstack"><button className="btn" type="button" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn primary" type="submit" disabled={!reason.trim() || busy}>Remove comment</button></span>
      </form> : null}
      {thread?.canComment && !reported ? <form className="vstack" onSubmit={async event => {
        event.preventDefault()
        try { await comments.post.mutateAsync(commentText.trim()); setCommentText(''); setNotice('Comment saved.') }
        catch (error) { setNotice(messageOf(error)) }
      }}>
        <Field label={thread.mine ? 'Edit your comment' : 'Write a comment'} htmlFor="live-comment"><textarea id="live-comment" maxLength={500} value={commentText} onChange={event => setCommentText(event.target.value)} /></Field>
        {thread.mine ? <button className="btn ghost" type="button" onClick={() => setCommentText(thread.mine!.content)}>Load my comment to edit</button> : null}
        <button className="btn primary" type="submit" disabled={!commentText.trim() || busy}>{thread.mine ? 'Update comment' : 'Post comment'}</button>
      </form> : !me.data ? <p className="sub">Sign in to comment.</p> : null}
      {thread && thread.pagination.totalPages > 1 ? <div className="hstack">
        <button className="btn" disabled={page <= 1} onClick={() => setFilter(reported, page - 1)}>Previous</button>
        <span>Page {page} of {thread.pagination.totalPages}</span>
        <button className="btn" disabled={page >= thread.pagination.totalPages} onClick={() => setFilter(reported, page + 1)}>Next</button>
      </div> : null}
      {notice ? <p role="status" className="sub">{notice}</p> : null}
      {adminRemove.isError || adminRestore.isError ? <p role="alert" className="sub">{messageOf(adminRemove.error ?? adminRestore.error)}</p> : null}
      {lastRemovedId && !organizer ? <button className="btn ghost" type="button" disabled={adminRestore.isPending}
        onClick={() => adminRestore.mutate(lastRemovedId)}>Restore removed item #{lastRemovedId}</button> : null}
    </Panel>
  </>
}
