/**
 * src/features/tournament/AnnouncementsTab.tsx
 *
 * An Announcement is written by the Organizer, published here and pushed to
 * every approved leader's inbox at once. Posting is a modal, not an inline form:
 * the compose box appears only when somebody means to write one.
 */
import { useState } from 'react'
import { Banner, Empty, Field, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Modal } from '../../components/kit/Modal'
import { postAnnouncement, useLtms } from '../../shared/store'
import { me, user } from '../../shared/selectors'
import { fmtDate } from '../../shared/rules'
import type { Tournament } from '../../shared/types'

export function AnnouncementsTab({ t, org }: { t: Tournament; org: boolean }) {
  const s = useLtms()
  const u = me(s)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const list = s.announcements.filter(a => a.tour === t.id).sort((a, b) => b.at - a.at)

  const post = () => {
    if (!u) return
    postAnnouncement(t.id, u.id, title, body)
    setTitle(''); setBody(''); setOpen(false)
  }

  return (
    <>
      {org ? (
        <div className="hstack" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" type="button" onClick={() => setOpen(true)}>
            <Icon name="bell" size={13} /> Post an announcement
          </button>
        </div>
      ) : null}

      {list.length ? list.map(a => (
        <Panel quiet key={a.id}>
          <div className="spread">
            <span className="tag"><em>//</em> {user(s, a.by)?.name ?? 'Organizer'} · {fmtDate(a.at)}</span>
          </div>
          <div className="disp" style={{ fontSize: 19 }}>{a.title}</div>
          <div style={{ fontSize: 15, lineHeight: 1.55 }}>{a.body}</div>
        </Panel>
      )) : <Empty icon="bell" title="Nothing announced yet" />}

      <Modal open={open} onClose={() => setOpen(false)} label="Post an announcement" title={t.name}>
        <Field label="Headline" htmlFor="an-title">
          <input id="an-title" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Saturday kick-offs move 30 minutes later" />
        </Field>
        <Field label="Message" htmlFor="an-body">
          <textarea id="an-body" rows={3} value={body} onChange={e => setBody(e.target.value)}
            placeholder="What changed, and what people should do about it." />
        </Field>
        <Banner kind="warn">
          This appears on the public page immediately and notifies every approved team leader.
          Announcements can't be unsent.
        </Banner>
        <div className="hstack">
          <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn primary" type="button" onClick={post}>Post</button>
        </div>
      </Modal>
    </>
  )
}
