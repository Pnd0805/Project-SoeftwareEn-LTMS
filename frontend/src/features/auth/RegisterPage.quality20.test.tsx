import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))

let submitted: unknown[]
let reject = false
let releaseFaculties: (() => void) | undefined
let holdFaculties = false
let holdDepartments = false
let releaseDepartments: (() => void) | undefined
const clients: QueryClient[] = []
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  submitted = []; reject = false; holdFaculties = false; holdDepartments = false
  releaseFaculties = undefined; releaseDepartments = undefined
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname.replace('/api/v1', '')
    if (path === '/auth/register') {
      submitted.push(JSON.parse(String(init?.body)))
      return reject ? json({ error: { code: 'VALIDATION_FAILED', message: 'Fixture rejected', fields: { email: 'Email already registered' } } }, 422)
        : json({ id: 9, fullName: 'Deliberate Student', email: 'chosen@ku.th' })
    }
    if (path === '/faculties') {
      if (holdFaculties) await new Promise<void>(resolve => { releaseFaculties = resolve })
      return json({ items: [{ id: 1, name: 'Science' }, { id: 2, name: 'Engineering' }] })
    }
    if (path === '/faculties/1/departments') return json({ items: [{ id: 1, facultyId: 1, name: 'Mathematics' }] })
    if (path === '/faculties/2/departments') {
      if (holdDepartments) await new Promise<void>(resolve => { releaseDepartments = resolve })
      return json({ items: [{ id: 8, facultyId: 2, name: 'Software Engineering' }] })
    }
    throw new Error(`Unexpected fixture request: ${path}`)
  }))
})
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals() })

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/register']}><Routes>
    <Route path="/register" element={<RegisterPage />} /><Route path="/login" element={<p>Sign in destination</p>} />
  </Routes></MemoryRouter></QueryClientProvider>)
}
function fillAccount() {
  for (const [label, value] of Object.entries({ 'Full name': 'Deliberate Student', Email: 'chosen@ku.th', Password: 'password123' }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
async function chooseStudent() {
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'other' } })
  fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2002-06-04' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next: Student details' }))
  await screen.findByRole('option', { name: 'Engineering' })
  fireEvent.change(screen.getByLabelText('Faculty'), { target: { value: '2' } })
  await screen.findByRole('option', { name: 'Software Engineering' })
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: '8' } })
  fireEvent.change(screen.getByLabelText('Year'), { target: { value: '3' } })
}

it('starts with unchosen student fields and does not submit invented values', async () => {
  const { container } = show()
  expect(screen.queryByLabelText('Faculty')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Gender')).toHaveValue('')
  expect(screen.getByLabelText('Birth date')).toHaveValue('')
  fillAccount()
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(screen.getByLabelText('Gender')).toHaveAttribute('aria-invalid', 'true'))
  expect(submitted).toEqual([])
})

it('does not select an identity when faculty reference data arrives late', async () => {
  holdFaculties = true
  show()
  fillAccount()
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'other' } })
  fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2002-06-04' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next: Student details' }))
  await waitFor(() => expect(releaseFaculties).toBeDefined())
  releaseFaculties!()
  await screen.findByRole('option', { name: 'Engineering' })
  expect(screen.getByLabelText('Faculty')).toHaveValue('')
  expect(screen.getByLabelText('Department')).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: 'Back to personal details' }))
  expect(screen.getByLabelText('Full name')).toHaveValue('Deliberate Student')
})

it('clears the old department immediately when faculty changes, even before the new list arrives', async () => {
  const { container } = show()
  fillAccount()
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'other' } })
  fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2002-06-04' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next: Student details' }))
  await screen.findByRole('option', { name: 'Science' })
  fireEvent.change(screen.getByLabelText('Faculty'), { target: { value: '1' } })
  await screen.findByRole('option', { name: 'Mathematics' })
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Year'), { target: { value: '3' } })
  holdDepartments = true
  fireEvent.change(screen.getByLabelText('Faculty'), { target: { value: '2' } })
  expect(screen.getByLabelText('Department')).toHaveValue('')
  fireEvent.submit(container.querySelector('form')!)
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  expect(submitted).toEqual([])
  await waitFor(() => expect(releaseDepartments).toBeDefined())
  releaseDepartments!()
  await screen.findByRole('option', { name: 'Software Engineering' })
  expect(screen.getByLabelText('Department')).toHaveValue('')
})

it('retains a deliberate draft on server field error and submits the unchanged payload on retry', async () => {
  reject = true
  const { container } = show()
  fillAccount(); await chooseStudent()
  fireEvent.submit(container.querySelector('form')!)
  await screen.findByText('Email already registered')
  expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Email already registered')
  expect(screen.getByLabelText('Gender')).toHaveValue('other')
  expect(screen.getByLabelText('Birth date')).toHaveValue('2002-06-04')
  reject = false
  fireEvent.click(screen.getByRole('button', { name: 'Next: Student details' }))
  await screen.findByRole('heading', { name: 'Step 2: Student details' })
  expect(screen.getByLabelText('Department')).toHaveValue('8')
  fireEvent.submit(container.querySelector('form')!)
  await screen.findByRole('heading', { name: 'Verify email' })
  expect(submitted).toEqual(Array(2).fill({ fullName: 'Deliberate Student', email: 'chosen@ku.th', password: 'password123', gender: 'other', birthDate: '2002-06-04', facultyId: 2, departmentId: 8, year: 3 }))
})
