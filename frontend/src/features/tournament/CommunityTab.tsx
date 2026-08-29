/**
 * src/features/tournament/CommunityTab.tsx
 *
 * Feedback is a review of how a Tournament was run: the rating is public in
 * aggregate, the note is read only by the Organizer. One per person, replaced
 * rather than stacked when sent again. Beside it, the match threads.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Field, Panel, TableWrap } from '../../components/kit/primitives'
import { TeamLink } from '../../components/kit/chips'
import { sendFeedback, useLtms } from '../../shared/store'
import { commentsOf, matchesOf, me } from '../../shared/selectors'
import { matchTag } from '../../shared/rules'
import type { State, Tournament } from '../../shared/types'

export function feedbackOf(s: State, trId: string) {
  const rows = s.feedback.filter(f => f.tour === trId)
  const count = rows.length
  const avg = count ? Math.round((rows.reduce((n, r) => n + r.rating, 0) / count) * 10) / 10 : 0
  return { rows, count, avg }
}

export function CommunityTab({ t, org }: { t: Tournament; org: boolean }) {
  const s = useLtms()
  const u = me(s)
  const navigate = useNavigate()
  const f = feedbackOf(s, t.id)
  const mine = u ? f.rows.find(x => x.by === u.id) : null
  const [rating, setRating] = useState(mine?.rating ?? 5)
  const [text, setText] = useState(mine?.text ?? '')

  const talked = matchesOf(s, t.id)
    .map(m => ({ m, n: commentsOf(s, m.id).length }))
    .filter(x => x.n)
    .sort((a, b) => b.n - a.n)

  return (
    <>
      <div className="grid2">
        <Panel quiet>
          <div className="spread">
            <span className="tag"><em>//</em> How it was run</span>
            {f.count
              ? <Badge kind={f.avg >= 4 ? 'ok' : f.avg >= 3 ? 'warn' : 'crit'}>{f.avg} out of 5</Badge>
              : <Badge kind="neutral">No ratings yet</Badge>}
          </div>
          <div className="statline">
            <div><span className="tag">Average</span><span className="v">{f.count ? f.avg : '—'}</span></div>
            <div><span className="tag">Ratings</span><span className="v">{f.count}</span></div>
          </div>
        </Panel>

        <Panel quiet>
          <span className="tag"><em>//</em> {org ? 'Your tournament' : mine ? 'Your feedback' : 'Tell the organizer'}</span>
          {org || !u ? (
            <div className="sub">
              {org
                ? 'The notes below the rating are written to you and nobody else — read them on the Manage tab.'
                : 'Sign in to rate how this tournament was run.'}
            </div>
          ) : (
            <>
              <Field label="Rating — 1 to 5" htmlFor="fb-rating">
                <select id="fb-rating" value={rating} onChange={e => setRating(Number(e.target.value))}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} out of 5</option>)}
                </select>
              </Field>
              <Field label="What would you change?" htmlFor="fb-text">
                <textarea id="fb-text" rows={3} maxLength={600} value={text}
                  onChange={e => setText(e.target.value)} placeholder="Only the organizer reads this." />
              </Field>
              <button className="btn primary" type="button" style={{ alignSelf: 'flex-start' }}
                onClick={() => sendFeedback(t.id, u.id, rating, text)}>
                {mine ? 'Update my feedback' : 'Send to the organizer'}
              </button>
            </>
          )}
        </Panel>
      </div>

      <Panel quiet>
        <span className="tag"><em>//</em> Match threads · {talked.length}</span>
        {talked.length ? (
          <TableWrap>
            <table>
              <thead><tr><th>Match</th><th>Round</th><th>Comments</th><th /></tr></thead>
              <tbody>
                {talked.map(({ m, n }) => (
                  <tr key={m.id}>
                    <td>
                      <span className="hstack" style={{ gap: 7 }}>
                        <TeamLink id={m.a} /><span className="tag">vs</span><TeamLink id={m.b} />
                      </span>
                    </td>
                    <td className="tag">{matchTag(s, m)}</td>
                    <td className="num">{n}</td>
                    <td>
                      <button className="btn ghost" type="button" onClick={() => navigate(`/m/${m.id}/community`)}>
                        Open the thread
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : <div className="sub">Nothing said yet. Results speak first, but not last.</div>}
      </Panel>
    </>
  )
}
