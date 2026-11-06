import { expect, it } from 'vitest'
import { registrationIsOpen, tourLifecycle } from './rules'
import { displayDate, dateRange } from './display'
import type { Tournament } from './types'
const tournament = { status: 'public', champion: null, drawn: false, registrationOpen: true, registrationStart: '2026-10-07T02:00:00Z', registrationEnd: '2026-10-07T03:00:00Z' } as Tournament
it('requires an open flag, public status and the actual entry window', () => {
  expect(registrationIsOpen(tournament, Date.parse('2026-10-07T01:59:59Z'))).toBe(false)
  expect(registrationIsOpen(tournament, Date.parse('2026-10-07T02:00:00Z'))).toBe(true)
  expect(registrationIsOpen(tournament, Date.parse('2026-10-07T03:00:01Z'))).toBe(false)
  expect(registrationIsOpen({ ...tournament, registrationOpen: false }, Date.parse('2026-10-07T02:30:00Z'))).toBe(false)
  expect(registrationIsOpen({ ...tournament, status: 'private' }, Date.parse('2026-10-07T02:30:00Z'))).toBe(false)
  expect(tourLifecycle({ ...tournament, champion: 'winner' })).toBe('finished')
})
it('formats calendar dates without Bangkok shifting their day', () => {
  expect(displayDate('2026-10-07')).toBe('7 Oct 2026')
  expect(dateRange('2026-10-07', '2026-10-09')).toBe('7 Oct 2026 – 9 Oct 2026')
})
