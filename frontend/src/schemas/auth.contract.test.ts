import { afterEach, expect, it, vi } from 'vitest'
import { registerSchema } from './auth.schema'

const input = { fullName: 'Test Student', email: 'test@example.test', password: 'password123', gender: 'other', birthDate: '2002-06-04', facultyId: 2, departmentId: 8, year: 3 }
afterEach(() => vi.useRealTimers())
it.each(['2026-02-31', '2025-02-29', '2026-04-31'])('rejects nonexistent date %s', birthDate => {
  expect(registerSchema.safeParse({ ...input, birthDate }).success).toBe(false)
})
it('uses the Bangkok calendar day rather than UTC when rejecting future birth dates', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T17:01:00Z'))
  expect(registerSchema.safeParse({ ...input, birthDate: '2026-10-09' }).success).toBe(true)
  expect(registerSchema.safeParse({ ...input, birthDate: '2026-10-10' }).success).toBe(false)
  expect(registerSchema.safeParse({ ...input, birthDate: '2024-02-29' }).success).toBe(true)
})
it.each([0, 9, 2.5])('rejects study year %s', year => {
  expect(registerSchema.safeParse({ ...input, year }).success).toBe(false)
})
it.each([1, 8])('accepts study year %s without changing the payload', year => {
  expect(registerSchema.parse({ ...input, year })).toEqual({ ...input, year })
})
