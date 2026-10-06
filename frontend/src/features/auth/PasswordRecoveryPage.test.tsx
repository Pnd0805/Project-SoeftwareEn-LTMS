import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PasswordRecoveryPage } from './PasswordRecoveryPage'
const api = vi.hoisted(() => ({ reset: vi.fn(), forgot: vi.fn() }))
vi.mock('../../api/auth', () => ({ resetPassword: api.reset, forgotPassword: api.forgot }))
const token = '0'.repeat(64)
function page(path = `/reset-password?token=${token}`, reset = true) {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[path]}><PasswordRecoveryPage reset={reset} /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { api.reset.mockReset().mockResolvedValue({ message: 'done' }); api.forgot.mockReset().mockResolvedValue({ message: 'accepted' }) })
describe('email password recovery', () => {
  it('rejects a missing or malformed token before allowing password entry', () => {
    page('/reset-password?token=bad')
    expect(screen.getByText(/ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง/)).toBeInTheDocument()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
    expect(api.reset).not.toHaveBeenCalled()
  })
  it('requires matching strong passwords and forwards the token from the email URL', async () => {
    page()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newPassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different2' } })
    expect(screen.getByRole('button', { name: 'Set new password' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newPassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))
    await waitFor(() => expect(api.reset).toHaveBeenCalledWith({ token, newPassword: 'newPassword1' }, expect.anything()))
    expect(await screen.findByText(/เปลี่ยนรหัสผ่านเรียบร้อยแล้ว/)).toBeInTheDocument()
  })
  it('shows an expired-link rejection and retains a route to request a new link', async () => {
    api.reset.mockRejectedValue(new Error('Reset token expired'))
    page()
    for (const label of ['New password', 'Confirm new password']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'newPassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(await screen.findByText('Reset token expired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
  })
  it('does not promise delivery when recovery returns the same response for an unknown email', async () => {
    page('/forgot-password', false)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'unknown@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText(/หากอีเมลนี้อยู่ในระบบ/)).toBeInTheDocument()
  })
})
