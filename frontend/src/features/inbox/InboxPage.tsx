/**
 * src/features/inbox/InboxPage.tsx
 *
 * Notifications the system generated, plus Announcements an Organizer pushed.
 * Approvals, results and announcements land here.
 */
import { useNavigate } from 'react-router-dom'
import { Empty, When } from '../../components/kit/primitives'
import { markAllRead, markRead, useLtms } from '../../shared/store'
import { me } from '../../shared/selectors'

export function InboxPage() {
  const s = useLtms()
  const navigate = useNavigate()
  const u = me(s)
  if (!u) return null
  const list = s.notifications.filter(n => n.to === u.id)

  return (
    <>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 32 }}>Inbox</h1>
        {list.some(n => !n.read)
          ? <button className="btn" type="button" onClick={() => markAllRead(u.id)}>Mark all read</button>
          : null}
      </div>

      {list.length ? (
        <div className="panel quiet">
          {list.map(n => (
            <div className="notif" key={n.id}>
              <span className={`dot ${n.read ? 'read' : ''}`} />
              <span className="txt">{n.text}<br /><span className="tag"><When at={n.at} /></span></span>
              {n.href ? (
                <button className="btn ghost" type="button" onClick={() => { markRead(n.id); navigate(n.href) }}>
                  Open
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="bell" title="Nothing here yet" sub="Approvals, results and announcements land here." />
      )}
    </>
  )
}
