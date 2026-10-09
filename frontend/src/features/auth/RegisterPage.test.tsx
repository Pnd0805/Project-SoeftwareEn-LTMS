import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'
import { readOtpRequests, saveOtpRequest } from './otpRequests'
import { ApiError } from '../../api/client'

const reference = vi.hoisted(() => ({
  facultyHook: vi.fn(), departmentHook: vi.fn(),
  facultyError: false, departmentError: false, pending: false, empty: false,
  retryFaculties: vi.fn(), retryDepartments: vi.fn(),
}))

const mockRegisterMutateAsync = vi.fn()
const mockVerifyEmailMutateAsync = vi.fn()
const mockResendVerificationMutateAsync = vi.fn()

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  mockRegisterMutateAsync.mockReset()
  mockVerifyEmailMutateAsync.mockReset()
  mockResendVerificationMutateAsync.mockReset()
  reference.facultyError = false; reference.departmentError = false; reference.pending = false; reference.empty = false
})
afterEach(() => vi.useRealTimers())

const renderOtp = (email = 'newuser@ku.th') => render(<MemoryRouter initialEntries={[`/register?step=otp&email=${email}`]}><RegisterPage /></MemoryRouter>)
const requestOtp = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Resend (?:code|in)/ })) })
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
  useFaculties: (enabled: boolean) => {
    reference.facultyHook(enabled)
    return {
      data: { items: [{ id: 1, name: 'คณะวิศวกรรมศาสตร์' }, { id: 2, name: 'คณะวิทยาศาสตร์' }] },
      isSuccess: enabled && !reference.facultyError && !reference.pending,
      isPending: reference.pending, isError: reference.facultyError, refetch: reference.retryFaculties,
    }
  },
  useDepartments: (facultyId: number | undefined) => {
    reference.departmentHook(facultyId)
    return {
      data: { items: reference.empty || !facultyId ? [] : [{ id: facultyId === 1 ? 10 : 20, name: facultyId === 1 ? 'วิศวกรรมคอมพิวเตอร์' : 'วิทยาการคอมพิวเตอร์' }] },
      isSuccess: !!facultyId && !reference.departmentError && !reference.pending,
      isPending: reference.pending, isError: reference.departmentError, refetch: reference.retryDepartments,
    }
  },
}))

const renderSignup = () => render(<MemoryRouter initialEntries={['/register']}><RegisterPage /></MemoryRouter>)
const fillPersonal = (email = 'student@ku.th') => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'QA Student' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } })
  fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2004-01-01' } })
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'male' } })
}
const advance = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Next: Student details' }))
  await screen.findByRole('heading', { name: 'Step 2: Student details' })
}
const selectStudy = () => {
  fireEvent.change(screen.getByLabelText('Faculty'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: '10' } })
  fireEvent.change(screen.getByLabelText('Year'), { target: { value: '3' } })
}

describe('two-step account registration', () => {
  it('keeps student fields and their reference reads out of the personal step', () => {
    renderSignup()
    expect(screen.getByRole('heading', { name: 'Step 1: Personal details' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Faculty')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Year')).not.toBeInTheDocument()
    expect(reference.facultyHook).toHaveBeenLastCalledWith(false)
    expect(reference.departmentHook).toHaveBeenLastCalledWith(undefined)
  })

  it('validates personal details before advancing and does not create an account at step one', async () => {
    renderSignup()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@ku.th' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next: Student details' }))
    await screen.findByText('ชื่อ-นามสกุลต้องมี 2-100 ตัวอักษร')
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByLabelText('Faculty')).not.toBeInTheDocument()
    fillPersonal(); await advance()
    expect(mockRegisterMutateAsync).not.toHaveBeenCalled()
    expect(reference.facultyHook).toHaveBeenLastCalledWith(true)
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Faculty')).toHaveValue('')
    expect(screen.getByLabelText('Department')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

  it('preserves the draft across Back and creates one account only after valid student details, then opens OTP', async () => {
    mockRegisterMutateAsync.mockResolvedValueOnce({ id: 99 })
    renderSignup(); fillPersonal('Student@KU.TH'); await advance(); selectStudy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to personal details' }))
    expect(screen.getByLabelText('Email')).toHaveValue('Student@KU.TH')
    expect(screen.getByLabelText('Password')).toHaveValue('Password1')
    await advance()
    expect(screen.getByLabelText('Year')).toHaveValue(3)
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByRole('heading', { name: 'Verify email' })
    expect(mockRegisterMutateAsync).toHaveBeenCalledExactlyOnceWith({ fullName: 'QA Student', email: 'Student@KU.TH', password: 'Password1', gender: 'male', birthDate: '2004-01-01', facultyId: 1, departmentId: 10, year: 3 })
    expect(readOtpRequests('Student@KU.TH', Date.now())).toHaveLength(1)
  })

  it('clears a department from the previous faculty and refuses invalid study years', async () => {
    renderSignup(); fillPersonal(); await advance(); selectStudy()
    fireEvent.change(screen.getByLabelText('Faculty'), { target: { value: '2' } })
    expect(screen.getByLabelText('Department')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByText('ชั้นปีต้องอยู่ระหว่าง 1-8')
    expect(mockRegisterMutateAsync).not.toHaveBeenCalled()
  })

  it.each(['person@gmail.com', 'person@notku.th', 'person@sub.ku.th'])('registers external %s with personal details only and opens OTP', async email => {
    mockRegisterMutateAsync.mockResolvedValueOnce({ id: 99 })
    reference.facultyError = true
    renderSignup(); fillPersonal(email)
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByRole('heading', { name: 'Verify email' })
    expect(screen.queryByLabelText('Faculty')).not.toBeInTheDocument()
    expect(reference.facultyHook).toHaveBeenLastCalledWith(false)
    expect(mockRegisterMutateAsync).toHaveBeenCalledExactlyOnceWith({ fullName: 'QA Student', email, password: 'Password1', gender: 'male', birthDate: '2004-01-01' })
    expect(readOtpRequests(email, Date.now())).toHaveLength(1)
  })

  it('does not submit stale study details after switching the email to external', async () => {
    mockRegisterMutateAsync.mockResolvedValueOnce({ id: 99 })
    renderSignup(); fillPersonal(); await advance(); selectStudy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to personal details' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@gmail.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByRole('heading', { name: 'Verify email' })
    expect(mockRegisterMutateAsync).toHaveBeenCalledExactlyOnceWith({ fullName: 'QA Student', email: 'person@gmail.com', password: 'Password1', gender: 'male', birthDate: '2004-01-01' })
  })

  it('returns server email errors to the personal step without losing the draft', async () => {
    mockRegisterMutateAsync.mockRejectedValueOnce(new ApiError(400, { code: 'EMAIL_ALREADY_REGISTERED', message: 'Duplicate', fields: { email: 'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว' } }))
    renderSignup(); fillPersonal(); await advance(); selectStudy()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByText('อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว')
    expect(screen.getByLabelText('Email')).toHaveValue('student@ku.th')
    expect(screen.queryByRole('heading', { name: 'Verify email' })).not.toBeInTheDocument()
    expect(readOtpRequests('student@ku.th', Date.now())).toEqual([])
  })

  it('keeps registration unavailable while reference reads fail and offers retry', async () => {
    reference.facultyError = true
    renderSignup(); fillPersonal(); await advance()
    fireEvent.click(screen.getByRole('button', { name: 'Retry faculties' }))
    expect(reference.retryFaculties).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    expect(mockRegisterMutateAsync).not.toHaveBeenCalled()
  })

  it('shows loading without selecting or submitting a fallback faculty', async () => {
    reference.pending = true
    renderSignup(); fillPersonal(); await advance()
    expect(screen.getByRole('status')).toHaveTextContent('Loading faculties')
    expect(screen.getByLabelText('Faculty')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    expect(mockRegisterMutateAsync).not.toHaveBeenCalled()
  })

  it('explains empty departments and never silently chooses a department', async () => {
    reference.empty = true
    renderSignup(); fillPersonal(); await advance()
    fireEvent.change(screen.getByLabelText('Faculty'), { target: { value: '1' } })
    expect(screen.getByText('No departments available for this faculty.')).toBeInTheDocument()
    expect(screen.getByLabelText('Department')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    expect(mockRegisterMutateAsync).not.toHaveBeenCalled()
  })
})

describe('RegisterPage OTP flow', () => {
  it('renders registration form by default', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('renders OTP step when query param step=otp is present', () => {
    render(
      <MemoryRouter initialEntries={['/register?step=otp&email=newuser@ku.th']}>
        <RegisterPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Verify email' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('newuser@ku.th')
    expect(screen.getByLabelText('Code')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify email' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('allows entering 6-digit OTP code and calls verifyEmail', async () => {
    mockVerifyEmailMutateAsync.mockResolvedValueOnce({ message: 'ยืนยันอีเมลสำเร็จ', emailVerified: true })

    render(
      <MemoryRouter initialEntries={['/register?step=otp&email=newuser@ku.th']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const otpInput = screen.getByLabelText('Code')
    fireEvent.change(otpInput, { target: { value: '007431' } })

    const verifyBtn = screen.getByRole('button', { name: 'Verify email' })
    fireEvent.click(verifyBtn)

    await waitFor(() => {
      expect(mockVerifyEmailMutateAsync).toHaveBeenCalledWith({
        email: 'newuser@ku.th',
        code: '007431',
      })
    })

    expect(screen.getByText('Email verified')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('allows requesting resend OTP and calls resendVerification', async () => {
    mockResendVerificationMutateAsync.mockResolvedValueOnce({ message: 'ส่งรหัสใหม่แล้ว' })

    render(
      <MemoryRouter initialEntries={['/register?step=otp&email=newuser@ku.th']}>
        <RegisterPage />
      </MemoryRouter>
    )

    const resendBtn = screen.getByRole('button', { name: /Resend (?:code|in)/ })
    fireEvent.click(resendBtn)

    await waitFor(() => {
      expect(mockResendVerificationMutateAsync).toHaveBeenCalledWith({
        email: 'newuser@ku.th',
      })
    })

    expect(screen.getByText(/Request received|Demo request received/)).toBeInTheDocument()
  })

  it('warns after three accepted requests, persists across reload, and unlocks at the rolling hour boundary', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    mockResendVerificationMutateAsync.mockResolvedValue({ message: 'accepted' })
    const view = renderOtp()
    await requestOtp()
    expect(screen.getByRole('button', { name: /Resend (?:code|in)/ })).toBeDisabled()
    act(() => vi.advanceTimersByTime(59_000))
    expect(screen.getByRole('button', { name: /Resend (?:code|in)/ })).toBeDisabled()
    act(() => vi.advanceTimersByTime(1000))
    await requestOtp()
    act(() => vi.advanceTimersByTime(60_000))
    await requestOtp()
    expect(screen.getByText(/Request limit reached/)).toBeInTheDocument()
    await requestOtp()
    expect(mockResendVerificationMutateAsync).toHaveBeenCalledTimes(3)
    view.unmount()
    renderOtp()
    expect(screen.getByRole('button', { name: /Resend (?:code|in)/ })).toBeDisabled()
    act(() => vi.advanceTimersByTime(3_480_000))
    expect(screen.getByRole('button', { name: /Resend (?:code|in)/ })).toBeEnabled()
    expect(screen.queryByText(/Request limit reached/)).not.toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /Resend (?:code|in)/ })).toBeDisabled()
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
    expect(screen.getByRole('button', { name: /Resend in 60s/ })).toBeDisabled()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('button', { name: /Resend (?:code|in)/ })).toBeEnabled()
  })
})
