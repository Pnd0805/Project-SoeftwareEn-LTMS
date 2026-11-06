import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchAdminRequests } = vi.hoisted(() => ({ fetchAdminRequests: vi.fn() }))

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/admin', async original => ({
  ...await original<typeof import('../../api/admin')>(),
  getPendingTournamentRequests: fetchAdminRequests,
}))
vi.mock('../../hooks/useTeam', () => ({
  useBackendMyInvitations: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useBackendMyTeams: () => ({ data: { items: [] }, isPending: false, isError: false }),
}))
vi.mock('../../hooks/useAdmin', async original => ({
  ...await original<typeof import('../../hooks/useAdmin')>(),
  useMyRefereeInvitations: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useMyRefereeRequests: () => ({ data: { incoming: [] }, isPending: false, isError: false }),
}))
vi.mock('../../hooks/useMatch', () => ({
  useMyMatches: () => ({ data: { items: [] }, isPending: false, isError: false }),
}))
vi.mock('../../hooks/useTournament', () => ({
  useMyTournaments: () => ({ data: { items: [] }, isPending: false, isError: false }),
}))

import { RealHomeTasks } from './RealHomeTasks'

function renderTasks() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><MemoryRouter><RealHomeTasks /></MemoryRouter></QueryClientProvider>)
  return client
}

describe('Home with the existing real Admin-access probe', () => {
  beforeEach(() => fetchAdminRequests.mockReset())
  afterEach(() => vi.unstubAllGlobals())

  it('shows honest empty work after an actual 403 without enabling Admin requests', async () => {
    const fetchProbe = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'INSUFFICIENT_ADMIN_SCOPE', message: 'No Admin access' },
    }), { status: 403 }))
    vi.stubGlobal('fetch', fetchProbe)
    const client = renderTasks()

    expect(await screen.findByText('No tasks right now')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry Admin/ })).not.toBeInTheDocument()
    expect(fetchAdminRequests).not.toHaveBeenCalled()
    expect(fetchProbe).toHaveBeenCalledOnce()
    expect(fetchProbe.mock.calls[0][0]).toContain('/admin/scopes')
    client.clear()
  })

  it.each(['server', 'network'] as const)('keeps an actual %s probe failure visible and retries it', async kind => {
    const fetchProbe = kind === 'server'
      ? vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
        error: { code: 'SERVER_ERROR', message: 'Try later' },
      }), { status: 500 })))
      : vi.fn().mockRejectedValue(new TypeError('Network unavailable'))
    vi.stubGlobal('fetch', fetchProbe)
    const client = renderTasks()

    expect(await screen.findByRole('alert')).toHaveTextContent('Some work could not load')
    expect(screen.getByText('Admin requests')).toBeVisible()
    expect(screen.queryByText('No tasks right now')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry Admin requests' }))
    await waitFor(() => expect(fetchProbe).toHaveBeenCalledTimes(2))
    expect(fetchAdminRequests).not.toHaveBeenCalled()
    client.clear()
  })
})
