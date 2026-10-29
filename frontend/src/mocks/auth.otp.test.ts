import { expect, it, vi } from 'vitest'
import { mockResendVerification, mockVerifyEmail } from './auth.mock'
vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(),
  mockDelay: async <T,>(value: T) => value,
  mockReject: async (status: number, body: import('../types/dto').ApiErrorBody) => {
    const { ApiError } = await original<typeof import('../api/client')>(); throw new ApiError(status, body)
  },
}))
it('accepts only the documented demo OTP and rejects an arbitrary six digit code', async () => {
  await expect(mockVerifyEmail({ email: 'demo@example.test', code: '123456' })).resolves.toMatchObject({ emailVerified: true })
  await expect(mockVerifyEmail({ email: 'demo@example.test', code: '654321' })).rejects.toMatchObject({ status: 400, code: 'INVALID_OTP' })
})
it('does not claim that mock mode sends email', async () => {
  await expect(mockResendVerification()).resolves.toMatchObject({ message: expect.stringContaining('No email is sent') })
})
