import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
const state = vi.hoisted(() => ({ applied: false, apply: vi.fn(), read: vi.fn() }))
vi.mock('../api/tournament', () => ({
  getMyApplications: state.read,
  applyToTournament: state.apply,
}))
import { useApplyToTournament, useMyTournamentApplications } from './useTournament'
it('refetches personal application status immediately after successful submission', async () => {
  state.applied = false
  state.read.mockImplementation(async () => ({ items: state.applied ? [{ id: 7, tournament: { id: 23 }, team: { id: 42 }, status: 'pending' }] : [] }))
  state.apply.mockImplementation(async () => { state.applied = true; return { id: 7 } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const hook = renderHook(() => ({ applications: useMyTournamentApplications(), apply: useApplyToTournament(23) }), { wrapper })
  await waitFor(() => expect(hook.result.current.applications.data?.items).toEqual([]))
  await act(() => hook.result.current.apply.mutateAsync({ teamId: 42, playerIds: [9] }))
  await waitFor(() => expect(hook.result.current.applications.data?.items[0]).toMatchObject({ id: 7, status: 'pending' }))
  expect(state.read).toHaveBeenCalledTimes(2)
})
