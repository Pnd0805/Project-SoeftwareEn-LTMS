import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { viewer, pending, amendments, legacy, impact } = vi.hoisted(() => ({
  viewer: { id: 1, scope: null as { scopeType: string; facultyId: number | null } | null },
  pending: vi.fn(), amendments: vi.fn(), legacy: vi.fn(), impact: vi.fn(),
}))
vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), USE_MOCK: false }))
vi.mock('./useAuth', () => ({ useMe: () => ({ data: { id: viewer.id, adminScope: viewer.scope } }) }))
vi.mock('../api/admin', () => ({ getPendingTournamentRequests: pending, getAmendmentRequests: amendments, getTournamentRequests: legacy, getAmendmentImpact: impact }))
import { useAmendmentImpact, useAmendmentRequests, usePendingTournamentRequests, useTournamentRequests } from './useAdmin'

function setup(enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return renderHook(() => ({ pending: usePendingTournamentRequests(enabled), amendments: useAmendmentRequests(enabled), legacy: useTournamentRequests(), impact: useAmendmentImpact(7) }), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  viewer.id = 1; viewer.scope = null
  pending.mockResolvedValue({ items: [{ id: 10 }] })
  amendments.mockResolvedValue({ items: [{ id: 20 }] })
  legacy.mockResolvedValue({ items: [] })
  impact.mockResolvedValue({ requestId: 7, canApprove: true })
})
describe('admin queue request gating and cache isolation', () => {
  it.each([null, { scopeType: 'root', facultyId: null }, { scopeType: 'faculty', facultyId: null }, { scopeType: 'faculty', facultyId: 0 }])('does not request queues for disallowed or unresolved scope %j', scope => {
    viewer.scope = scope
    const { result } = setup()
    expect(result.current.pending.fetchStatus).toBe('idle')
    expect(result.current.amendments.fetchStatus).toBe('idle')
    expect(pending).not.toHaveBeenCalled()
    expect(amendments).not.toHaveBeenCalled()
    expect(legacy).not.toHaveBeenCalled()
    expect(impact).not.toHaveBeenCalled()
  })

  it.each([{ scopeType: 'faculty', facultyId: 1 }, { scopeType: 'university_wide', facultyId: null }])('requests both queues for allowed scope %j', async scope => {
    viewer.scope = scope
    const { result } = setup()
    await waitFor(() => expect(result.current.pending.isSuccess && result.current.amendments.isSuccess).toBe(true))
    expect(pending).toHaveBeenCalledTimes(1)
    expect(amendments).toHaveBeenCalledTimes(1)
    expect(legacy).toHaveBeenCalledTimes(1)
    expect(impact).toHaveBeenCalledExactlyOnceWith(7)
  })

  it('supports caller disabling even for an allowed admin', () => {
    viewer.scope = { scopeType: 'faculty', facultyId: 1 }
    setup(false)
    expect(pending).not.toHaveBeenCalled()
    expect(amendments).not.toHaveBeenCalled()
  })

  it('does not reuse a different scope or actor queue', async () => {
    viewer.scope = { scopeType: 'university_wide', facultyId: null }
    const { result, rerender } = setup()
    await waitFor(() => expect(result.current.pending.data?.items).toEqual([{ id: 10 }]))
    viewer.scope = { scopeType: 'faculty', facultyId: 1 }
    pending.mockResolvedValue({ items: [{ id: 11 }] })
    amendments.mockResolvedValue({ items: [{ id: 21 }] })
    rerender()
    expect(result.current.pending.data).toBeUndefined()
    expect(result.current.amendments.data).toBeUndefined()
    expect(result.current.impact.data).toBeUndefined()
    await waitFor(() => expect(result.current.pending.data?.items).toEqual([{ id: 11 }]))
    viewer.id = 2
    pending.mockResolvedValue({ items: [{ id: 12 }] })
    rerender()
    expect(result.current.pending.data).toBeUndefined()
    expect(result.current.impact.data).toBeUndefined()
    await waitFor(() => expect(result.current.pending.data?.items).toEqual([{ id: 12 }]))
    viewer.scope = { scopeType: 'root', facultyId: null }
    rerender()
    expect(result.current.pending.data).toBeUndefined()
    expect(result.current.amendments.data).toBeUndefined()
    expect(pending).toHaveBeenCalledTimes(3)
    expect(amendments).toHaveBeenCalledTimes(3)
    expect(impact).toHaveBeenCalledTimes(3)
  })
})
