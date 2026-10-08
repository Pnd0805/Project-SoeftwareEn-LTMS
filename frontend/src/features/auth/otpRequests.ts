export const OTP_WINDOW_MS = 60 * 60 * 1000
export const OTP_COOLDOWN_MS = 60 * 1000
export const OTP_REQUEST_LIMIT = 3
const key = (email: string) => `ltms:otp-requests:${email.trim().toLowerCase()}`

export function activeOtpRequests(times: number[], now: number): number[] {
  return times.filter(time => Number.isFinite(time) && time <= now && time > now - OTP_WINDOW_MS).sort((a, b) => a - b)
}
export function readOtpRequests(email: string, now: number): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(email)) ?? '[]')
    return Array.isArray(value) ? activeOtpRequests(value.filter((time): time is number => typeof time === 'number'), now) : []
  } catch { return [] }
}
export function saveOtpRequest(email: string, times: number[], now: number): number[] {
  const next = [...activeOtpRequests(times, now), now]
  try { localStorage.setItem(key(email), JSON.stringify(next)) } catch { /* Keep feedback usable when storage is disabled. */ }
  return next
}

export function recordRegistrationOtp(email: string): void {
  const now = Date.now()
  saveOtpRequest(email, readOtpRequests(email, now), now)
}
