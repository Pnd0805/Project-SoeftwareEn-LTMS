import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Panel } from '../../../components/kit/primitives'
import { reportFeedback } from '../../../api/liveEngagement'
import { useReviews } from '../../../hooks/useLiveEngagement'

export function LiveFeedbackPanel({ tournamentId }: { tournamentId: number }) {
  const reviews = useReviews(tournamentId)
  const qc = useQueryClient()
  const [notice, setNotice] = useState('')
  const report = useMutation({ mutationFn: reportFeedback,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liveReviews', tournamentId] }) })
  const data = reviews.query.data
  return <Panel quiet>
    <div className="spread"><span className="tag"><em>//</em> Reviews from participants</span>
      {data ? <Badge kind="neutral">{data.summary.average ?? '—'} / 5 · {data.summary.count}</Badge> : null}</div>
    <p className="sub">Review text is private to organizers. Author names are withheld.</p>
    {reviews.query.isPending ? <p className="sub">Loading reviews…</p> : null}
    {reviews.query.isError ? <p className="sub">Unable to load reviews.</p> : null}
    {data?.items?.length === 0 ? <p className="sub">No reviews yet.</p> : null}
    {data?.items?.map(item => <div className="notif" key={item.id}>
      <span className="txt"><b>{item.rating}/5</b> {item.isReported ? <Badge kind="warn">Reported</Badge> : null}<br />
        {item.content || 'No written review'}<br /><span className="tag">{new Date(item.createdAt).toLocaleString()}</span></span>
      {!item.isReported ? <button className="btn ghost" type="button" disabled={report.isPending}
        onClick={async () => { try { await report.mutateAsync(item.id); setNotice('Review reported.') }
          catch (error) { setNotice(error instanceof Error ? error.message : 'Could not report review.') } }}>Report</button> : null}
    </div>)}
    {data && data.items === null ? <p className="sub">Review details are unavailable for this account.</p> : null}
    {notice ? <p role="status" className="sub">{notice}</p> : null}
  </Panel>
}
