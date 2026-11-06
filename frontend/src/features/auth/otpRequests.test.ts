import { beforeEach, expect, it, vi } from 'vitest'
import { activeOtpRequests, OTP_COOLDOWN_MS, OTP_REQUEST_LIMIT, OTP_WINDOW_MS, readOtpRequests, saveOtpRequest } from './otpRequests'
beforeEach(() => localStorage.clear())
it('keeps only requests in the rolling hour, discarding corrupt and future entries', () => {
  const now = 2 * OTP_WINDOW_MS
  expect(activeOtpRequests([now, now + 1, now - OTP_WINDOW_MS, NaN, now - 1000], now)).toEqual([now - 1000, now])
})
it('normalizes email keys and preserves cooldown and the hourly count after reload', () => {
  const now = 2 * OTP_WINDOW_MS
  let times: number[] = []
  for (let i = 0; i < OTP_REQUEST_LIMIT; i++) times = saveOtpRequest(' Person@Example.test ', times, now + i * OTP_COOLDOWN_MS)
  expect(readOtpRequests('person@example.test', now + 2 * OTP_COOLDOWN_MS)).toEqual(times)
  expect(readOtpRequests('other@example.test', now + 2 * OTP_COOLDOWN_MS)).toEqual([])
  expect(readOtpRequests('person@example.test', now + OTP_WINDOW_MS)).toHaveLength(2)
})
it('ignores malformed storage and keeps an in-memory history if writes are blocked', () => {
  localStorage.setItem('ltms:otp-requests:person@example.test', '{')
  expect(readOtpRequests('person@example.test', 5000)).toEqual([])
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable') })
  expect(saveOtpRequest('person@example.test', [4000], 5000)).toEqual([4000, 5000])
  write.mockRestore()
})
