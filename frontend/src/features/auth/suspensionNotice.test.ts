import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { suspensionNotice } from './suspensionNotice'

const suspended = (extra: Record<string, unknown>) =>
  new ApiError(403, { code: 'ACCOUNT_SUSPENDED', message: 'บัญชีนี้ถูกระงับ', ...extra } as never)
const now = Date.parse('2026-10-30T00:00:00.000Z')

describe('suspensionNotice', () => {
  it('states the days left and the end time', () => {
    const text = suspensionNotice(suspended({ suspendedUntil: '2026-11-06T00:00:00.000Z' }), now)
    expect(text).toContain('เหลืออีก 7 วัน')
    expect(text).toContain('6 Nov 2026')
  })

  it('rounds a part of a day up so the last day never reads as zero', () => {
    expect(suspensionNotice(suspended({ suspendedUntil: '2026-10-30T01:00:00.000Z' }), now)).toContain('เหลืออีก 1 วัน')
  })

  it('says permanent only when the server says so', () => {
    expect(suspensionNotice(suspended({ suspendedUntil: null }), now)).toContain('ระงับถาวร')
    expect(suspensionNotice(suspended({}), now)).toBe('บัญชีนี้ถูกระงับ')
  })
})
