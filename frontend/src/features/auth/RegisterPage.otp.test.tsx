import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const clients: QueryClient[] = []
let posts: { path: string; body: unknown }[]
let verified: boolean
let verifyStatus: number
let resendStatus: number
let emailSent: boolean
let release: (() => void) | undefined
let hold: boolean
function Location() { const location = useLocation(); return <output aria-label="Location">{location.pathname}{location.search}</output> }
function show(path = '/register?step=otp&email=chosen%40example.test') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/register" element={<RegisterPage />} /><Route path="/login" element={<h1>Sign in destination</h1>} />
  </Routes></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  localStorage.clear(); posts = []; verified = true; verifyStatus = 200; resendStatus = 200; emailSent = false; release = undefined; hold = false
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname.replace('/api/v1', '')
    if (init?.method === 'POST') posts.push({ path, body: JSON.parse(String(init.body)) })
    if (path === '/auth/verify-email') {
      if (hold) await new Promise<void>(resolve => { release = resolve })
      return verifyStatus === 200 ? json({ message: 'Verified', emailVerified: verified }) : json({ error: { code: 'INVALID_OTP', message: 'Code expired. Request a new code.' } }, verifyStatus)
    }
    if (path === '/auth/resend-verification') return resendStatus === 200 ? json({ message: 'If eligible, a code will be sent.' }) : json({ error: { code: 'RATE_LIMITED', message: 'Please try later.' } }, resendStatus)
    if (path === '/auth/register') return json({ id: 9, fullName: 'Test Student', email: 'chosen@example.test', emailVerificationSent: emailSent }, 201)
    if (path === '/faculties') return json({ items: [{ id: 2, name: 'Engineering' }] })
    if (path === '/faculties/2/departments') return json({ items: [{ id: 8, facultyId: 2, name: 'Software Engineering' }] })
    throw new Error(`Unexpected request: ${path}`)
  }))
})
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals() })
const verify = (container: HTMLElement, code = '007431') => {
  fireEvent.change(screen.getByLabelText('Code'), { target: { value: code } })
  fireEvent.submit(container.querySelector('form')!)
}
it('keeps leading zeros, waits for server confirmation, then lets the user sign in', async () => {
  const { container } = show(); verify(container)
  await screen.findByRole('heading', { name: 'Email verified' })
  expect(posts).toEqual([{ path: '/auth/verify-email', body: { email: 'chosen@example.test', code: '007431' } }])
  fireEvent.click(screen.getByRole('link', { name: 'Sign in' }))
  await screen.findByRole('heading', { name: 'Sign in destination' })
})
it('retains an expired code for correction and succeeds on retry', async () => {
  verifyStatus = 400
  const { container } = show(); verify(container)
  await screen.findByRole('alert')
  expect(screen.getByRole('alert')).toHaveTextContent('Code expired')
  expect(screen.getByLabelText('Code')).toHaveValue('007431')
  expect(screen.queryByRole('heading', { name: 'Email verified' })).not.toBeInTheDocument()
  verifyStatus = 200; verify(container, '123456')
  await screen.findByRole('heading', { name: 'Email verified' })
})
it('does not report verification for an unconfirmed 200 response', async () => {
  verified = false
  const { container } = show(); verify(container)
  await screen.findByRole('alert')
  expect(screen.queryByRole('heading', { name: 'Email verified' })).not.toBeInTheDocument()
})
it('validates a deep link email and six digit string before any request', async () => {
  const { container } = show('/register?step=otp&email=invalid'); verify(container, '7431')
  await waitFor(() => expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true'))
  expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'true')
  expect(posts).toEqual([])
})
it('acknowledges resend without promising delivery and keeps its cooldown after remount', async () => {
  const view = show()
  fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))
  await screen.findByText('Request received. Check your email if a code is available.')
  expect(posts).toEqual([{ path: '/auth/resend-verification', body: { email: 'chosen@example.test' } }])
  expect(screen.getByRole('button', { name: /Resend in/ })).toBeDisabled()
  view.unmount(); show()
  expect(screen.getByRole('button', { name: /Resend in/ })).toBeDisabled()
})
it('keeps resend retry available when the server rejects it', async () => {
  resendStatus = 429; show()
  fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))
  await screen.findByText('Please try later.')
  expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled()
})
it('prevents duplicate verify submissions while pending', async () => {
  hold = true
  const { container } = show(); verify(container)
  await waitFor(() => expect(release).toBeDefined())
  expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled()
  fireEvent.submit(container.querySelector('form')!)
  expect(posts).toHaveLength(1)
  release!()
  await screen.findByRole('heading', { name: 'Email verified' })
})
it('moves registration to OTP, keeps delivery failure truthful and does not retain the password', async () => {
  const { container } = show('/register')
  for (const [label, value] of Object.entries({ 'Full name': 'Test Student', Email: 'chosen@ku.th', Password: 'password123', Gender: 'other', 'Birth date': '2002-06-04' }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Next: Student details' }))
  await screen.findByRole('option', { name: 'Engineering' })
  fireEvent.change(screen.getByLabelText('Faculty'), { target: { value: '2' } })
  await screen.findByRole('option', { name: 'Software Engineering' })
  for (const [label, value] of Object.entries({ Department: '8', Year: '3' }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.submit(container.querySelector('form')!)
  await screen.findByRole('heading', { name: 'Verify email' })
  expect(screen.getByRole('alert')).toHaveTextContent('Email could not be sent')
  expect(screen.getByRole('button', { name: /Resend in/ })).toBeDisabled()
  expect(JSON.parse(localStorage.getItem('ltms:otp-requests:chosen@ku.th')!)).toHaveLength(1)
  expect(screen.getByLabelText('Location')).toHaveTextContent('/register?step=otp&email=chosen%40ku.th')
  expect(screen.getByLabelText('Location')).not.toHaveTextContent('password123')
  expect(JSON.stringify(localStorage)).not.toContain('password123')
  expect(posts).toEqual([{ path: '/auth/register', body: { fullName: 'Test Student', email: 'chosen@ku.th', password: 'password123', gender: 'other', birthDate: '2002-06-04', facultyId: 2, departmentId: 8, year: 3 } }])
})
it('shows the hourly limit until the oldest request leaves the rolling window', () => {
  const now = Date.now()
  localStorage.setItem('ltms:otp-requests:chosen@example.test', JSON.stringify([now - 180000, now - 120000, now - 61000]))
  show()
  expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled()
  expect(screen.getByText(/Request limit reached/)).toHaveAttribute('role', 'status')
  expect(posts).toEqual([])
})
it('loads cooldown for each email and clears stale errors and code on an email change', async () => {
  localStorage.setItem('ltms:otp-requests:chosen@example.test', JSON.stringify([Date.now()]))
  const { container } = show(); verifyStatus = 400; verify(container)
  await screen.findByText('Code expired. Request a new code.')
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'other@example.test' } })
  expect(screen.getByLabelText('Code')).toHaveValue('')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled()
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'chosen@example.test' } })
  expect(screen.getByRole('button', { name: /Resend in/ })).toBeDisabled()
})
it('recovers from a network error without losing the code', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')))
  const { container } = show(); verify(container)
  await screen.findByText('Unable to verify. Try again.')
  expect(screen.getByLabelText('Code')).toHaveValue('007431')
  expect(screen.getByRole('button', { name: 'Verify email' })).toBeEnabled()
})
