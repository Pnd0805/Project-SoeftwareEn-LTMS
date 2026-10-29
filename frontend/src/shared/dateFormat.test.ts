import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateOnly, fmtDateTime } from './dateFormat'

describe('dateFormat', () => {
  it('formats an instant as day, short month, year, 24-hour time and the zone', () => {
    expect(fmtDateTime('2026-09-08T15:44:00Z')).toBe('8 Sept 2026, 22:44 (UTC+7)')
  })

  it('renders Thailand time whatever offset the value arrives in', () => {
    expect(fmtDateTime('2026-10-09T13:20:00+07:00')).toBe('9 Oct 2026, 13:20 (UTC+7)')
    expect(fmtDateTime('2026-10-09T06:20:00.000Z')).toBe('9 Oct 2026, 13:20 (UTC+7)')
    expect(fmtDateTime(Date.UTC(2026, 9, 9, 6, 20))).toBe('9 Oct 2026, 13:20 (UTC+7)')
  })

  it('rolls the date forward when Thailand is already on the next day', () => {
    expect(fmtDateTime('2026-10-08T18:30:00Z')).toBe('9 Oct 2026, 01:30 (UTC+7)')
  })

  it('leaves the time off a bare calendar day and never shifts it', () => {
    expect(fmtDateOnly('2026-10-27')).toBe('27 Oct 2026')
    expect(fmtDate('2026-10-27')).toBe('27 Oct 2026')
  })

  it('reduces an instant to its Thailand calendar day when only the date matters', () => {
    expect(fmtDateOnly('2026-10-08T18:30:00Z')).toBe('9 Oct 2026')
  })

  it('picks date-and-time for anything that is not a bare calendar day', () => {
    expect(fmtDate('2026-10-27T03:00:00Z')).toBe('27 Oct 2026, 10:00 (UTC+7)')
  })

  it('falls back instead of printing Invalid Date', () => {
    expect(fmtDateTime(null)).toBe('Not set')
    expect(fmtDateTime('')).toBe('Not set')
    expect(fmtDateTime('not-a-date', 'Unavailable')).toBe('Unavailable')
    expect(fmtDateOnly(undefined, 'Not available')).toBe('Not available')
  })
})
