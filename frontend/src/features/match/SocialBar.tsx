/**
 * src/features/match/SocialBar.tsx
 *
 * Pick'em and the conversation are places to spend time, not steps in the match.
 * Left on the page they push the result trail — the thing the match is for —
 * below the fold. So the page carries where each stands and a way in; the doing
 * happens over the top, and closing it puts the score back in front of you.
 */
import { useState } from 'react'
import { Badge, Field, Panel } from '../../components/kit/primitives'
import { Modal } from '../../components/kit/Modal'
import { placePick, useLtms } from '../../shared/store'
import { isOrg, me, officiates, team, tour } from '../../shared/selectors'
import { fmtDate, matchStage, winnerOf } from '../../shared/rules'
import type { Match } from '../../shared/types'
import { useComments } from '../../hooks/useUser'

/** Public to read, signed-in to write, and the organizer can take a post down. */
function CommentBlock({ m, onClose }: { m: Match; onClose: () => void }) {
  const s = useLtms()
  const u = me(s)
  const org = isOrg(s, tour(s, m.tour))
  const comments = useComments(m.id)
  const rows = comments.data?.items ?? []
  const [text, setText] = useState('')

  return (
    <>
      <div className="spread">
        <span className="tag"><em>//</em> Community · {rows.length} comment{rows.length === 1 ? '' : 's'}</span>
        {org ? <Badge kind="neutral">You moderate this</Badge> : null}
      </div>
      {rows.length ? (
        <div className="vstack" style={{ gap: 0 }}>
          {rows.map(c => {
            const canRemove = u && (c.userId === u.id || org)
            return (
              <div className="notif" style={{ alignItems: 'flex-start' }} key={c.id}>
                <span className="avatar">{c.userName.slice(0, 1)}</span>
                <span className="txt">
                  <b>{c.userName}</b>
                  <span className="tag" style={{ marginLeft: 8 }}>{fmtDate(new Date(c.createdAt).getTime())}</span>
                  <br />{c.text}
                </span>
                {canRemove
                  ? <button className="btn ghost" type="button" onClick={() => comments.remove.mutate(c.id)}
                    disabled={comments.remove.isPending}>Remove</button>
                  : null}
              </div>
            )
          })}
        </div>
      ) : <div className="sub">Nothing said yet. Keep it about the match.</div>}

      {u ? (
        <>
          <Field label="Add a comment" htmlFor={`cm-${m.id}`}>
            <textarea id={`cm-${m.id}`} rows={2} maxLength={500} value={text}
              onChange={e => setText(e.target.value)} placeholder="Keep it about the match." />
          </Field>
          <div className="hstack">
            <button className="btn ghost" type="button" onClick={onClose}>Done</button>
            <button className="btn primary" type="button"
              onClick={() => {
                if (!text.trim()) return
                comments.post.mutate({ userId: u.id, userName: u.name, text })
                setText('')
              }}
              disabled={comments.post.isPending}>Post</button>
          </div>
        </>
      ) : (
        <div className="hstack"><button className="btn ghost" type="button" onClick={onClose}>Done</button></div>
      )}
    </>
  )
}

/** A prediction before kick-off, one Token if it lands. */
function PickBlock({ m, onClose }: { m: Match; onClose: () => void }) {
  const s = useLtms()
  const u = me(s)
  if (!u || !m.a || !m.b) return null

  /* an official betting on their own competition is the conflict — the control is
     not merely refused on click, it is not offered, and the reason is stated */
  if (officiates(s, m.tour)) {
    return (
      <>
        <div className="spread"><span className="tag"><em>//</em> Pick'em</span><Badge kind="neutral">Closed to you</Badge></div>
        <div className="sub">You officiate this tournament, and whoever decides a result cannot hold a stake in it.</div>
        <div className="hstack"><button className="btn ghost" type="button" onClick={onClose}>Done</button></div>
      </>
    )
  }

  const mine = s.picks.find(p => p.match === m.id && p.by === u.id)
  const open = m.status === 'scheduled'
  const tally = s.picks.filter(p => p.match === m.id)
  const pct = (tid: string) => (tally.length ? Math.round(tally.filter(p => p.team === tid).length / tally.length * 100) : 0)
  const outcome = m.status === 'confirmed' && mine
    ? (mine.team === winnerOf(m) ? <Badge kind="ok">+1 — you called it</Badge> : <Badge kind="crit">0 — wrong call</Badge>)
    : m.status === 'disputed' && mine ? <Badge kind="neutral">Held until the dispute settles</Badge> : null

  return (
    <>
      <div className="spread">
        <span className="tag"><em>//</em> Pick'em — {open ? 'predict the winner' : 'predictions closed'}</span>
        {outcome}
      </div>
      <h3 style={{ margin: 0, fontSize: 20 }}>{matchStage(s, m)}</h3>
      <div className="grid2">
        {([m.a, m.b] as string[]).map(tid => (
          <button key={tid} type="button" disabled={!open}
            className={`btn ${mine?.team === tid ? 'primary' : ''}`}
            style={{ justifyContent: 'space-between', padding: '13px 16px' }}
            onClick={() => placePick(m.id, u.id, tid)}>
            <span>{team(s, tid)?.name}</span><span className="num">{pct(tid)}%</span>
          </button>
        ))}
      </div>
      <div className="hstack"><button className="btn ghost" type="button" onClick={onClose}>Done</button></div>
    </>
  )
}

export function SocialBar({ m }: { m: Match }) {
  const s = useLtms()
  const u = me(s)
  const [openPick, setOpenPick] = useState(false)
  const [openTalk, setOpenTalk] = useState(false)
  const comments = useComments(m.id)

  const rows = comments.data?.items.length ?? 0
  const tally = s.picks.filter(p => p.match === m.id).length
  const mine = u ? s.picks.find(p => p.match === m.id && p.by === u.id) : null
  const canPick = !!(u && m.a && m.b && !officiates(s, m.tour))
  const says = !u ? 'Sign in to call this one.'
    : !m.a || !m.b ? 'Both squads have to be known first.'
      : officiates(s, m.tour) ? 'Closed to you — you officiate this tournament, and whoever decides a result cannot have a stake in it.'
        : mine ? `You called ${team(s, mine.team)?.name}.`
          : m.status === 'scheduled' ? 'You have not called this one.'
            : 'Predictions closed before you got to it.'

  return (
    <>
      <Panel quiet>
        <div className="spread">
          <span className="tag"><em>//</em> Pick'em — {tally} prediction{tally === 1 ? '' : 's'}</span>
        </div>
        <div className="spread">
          <span className="sub">{says}</span>
          {canPick ? (
            <button className="btn" type="button" onClick={() => setOpenPick(true)}>
              {mine ? 'Change your call' : m.status === 'scheduled' ? 'Call it' : 'See the split'}
            </button>
          ) : null}
        </div>
      </Panel>

      <Panel quiet>
        <div className="spread">
          <span className="tag"><em>//</em> Community — {rows} comment{rows === 1 ? '' : 's'}</span>
          {isOrg(s, tour(s, m.tour)) ? <Badge kind="neutral">You moderate this</Badge> : null}
        </div>
        <div className="spread">
          <span className="sub">{rows ? 'Results speak first, but not last.' : 'Nothing said yet.'}</span>
          <button className="btn" type="button" onClick={() => setOpenTalk(true)}>
            {rows ? 'Read the conversation' : 'Start it'}
          </button>
        </div>
      </Panel>

      <Modal open={openPick} onClose={() => setOpenPick(false)}>
        <PickBlock m={m} onClose={() => setOpenPick(false)} />
      </Modal>
      <Modal open={openTalk} onClose={() => setOpenTalk(false)} title={matchStage(s, m)}>
        <CommentBlock m={m} onClose={() => setOpenTalk(false)} />
      </Modal>
    </>
  )
}
