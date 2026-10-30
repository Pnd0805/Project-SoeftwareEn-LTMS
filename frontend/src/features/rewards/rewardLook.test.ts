import { describe, expect, it } from 'vitest'
import type { RewardDto } from '../../api/rewards'
import { byRank, rewardLook } from './rewardLook'

const reward = (o: Partial<RewardDto>): RewardDto => ({ id: 1, type: 'badge', name: 'x', description: null, pointsRequired: null, criteria: null, iconKey: null, ...o })
const catalog = [
  reward({ criteria: { gte: 1, stat: 'matches_played' } }),
  reward({ criteria: { gte: 1, stat: 'wins' } }),
  reward({ type: 'achievement', criteria: { gte: 10, stat: 'wins' } }),
  reward({ type: 'achievement', criteria: { gte: 1, stat: 'championships' } }),
  reward({ type: 'achievement', criteria: { gte: 3, stat: 'championships' } }),
  reward({ type: 'achievement', criteria: { gte: 5, pickem: 'spot_on' } }),
  reward({ pointsRequired: 30 }),
]

describe('rewardLook', () => {
  it('gives every kind of reward its own icon', () => {
    const icons = catalog.map(r => rewardLook(r).icon)
    expect(new Set(icons).size).toBe(icons.length)
  })

  it('ranks supporter badges by the points they cost, keeping one icon', () => {
    const looks = [30, 100, 300].map(pointsRequired => rewardLook(reward({ pointsRequired })))
    expect(looks.map(l => l.rank)).toEqual(['bronze', 'silver', 'gold'])
    expect(new Set(looks.map(l => l.icon)).size).toBe(1)
  })

  it('calls what points can buy a badge and what is earned an achievement, whatever reward_type says', () => {
    expect(rewardLook(reward({ pointsRequired: 30 })).family).toBe('badge')
    expect(rewardLook(catalog[0]).family).toBe('achievement')
    expect(rewardLook(catalog[1]).family).toBe('achievement')
    expect(rewardLook(catalog[2]).family).toBe('achievement')
  })

  it('falls back safely when the backend adds a reward this file does not know', () => {
    expect(rewardLook(reward({ criteria: { stat: 'new_thing' } })).rank).toBe('bronze')
  })

  it('puts the highest rank first', () => {
    const sorted = byRank([catalog[0], catalog[4], catalog[3]])
    expect(sorted.map(r => rewardLook(r).rank)).toEqual(['legend', 'gold', 'bronze'])
  })
})
