import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'

const me = { id: 9, fullName: 'Account Fixture', email: 'account@example.test', userType: 'student', avatarUrl: null,
  gender: 'male', birthDate: '2000-01-01', facultyId: 2, departmentId: 8, year: 3, totalPoints: 0, contactInfo: null, address: null, notificationPrefs: null, createdAt: '2026-10-01T00:00:00Z' }
let staff = false
let rejectSubmit = false
let referenceFailure = false
let submitted: unknown[]
const clients: QueryClient[] = []
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function show(path: '/login' | '/register') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} />
    <Route path="/" element={<p>Student destination</p>} /><Route path="/admin" element={<p>Staff destination</p>} />
  </Routes></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  staff = false; rejectSubmit = false; referenceFailure = false; submitted = []
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const path = String(input).replace('/api/v1', '')
    if (path === '/auth/login' || path === '/auth/register') {
      submitted.push(JSON.parse(String(init?.body)))
      if (rejectSubmit) return json({ error: { code: 'VALIDATION_FAILED', message: 'Fixture rejected', fields: { email: 'This email is already registered. Use another address.' } } }, 422)
      return json(path === '/auth/login' ? { accessToken: 'fixture-only', expiresIn: 604800, tokenType: 'Bearer', user: { ...me, userType: staff ? 'staff' : 'student' } } : { id: 9, fullName: 'Account Fixture', email: 'account@example.test' })
    }
    if (path === '/me') return json({ ...me, userType: staff ? 'staff' : 'student' })
    if (path === '/faculties') return referenceFailure ? json({ error: { code: 'SOURCE_FAILED', message: 'Fixture only' } }, 503) : json({ items: [{ id: 1, name: 'Science' }, { id: 2, name: 'Engineering' }] })
    if (path === '/faculties/1/departments') return json({ items: [{ id: 1, facultyId: 1, name: 'Mathematics' }] })
    if (path === '/faculties/2/departments') return json({ items: [{ id: 7, facultyId: 2, name: 'Civil Engineering' }, { id: 8, facultyId: 2, name: 'Software Engineering' }] })
    throw new Error(`Unexpected fixture request: ${path}`)
  }))
})
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals() })

const fillLogin = (container: HTMLElement) => {
  fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'account@example.test' } })
  fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: '1' } })
}
const submit = (container: HTMLElement) => fireEvent.submit(container.querySelector('form')!)

describe('Account submissions with real hooks', () => {
  it.each([false, true])('preserves the login payload and redirects staff=%s; legacy short passwords remain valid', async isStaff => {
    staff = isStaff
    const { container } = show('/login'); fillLogin(container); submit(container)
    expect(await screen.findByText(isStaff ? 'Staff destination' : 'Student destination')).toBeInTheDocument()
    expect(submitted).toEqual([{ email: 'account@example.test', password: '1' }])
  })

  it('associates a rejected login field with its message and retains values for retry', async () => {
    rejectSubmit = true
    const { container } = show('/login'); fillLogin(container); submit(container)
    const message = await screen.findByText(/This email is already registered/)
    const email = container.querySelector('input[name="email"]')!
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription(message.textContent!)
    expect(email).toHaveValue('account@example.test')
    expect(container.querySelector('input[name="password"]')).toHaveValue('1')
    rejectSubmit = false; submit(container)
    expect(await screen.findByText('Student destination')).toBeInTheDocument()
  })

  it('retains faculty/department and the registration draft after rejection, then submits the original payload', async () => {
    rejectSubmit = true
    const { container } = show('/register')
    await screen.findByRole('option', { name: 'Engineering' })
    fireEvent.change(container.querySelector('[name="facultyId"]')!, { target: { value: '2' } })
    await screen.findByRole('option', { name: 'Software Engineering' })
    fireEvent.change(container.querySelector('[name="departmentId"]')!, { target: { value: '8' } })
    for (const [name, value] of Object.entries({ fullName: 'Account Fixture', email: 'account@example.test', password: 'password123', gender: 'other', birthDate: '2002-06-04', year: '3' })) {
      fireEvent.change(container.querySelector(`[name="${name}"]`)!, { target: { value } })
    }
    submit(container)
    await screen.findByText(/This email is already registered/)
    expect(container.querySelector('[name="departmentId"]')).toHaveValue('8')
    expect(container.querySelector('[name="facultyId"]')).toHaveValue('2')
    expect(container.querySelector('[name="fullName"]')).toHaveValue('Account Fixture')
    expect(container.querySelector('[name="email"]')).toHaveAccessibleDescription(/already registered/)
    rejectSubmit = false; submit(container)
    await screen.findByRole('button', { name: /Sign in|เข้าสู่ระบบ/ })
    expect(submitted).toEqual(Array(2).fill({ fullName: 'Account Fixture', email: 'account@example.test', password: 'password123', gender: 'other', birthDate: '2002-06-04', facultyId: 2, departmentId: 8, year: 3 }))
  })

  it('makes failed reference data visible and offers retry without erasing the draft', async () => {
    referenceFailure = true
    const { container } = show('/register')
    fireEvent.change(container.querySelector('[name="fullName"]')!, { target: { value: 'Retained draft' } })
    await screen.findByText('Unable to load faculties.')
    referenceFailure = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry faculties' }))
    await screen.findByRole('option', { name: 'Engineering' })
    expect(container.querySelector('[name="fullName"]')).toHaveValue('Retained draft')
    expect(submitted).toEqual([])
  })

  it('keeps demo-role and reset controls out of real mode while retaining guest access', () => {
    show('/login')
    expect(screen.queryByRole('button', { name: 'Reset demo data' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Team Leader/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue as guest/ })).toBeInTheDocument()
  })

  it('blocks empty login fields without sending a request', async () => {
    const { container } = show('/login'); submit(container)
    await waitFor(() => expect(container.querySelector('[name="password"]')).toHaveAttribute('aria-invalid', 'true'))
    expect(submitted).toEqual([])
  })
})
