// คำตอบที่ปฏิเสธสิทธิ์ต้องไม่แสดงข้อมูลส่วนตัวจาก cache ส่วน error ชั่วคราวยังเก็บงานไว้ได้
export const adminReadBlocked = (query: { isError?: boolean; error?: unknown }) => query.isError
  && [401, 403, 404, 501].includes((query.error as { status?: number } | null)?.status ?? 0)

export const adminFieldLabel = (key: string) => {
  const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}
export const adminChangeValue = (value: unknown): string => {
  if (value == null) return 'Not set'
  if (Array.isArray(value)) return value.length ? value.map(adminChangeValue).join('; ') : 'None'
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${adminFieldLabel(key)}: ${adminChangeValue(item)}`).join(' · ') || 'None'
  return String(value)
}
