import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { checkinErrorMessage } from './checkinErrors'

describe('participant check-in feedback', () => {
  it.each([
    ['CHECKIN_NOT_OPEN', 'not open'],
    ['CHECKIN_METHOD_MISMATCH', 'does not match'],
    ['CHECKIN_QR_MISMATCH', 'invalid, expired'],
    ['NOT_IN_APPROVED_ROSTER', 'approved lineup'],
    ['UPLOAD_FAILED', 'could not be uploaded'],
  ])('turns %s into actionable copy', (code, expected) => {
    expect(checkinErrorMessage(new ApiError(409, { code, message: 'generic server message' })))
      .toContain(expected)
  })
})
