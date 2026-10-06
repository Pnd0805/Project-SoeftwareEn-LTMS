import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'
import { readOtpRequests, saveOtpRequest } from './otpRequests'

const mockRegisterMutateAsync = vi.fn()
const mockVerifyEmailMutateAsync = vi.fn()
const mockResendVerificationMutateAsync = vi.fn()

beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })
afterEach(() => vi.useRealTimers())

const renderOtp = (email = 'newuser@ku.th') => render(<MemoryRouter initialEntries={[`/register?step=otp&email=${email}`]}><RegisterPage /></MemoryRouter>)
const requestOtp = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /ขอรหัส OTP ใหม่อีกครั้ง/ })) })
}

vi.mock('../../hooks/useAuth', () => ({
  useRegister: () => ({
    mutateAsync: mockRegisterMutateAsync,
    isPending: false,
  }),
  useVerifyEmail: () => ({
    mutateAsync: mockVerifyEmailMutateAsync,
    isPending: false,
  }),
  useResendVerification: () => ({
    mutateAsync: mockResendVerificationMutateAsync,
    isPending: false,
  }),
}))

vi.mock('../../hooks/useReference', () => ({
  useFaculties: () => ({
    data: { items: [{ id: 1, name: 'คณะวิศวกรรมศาสตร์' }] },
    isLoading: false,
  }),
  useDepartments: () => ({
    data: { items: [{ id: 1, name: 'วิศวกรรมคอมพิวเตอร์' }] },
    isLoading: false,
  }),
}))

describe('RegisterPage OTP flow', () => {
  it('renders registration form by default', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    expect(screen.getByText('สมัครสมาชิกเพื่อเข้าระบบ LTMS')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'สมัครสมาชิก' })).toBeInTheDocument()
  })

  it('renders OTP step when query param step=otp is present', () => {
    render(
      <MemoryRouter initialEntries={['/register?step=otp&email=newuser@ku.th']}>
        <RegisterPage />
      </MemoryRouter>
    )

    expect(screen.getByText('ยืนยันรหัส OTP (Email Verification)')).toBeInTheDocument()
    expect(screen.getByText('newuser@ku.th')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('123456')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ยืนยันรหัส OTP' })).toBeInTheDocument()
  })

  it('allows entering 6-digit OTP code and calls verifyEmail', async () => {
    mockVerifyEmailMutateAsync.mockResolvedValueOnce({ message: 'ยืนยันอีเมลสำเร็จ', emailVerified: true })

    render(
      <MemoryRouter initialEntries={['/register?step=otp&email=newuser@ku.th']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const otpInput = screen.getByPlaceholderText('123456')
    fireEvent.change(otpInput, { target: { value: '007431' } })

    const verifyBtn = screen.getByRole('button', { name: 'ยืนยันรหัส OTP' })
    fireEvent.click(verifyBtn)

    await waitFor(() => {
      expect(mockVerifyEmailMutateAsync).toHaveBeenCalledWith({
        email: 'newuser@ku.th',
        code: '007431',
      })
    })

    expect(screen.getByText('ยืนยันอีเมลสำเร็จเรียบร้อยแล้ว!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })

  it('allows requesting resend OTP and calls resendVerification', async () => {
    mockResendVerificationMutateAsync.mockResolvedValueOnce({ message: 'ส่งรหัสใหม่แล้ว' })

    render(
      <MemoryRouter initialEntries={['/register?step=otp&email=newuser@ku.th']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const resendBtn = screen.getByRole('button', { name: /ขอรหัส OTP ใหม่อีกครั้ง/ })
    fireEvent.click(resendBtn)

    await waitFor(() => {
      expect(mockResendVerificationMutateAsync).toHaveBeenCalledWith({
        email: 'newuser@ku.th',
      })
    })

    expect(screen.getByText(/รับคำขอแล้ว หากอีเมลนี้ยังรอยืนยัน/)).toBeInTheDocument()
  })

  it('warns after three accepted requests, persists across reload, and unlocks at the rolling hour boundary', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    mockResendVerificationMutateAsync.mockResolvedValue({ message: 'accepted' })
    const view = renderOtp()
    await requestOtp()
    expect(screen.getByRole('button', { name: /ขอรหัส OTP ใหม่อีกครั้ง/ })).toBeDisabled()
    act(() => vi.advanceTimersByTime(59_000))
    expect(screen.getByRole('button', { name: /ขอรหัส OTP ใหม่อีกครั้ง/ })).toBeDisabled()
    act(() => vi.advanceTimersByTime(1000))
    await requestOtp()
    act(() => vi.advanceTimersByTime(60_000))
    await requestOtp()
    expect(screen.getByText('คุณขอรหัสครบ 3 ครั้งในช่วง 1 ชั่วโมงจากเบราว์เซอร์นี้แล้ว')).toBeInTheDocument()
    expect(screen.queryByText(/รับคำขอแล้ว หากอีเมลนี้ยังรอยืนยัน/)).not.toBeInTheDocument()
    await requestOtp()
    expect(mockResendVerificationMutateAsync).toHaveBeenCalledTimes(3)
    view.unmount()
    renderOtp()
    expect(screen.getByRole('button', { name: /ครบโควตา/ })).toBeDisabled()
    act(() => vi.advanceTimersByTime(3_480_000))
    expect(screen.getByRole('button', { name: /ขอรหัส OTP ใหม่อีกครั้ง/ })).toBeEnabled()
    expect(screen.queryByText(/คุณขอรหัสครบ 3 ครั้ง/)).not.toBeInTheDocument()
  })

  it('includes the initial registration request and isolates history by email', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    const now = Date.now()
    saveOtpRequest('newuser@ku.th', [], now - 120_000)
    saveOtpRequest('newuser@ku.th', readOtpRequests('newuser@ku.th', now), now - 60_000)
    saveOtpRequest('someoneelse@ku.th', [], now)
    mockResendVerificationMutateAsync.mockResolvedValue({ message: 'accepted' })
    renderOtp()
    await requestOtp()
    expect(screen.getByRole('button', { name: /ครบโควตา/ })).toBeDisabled()
    expect(readOtpRequests('someoneelse@ku.th', now)).toHaveLength(1)
  })

  it('preserves the 60-second cooldown across remount and does not count a failed request', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    mockResendVerificationMutateAsync.mockRejectedValueOnce(new Error('Network failure'))
    const view = renderOtp()
    await requestOtp()
    expect(readOtpRequests('newuser@ku.th', Date.now())).toEqual([])
    mockResendVerificationMutateAsync.mockResolvedValue({ message: 'accepted' })
    await requestOtp()
    view.unmount()
    renderOtp()
    expect(screen.getByRole('button', { name: /\(60s\)/ })).toBeDisabled()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('button', { name: /ขอรหัส OTP ใหม่อีกครั้ง/ })).toBeEnabled()
  })
})
