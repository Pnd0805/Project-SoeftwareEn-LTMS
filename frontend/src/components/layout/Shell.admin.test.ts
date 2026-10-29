import { describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(), USE_MOCK: false,
}))

import { canShowAdminNav } from './adminNav'

describe('Admin navigation permission', () => {
  it('hides Admin for a backend staff user without admin-scope capability', () => {
    expect(canShowAdminNav(false, undefined, false)).toBe(false)
  })

  it.each(['faculty', 'university_wide'])('shows Admin after a %s scope passes the backend capability check', () => {
    expect(canShowAdminNav(false, undefined, true)).toBe(true)
  })
})
