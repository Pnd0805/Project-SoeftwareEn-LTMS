import { expect, it } from 'vitest'
import { personalRegisterSchema, registerSchema } from './auth.schema'
const input = { fullName: 'QA Student', email: 'qa@test.example', password: 'Password1', gender: 'male', birthDate: '2004-01-01', facultyId: 1, departmentId: 1, year: 1 }
it('rejects future or impossible birthdays and implausible study years', () => {
  for (const override of [{ birthDate: '2999-01-01' }, { birthDate: '2026-02-30' }, { year: 99 }, { year: 0 }]) expect(registerSchema.safeParse({ ...input, ...override }).success).toBe(false)
  expect(registerSchema.safeParse({ ...input, year: 8 }).success).toBe(true)
})
it('requires academic fields only for exact KU email and strips them from external personal payloads', () => {
  const personal = personalRegisterSchema.parse(input)
  expect(registerSchema.safeParse(personal).success).toBe(true)
  for (const email of ['person@gmail.com', 'person@sub.ku.th', 'person@notku.th']) expect(registerSchema.safeParse({ ...personal, email }).success).toBe(true)
  for (const email of ['student@ku.th', 'Student@KU.TH']) {
    const result = registerSchema.safeParse({ ...personal, email })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map(issue => issue.path[0])).toEqual(['facultyId', 'departmentId', 'year'])
    expect(registerSchema.safeParse({ ...input, email }).success).toBe(true)
  }
  expect(personal).not.toHaveProperty('facultyId')
  expect(personal).not.toHaveProperty('departmentId')
  expect(personal).not.toHaveProperty('year')
  expect(registerSchema.safeParse({ ...personal, facultyId: null }).success).toBe(false)
})
