import { setAccessToken } from '../../api/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
import { AdminRefereesTab } from './AdminRefereesTab'
let decided: boolean
let blocked: boolean
const writes: Array<{ path: string; body: unknown }> = []
const clients: QueryClient[] = []
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
beforeEach(() => {
  setAccessToken("test-token")
 decided = false; blocked = false; writes.length = 0
 vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = new URL(String(input), 'http://localhost').pathname.replace('/api/v1', '')
  if (path === '/admin/referee-requests') return json({ items: decided ? [] : [{ userId: 9054, user: { id: 9054, fullName: 'Alex External', email: 'alex@example.test', avatarUrl: null }, docs: [], docsSubmitted: true, tournaments: [{ id: 14, name: 'Campus Cup', tournamentRefereeId: 19 }], submittedAt: '2026-10-08T00:00:00Z' }] })
  if (path.endsWith('/approve') || path.endsWith('/reject')) {
   writes.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined })
   if (blocked) return json({ error: { code: 'INSUFFICIENT_ADMIN_SCOPE', message: 'Scope does not permit this decision' } }, 403)
   decided = true
   return json({ userId: 9054, identityStatus: path.endsWith('/approve') ? 'approved' : 'rejected', tournamentsUpdated: 1 })
  }
  throw new Error(`Unexpected request: ${path}`)
 }))
})
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals() })
function show() {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client)
 render(<QueryClientProvider client={client}><MemoryRouter><AdminRefereesTab /></MemoryRouter></QueryClientProvider>)
}
it.each([true, false])('refreshes the queue and retains success feedback after approve=%s', async approve => {
 show(); await screen.findByText('Alex External')
 if (approve) fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
 else {
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
  fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Unclear document' } })
  fireEvent.click(screen.getByRole('button', { name: 'Do not approve' }))
 }
 await screen.findByText('Nothing waiting.')
 expect(screen.getByRole('status')).toHaveTextContent('Alex External')
 expect(screen.queryByText(/decision did not go through/)).not.toBeInTheDocument()
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 expect(writes).toEqual([{ path: `/admin/referee-requests/9054/${approve ? 'approve' : 'reject'}`, body: approve ? undefined : { reason: 'Unclear document' } }])
})
it('keeps the queue and backend error when approval is forbidden', async () => {
 blocked = true; show(); await screen.findByText('Alex External')
 fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
 await screen.findByText('Scope does not permit this decision')
 await waitFor(() => expect(screen.getByText('Alex External')).toBeInTheDocument())
 expect(screen.queryByRole('status')).not.toBeInTheDocument()
 expect(writes).toHaveLength(1)
})
