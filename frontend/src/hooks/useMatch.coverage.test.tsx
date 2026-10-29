import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

vi.mock('../api/match', () => ({ updateMatch: vi.fn().mockResolvedValue({ id: 41 }) }))
import { useUpdateMatch } from './useMatch'

it('invalidates coverage and personal schedules after rescheduling so an old conflict is not retained', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const coverageKey = ['referees', 5, 'coverage']
  const personalKey = ['matches', 'mine']
  client.setQueryData(coverageKey, { crossTournamentConflicts: [{ userId: 70, matchId: 41, conflictCount: 1 }] })
  client.setQueryData(personalKey, { items: [] })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useUpdateMatch(41, 5), { wrapper })
  await act(async () => { await result.current.mutateAsync({ scheduledTime: '2026-10-08T03:00:00Z', scheduledEndTime: '2026-10-08T04:00:00Z' }) })
  expect(client.getQueryState(coverageKey)?.isInvalidated).toBe(true)
  expect(client.getQueryState(personalKey)?.isInvalidated).toBe(true)
  client.clear()
})
