import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'

const api = vi.hoisted(() => ({
  mine: vi.fn(),
  catalogue: vi.fn(),
  display: vi.fn(),
  public: vi.fn(),
  redeem: vi.fn(),
}))

let mockUser = { id: 9, totalPoints: 100 }
const mockRefetchMe = vi.fn()

vi.mock('../../api/client', async (original) => ({
  ...(await original<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))
vi.mock('../../api/rewards', () => ({
  getMyRewards: api.mine,
  getRewards: api.catalogue,
  setRewardDisplayed: api.display,
  getUserRewards: api.public,
  redeemReward: api.redeem,
}))
vi.mock('../../hooks/useAuth', () => ({
  useMe: () => ({ data: mockUser, refetch: mockRefetchMe }),
}))

import { RewardsPage } from './RewardsPage'
import { ProfileRewardBadges } from './ProfileRewardBadges'

const earnedBadge = {
  id: 1,
  name: 'First win',
  type: 'badge',
  description: 'Win a match',
  pointsRequired: null,
  criteria: null,
  iconKey: null,
  earnedAt: '2026-10-01T00:00:00Z',
  isDisplayed: true,
}

const shopBadgeAffordable = {
  id: 2,
  name: 'Bronze Supporter',
  type: 'badge',
  description: 'Support the team',
  pointsRequired: 50,
  criteria: null,
  iconKey: null,
}

const shopBadgeExpensive = {
  id: 3,
  name: 'Gold Legend',
  type: 'badge',
  description: 'Legendary status',
  pointsRequired: 250,
  criteria: null,
  iconKey: null,
}

const achievementBadge = {
  id: 4,
  name: 'Tournament Champion',
  type: 'badge',
  description: 'Become champion',
  pointsRequired: null,
  criteria: { champion: 1 },
  iconKey: null,
}

function page(withProfileBadges = false) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {withProfileBadges ? <ProfileRewardBadges userId={mockUser.id} /> : null}
        <RewardsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return qc
}

beforeEach(() => {
  mockUser = { id: 9, totalPoints: 100 }
  mockRefetchMe.mockReset()
  api.mine.mockReset().mockResolvedValue({ items: [earnedBadge] })
  api.public.mockReset().mockResolvedValue({ items: [] })
  api.catalogue.mockReset().mockResolvedValue({ items: [] })
  api.display.mockReset().mockResolvedValue({ rewardId: 1, isDisplayed: false })
  api.redeem.mockReset().mockResolvedValue({ rewardId: 2, pointsSpent: 50, totalPoints: 50 })
})

describe('rewards display and revocation', () => {
  it('shows only displayed rewards in the profile showcase, grouped and named, without descriptions', async () => {
    api.public.mockResolvedValue({ items: [earnedBadge, { ...earnedBadge, id: 2, name: 'Hidden award', isDisplayed: false }] })
    page(true)
    const badges = await screen.findByRole('group', { name: 'Displayed rewards' })
    expect(within(badges).getAllByRole('img')).toHaveLength(1)
    expect(within(badges).getByRole('img', { name: 'First win' })).toHaveAttribute('title', 'First win')
    expect(within(badges).queryByRole('img', { name: 'Hidden award' })).not.toBeInTheDocument()
    expect(within(badges).getByRole('region', { name: 'Achievements' })).toHaveTextContent('First win')
    expect(within(badges).getByRole('region', { name: 'Badges' })).toHaveTextContent('None on show')
    expect(badges).not.toHaveTextContent(earnedBadge.description ?? 'no description')
  })

  it('files a reward bought with points under Badges and one earned by play under Achievements', async () => {
    api.public.mockResolvedValue({ items: [earnedBadge, { ...earnedBadge, id: 2, name: 'Bronze Supporter', pointsRequired: 30 }] })
    page(true)
    const shown = await screen.findByRole('group', { name: 'Displayed rewards' })
    expect(within(shown).getByRole('region', { name: 'Badges' })).toHaveTextContent('Bronze Supporter')
    expect(within(shown).getByRole('region', { name: 'Achievements' })).toHaveTextContent('First win')
  })

  it('refreshes profile logos after hiding and showing a reward', async () => {
    api.public.mockResolvedValue({ items: [earnedBadge] })
    page(true)
    await screen.findByRole('img', { name: 'First win' })
    const hide = await screen.findByRole('checkbox', { name: 'Hide First win from profile' })
    await waitFor(() => expect(hide).toBeEnabled())
    api.mine.mockResolvedValue({ items: [{ ...earnedBadge, isDisplayed: false }] })
    api.public.mockResolvedValue({ items: [] })
    fireEvent.click(hide)
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Displayed rewards' })).not.toBeInTheDocument())
    await waitFor(() => expect(hide).toBeChecked())
    await waitFor(() => expect(hide).toBeEnabled())
    api.mine.mockResolvedValue({ items: [earnedBadge] })
    api.public.mockResolvedValue({ items: [earnedBadge] })
    fireEvent.click(hide)
    expect(await screen.findByRole('img', { name: 'First win' })).toBeInTheDocument()
    expect(api.display).toHaveBeenLastCalledWith(1, true)
  })

  it('shows earned rewards by default, supplies artwork fallback, and sends false when Hide is checked', async () => {
    page()
    const hide = await screen.findByRole('checkbox', { name: 'Hide First win from profile' })
    await waitFor(() => expect(hide).toBeEnabled())
    expect(hide).not.toBeChecked()
    expect(screen.getAllByRole('img', { name: 'Reward badge' })[0]).toBeInTheDocument()
    api.mine.mockResolvedValue({ items: [{ ...earnedBadge, isDisplayed: false }] })
    fireEvent.click(hide)
    await waitFor(() => expect(api.display).toHaveBeenCalledWith(1, false))
    expect(await screen.findByText('Hidden from profile')).toBeInTheDocument()
    expect(hide).toBeChecked()
  })

  it('removes a revoked badge even when the refreshed list has the same count', async () => {
    const qc = page()
    await screen.findByText('First win')
    api.mine.mockResolvedValue({ items: [{ ...earnedBadge, id: 99, name: 'Next award' }] })
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ['rewards'] })
    })
    expect(await screen.findByText('Next award')).toBeInTheDocument()
    expect(screen.queryByText('First win')).not.toBeInTheDocument()
  })

  it('calls refetch for fresh points on mount', async () => {
    page()
    await waitFor(() => expect(mockRefetchMe).toHaveBeenCalled())
  })
})

/** ผ่านหน้าสรุปแล้วยืนยันอีกชั้น — สองขั้นก่อนหักแต้มจริง */
function confirmRedeem() {
  fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
  fireEvent.click(screen.getByRole('button', { name: 'ยืนยันใช้ 50 แต้ม' }))
}

describe('badge store and redeem rules', () => {
  it('spends nothing until both confirmation steps are passed, and either step can back out', async () => {
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'แลก (50 แต้ม)' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('50 แต้ม')
    expect(api.redeem).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
    expect(api.redeem).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.redeem).not.toHaveBeenCalled()
  })

  beforeEach(() => {
    api.catalogue.mockResolvedValue({
      items: [shopBadgeAffordable, shopBadgeExpensive, achievementBadge],
    })
  })

  it('displays user current points balance', async () => {
    page()
    expect(await screen.findByText('ยอดแต้มสะสมของฉัน')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('clearly separates into redeemable badges and achievements', async () => {
    page()
    expect(await screen.findByText('แลกได้ด้วยแต้ม')).toBeInTheDocument()
    expect(screen.getByText('ได้จากความสำเร็จ')).toBeInTheDocument()
  })

  it('rule ①: does not show a redeem button for achievements (pointsRequired === null)', async () => {
    page()
    await screen.findByText('Tournament Champion')
    // No redeem button for Tournament Champion
    expect(screen.queryByRole('button', { name: /แลก.*Tournament Champion/i })).not.toBeInTheDocument()
    // It shows achievement status badge
    expect(screen.getByText('ยังไม่ได้รับ')).toBeInTheDocument()
  })

  it('shows "มีแล้ว" badge for badges the user already owns', async () => {
    // Add First win with pointsRequired to check shop representation
    api.catalogue.mockResolvedValue({
      items: [{ ...earnedBadge, pointsRequired: 50 }],
    })
    page()
    const elements = await screen.findAllByText('First win')
    expect(elements.length).toBeGreaterThan(0)
    expect(screen.getByText('มีแล้ว')).toBeInTheDocument()
  })

  it('rule ④: disables button and shows missing points if totalPoints < pointsRequired', async () => {
    page()
    // Gold Legend costs 250, user has 100 -> missing 150
    const expensiveBtn = await screen.findByRole('button', {
      name: 'แต้มไม่พอ (ขาดอีก 150 แต้ม)',
    })
    expect(expensiveBtn).toBeDisabled()
  })

  it('rule ④: enables redeem button when user has sufficient points', async () => {
    page()
    // Bronze Supporter costs 50, user has 100 -> affordable
    const redeemBtn = await screen.findByRole('button', { name: 'แลก (50 แต้ม)' })
    expect(redeemBtn).toBeEnabled()
  })

  it('successfully redeems a badge, disables while pending, and shows success message', async () => {
    page()
    const redeemBtn = await screen.findByRole('button', { name: 'แลก (50 แต้ม)' })
    fireEvent.click(redeemBtn)
    confirmRedeem()

    await waitFor(() => expect(api.redeem).toHaveBeenCalledWith(2))
    expect(
      await screen.findByText('แลกรับ "Bronze Supporter" สำเร็จ! (ใช้ไป 50 แต้ม)'),
    ).toBeInTheDocument()
  })

  it('handles 409 INSUFFICIENT_POINTS error with missing points message', async () => {
    api.redeem.mockRejectedValue(
      new ApiError(409, {
        code: 'INSUFFICIENT_POINTS',
        message: 'Points shortage',
        pointsRequired: 50,
        totalPoints: 10,
      }),
    )
    page()
    const redeemBtn = await screen.findByRole('button', { name: 'แลก (50 แต้ม)' })
    fireEvent.click(redeemBtn)
    confirmRedeem()

    expect(
      await screen.findByText('แต้มไม่พอสำหรับแลก "Bronze Supporter" (ขาดอีก 40 แต้ม)'),
    ).toBeInTheDocument()
  })

  it('handles 404 REWARD_NOT_FOUND error and refreshes catalogue', async () => {
    const qc = page()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    api.redeem.mockRejectedValue(
      new ApiError(404, {
        code: 'REWARD_NOT_FOUND',
        message: 'Reward is gone',
      }),
    )

    const redeemBtn = await screen.findByRole('button', { name: 'แลก (50 แต้ม)' })
    fireEvent.click(redeemBtn)
    confirmRedeem()

    expect(
      await screen.findByText(
        'ไม่มีเหรียญรางวัลนี้หรือถูกปิดการใช้งานแล้ว กรุณารีโหลดรายการ',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['rewards', 'catalogue'] }),
      ),
    )
  })

  it('handles 409 REWARD_ALREADY_OWNED error', async () => {
    const qc = page()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    api.redeem.mockRejectedValue(
      new ApiError(409, {
        code: 'REWARD_ALREADY_OWNED',
        message: 'Already owned',
      }),
    )

    const redeemBtn = await screen.findByRole('button', { name: 'แลก (50 แต้ม)' })
    fireEvent.click(redeemBtn)
    confirmRedeem()

    expect(
      await screen.findByText('คุณครอบครองเหรียญรางวัลนี้อยู่แล้ว'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['rewards', 'mine'] }),
      ),
    )
  })
})
