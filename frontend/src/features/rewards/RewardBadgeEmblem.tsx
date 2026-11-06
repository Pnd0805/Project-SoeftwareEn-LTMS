import type { RewardDto } from '../../api/rewards'
import { rewardLook } from './rewardLook'
import './rewards.css'

/* กรอบวาดเป็น SVG เพราะหกเหลี่ยมด้วย clip-path ตัดเส้นขอบทิ้ง */
const FRAME = {
  badge: { outer: <circle cx="24" cy="24" r="22" />, inner: <circle cx="24" cy="24" r="18" /> },
  achievement: { outer: <path d="M24 2 43 13v22L24 46 5 35V13Z" />, inner: <path d="M24 6.6 39 15.3v17.4L24 41.4 9 32.7V15.3Z" /> },
}

export function RewardBadgeEmblem({ reward, compact = false }: { reward: RewardDto; compact?: boolean }) {
  const { icon: Glyph, rank, family } = rewardLook(reward)
  const frame = FRAME[family]
  return <span className={`reward-emblem ${rank} ${family}${compact ? ' compact' : ''}`}
    role="img" aria-label={compact ? reward.name : 'Reward badge'} title={reward.name}>
    <svg className="reward-emblem-frame" viewBox="0 0 48 48" aria-hidden="true">
      <g className="outer">{frame.outer}</g>
      {rank === 'gold' ? <g className="inner">{frame.inner}</g> : null}
    </svg>
    <Glyph className="reward-emblem-glyph" aria-hidden="true" strokeWidth={1.8} strokeLinecap="square" strokeLinejoin="miter" />
  </span>
}
