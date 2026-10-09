import { apiFetch } from './client'

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
export const getRewards = () => apiFetch<{ items: RewardDto[] }>('/rewards')
export const getMyRewards = () => apiFetch<{ items: UserRewardDto[] }>('/me/rewards')
export const getUserRewards = (id: number) => apiFetch<{ items: UserRewardDto[] }>(`/users/${id}/rewards`)
export const setRewardDisplayed = (id: number, isDisplayed: boolean) =>
  apiFetch<{ rewardId: number; isDisplayed: boolean }>(`/me/rewards/${id}/display`, {
    method: 'PATCH', body: JSON.stringify({ isDisplayed }),
  })
