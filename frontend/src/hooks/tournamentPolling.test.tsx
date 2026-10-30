import { act, renderHook } from '@testing-library/react'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ matches: vi.fn(), bracket: vi.fn(), standings: vi.fn(), leaderboard: vi.fn(), detail: vi.fn() }))
vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), USE_MOCK: false }))
vi.mock('../api/match', () => ({ getTournamentMatches: api.matches, getBracket: api.bracket, getStandings: api.standings }))
vi.mock('../api/liveEngagement', () => ({ getPickemLeaderboard: api.leaderboard }))
vi.mock('../api/tournament', () => ({ getTournament: api.detail }))
import { ApiError } from '../api/client'
import { useTournamentMatches, useStandings } from './useMatch'
import { useTournamentBracket } from './useTournamentBracket'
import { usePickemLeaderboard } from './useLiveEngagement'
import { useTournament } from './useTournament'
import { TournamentRefreshContext, TOURNAMENT_REFRESH_MS } from './tournamentPolling'

let client: QueryClient
let status: string, active: boolean
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(1) })
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(TOURNAMENT_REFRESH_MS) })
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
  <TournamentRefreshContext.Provider value={{ enabled: active, status }}>{children}</TournamentRefreshContext.Provider>
</QueryClientProvider>
const useBoards = () => ({ matches: useTournamentMatches(42), bracket: useTournamentBracket(42, true), standings: useStandings(42), leaderboard: usePickemLeaderboard(42) })
beforeEach(() => {
  vi.useFakeTimers()
  focusManager.setFocused(true)
  active = true; status = 'public'
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue({ items: [] })
})
afterEach(() => { client.clear(); focusManager.setFocused(undefined); vi.useRealTimers() })

it('refreshes all four board sources within 10 seconds for an idle spectator', async () => {
  renderHook(useBoards, { wrapper }); await settle()
  for (const fn of [api.matches, api.bracket, api.standings, api.leaderboard]) expect(fn).toHaveBeenCalledTimes(1)
  await tick()
  for (const fn of [api.matches, api.bracket, api.standings, api.leaderboard]) expect(fn).toHaveBeenCalledTimes(2)
})

it('stops for hidden browser tabs and inactive workspaces and resumes when visible', async () => {
  const hook = renderHook(useBoards, { wrapper }); await settle()
  focusManager.setFocused(false); await tick(); await tick()
  expect(api.matches).toHaveBeenCalledTimes(1)
  focusManager.setFocused(true); await settle(); await tick()
  expect(api.matches.mock.calls.length).toBeGreaterThan(1)
  active = false; hook.rerender(); const calls = api.matches.mock.calls.length
  await tick(); expect(api.matches).toHaveBeenCalledTimes(calls)
  hook.unmount(); await tick(); expect(api.matches).toHaveBeenCalledTimes(calls)
})

it.each(['completed', 'cancelled'])('stops all board polling once status changes to %s', async terminal => {
  const hook = renderHook(useBoards, { wrapper }); await settle()
  status = terminal; hook.rerender(); await tick(); await tick()
  for (const fn of [api.matches, api.bracket, api.standings, api.leaderboard]) expect(fn).toHaveBeenCalledTimes(1)
})

it('stops polling after failure and allows explicit retry to recover', async () => {
  api.matches.mockRejectedValueOnce(new ApiError(503, { code: 'SERVICE_UNAVAILABLE', message: 'Failed' }))
  const hook = renderHook(useBoards, { wrapper }); await settle(); await tick(); await tick()
  expect(api.matches).toHaveBeenCalledTimes(1)
  await act(async () => { await hook.result.current.matches.refetch() }); await settle(); await tick()
  expect(api.matches).toHaveBeenCalledTimes(3)
})

it('refreshes lifecycle status and stops itself when the server completes the tournament', async () => {
  api.detail.mockResolvedValueOnce({ id: 42, status: 'public' }).mockResolvedValue({ id: 42, status: 'completed' })
  renderHook(() => useTournament(42, true), { wrapper }); await settle(); await tick(); await settle(); await tick()
  expect(api.detail).toHaveBeenCalledTimes(2)
})

it('keeps unrelated match-list consumers on their existing non-polling behavior', async () => {
  renderHook(useBoards, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
  await settle(); await tick(); expect(api.matches).toHaveBeenCalledTimes(1)
})
