import { describe, expect, it } from 'vitest'
import { createTournamentSchema, registrationClosesBeforeEvent } from './tournament.schema'

const input = {
  name: 'Campus Cup', sportTypeId: 1, bracketFormat: 'single_elimination' as const,
  scopeType: 'faculty' as const, organizingFacultyId: 1, organizingDepartmentId: null,
  registrationStart: '2026-10-01T09:00', registrationEnd: '2026-10-05T17:00',
  eventStartDate: '2026-10-06', eventEndDate: '2026-10-07', maxTeams: 8, minTeams: 2,
  venue: 'Main Hall', genderRequirement: 'any' as const,
}

describe('tournament schedule validation', () => {
  it('matches the backend rule that event day starts at midnight', () => {
    expect(registrationClosesBeforeEvent('2026-10-05T17:00:00+07:00', '2026-10-05')).toBe(false)
    expect(registrationClosesBeforeEvent('2026-10-05T17:00:00+07:00', '2026-10-06')).toBe(true)
  })

  it('rejects creating a tournament whose registration closes on its first event day', () => {
    const result = createTournamentSchema.safeParse({ ...input, eventStartDate: '2026-10-05' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.flatten().fieldErrors.eventStartDate)
      .toContain('วันแข่งวันแรกต้องอยู่หลังวันปิดรับสมัคร')
  })
})
