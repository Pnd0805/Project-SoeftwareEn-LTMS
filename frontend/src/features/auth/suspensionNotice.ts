import { ApiError } from '../../api/client'
import { fmtDateTime } from '../../shared/dateFormat'

const DAY = 86_400_000

/**
 * ข้อความ 403 ACCOUNT_SUSPENDED พร้อมเวลาที่เหลือ
 * `suspendedUntil` เป็น null แปลว่าระงับถาวร · ไม่มี key นี้เลยแปลว่าไม่รู้ จึงไม่เดาว่าถาวร
 */
export function suspensionNotice(error: ApiError, now = Date.now()): string {
  if (!('suspendedUntil' in error.extra)) return error.message
  const until = error.extra.suspendedUntil
  if (until === null) return `${error.message} (ระงับถาวร)`
  const ends = typeof until === 'string' ? Date.parse(until) : NaN
  if (!Number.isFinite(ends)) return error.message
  const days = Math.max(1, Math.ceil((ends - now) / DAY))
  return `${error.message} (เหลืออีก ${days} วัน · สิ้นสุด ${fmtDateTime(until as string)})`
}
