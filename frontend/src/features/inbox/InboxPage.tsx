import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, Empty, Panel } from '../../components/kit/primitives'
import { useMe } from '../../hooks/useAuth'
import { useMarkNotificationRead, useMarkNotificationsRead, useNotifications } from '../../hooks/useNotifications'
import { USE_MOCK } from '../../api/client'
import type { NotificationDto } from '../../types/notification.dto'
import { Icon } from '../../components/kit/Icon'
import type { IconName } from '../../components/kit/Icon'
import { BackendInbox } from './BackendInbox'
import '../search/search-inbox-workspace.css'

function age(at: string): string {
  const seconds = Math.round((Date.now() - new Date(at).getTime()) / 1000)
  if (!Number.isFinite(seconds)) return ''
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function notificationHref(n: NotificationDto): string | null {
  if (USE_MOCK) return n.href ?? null
  const id = n.relatedEntityId
  if (!Number.isSafeInteger(id) || !id || id < 1) return null
  // BE_KN Notice C: pending invitations grant private-tournament read access.
  // Open the tournament so referees can inspect eligibility before accepting.
  if (n.relatedEntityType === 'tournament') {
    return n.type === 'comment_reported'
      ? `/t/${id}/community?reported=true`
      : (n.type === 'comment_removed' || n.type === 'comment_rewritten_after_removal') ? `/t/${id}/community` : n.type === 'tournament_announcement' ? `/t/${id}/announcements` : `/t/${id}`
  }
  if (n.relatedEntityType === 'match') return `/m/${id}`
  if (n.relatedEntityType === 'team') return `/team/${id}`
  return null
}

function notificationIcon(type?: string): IconName {
  if (type === 'comment_removed' || type === 'comment_reported' || type === 'comment_rewritten_after_removal') return 'shield'
  if (type === 'bracket_created' || type === 'bracket_redrawn') return 'trophy'
  if (type === 'pickem_cancelled') return 'star'
  if (type === 'match_walkover') return 'match'
  if (type === 'referee_removed') return 'warn'
  return 'bell'
}

function notificationCategory(n: NotificationDto): string {
  if (n.type === 'tournament_announcement') return 'Announcements'
  if (n.type?.startsWith('comment_')) return 'Comments and moderation'
  if (n.type?.startsWith('referee_')) return 'Referee updates'
  if (n.type?.includes('application') || n.type?.includes('registration')) return 'Squad entries'
  if (n.relatedEntityType === 'match' || n.type?.startsWith('pickem_')) return 'Matches and results'
  if (n.relatedEntityType === 'team') return 'Team updates'
  if (n.relatedEntityType === 'tournament') return 'Tournament updates'
  return 'Other notifications'
}

export function InboxPage() {
  const navigate = useNavigate()
  const { data: currentUser, isLoading: userLoading } = useMe()
  const userId = currentUser?.id
  const [page, setPage] = useState(1)
  const [unread, setUnread] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'crit'; text: string } | null>(null)
  const { data, isLoading, isError, error, refetch } = useNotifications(userId, true, page, unread)
  const markRead = useMarkNotificationRead(userId)
  const markAllRead = useMarkNotificationsRead(userId)

  if (userLoading) return <div className="inbox-page"><h1 className="disp">Inbox</h1><Panel quiet><span className="sub" role="status">Loading inbox…</span></Panel></div>
  if (!currentUser) return <div className="inbox-page"><h1 className="disp">Inbox</h1><Empty icon="bell" title="Sign in to open Inbox" /></div>

  const denied = isError && typeof error === 'object' && error !== null && 'status' in error && (error.status === 401 || error.status === 403)
  const list = !denied && data && Array.isArray(data.items) ? data.items : null
  const count = data?.unreadCount ?? list?.filter(n => !(n.isRead ?? n.read)).length ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1
  const groups = new Map<string, NotificationDto[]>()
  for (const item of list ?? []) {
    const category = notificationCategory(item)
    groups.set(category, [...(groups.get(category) ?? []), item])
  }

  return <div className="inbox-page">
    <div className="spread">
      <h1 className="disp">Inbox {count > 0 && !denied ? `· ${count} unread` : ''}</h1>
      <span className="hstack">
        {!USE_MOCK ? <button className="btn ghost" type="button" aria-pressed={unread} onClick={() => { setPage(1); setUnread(!unread) }}>
          {unread ? 'Show all' : 'Unread only'}
        </button> : null}
        {count > 0 && !denied ? <button className="btn" type="button" disabled={markAllRead.isPending || markRead.isPending}
          onClick={() => { setNotice(null); markAllRead.mutate(undefined, {
            onSuccess: () => setNotice({ kind: 'ok', text: 'All notifications marked read.' }),
            onError: () => setNotice({ kind: 'crit', text: 'Could not mark all notifications read. Try again.' }),
          }) }}>Mark all read</button> : null}
      </span>
    </div>
    {notice ? <div role={notice.kind === 'crit' ? 'alert' : 'status'}><Banner kind={notice.kind}>{notice.text}</Banner></div> : null}
    {markRead.isPending || markAllRead.isPending ? <p className="sub" role="status">Marking notifications read…</p> : null}
    {isLoading ? <Panel quiet><span className="sub" role="status">Loading notifications…</span></Panel> : null}
    {isError || (!isLoading && !list) ? <Panel quiet><div role="alert"><b>Unable to load inbox</b><p className="sub">{error instanceof Error ? error.message : 'Notifications are unavailable. Try again.'}</p></div>
      <button className="btn ghost" type="button" onClick={() => void refetch()}>Retry notifications</button></Panel> : null}
    {list?.length ? <div className="inbox-notifications">{Array.from(groups, ([category, items]) => <section className="panel quiet" key={category} aria-label={category}><h2>{category} <span className="tag">{items.length} on this page</span></h2>{items.map(n => {
      const href = notificationHref(n)
      const isRead = n.isRead ?? n.read ?? false
      const label = n.title ?? n.message ?? 'Notification'
      return <div className="notif" key={n.id}>
        <span className={`dot ${isRead ? 'read' : ''}`} aria-hidden="true" />
        <Icon name={notificationIcon(n.type)} size={17} />
        <span className="txt"><b>{n.title ?? 'Notification'}</b><span className="inbox-message">{n.message}</span>
          <span className="tag">{isRead ? 'Read' : 'Unread'} · <time dateTime={n.createdAt} title={n.createdAt}>{age(n.createdAt)}</time></span></span>
        <div className="inbox-row-actions">
        {!isRead ? <button className="btn ghost" type="button" aria-label={`Mark read: ${label}`} disabled={markRead.isPending || markAllRead.isPending}
          onClick={() => { setNotice(null); markRead.mutate(n.id, {
            onSuccess: () => setNotice({ kind: 'ok', text: `Marked read: ${label}` }),
            onError: () => setNotice({ kind: 'crit', text: `Could not mark read: ${label}. Try again.` }),
          }) }}>Mark read</button> : null}
        {href ? <button className="btn ghost" type="button" aria-label={`Open: ${label}`} onClick={() => {
          if (!isRead) markRead.mutate(n.id)
          navigate(href)
        }}>Open</button> : null}
        </div>
      </div>
    })}</section>)}</div> : null}
    {!isLoading && !isError && list?.length === 0 ? <Empty icon="bell" title={unread ? 'No unread notifications' : 'Nothing here yet'} sub="Approvals, results and announcements land here." /> : null}
    {!USE_MOCK && !denied && totalPages > 1 ? <div className="hstack">
      <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span className="tag">Page {page} of {totalPages}</span>
      <button className="btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
    </div> : null}
    {!USE_MOCK ? <BackendInbox /> : null}
  </div>
}
