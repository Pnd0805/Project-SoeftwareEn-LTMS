import { expect, it } from 'vitest'
import { formatScheduleDate, parseScheduleDate, schedulePickerValue } from './scheduleDate'
import { createTournamentSchema } from '../../schemas/tournament.schema'

it('uses the same English 24-hour Bangkok format for fields and review values', () => {
  expect(formatScheduleDate('2026-10-30T19:28:00Z', true)).toBe('31 Oct 2026, 02:28 (UTC+7)')
  expect(formatScheduleDate('2026-10-31', false)).toBe('31 Oct 2026')
  expect(schedulePickerValue('2026-10-30T19:28:00Z', true)).toBe('2026-10-31T02:28')
})

it('interprets typed and picked date-times in Bangkok without relying on the browser timezone', () => {
  const typed = parseScheduleDate('31 Oct 2026, 02:28 (UTC+7)', true)
  expect(typed).toBe('2026-10-31T02:28:00+07:00')
  expect(new Date(typed!).toISOString()).toBe('2026-10-30T19:28:00.000Z')
  expect(parseScheduleDate('2026-10-31T02:28', true)).toBe(typed)
  expect(parseScheduleDate('31 Oct 2026, 14:28', true)).toBe('2026-10-31T14:28:00+07:00')
  expect(parseScheduleDate('1 Nov 2026', false)).toBe('2026-11-01')
})

it.each(['31 Feb 2026', '29 Feb 2025', '2026-02-30', '2026-02-30T02:28:00+07:00', '2026-10-31T24:00:00Z', '31 Oct 2026, 24:01', '31 Oct 2026, 02:60', '31 Oct 2026, 02:28 PM', 'tomorrow'])('does not turn invalid %s into another day or silently assume AM/PM', value => {
  expect(parseScheduleDate(value, value.includes(':'))).toBeNull()
})

it('retains leap days, clear values, and calendar-only dates without timezone shifting', () => {
  expect(parseScheduleDate('29 Feb 2028', false)).toBe('2028-02-29')
  expect(formatScheduleDate('2028-02-29', false)).toBe('29 Feb 2028')
  expect(parseScheduleDate('', true)).toBe('')
  expect(formatScheduleDate('', true)).toBe('')
})

it('preserves the existing create-tournament payload contract', () => {
  const result = createTournamentSchema.parse({ name: 'KU Cup', sportTypeId: 1, bracketFormat: 'single_elimination', scopeType: 'faculty',
    organizingFacultyId: 1, organizingDepartmentId: null,
    registrationStart: parseScheduleDate('31 Oct 2026, 02:28 (UTC+7)', true),
    registrationEnd: parseScheduleDate('31 Oct 2026, 14:28 (UTC+7)', true),
    eventStartDate: parseScheduleDate('1 Nov 2026', false), eventEndDate: parseScheduleDate('2 Nov 2026', false),
    maxTeams: 8, minTeams: 2, venue: 'Main Hall', genderRequirement: 'any', eligibilityFacultyIds: [], eligibilityYears: [],
  })
  expect(result.registrationStart).toBe('2026-10-31T02:28:00+07:00')
  expect(result.registrationEnd).toBe('2026-10-31T14:28:00+07:00')
  expect(result.eventStartDate).toBe('2026-11-01')
  expect(result.eventEndDate).toBe('2026-11-02')
})
