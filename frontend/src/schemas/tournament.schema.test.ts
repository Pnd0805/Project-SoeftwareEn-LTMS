import { describe, expect, it } from 'vitest'
import { createTournamentSchema, registrationClosesByEventDay } from './tournament.schema'

const input = {
  name: 'Campus Cup', sportTypeId: 1, bracketFormat: 'single_elimination' as const,
  scopeType: 'faculty' as const, organizingFacultyId: 1, organizingDepartmentId: null,
  registrationStart: '2026-10-01T09:00', registrationEnd: '2026-10-05T17:00',
  eventStartDate: '2026-10-06', eventEndDate: '2026-10-07', maxTeams: 8, minTeams: 2,
  venue: 'Main Hall', genderRequirement: 'any' as const,
}

describe('tournament schedule validation', () => {
  // 30 ต.ค. 2569 — วันแข่งวันแรกต้องไม่ก่อนวันปิดรับสมัคร (วันเดียวกันได้) · เทียบวันที่ตามเวลาไทย เหมือน backend
  it('allows the first event day to be the registration closing day, measured in Thai time', () => {
    expect(registrationClosesByEventDay('2026-10-05T17:00:00+07:00', '2026-10-05')).toBe(true)
    expect(registrationClosesByEventDay('2026-10-05T17:00:00+07:00', '2026-10-06')).toBe(true)
    expect(registrationClosesByEventDay('2026-10-06T08:00:00+07:00', '2026-10-05')).toBe(false)
    // 00:30 ไทยของวันที่ 6 = 17:30 UTC ของวันที่ 5 — ต้องนับเป็นวันที่ 6
    expect(registrationClosesByEventDay('2026-10-05T17:30:00Z', '2026-10-05')).toBe(false)
    expect(registrationClosesByEventDay('2026-10-05T16:30:00Z', '2026-10-05')).toBe(true)
    // datetime-local (ไม่มีเขตเวลา) = เวลาไทยที่ผู้ใช้พิมพ์
    expect(registrationClosesByEventDay('2026-10-05T23:30', '2026-10-05')).toBe(true)
    expect(registrationClosesByEventDay(null, '2026-10-05')).toBe(false)
  })

  it('accepts a tournament whose registration closes on its first event day', () => {
    expect(createTournamentSchema.safeParse({ ...input, eventStartDate: '2026-10-05' }).success).toBe(true)
  })

  it('rejects a first event day before the registration closing day', () => {
    const result = createTournamentSchema.safeParse({ ...input, eventStartDate: '2026-10-04', eventEndDate: '2026-10-07' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.flatten().fieldErrors.eventStartDate)
      .toContain('วันแข่งวันแรกต้องไม่ก่อนวันปิดรับสมัคร')
  })
})
