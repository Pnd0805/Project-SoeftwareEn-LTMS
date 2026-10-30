import { fmtDateOnly, fmtDateTime } from '../../shared/dateFormat'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
const dayPattern = /^\d{4}-\d{2}-\d{2}$/
const localPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const bangkokParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function validDay(day: string) {
  return dayPattern.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
}

/** ค่าจากปฏิทินและข้อความที่กรอกเป็นเวลาไทยเสมอ ไม่อิง timezone ของเครื่อง */
export function parseScheduleDate(value: string, withTime: boolean): string | null {
  const source = value.trim()
  if (!source) return ''
  if (!withTime && validDay(source)) return source
  if (withTime && localPattern.test(source)) {
    const hour = Number(source.slice(11, 13)), minute = Number(source.slice(14, 16))
    return validDay(source.slice(0, 10)) && hour < 24 && minute < 60 ? `${source}:00+07:00` : null
  }
  if (withTime && instantPattern.test(source) && validDay(source.slice(0, 10))
    && Number(source.slice(11, 13)) < 24 && Number(source.slice(14, 16)) < 60 && !Number.isNaN(Date.parse(source))) return source
  const match = /^(\d{1,2})\s+([a-z]{3,4})\s+(\d{4})(?:,\s*(\d{1,2}):(\d{2})\s*(?:\(UTC\+7\))?)?$/i.exec(source)
  if (!match) return null
  const month = months.findIndex(name => name.toLowerCase() === match[2].toLowerCase() || name === 'Sept' && match[2].toLowerCase() === 'sep')
  if (month < 0 || withTime !== (match[4] !== undefined)) return null
  const day = `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`
  if (!validDay(day)) return null
  if (!withTime) return day
  if (Number(match[4]) > 23 || Number(match[5]) > 59) return null
  return `${day}T${match[4].padStart(2, '0')}:${match[5]}:00+07:00`
}

export function formatScheduleDate(value: string, withTime: boolean) {
  const parsed = parseScheduleDate(value, withTime)
  return parsed ? withTime ? fmtDateTime(parsed) : fmtDateOnly(parsed) : value
}

export function schedulePickerValue(value: string, withTime: boolean) {
  const parsed = parseScheduleDate(value, withTime)
  if (!parsed) return ''
  if (!withTime) return parsed
  const parts = Object.fromEntries(bangkokParts.formatToParts(new Date(parsed)).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
