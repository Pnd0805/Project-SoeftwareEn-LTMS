import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, hasAccessToken, setAccessToken } from './client'
import { getRewards, getMyRewards, setRewardDisplayed, redeemReward } from './rewards'
import { mockRedeemReward, mockUsers } from '../mocks/rewards.mock'

const response = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  setAccessToken(null)
})

describe('rewards API client functions', () => {
  it('redeemReward calls POST /me/rewards/:id/redeem with bearer token and returns response', async () => {
    setAccessToken('test-token')
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        rewardId: 7,
        pointsSpent: 50,
        totalPoints: 120,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await redeemReward(7)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/me/rewards/7/redeem'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      }),
    )
    expect(result).toEqual({
      rewardId: 7,
      pointsSpent: 50,
      totalPoints: 120,
    })
  })

  it('getRewards calls GET /rewards', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        items: [{ id: 1, name: 'Badge 1', pointsRequired: 50 }],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getRewards()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rewards'),
      expect.anything(),
    )
    expect(result.items).toHaveLength(1)
  })

  it('setRewardDisplayed calls PATCH /me/rewards/:id/display', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        rewardId: 3,
        isDisplayed: false,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await setRewardDisplayed(3, false)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/me/rewards/3/display'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isDisplayed: false }),
      }),
    )
    expect(result).toEqual({ rewardId: 3, isDisplayed: false })
  })
})

describe('mockRedeemReward', () => {
  it('deducts points and succeeds when user has enough points', async () => {
    // User 2 has 120 points initially in mockUsers
    const res = await mockRedeemReward(3) // Bronze Supporter costs 30
    expect(res.rewardId).toBe(3)
    expect(res.pointsSpent).toBe(30)
    expect(res.totalPoints).toBe(90)
  })

  it('rejects with REWARD_ALREADY_OWNED if user already owns it', async () => {
    // Reward 3 was just redeemed above
    await expect(mockRedeemReward(3)).rejects.toMatchObject({
      code: 'REWARD_ALREADY_OWNED',
      status: 409,
    })
  })

  it('rejects with REWARD_NOT_PURCHASABLE for achievement rewards', async () => {
    await expect(mockRedeemReward(2)).rejects.toMatchObject({
      code: 'REWARD_NOT_PURCHASABLE',
      status: 409,
    })
  })

  it('rejects with INSUFFICIENT_POINTS if points are not enough', async () => {
    // Gold Legend costs 300, user now has 90 points
    await expect(mockRedeemReward(5)).rejects.toMatchObject({
      code: 'INSUFFICIENT_POINTS',
      status: 409,
      extra: expect.objectContaining({
        pointsRequired: 300,
        totalPoints: 90,
      }),
    })
  })
})
