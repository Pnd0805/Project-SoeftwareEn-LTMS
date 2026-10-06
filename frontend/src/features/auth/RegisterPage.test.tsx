import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'

const mockRegisterMutateAsync = vi.fn()
const mockVerifyEmailMutateAsync = vi.fn()
const mockResendVerificationMutateAsync = vi.fn()

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
})
