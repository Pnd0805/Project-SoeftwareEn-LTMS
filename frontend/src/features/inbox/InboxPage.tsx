import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty, Panel } from '../../components/kit/primitives'
import { useMe } from '../../hooks/useAuth'
import { useMarkNotificationRead, useMarkNotificationsRead, useNotifications } from '../../hooks/useNotifications'
import { USE_MOCK } from '../../api/client'
import type { NotificationDto } from '../../types/notification.dto'
import { Icon } from '../../components/kit/Icon'
import type { IconName } from '../../components/kit/Icon'
import { BackendInbox } from './BackendInbox'

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
  /**
   * คำเชิญเป็นกรรมการมาถึงก่อนทัวร์นาเมนต์เปิดเผยแพร่เกือบทุกครั้ง — ลำดับที่ระบบ
   * บอกผู้จัดเองคือ "อนุมัติแล้วได้ฉบับร่าง → ตั้งกรรมการ → ค่อยเปิดเผยแพร่"
   * และ `getVisibleTournament` ให้ผ่านเฉพาะผู้ยื่นคำขอกับแอดมินที่ดูแลคณะนั้น
   * กรรมการที่เพิ่งถูกเชิญจึงได้ 404 แล้วหน้าจออ่านว่า "ทัวร์นาเมนต์นี้ไม่มีอยู่"
   * ทั้งที่จดหมายในมือเพิ่งบอกชื่อมันไป — ปุ่มที่พาไปทางตันแย่กว่าไม่มีปุ่ม
   * สิ่งที่กรรมการต้องทำจริงคือรับหรือปฏิเสธ ซึ่งอยู่ใน Referee appointments หน้าเดียวกันนี้
   * (ดู BACKEND-GAPS `FE-referee-cannot-read-invited-tournament`)
   */
  if (n.type === 'referee_invited') return null
  if (n.relatedEntityType === 'tournament') {
    return n.type === 'comment_reported'
      ? `/t/${id}/community?reported=true`
      : n.type === 'comment_removed' ? `/t/${id}/community` : `/t/${id}`
  }
  if (n.relatedEntityType === 'match') return `/m/${id}`
  if (n.relatedEntityType === 'team') return `/team/${id}`
  return null
}

function notificationIcon(type?: string): IconName {
  if (type === 'comment_removed' || type === 'comment_reported') return 'shield'
  if (type === 'bracket_created' || type === 'bracket_redrawn') return 'trophy'
  if (type === 'pickem_cancelled') return 'star'
  if (type === 'match_walkover') return 'match'
  if (type === 'referee_removed') return 'warn'
  return 'bell'
}

export function InboxPage() {
  const navigate = useNavigate()
  const { data: currentUser, isLoading: userLoading } = useMe()
  const userId = currentUser?.id
  const [page, setPage] = useState(1)
  const [unread, setUnread] = useState(false)
  const { data, isLoading, isError, error } = useNotifications(userId, true, page, unread)
  const markRead = useMarkNotificationRead(userId)
  const markAllRead = useMarkNotificationsRead(userId)

  if (userLoading) return <Panel quiet><span className="sub">Loading inbox…</span></Panel>
  if (!currentUser) return <Empty icon="bell" title="Sign in to open Inbox" />

  const list = data && Array.isArray(data.items) ? data.items : null
  const count = data?.unreadCount ?? list?.filter(n => !(n.isRead ?? n.read)).length ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1

  return <>
    <div className="spread">
      <h1 className="disp" style={{ fontSize: 32 }}>Inbox {count > 0 ? `· ${count} unread` : ''}</h1>
      <span className="hstack">
        {!USE_MOCK ? <button className="btn ghost" type="button" onClick={() => { setPage(1); setUnread(!unread) }}>
          {unread ? 'Show all' : 'Unread only'}
        </button> : null}
        {count > 0 ? <button className="btn" type="button" disabled={markAllRead.isPending}
          onClick={() => markAllRead.mutate()}>Mark all read</button> : null}
      </span>
    </div>
    {isLoading ? <Panel quiet><span className="sub">Loading notifications…</span></Panel> : null}
    {isError || (!isLoading && !list) ? <Empty icon="warn" title="Unable to load inbox"
      sub={error instanceof Error ? error.message : 'Please try again later.'} /> : null}
    {markRead.isError || markAllRead.isError ? <Panel quiet><span className="sub">Could not mark notifications read. Try again.</span></Panel> : null}
    {list?.length ? <div className="panel quiet">{list.map(n => {
      const href = notificationHref(n)
      const isRead = n.isRead ?? n.read ?? false
      return <div className="notif" key={n.id}>
        <span className={`dot ${isRead ? 'read' : ''}`} />
        <Icon name={notificationIcon(n.type)} size={17} />
        <span className="txt"><b>{n.title ?? 'Notification'}</b><br />{n.message}<br />
          <span className="tag">{age(n.createdAt)}</span></span>
        {!isRead ? <button className="btn ghost" type="button" disabled={markRead.isPending}
          onClick={() => markRead.mutate(n.id)}>Mark read</button> : null}
        {href ? <button className="btn ghost" type="button" onClick={() => {
          if (!isRead) markRead.mutate(n.id)
          navigate(href)
        }}>Open</button> : null}
      </div>
    })}</div> : null}
    {list?.length === 0 ? <Empty icon="bell" title="Nothing here yet" sub="Approvals, results and announcements land here." /> : null}
    {!USE_MOCK && totalPages > 1 ? <div className="hstack">
      <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span className="tag">Page {page} of {totalPages}</span>
      <button className="btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
    </div> : null}
    {!USE_MOCK ? <BackendInbox /> : null}
  </>
}
