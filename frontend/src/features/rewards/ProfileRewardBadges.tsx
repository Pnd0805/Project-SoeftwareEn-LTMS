import { Link } from 'react-router-dom'
import type { UserRewardDto } from '../../api/rewards'
import { useUserRewards } from '../../hooks/useRewards'
import { RewardBadgeEmblem } from './RewardBadgeEmblem'
import { byRank, rewardFamily } from './rewardLook'

/* แสดงการ์ดเสมอแม้ว่าง — ถ้าซ่อนหมวดที่ไม่มีของ คนดูจะไม่รู้ว่ารางวัลแบ่งเป็นสองหมวด */
function ShowcaseGroup({ title, rewards }: { title: string; rewards: UserRewardDto[] }) {
  return <section className="reward-showcase-group" aria-label={title}>
    <h2 className="tag">{title} · {rewards.length}</h2>
    {rewards.length ? <ul className="reward-showcase-list">
      {byRank(rewards).map(reward => <li key={reward.id}>
        <RewardBadgeEmblem reward={reward} compact />
        <span className="reward-showcase-name" aria-hidden="true">{reward.name}</span>
      </li>)}
    </ul> : <p className="reward-showcase-empty sub">None on show</p>}
  </section>
}

/** โชว์ในกรอบบนสุดของโปรไฟล์ — `own` คือหน้าของตัวเอง จึงมีทางไปหน้ารางวัล */
export function ProfileRewardBadges({ userId, own = false }: { userId: number; own?: boolean }) {
  const rewards = useUserRewards(userId)
  const displayed = rewards.data?.items.filter(reward => reward.isDisplayed) ?? []
  if (rewards.isError || rewards.isPending) return null
  if (!displayed.length && !own) return null
  return <div className="reward-showcase" role="group" aria-label="Displayed rewards">
    <ShowcaseGroup title="Badges" rewards={displayed.filter(reward => rewardFamily(reward) === 'badge')} />
    <ShowcaseGroup title="Achievements" rewards={displayed.filter(reward => rewardFamily(reward) === 'achievement')} />
    {own ? <Link className="reward-showcase-more" to="/me/rewards">View all rewards</Link> : null}
  </div>
}
