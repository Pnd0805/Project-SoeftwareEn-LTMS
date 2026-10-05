import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendPendingTournamentRequestDto } from '../../types/tournament.dto'
import { adminHomeTasks } from './adminHomeTasks'

const { fetchPendingRequests } = vi.hoisted(() => ({ fetchPendingRequests: vi.fn() }))

vi.mock('../../api/client', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/client')>(),
  USE_MOCK: false,
}))
vi.mock('../../api/admin', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/admin')>(),
  getPendingTournamentRequests: fetchPendingRequests,
}))

import { usePendingTournamentRequests } from '../../hooks/useAdmin'

const pendingRequest: BackendPendingTournamentRequestDto = {
  id: 41,
  name: 'Campus Cup',
  requestedBy: { id: 9001, fullName: 'Organizer', avatarUrl: null },
  sportTypeId: 4,
  eventStartDate: '2026-12-01',
  createdAt: '2026-10-01T00:00:00Z',
}

describe('admin home tasks', () => {
  beforeEach(() => fetchPendingRequests.mockReset())

  it('turns pending requests into review tasks with tournament context', () => {
    expect(adminHomeTasks([pendingRequest])).toEqual([{
      key: 'admin:tournament-request:41',
      source: 'admin',
      label: 'Review',
      context: 'Campus Cup',
      urgency: 'waiting',
      href: '/admin/requests',
    }])
  })

  it('honors the enabled argument and keeps real mode enabled by default', async () => {
    fetchPendingRequests.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children)

    const disabled = renderHook(() => usePendingTournamentRequests(false), { wrapper })
    expect(disabled.result.current.fetchStatus).toBe('idle')
    expect(fetchPendingRequests).not.toHaveBeenCalled()
    disabled.unmount()

    renderHook(() => usePendingTournamentRequests(), { wrapper })
    await waitFor(() => expect(fetchPendingRequests).toHaveBeenCalledOnce())
    client.clear()
  })
})
