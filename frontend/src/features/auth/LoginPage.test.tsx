import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
const state = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../hooks/useAuth', () => ({ useLogin: () => ({ mutateAsync: state.login, isPending: false }) }))
import { LoginPage } from './LoginPage'
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())
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
