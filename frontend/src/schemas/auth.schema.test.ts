import { expect, it } from 'vitest'
import { registerSchema } from './auth.schema'
const input = { fullName: 'QA Student', email: 'qa@test.example', password: 'Password1', gender: 'male', birthDate: '2004-01-01', facultyId: 1, departmentId: 1, year: 1 }
it('rejects future or impossible birthdays and implausible study years', () => {
  for (const override of [{ birthDate: '2999-01-01' }, { birthDate: '2026-02-30' }, { year: 99 }, { year: 0 }]) expect(registerSchema.safeParse({ ...input, ...override }).success).toBe(false)
  expect(registerSchema.safeParse({ ...input, year: 8 }).success).toBe(true)
})
