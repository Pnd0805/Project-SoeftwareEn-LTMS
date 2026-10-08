/**
 * src/shared/dateFormat.ts — รูปแบบวันที่ของทั้งแอป มีที่เดียวคือที่นี่
 *
 *   มีเวลา      8 Sept 2026, 22:44 (UTC+7)
 *   ไม่มีเวลา   8 Sept 2026            (วันแข่งของทัวร์ · วันที่เข้าทีม — เวลาไม่มีความหมาย)
 *
 * ของเดิมแต่ละหน้าจัดรูปแบบเอง ~40 จุด: บางจุดตาม locale ของเบราว์เซอร์ (ขึ้น พ.ศ. 2569 บนเครื่องไทย)
 * บางจุดไม่มีปี บางจุดมีวินาที บางจุดลงท้าย GMT+7 — เวลาเตะเดียวกันจึงอ่านไม่เหมือนกันในสองหน้า
 *
 * ★ ตรึงโซนเป็นเวลาไทยเสมอ ไม่ตามเครื่องผู้ใช้ — กรรมการกับผู้เล่นต้องเห็นเวลานัดตรงกัน
 *   และท้ายข้อความบอกโซนไว้ให้ชัดว่าเวลานี้คือโซนไหน
 */
const TIME_ZONE = 'Asia/Bangkok'
const ZONE_LABEL = '(UTC+7)'
const DATE_PARTS = { day: 'numeric', month: 'short', year: 'numeric' } as const

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  ...DATE_PARTS, hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE,
})
const dateFormat = new Intl.DateTimeFormat('en-GB', { ...DATE_PARTS, timeZone: TIME_ZONE })
/* `YYYY-MM-DD` ล้วนคือ "วันในปฏิทิน" ไม่ใช่จุดเวลา — จัดรูปแบบใน UTC ไม่งั้นวันเลื่อนตามโซน */
const calendarDayFormat = new Intl.DateTimeFormat('en-GB', { ...DATE_PARTS, timeZone: 'UTC' })

export type DateInput = string | number | Date | null | undefined

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/
const isCalendarDay = (value: DateInput): value is string => typeof value === 'string' && CALENDAR_DAY.test(value)

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `8 Sept 2026, 22:44 (UTC+7)` */
export function fmtDateTime(value: DateInput, fallback = 'Not set'): string {
  const date = toDate(value)
  return date ? `${dateTimeFormat.format(date)} ${ZONE_LABEL}` : fallback
}

/** `8 Sept 2026` — สำหรับค่าที่เวลาของวันไม่มีความหมาย */
export function fmtDateOnly(value: DateInput, fallback = 'Not set'): string {
  if (isCalendarDay(value)) {
    const date = toDate(`${value}T00:00:00Z`)
    return date ? calendarDayFormat.format(date) : fallback
  }
  const date = toDate(value)
  return date ? dateFormat.format(date) : fallback
}

/** เลือกให้เอง: วันในปฏิทินล้วนไม่มีเวลาให้แสดง นอกนั้นแสดงเวลาด้วย */
export function fmtDate(value: DateInput, fallback = 'Not set'): string {
  return isCalendarDay(value) ? fmtDateOnly(value, fallback) : fmtDateTime(value, fallback)
}
