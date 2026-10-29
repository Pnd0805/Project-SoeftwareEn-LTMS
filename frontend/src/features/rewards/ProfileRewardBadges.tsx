import { useUserRewards } from '../../hooks/useRewards'
import { RewardBadgeEmblem } from './RewardBadgeEmblem'

export function ProfileRewardBadges({ userId }: { userId: number }) {
  const rewards = useUserRewards(userId)
  const displayed = rewards.data?.items.filter(reward => reward.isDisplayed) ?? []
  if (rewards.isError || !displayed.length) return null
  return <span className="profile-reward-badges" role="group" aria-label="Displayed rewards">
    {displayed.map(reward => <RewardBadgeEmblem key={reward.id} reward={reward} compact />)}
  </span>
}
