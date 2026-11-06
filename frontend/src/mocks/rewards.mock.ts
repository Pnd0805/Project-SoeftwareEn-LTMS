import { mockDelay, mockReject } from '../api/client'
import type { RewardDto, UserRewardDto, RedeemRewardResponse } from '../api/rewards'
import { mockUsers } from './user.mock'

export const seedRewards: RewardDto[] = [
  {
    id: 1,
    type: 'badge',
    name: 'First Win',
    description: 'ชนะการแข่งขันแมตช์แรกในทัวร์นาเมนต์',
    pointsRequired: null,
    criteria: { wins: 1 },
    iconKey: 'trophy',
  },
  {
    id: 2,
    type: 'badge',
    name: 'Tournament Champion',
    description: 'คว้าตำแหน่งแชมป์ทัวร์นาเมนต์',
    pointsRequired: null,
    criteria: { champion: 1 },
    iconKey: 'trophy',
  },
  {
    id: 3,
    type: 'badge',
    name: 'Bronze Supporter',
    description: 'เหรียญแฟนคลับระดับบรอนซ์สำหรับผู้ร่วมเชียร์และทายผล',
    pointsRequired: 30,
    criteria: null,
    iconKey: 'badge-bronze',
  },
  {
    id: 4,
    type: 'badge',
    name: 'Silver Veteran',
    description: 'เหรียญแฟนคลับระดับซิลเวอร์สำหรับผู้เล่นและแฟนคลับระดับสูง',
    pointsRequired: 80,
    criteria: null,
    iconKey: 'badge-silver',
  },
  {
    id: 5,
    type: 'badge',
    name: 'Gold Legend',
    description: 'เหรียญทองระดับตำนานสำหรับสุดยอดผู้เล่น',
    pointsRequired: 300,
    criteria: null,
    iconKey: 'badge-gold',
  },
]

// In-memory user rewards: map of userId -> UserRewardDto[]
const userRewardsMap = new Map<number, UserRewardDto[]>([
  [
    2,
    [
      {
        ...seedRewards[0],
        earnedAt: '2026-10-01T00:00:00Z',
        isDisplayed: true,
      },
    ],
  ],
])

export function getMockCurrentUserId(): number | null {
  const saved = Number(localStorage.getItem('ltms-mock-user-id'))
  return Number.isInteger(saved) && saved > 0 ? saved : 2
}

export async function mockGetRewards(): Promise<{ items: RewardDto[] }> {
  return mockDelay({ items: [...seedRewards] })
}

export async function mockGetMyRewards(): Promise<{ items: UserRewardDto[] }> {
  const userId = getMockCurrentUserId()
  if (!userId) return mockReject(401, { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อน' })
  const rewards = userRewardsMap.get(userId) ?? []
  return mockDelay({ items: [...rewards] })
}

export async function mockGetUserRewards(userId: number): Promise<{ items: UserRewardDto[] }> {
  const rewards = (userRewardsMap.get(userId) ?? []).filter(r => r.isDisplayed)
  return mockDelay({ items: [...rewards] })
}

export async function mockSetRewardDisplayed(id: number, isDisplayed: boolean): Promise<{ rewardId: number; isDisplayed: boolean }> {
  const userId = getMockCurrentUserId()
  if (!userId) return mockReject(401, { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อน' })
  const list = userRewardsMap.get(userId) ?? []
  const item = list.find(r => r.id === id)
  if (!item) return mockReject(404, { code: 'REWARD_NOT_FOUND', message: 'ไม่พบเหรียญรางวัลนี้' })
  item.isDisplayed = isDisplayed
  return mockDelay({ rewardId: id, isDisplayed })
}

export async function mockRedeemReward(id: number): Promise<RedeemRewardResponse> {
  const userId = getMockCurrentUserId()
  if (!userId) return mockReject(401, { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อน' })

  const user = mockUsers.find(u => u.id === userId)
  const reward = seedRewards.find(r => r.id === id)
  if (!reward) {
    return mockReject(404, { code: 'REWARD_NOT_FOUND', message: 'ไม่มีรางวัลนี้หรือถูกปิดการใช้งานแล้ว' })
  }
  if (reward.pointsRequired === null) {
    return mockReject(409, { code: 'REWARD_NOT_PURCHASABLE', message: 'รางวัลนี้ไม่ได้ขายด้วยแต้ม' })
  }

  const list = userRewardsMap.get(userId) ?? []
  if (list.some(r => r.id === id)) {
    return mockReject(409, { code: 'REWARD_ALREADY_OWNED', message: 'คุณครอบครองรางวัลนี้อยู่แล้ว' })
  }

  const userPoints = user ? user.totalPoints : 0
  if (userPoints < reward.pointsRequired) {
    return mockReject(409, {
      code: 'INSUFFICIENT_POINTS',
      message: `แต้มไม่พอ (ขาดอีก ${reward.pointsRequired - userPoints} แต้ม)`,
      pointsRequired: reward.pointsRequired,
      totalPoints: userPoints,
    })
  }

  const pointsSpent = reward.pointsRequired
  const totalPoints = userPoints - pointsSpent
  if (user) {
    user.totalPoints = totalPoints
  }

  const userReward: UserRewardDto = {
    ...reward,
    earnedAt: new Date().toISOString(),
    isDisplayed: true,
  }
  userRewardsMap.set(userId, [...list, userReward])

  return mockDelay({
    rewardId: id,
    pointsSpent,
    totalPoints,
  })
}
