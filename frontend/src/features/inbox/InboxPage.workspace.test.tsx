import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { InboxPage } from './InboxPage'

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))

const notification = { id: 31, title: 'Court changed', message: 'Use court B.', type: 'tournament_announcement',
  relatedEntityType: 'tournament', relatedEntityId: 42, isRead: false, createdAt: '2026-10-01T00:00:00Z' }
const invitation = { id: 12, team: { id: 9, name: 'Byte Force', sportTypeId: 1 },
  invitedBy: { id: 4, fullName: 'Lee Captain', avatarUrl: null }, expiresAt: '2026-12-01T00:00:00Z' }
const appointment = { id: 17, tournament: { id: 42, name: 'Autumn Cup' }, isExternal: true, createdAt: '2026-10-01T00:00:00Z' }
let read: boolean, joined: boolean, mutationFailure: boolean, sourceFailure: string, pendingEntries: boolean, emptyQueues: boolean
let client: QueryClient
const writes: { path: string; method: string; body: unknown }[] = []

beforeEach(() => {
  read = joined = mutationFailure = pendingEntries = emptyQueues = false; sourceFailure = ''; writes.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit = {}) => {
    const path = new URL(url, 'http://localhost').pathname.replace('/api/v1', '')
    const method = options.method ?? 'GET'
    if (method !== 'GET') {
      writes.push({ path, method, body: options.body ?? null })
      if (mutationFailure) return new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'Invitation no longer available.' } }), { status: 409 })
      if (path.includes('/notifications')) read = true
      if (path === '/invitations/12/accept') joined = true
      return new Response(JSON.stringify({ id: 17, invitationStatus: 'accepted', requiresAdminApproval: true }))
    }
    if (path === sourceFailure) return new Response(JSON.stringify({ error: { code: 'DENIED', message: 'This source is unavailable.' } }), { status: 403 })
    if (path === '/me/applications' && pendingEntries) return new Promise<Response>(() => {})
    const data = path === '/me' ? { id: 7, fullName: 'Player', userType: 'student' }
      : path === '/me/notifications' ? { items: read ? [] : [notification], unreadCount: read ? 0 : 1 }
      : path === '/me/invitations' ? { items: joined || emptyQueues ? [] : [invitation] }
      : path === '/me/referee-invitations' ? { items: emptyQueues ? [] : [appointment] }
      : path === '/me/referee-requests' ? { incoming: [], outgoing: [] } : { items: [] }
    return new Response(JSON.stringify(data))
  }))
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } } })
})
afterEach(() => { client.clear(); vi.unstubAllGlobals() })
const draw = () => render(<QueryClientProvider client={client}><MemoryRouter><InboxPage /></MemoryRouter></QueryClientProvider>)

it('retains a named mark-read result when the unread row disappears', async () => {
  draw(); await screen.findByText('Court changed')
  fireEvent.click(screen.getByRole('button', { name: 'Mark read: Court changed' }))
  await waitFor(() => expect(screen.queryByText('Court changed')).not.toBeInTheDocument())
  expect(screen.getByRole('status')).toHaveTextContent('Marked read: Court changed')
  expect(writes).toEqual([{ path: '/me/notifications/31/read', method: 'PATCH', body: null }])
})

it('retains the mark-all result when all notification rows disappear', async () => {
  draw(); await screen.findByText('Court changed')
  await screen.findByText('Byte Force')
  fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
  await waitFor(() => expect(screen.queryByText('Court changed')).not.toBeInTheDocument())
  expect(screen.getByRole('status')).toHaveTextContent('All notifications marked read')
  expect(screen.getByRole('status').compareDocumentPosition(screen.getByRole('region', { name: 'Needs action' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(writes).toEqual([{ path: '/me/notifications/read-all', method: 'POST', body: null }])
  expect(joined).toBe(false)
  expect(screen.getByRole('button', { name: 'Accept team invitation: Byte Force' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Accept referee invitation: Autumn Cup' })).toBeEnabled()
})

it('puts the counted pending decisions before notification history and pagination', async () => {
  draw(); await screen.findByText('Court changed'); await screen.findByText('Autumn Cup')
  const actions = screen.getByRole('region', { name: 'Needs action' })
  const updates = screen.getByRole('region', { name: 'Updates' })
  expect(within(actions).getByText('2 pending')).toBeInTheDocument()
  expect(within(actions).getByRole('button', { name: 'Accept team invitation: Byte Force' })).toBeEnabled()
  expect(within(updates).getByText('Court changed')).toBeInTheDocument()
  expect(actions.compareDocumentPosition(updates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('retains the team acceptance result after the invitation disappears', async () => {
  draw(); await screen.findByText('Byte Force')
  fireEvent.click(screen.getByRole('button', { name: 'Accept team invitation: Byte Force' }))
  await waitFor(() => expect(screen.queryByText('Byte Force')).not.toBeInTheDocument())
  expect(screen.getByRole('status')).toHaveTextContent('You joined Byte Force')
  expect(writes).toEqual([{ path: '/invitations/12/accept', method: 'POST', body: null }])
})

it.each(['Accept team invitation: Byte Force', 'Decline referee invitation: Autumn Cup'])('shows a recoverable mutation failure for %s', async name => {
  mutationFailure = true; draw(); await screen.findByText('Autumn Cup')
  fireEvent.click(screen.getByRole('button', { name }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Invitation no longer available')
  expect(screen.getByRole('button', { name })).toBeEnabled()
})

it('does not claim an external referee is eligible before admin approval', async () => {
  draw(); await screen.findByText('Autumn Cup')
  fireEvent.click(screen.getByRole('button', { name: 'Accept referee invitation: Autumn Cup' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Admin approval is still required')
  expect(screen.queryByText(/now eligible to officiate/)).not.toBeInTheDocument()
  expect(writes).toEqual([{ path: '/referee-invitations/17/accept', method: 'POST', body: null }])
})

it('keeps application loading separate from an empty action queue', async () => {
  pendingEntries = true; emptyQueues = true
  draw(); await screen.findByText('Loading entry decisions…')
  expect(screen.queryByText('Nothing waiting on you')).not.toBeInTheDocument()
})

it('offers recovery for failed entries without claiming the action queue is empty', async () => {
  sourceFailure = '/me/applications'; emptyQueues = true; draw()
  const retry = await screen.findByRole('button', { name: 'Retry entry decisions' })
  expect(screen.queryByText('Nothing waiting on you')).not.toBeInTheDocument()
  sourceFailure = ''; fireEvent.click(retry)
  await screen.findByText('Nothing waiting on you')
  expect(screen.queryByRole('button', { name: 'Retry entry decisions' })).not.toBeInTheDocument()
})

it.each(['/me/notifications', '/me/invitations', '/me/referee-invitations'])('hides cached private rows after access denial at %s', async source => {
  draw(); await screen.findByText('Court changed'); await screen.findByText('Byte Force'); await screen.findByText('Autumn Cup')
  sourceFailure = source
  await client.invalidateQueries()
  await waitFor(() => expect(screen.queryByText(source === '/me/notifications' ? 'Court changed' : source === '/me/invitations' ? 'Byte Force' : 'Autumn Cup')).not.toBeInTheDocument())
  expect(screen.getByRole('alert')).toHaveTextContent('unavailable')
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument()
})
