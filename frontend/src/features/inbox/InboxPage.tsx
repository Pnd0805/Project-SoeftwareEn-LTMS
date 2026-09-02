function notificationAge(at: string): string {
  const seconds = Math.round((Date.now() - new Date(at).getTime()) / 1000)
  if (!Number.isFinite(seconds)) return ''
  if (seconds < 0) return `in ${Math.ceil(Math.abs(seconds) / 86400)}d`
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`
  return `${Math.floor(seconds / 2592000)}mo ago`
}
/**
 * src/features/inbox/InboxPage.tsx
 *
 * Notifications the system generated, plus Announcements an Organizer pushed.
 * Approvals, results and announcements land here.
 */
import { useNavigate } from 'react-router-dom'
import { Empty } from '../../components/kit/primitives'
import { useMe } from '../../hooks/useAuth'
import {
  useMarkNotificationRead,
  useMarkNotificationsRead,
  useNotifications,
} from '../../hooks/useNotifications'

export function InboxPage() {
  const navigate = useNavigate()
  const { data: currentUser, isLoading: userLoading } = useMe()
  const userId = currentUser?.id
  const { data, isLoading: notificationsLoading, isError } = useNotifications(userId)
  const markRead = useMarkNotificationRead(userId)
  const markAllRead = useMarkNotificationsRead(userId)
  if (userLoading || notificationsLoading || !currentUser) return null
  if (isError || !data) {
    return <Empty icon="bell" title="Unable to load inbox" sub="Please try again later." />
  }
  const list = data.items

  return (
    <>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 32 }}>Inbox</h1>
        {list.some(n => !n.read)
          ? <button className="btn" type="button" onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}>Mark all read</button>
          : null}
      </div>

      {list.length ? (
        <div className="panel quiet">
          {list.map(n => (
            <div className="notif" key={n.id}>
              <span className={`dot ${n.read ? 'read' : ''}`} />
                <span className="txt">{n.message}<br /><span className="tag">{notificationAge(n.createdAt)}</span></span>
              {n.href ? (
                <button className="btn ghost" type="button" onClick={() => { markRead.mutate(n.id); navigate(n.href!) }}
                  disabled={markRead.isPending}>
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
