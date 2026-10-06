const labels: Record<string, string> = {
  name: 'ชื่อทัวร์นาเมนต์',
  registrationStart: 'วันเปิดรับสมัคร',
  registrationEnd: 'วันปิดรับสมัคร',
  eventStartDate: 'วันเริ่มการแข่งขัน',
  eventEndDate: 'วันสิ้นสุดการแข่งขัน',
  minTeams: 'จำนวนทีมขั้นต่ำ',
  maxTeams: 'จำนวนทีมสูงสุด',
  genderRequirement: 'เงื่อนไขเพศ',
  minAge: 'อายุขั้นต่ำ',
  maxAge: 'อายุสูงสุด',
  eligibilityRules: 'คุณสมบัติผู้สมัคร',
}

const readableLabel = (key: string) => labels[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
const readableValue = (value: unknown): string => {
  if (value == null || value === '') return 'ไม่ระบุ'
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่'
  if (Array.isArray(value)) return value.length ? value.map(readableValue).join(' · ') : 'ไม่มี'
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${readableLabel(key)}: ${readableValue(item)}`).join(' · ')
  return String(value)
}

export function formatAmendmentChanges(changes: Record<string, unknown>, facultyName?: (id: number) => string) {
  return Object.entries(changes).map(([field, value]) => {
    let text = readableValue(value)
    if (['registrationStart', 'registrationEnd', 'eventStartDate', 'eventEndDate'].includes(field) && typeof value === 'string' && value) {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
      const date = new Date(dateOnly ? `${value}T00:00:00Z` : value)
      if (!Number.isNaN(date.getTime())) text = new Intl.DateTimeFormat('th-TH', {
        calendar: 'gregory', day: 'numeric', month: 'short', year: 'numeric',
        timeZone: dateOnly ? 'UTC' : 'Asia/Bangkok',
        ...(!dateOnly ? { hour: '2-digit', minute: '2-digit' } as const : {}),
      }).format(date)
    } else if (field === 'genderRequirement' && typeof value === 'string') {
      text = ({ any: 'ทุกเพศ', male: 'ชาย', female: 'หญิง' } as Record<string, string>)[value] ?? text
    } else if (field === 'minAge' || field === 'maxAge') {
      text = value == null ? 'ไม่จำกัด' : `${text} ปี`
    } else if (field === 'minTeams' || field === 'maxTeams') {
      text = value == null ? 'ไม่ระบุ' : `${text} ทีม`
    } else if (field === 'eligibilityRules' && Array.isArray(value)) {
      const faculties: string[] = []
      const years: string[] = []
      const other: string[] = []
      for (const rule of value) {
        if (typeof rule !== 'object' || rule == null) { other.push(readableValue(rule)); continue }
        const type = rule.type ?? rule.ruleType
        const id = rule.value ?? rule.ruleValue
        if (type === 'faculty' && typeof id === 'number') faculties.push(facultyName?.(id) ?? `คณะ #${id}`)
        else if (type === 'year') years.push(readableValue(id))
        else other.push(readableValue(rule))
      }
      text = [faculties.length ? faculties.join(' · ') : 'ทุกคณะ', years.length ? `ชั้นปี ${years.join(', ')}` : 'ทุกชั้นปี', ...other].join(' / ')
    }
    return { field, label: readableLabel(field), value: text }
  })
}
