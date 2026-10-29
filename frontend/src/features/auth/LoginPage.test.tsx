import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
const state = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../hooks/useAuth', () => ({ useLogin: () => ({ mutateAsync: state.login, isPending: false }) }))
import { LoginPage } from './LoginPage'
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())
function Location() { const location = useLocation(); return <output aria-label="Destination">{location.pathname}{location.search}</output> }
it('routes an unverified login to OTP using the email returned by the server', async () => {
  state.login.mockRejectedValue(new ApiError(403, { code: 'EMAIL_NOT_VERIFIED', message: 'Verify email', email: 'canonical@example.test' }))
  render(<MemoryRouter><LoginPage /><Location /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'typed@example.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!) })
  expect(screen.getByLabelText('Destination')).toHaveTextContent('/register?step=otp&email=canonical%40example.test')
})
it('keeps an invalid password on the login form', async () => {
  state.login.mockRejectedValue(new ApiError(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }))
  render(<MemoryRouter initialEntries={['/login']}><LoginPage /><Location /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'typed@example.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
  await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!) })
  expect(screen.getByLabelText('Destination')).toHaveTextContent('/login')
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
})
it('waits for the server retry interval after a 429 and permits retry at expiry', async () => {
  vi.useFakeTimers()
  state.login.mockRejectedValue(new ApiError(429, { code: 'TOO_MANY_LOGIN_ATTEMPTS', message: 'Too many attempts', retryAfterSeconds: 2 }))
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'qa@ku.th' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } })
  const button = screen.getByRole('button', { name: 'Sign in' })
  await act(async () => { fireEvent.submit(button.closest('form')!) })
  expect(button).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('2 seconds')
  await act(async () => { fireEvent.submit(button.closest('form')!) })
  expect(state.login).toHaveBeenCalledTimes(1)
  act(() => vi.advanceTimersByTime(2000))
  expect(button).toBeEnabled()
})
