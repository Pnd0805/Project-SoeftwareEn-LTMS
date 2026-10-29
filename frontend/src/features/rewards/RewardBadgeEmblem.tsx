import { Icon } from '../../components/kit/Icon'
import type { RewardDto } from '../../api/rewards'
import './rewards.css'

function getBadgeTier(reward: RewardDto): 'gold' | 'achievement' | 'standard' {
  if (reward.pointsRequired === null) return 'achievement'
  const name = reward.name.toLowerCase()
  const key = (reward.iconKey ?? '').toLowerCase()
  if (name.includes('gold') || key.includes('gold') || (reward.pointsRequired && reward.pointsRequired >= 150)) {
    return 'gold'
  }
  return 'standard'
}

export function RewardBadgeEmblem({ reward, compact = false }: { reward: RewardDto; compact?: boolean }) {
  const tier = getBadgeTier(reward)
  const iconName = tier === 'gold' || tier === 'achievement' ? 'star' : 'trophy'
  return <span className={`badge-card-emblem ${tier}${compact ? ' compact' : ''}`}
    role="img" aria-label={compact ? reward.name : 'Reward badge'} title={reward.name}>
    <Icon name={iconName} size={compact ? 20 : 22} />
  </span>
}
