import { Avatar } from '../../components/kit/Avatar'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Empty, Field, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Modal } from '../../components/kit/Modal'
import { ApiError } from '../../api/client'
import { removeFeedbackByAdmin, restoreFeedbackByAdmin } from '../../api/liveEngagement'
import { useMe } from '../../hooks/useAuth'
import { useCommentsLive, usePickemLeaderboard, useReviews } from '../../hooks/useLiveEngagement'
import type { TournamentComment } from '../../types/liveEngagement.dto'
import './feedback-moderation.css'

type FeedbackTarget = { id: number; tournamentId: number; kind: 'comment' | 'review'; author: string | null; content: string | null; rating?: number }

const messageOf = (error: unknown) => error instanceof ApiError ? error.message : 'Request failed. Please try again.'

const REPORT_REASONS = [
  { id: 'harassment', label: 'คำพูดรุนแรงหรือไม่เหมาะสม (Harassment / Hate speech)' },
  { id: 'spam', label: 'สแปมหรือโฆษณา (Spam / Commercial)' },
  { id: 'misinformation', label: 'ข้อมูลเท็จหรือหลอกลวง (Misinformation)' },
  { id: 'inappropriate', label: 'เนื้อหาก่อกวนหรือไม่พึงประสงค์ (Inappropriate content)' },
  { id: 'other', label: 'อื่นๆ (Other - โปรดระบุเหตุผล)' },
]

export function LiveCommunityTab({ tournamentId, organizer }: { tournamentId: number; organizer: boolean }) {
  const me = useMe()
  const qc = useQueryClient()
  const [lastRemoved, setLastRemoved] = useState<FeedbackTarget | null>(null)
  const [adminConfirmation, setAdminConfirmation] = useState<{ target: FeedbackTarget; action: 'remove' | 'restore' } | null>(null)
  const refreshFeedback = (id: number) => {
    void qc.invalidateQueries({ queryKey: ['liveComments', id] }); void qc.invalidateQueries({ queryKey: ['liveReviews', id] })
  }
  const adminRemove = useMutation({ mutationFn: ({ target, reason }: { target: FeedbackTarget; reason: string }) => removeFeedbackByAdmin(target.id, reason.trim() || undefined), onSuccess: (_, { target }) => {
    setLastRemoved(target); setAdminConfirmation(null); setNotice(`Feedback #${target.id} removed.`); refreshFeedback(target.tournamentId)
  } })
  const adminRestore = useMutation({ mutationFn: (target: FeedbackTarget) => restoreFeedbackByAdmin(target.id), onSuccess: (_, target) => {
    setLastRemoved(null); setAdminConfirmation(null); setNotice(`Feedback #${target.id} restored.`); refreshFeedback(target.tournamentId)
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
  const [reportingComment, setReportingComment] = useState<TournamentComment | null>(null)
  const [reportReasonCategory, setReportReasonCategory] = useState<string>('harassment')
  const [reportOtherDetail, setReportOtherDetail] = useState<string>('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')

  const review = reviews.query.data
  const thread = comments.query.data
  const entries = thread?.mine && !reported
    ? [thread.mine, ...thread.items.filter(item => !item.isMine)]
    : thread?.items ?? []
  const busy = comments.post.isPending || comments.removeMine.isPending || comments.moderate.isPending || comments.report.isPending || comments.dismiss.isPending
  const adminBusy = adminRemove.isPending || adminRestore.isPending
  const canModerateTarget = (target: FeedbackTarget) => !organizer && !!me.data && target.tournamentId === tournamentId &&
    (target.kind === 'comment' ? thread?.canModerate === true : review?.items != null)
  const confirmAdmin = (target: FeedbackTarget, action: 'remove' | 'restore') => {
    if (!canModerateTarget(target) || adminBusy) return
    adminRemove.reset(); adminRestore.reset(); setNotice(''); setReason(''); setAdminConfirmation({ target, action })
  }

  const setFilter = (nextReported: boolean, nextPage = 1) => {
    const next = new URLSearchParams()
    if (nextReported) next.set('reported', 'true')
    if (nextPage > 1) next.set('page', String(nextPage))
    setParams(next)
  }

  return <>
    <div className="tour-community-pair">
      <section role="region" aria-label="Tournament reviews" tabIndex={0}><Panel quiet>
        <div className="spread"><h2 className="journey-heading">Tournament reviews</h2>
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
            <button className="btn ghost" type="button" disabled={adminBusy || !me.data} onClick={() => confirmAdmin({ id: item.id, tournamentId, kind: 'review', author: item.author?.fullName ?? null, content: item.content, rating: item.rating }, 'remove')}>Remove</button>
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
      </Panel></section>
      <section role="region" aria-label="Prediction leaderboard" tabIndex={0}><Panel quiet>
        <h2 className="journey-heading">Pick'em leaderboard</h2>
        {leaderboard.isPending ? <p className="sub">Loading leaderboard…</p> : null}
        {leaderboard.isError ? <p className="sub">Unable to load leaderboard.</p> : null}
        {leaderboard.data?.items.length === 0 ? <p className="sub">No settled predictions yet.</p> : null}
        {leaderboard.data?.items.map(row => <div className="spread" key={row.user.id}>
          <span>#{row.rank} {row.user.fullName}</span><span>{row.points} points · {row.correct}/{row.settled}</span>
        </div>)}
      </Panel></section>
    </div>
    <Panel quiet>
      <div className="spread"><h2 className="journey-heading">Tournament comments · {thread?.pagination.totalItems ?? 0}</h2>
        {thread?.canModerate ? <button className="btn ghost" type="button" onClick={() => setFilter(!reported)}>{reported ? 'All comments' : 'Reported only'}</button> : null}
      </div>
      {comments.query.isPending ? <p className="sub">Loading comments…</p> : null}
      {comments.query.isError ? <Empty icon="warn" title="Unable to load comments" sub={messageOf(comments.query.error)} /> : null}
      {thread && entries.length === 0 ? <p className="sub">No comments here yet.</p> : null}
      {entries.map(item => <div className="notif" key={item.id} style={{ alignItems: 'flex-start' }}>
        <Avatar name={item.author.fullName} avatarUrl={item.author.avatarUrl} />
        <div className="txt" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="hstack" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>{item.author.fullName}</b>
            {thread?.canModerate ? <span className="tag">#{item.id}</span> : null}
            {item.isMine ? <Badge kind="neutral">Yours</Badge> : null}
            <span className="tag">{new Date(item.createdAt).toLocaleString()}</span>
          </div>

          <div style={{ fontSize: 15, lineHeight: 1.5, wordBreak: 'break-word', margin: '2px 0' }}>
            {item.content}
            {thread?.canModerate && item.isReported ? <div style={{ marginTop: 6 }}><Badge kind="warn">Reported</Badge></div> : null}
            {thread?.canModerate && item.reportCleared ? <div className="sub">Reviewed and dismissed. A new report can be made after the author edits this comment.</div> : null}
          </div>

          <div className="hstack" style={{ gap: 8, marginTop: 4 }}>
            {thread?.canModerate && item.isReported ? <button className="btn ghost" type="button" disabled={busy}
              onClick={async () => {
                try { await comments.dismiss.mutateAsync(item.id); setNotice('Report dismissed. The comment remains visible.') }
                catch (error) { setNotice(messageOf(error)) }
              }}>{comments.dismiss.isPending ? 'Dismissing...' : 'Dismiss report'}</button> : null}
            {item.isMine ? (
              <button className="btn ghost" type="button" disabled={busy} style={{ padding: '2px 8px', fontSize: 13 }}
                onClick={async () => {
                  try { await comments.removeMine.mutateAsync(); setNotice('Your comment was removed.') }
                  catch (error) { setNotice(messageOf(error)) }
                }}>
                Delete mine
              </button>
            ) : (
              <>
                {me.data && !thread?.canModerate ? (
                  <button className="btn ghost" type="button" disabled={busy} style={{ padding: '2px 8px', fontSize: 13 }}
                    onClick={() => {
                      setReportingComment(item)
                      setReportReasonCategory('harassment')
                      setReportOtherDetail('')
                    }}>
                    <Icon name="warn" size={13} /> Report
                  </button>
                ) : null}
                {thread?.canModerate ? (
                  <button className="btn ghost" type="button" style={{ padding: '2px 8px', fontSize: 13 }}
                    onClick={() => {
                      if (organizer) { setRemoving(item); setReason('') }
                      else confirmAdmin({ id: item.id, tournamentId, kind: 'comment', author: item.author.fullName, content: item.content }, 'remove')
                    }}>
                    Remove
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>)}
      {reportingComment ? (
        <Modal
          open={!!reportingComment}
          onClose={() => {
            setReportingComment(null)
            setReportOtherDetail('')
          }}
          label="Confirm Report"
          title="รายงานความคิดเห็น (Report Comment)"
        >
          <div className="vstack" style={{ gap: 14 }}>
            <p className="sub">
              โปรดเลือกเหตุผลที่ต้องการรายงานความคิดเห็นนี้ เพื่อส่งให้ผู้จัดและแอดมินตรวจสอบ:
            </p>
            <div className="panel quiet" style={{ padding: '12px 14px', border: '1px solid var(--amber)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{reportingComment.author.fullName}</div>
              <div style={{ margin: '6px 0', fontSize: 15 }}>{reportingComment.content}</div>
              <span className="tag">{new Date(reportingComment.createdAt).toLocaleString()}</span>
            </div>

            <div className="field">
              <label>เหตุผลในการรายงาน (Reason)</label>
              <div className="vstack" style={{ gap: 8, marginTop: 4 }}>
                {REPORT_REASONS.map(r => (
                  <label
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 'var(--r)',
                      background: reportReasonCategory === r.id ? 'var(--panel-3)' : 'var(--void-2)',
                      border: `1px solid ${reportReasonCategory === r.id ? 'var(--teal)' : 'var(--line-hot)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.id}
                      checked={reportReasonCategory === r.id}
                      onChange={() => setReportReasonCategory(r.id)}
                      style={{ cursor: 'pointer', margin: 0 }}
                    />
                    <span style={{ fontSize: 14 }}>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {reportReasonCategory === 'other' ? (
              <Field label="ระบุเหตุผลเพิ่มเติม (จำเป็น)" htmlFor="report-other-detail">
                <textarea
                  id="report-other-detail"
                  rows={3}
                  maxLength={255}
                  placeholder="พิมพ์เหตุผลที่ต้องการรายงาน..."
                  value={reportOtherDetail}
                  onChange={e => setReportOtherDetail(e.target.value)}
                />
              </Field>
            ) : null}

            <div className="hstack" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setReportingComment(null)
                  setReportOtherDetail('')
                }}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={busy || (reportReasonCategory === 'other' && !reportOtherDetail.trim())}
                onClick={async () => {
                  try {
                    await comments.report.mutateAsync(reportingComment.id)
                    setNotice('รายงานความคิดเห็นเรียบร้อยแล้ว (Comment reported)')
                    setReportingComment(null)
                    setReportOtherDetail('')
                  } catch (error) {
                    setNotice(messageOf(error))
                  }
                }}
              >
                Confirm Report
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {removing ? <Modal open onClose={() => !busy && setRemoving(null)} title="Remove comment"><form className="vstack" onSubmit={async event => {
        event.preventDefault()
        if (busy || !reason.trim() || reason.trim().length > 255) return
        try { await comments.moderate.mutateAsync({ commentId: removing.id, reason: reason.trim() }); setRemoving(null); setNotice('Comment removed.') }
        catch (error) { setNotice(messageOf(error)) }
      }}>
        {comments.moderate.isError ? <p role="alert">{messageOf(comments.moderate.error)}</p> : null}
        <blockquote>{removing.content}</blockquote>
        <b>Remove {removing.author.fullName}'s comment</b>
        <Field label="Reason (required, 1–255 characters)" htmlFor="remove-reason"><textarea id="remove-reason" maxLength={255} value={reason} onChange={event => setReason(event.target.value)} /></Field>
        <span className="sub">The author will see this reason in their notification.</span>
        <span className="hstack"><button className="btn" type="button" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn primary" type="submit" disabled={!reason.trim() || busy}>Remove comment</button></span>
      </form></Modal> : null}
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
      {adminConfirmation && canModerateTarget(adminConfirmation.target) ? <Modal open title={adminConfirmation.action === 'remove' ? 'Remove feedback' : 'Restore feedback'} className="feedback-moderation-dialog"
        onClose={() => !adminBusy && setAdminConfirmation(null)}>
        <form className="vstack" onSubmit={event => {
          event.preventDefault()
          if (adminBusy || !canModerateTarget(adminConfirmation.target)) return
          if (adminConfirmation.action === 'remove') adminRemove.mutate({ target: adminConfirmation.target, reason })
          else adminRestore.mutate(adminConfirmation.target)
        }}>
          <div className="feedback-moderation-context" role="region" aria-label="Selected feedback" tabIndex={0}>
            <b>{adminConfirmation.target.kind === 'review' ? 'Review' : 'Comment'} #{adminConfirmation.target.id}</b>
            <Link to={`/t/${adminConfirmation.target.tournamentId}/community`}>Tournament #{adminConfirmation.target.tournamentId}</Link>
            <span>{adminConfirmation.target.author ?? 'Author unavailable'}</span>
            {adminConfirmation.target.rating !== undefined ? <span>{adminConfirmation.target.rating} / 5 rating</span> : null}
            <blockquote>{adminConfirmation.target.content ?? 'No written review attached.'}</blockquote>
          </div>
          <p className="sub">{adminConfirmation.action === 'remove' ? 'Removal excludes this item from public counts.' : 'Restoring makes this item available again and clears its report flag.'}</p>
          {adminConfirmation.action === 'remove' ? <Field label="Reason (optional)" htmlFor="admin-feedback-reason"><textarea id="admin-feedback-reason" disabled={adminBusy} maxLength={255} value={reason} onChange={event => setReason(event.target.value)} /></Field> : null}
          {adminRemove.isError || adminRestore.isError ? <p role="alert" className="sub">{(adminRemove.error ?? adminRestore.error) instanceof Error ? (adminRemove.error ?? adminRestore.error)?.message : 'Moderation failed. Try again.'}</p> : null}
          <div className="hstack">
            <button className="btn" type="button" disabled={adminBusy} onClick={() => setAdminConfirmation(null)}>Cancel</button>
            <button className={`btn ${adminConfirmation.action === 'remove' ? 'danger' : 'primary'}`} type="submit" disabled={adminBusy}>
              {adminBusy ? 'Saving…' : adminConfirmation.action === 'remove' ? 'Confirm removal' : 'Confirm restore'}
            </button>
          </div>
        </form>
      </Modal> : null}
      {lastRemoved && canModerateTarget(lastRemoved) ? <button className="btn ghost" type="button" disabled={adminBusy}
        onClick={() => confirmAdmin(lastRemoved, 'restore')}>Restore removed item #{lastRemoved.id}</button> : null}
    </Panel>
  </>
}
