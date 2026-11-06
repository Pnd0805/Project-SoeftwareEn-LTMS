import { apiFetch, USE_MOCK } from './client'
import {
  mockGetRewards,
  mockGetMyRewards,
  mockGetUserRewards,
  mockSetRewardDisplayed,
  mockRedeemReward,
} from '../mocks/rewards.mock'

export interface RewardDto {
  id: number
  type: string
  name: string
  description: string | null
  pointsRequired: number | null
  criteria: unknown | null
  iconKey: string | null
}

export interface UserRewardDto extends RewardDto {
  earnedAt: string
  isDisplayed: boolean
}

export interface RedeemRewardResponse {
  rewardId: number
  pointsSpent: number
  totalPoints: number
}

export const getRewards = () =>
  USE_MOCK ? mockGetRewards() : apiFetch<{ items: RewardDto[] }>('/rewards')

export const getMyRewards = () =>
  USE_MOCK ? mockGetMyRewards() : apiFetch<{ items: UserRewardDto[] }>('/me/rewards')

export const getUserRewards = (id: number) =>
  USE_MOCK ? mockGetUserRewards(id) : apiFetch<{ items: UserRewardDto[] }>(`/users/${id}/rewards`)

export const setRewardDisplayed = (id: number, isDisplayed: boolean) =>
  USE_MOCK
    ? mockSetRewardDisplayed(id, isDisplayed)
    : apiFetch<{ rewardId: number; isDisplayed: boolean }>(`/me/rewards/${id}/display`, {
        method: 'PATCH',
        body: JSON.stringify({ isDisplayed }),
      })

export const redeemReward = (id: number) =>
  USE_MOCK
    ? mockRedeemReward(id)
    : apiFetch<RedeemRewardResponse>(`/me/rewards/${id}/redeem`, {
        method: 'POST',
      })
