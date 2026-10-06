import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ mine: vi.fn(), catalogue: vi.fn(), display: vi.fn(), public: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/rewards', () => ({ getMyRewards: api.mine, getRewards: api.catalogue, setRewardDisplayed: api.display, getUserRewards: api.public }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 9 } }) }))
import { RewardsPage } from './RewardsPage'
const badge = { id: 1, name: 'First win', type: 'badge', description: 'Win a match', pointsRequired: null, criteria: null, iconKey: null, earnedAt: '2026-10-01T00:00:00Z', isDisplayed: true }
function page() {
  const qc = new QueryClient()
  render(<QueryClientProvider client={qc}><MemoryRouter><RewardsPage /></MemoryRouter></QueryClientProvider>)
  return qc
}
beforeEach(() => {
  api.mine.mockReset().mockResolvedValue({ items: [badge] }); api.catalogue.mockReset().mockResolvedValue({ items: [] })
  api.display.mockReset().mockResolvedValue({ rewardId: 1, isDisplayed: false })
})
describe('rewards display and revocation', () => {
  it('shows earned rewards by default, supplies artwork fallback, and sends false when Hide is checked', async () => {
    page()
    const hide = await screen.findByRole('checkbox', { name: 'Hide First win from profile' })
    await waitFor(() => expect(hide).toBeEnabled())
    expect(hide).not.toBeChecked()
    expect(screen.getByRole('img', { name: 'Reward badge' })).toBeInTheDocument()
    api.mine.mockResolvedValue({ items: [{ ...badge, isDisplayed: false }] })
    fireEvent.click(hide)
    await waitFor(() => expect(api.display).toHaveBeenCalledWith(1, false))
    expect(await screen.findByText('Hidden from profile')).toBeInTheDocument()
    expect(hide).toBeChecked()
  })
  it('removes a revoked badge even when the refreshed list has the same count', async () => {
    const qc = page()
    await screen.findByText('First win')
    api.mine.mockResolvedValue({ items: [{ ...badge, id: 2, name: 'Next award' }] })
    await act(async () => { await qc.invalidateQueries({ queryKey: ['rewards'] }) })
    expect(await screen.findByText('Next award')).toBeInTheDocument()
    expect(screen.queryByText('First win')).not.toBeInTheDocument()
  })
})
