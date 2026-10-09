import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../api/liveEngagement', () => ({ getPickemLeaderboard: api.get }))
import { PickemLeaderboardPanel } from './PickemLeaderboardPanel'
const pageData = (page: number) => ({ items: [{ rank: 20, user: { id: page, fullName: `Player on page ${page}`, avatarUrl: null }, points: 10, correct: 1, settled: 1 }], pagination: { page, pageSize: 20, totalItems: 21, totalPages: 2 } })
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PickemLeaderboardPanel tournamentId={23} /></QueryClientProvider>)
beforeEach(() => { api.get.mockReset(); api.get.mockImplementation(async (_id: number, page: number) => pageData(page)) })
it('loads different page keys, keeps global ranks, and allows navigation back', async () => {
  show()
  await screen.findByText('#20 Player on page 1')
  expect(screen.getByRole('button', { name: 'Previous leaderboard page' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Next leaderboard page' }))
  await screen.findByText('#20 Player on page 2')
  expect(api.get).toHaveBeenCalledWith(23, 2, 20)
  expect(screen.getByText('Page 2 of 2 · 21 players')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next leaderboard page' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Previous leaderboard page' }))
  await screen.findByText('#20 Player on page 1')
  expect(screen.getByText(/up to 5 seconds/)).toBeInTheDocument()
})
it('shows page loading then a real failure without stale rows, and retries the same page', async () => {
  let fail: (reason: Error) => void = () => {}
  api.get.mockImplementationOnce(async () => pageData(1)).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
  show(); await screen.findByText('#20 Player on page 1')
  fireEvent.click(screen.getByRole('button', { name: 'Next leaderboard page' }))
  await screen.findByText('Loading leaderboard…')
  expect(screen.queryByText('#20 Player on page 1')).not.toBeInTheDocument()
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
  fail(new ApiError(404, { code: 'TOURNAMENT_NOT_FOUND', message: 'Unavailable' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('No settled predictions yet.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh leaderboard' }))
  await screen.findByText('#20 Player on page 2')
})
it('does not treat an old items-only response as a complete leaderboard', async () => {
  api.get.mockResolvedValue({ items: [] }); show()
  await screen.findByRole('alert')
  expect(screen.queryByText('No settled predictions yet.')).not.toBeInTheDocument()
})
it('handles an empty leaderboard using the server total', async () => {
  api.get.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }); show()
  await screen.findByText('No settled predictions yet.')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next leaderboard page' })).toBeDisabled())
})
