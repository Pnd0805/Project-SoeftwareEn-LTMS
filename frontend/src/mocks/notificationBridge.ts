/**
 * src/mocks/notificationBridge.ts — การแจ้งเตือนจริงจาก store
 *
 * ── ปัญหาที่ไฟล์นี้แก้ ─────────────────────────────────────────────────────
 * `notification.mock.ts` เป็นรายการตายตัว 6 แถวที่ฮาร์ดโค้ด href ไว้เป็น `/t/2`,
 * `/t/3`, `/m/1` — id พวกนั้นไม่มีอยู่จริงในระบบ กดแล้วไปเจอหน้าว่าง
 *
 * และสำคัญกว่านั้น: prototype สร้างการแจ้งเตือนเองอยู่แล้วทุกครั้งที่มีอะไรเกิดขึ้น
 * (เชิญเข้าทีม แต่งตั้งกรรมการ อนุมัติคำร้อง ขอถอนตัว) พร้อม href ที่ถูกต้อง
 * แต่ inbox ไม่เคยแสดงมันเลย — ทำอะไรก็ไม่มีอะไรเด้ง
 *
 * ที่นี่จึงอ่านจาก `state.notifications` ตรงๆ และ mark read เขียนกลับที่เดิม
 * ตายพร้อมชั้น mock ตอน `VITE_USE_MOCK=false`
 */
import { getState, markAllRead, markRead } from '../shared/store'
import { me } from '../shared/selectors'
import { numOf } from './storeBridge'
import type { NotificationDto } from '../types/notification.dto'

/**
 * id ของการแจ้งเตือนเป็น string ('n-12') ฝั่ง DTO ต้องการตัวเลข ใช้ `numOf`
 * ชุดเดียวกับทั้งแอป แล้วย้อนกลับตอน mark read
 */
/** คืน null เมื่อระบุตัวผู้ใช้ไม่ได้เลย · คืน [] เมื่อรู้ว่าใครแต่ยังไม่มีการแจ้งเตือน */
export function storeNotifications(userId: number): NotificationDto[] | null {
  const s = getState()
  /**
   * บัญชีเดโมห้าใบใน `user.mock.ts` ใช้ id 1..5 ซึ่งไม่ใช่ชุดเดียวกับ `numOf`
   * หาไม่เจอด้วยตัวเลขจึงตกมาใช้ session ของ prototype แทน — inbox ถามหา
   * การแจ้งเตือนของ "คนที่ล็อกอินอยู่" เสมอ ตัวนี้จึงตรงเป้าเหมือนกัน
   */
  const owner = s.users.find(u => numOf(u.id) === userId) ?? me(s)
  if (!owner) return null
  return s.notifications
    .filter(n => n.to === owner.id)
    .map(n => ({
      id: numOf(n.id),
      userId,
      message: n.text,
      href: n.href || null,
      read: n.read,
      createdAt: new Date(n.at).toISOString(),
    }))
}

/** คืน true เมื่อเจอและทำเครื่องหมายแล้ว */
export function markStoreNotificationRead(notificationId: number): boolean {
  const n = getState().notifications.find(x => numOf(x.id) === notificationId)
  if (!n) return false
  markRead(n.id)
  return true
}

export function markStoreNotificationsRead(userId: number): boolean {
  const s = getState()
  const owner = s.users.find(u => numOf(u.id) === userId) ?? me(s)
  if (!owner) return false
  markAllRead(owner.id)
  return true
}
