import { Link } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import { useMyRewards, useRewardCatalogue, useRewardDisplay, useUserRewards } from '../../hooks/useRewards'
import { USE_MOCK } from '../../api/client'
import { Badge, Banner, Empty, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import type { RewardDto } from '../../api/rewards'

function RewardName({ reward }: { reward: RewardDto }) {
  // iconKey is an object key, not an image URL. Use the existing trophy until assets are delivered.
  return <span className="hstack"><span role="img" aria-label="Reward badge"><Icon name="trophy" size={28} /></span><b>{reward.name}</b></span>
}

export function PublicRewards({ userId }: { userId: number }) {
  const rewards = useUserRewards(userId)
  return <Panel quiet><h3>Rewards</h3>
    {rewards.isPending ? <p>Loading rewards…</p> : null}
    {rewards.isError ? <Banner kind="crit">Unable to load rewards. <button className="btn" onClick={() => void rewards.refetch()}>Retry</button></Banner> : null}
    {rewards.isSuccess && !rewards.data.items.length ? <p>No displayed rewards.</p> : null}
    {rewards.data?.items.map(row => <div className="vstack" key={row.id}><RewardName reward={row} />{row.description ? <p className="sub">{row.description}</p> : null}</div>)}
  </Panel>
}

export function RewardsPage() {
  const me = useMe()
  const rewards = useMyRewards(me.data?.id)
  const catalogue = useRewardCatalogue()
  const display = useRewardDisplay()
  if (USE_MOCK) return <Empty title="Rewards need the live server" />
  return <><h1 className="disp">My rewards</h1><Link className="btn ghost" to="/me">Back to profile</Link>
    <p className="sub">เหรียญที่ได้รับจะแสดงบนโปรไฟล์อัตโนมัติ เลือกซ่อนได้ เหรียญอาจถูกริบเมื่อผลการแข่งขันเปลี่ยน</p>
    {display.error ? <Banner kind="crit">{display.error instanceof Error ? display.error.message : 'Unable to change display.'}</Banner> : null}
    {display.isSuccess ? <p role="status">Reward display saved.</p> : null}
    <Panel><h2>Earned rewards</h2>
      {rewards.isPending ? <p>Loading rewards…</p> : null}
      {rewards.isError ? <Banner kind="crit">{rewards.error instanceof Error ? rewards.error.message : 'Unable to load rewards.'} <button className="btn" onClick={() => void rewards.refetch()}>Retry</button></Banner> : null}
      {rewards.isSuccess && !rewards.data.items.length ? <p>No earned rewards yet.</p> : null}
      {rewards.data?.items.map(row => <div className="spread" key={row.id}>
        <div><RewardName reward={row} />{row.description ? <p className="sub">{row.description}</p> : null}<p className="sub">Earned {new Date(row.earnedAt).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}</p><Badge kind={row.isDisplayed ? 'ok' : 'neutral'}>{row.isDisplayed ? 'Displayed on profile' : 'Hidden from profile'}</Badge></div>
        <label className="hstack"><input type="checkbox" checked={!row.isDisplayed} disabled={display.isPending || rewards.isFetching} onChange={e => display.mutate({ id: row.id, isDisplayed: !e.target.checked })} />Hide {row.name} from profile</label>
      </div>)}
    </Panel>
    <Panel quiet><h2>Reward catalogue</h2>
      {catalogue.isPending ? <p>Loading catalogue…</p> : null}
      {catalogue.isError ? <Banner kind="crit">Unable to load catalogue. <button className="btn" onClick={() => void catalogue.refetch()}>Retry</button></Banner> : null}
      {catalogue.isSuccess && !catalogue.data.items.length ? <p>No rewards available yet.</p> : null}
      {catalogue.data?.items.map(row => <div key={row.id}><RewardName reward={row} />{row.description ? <p className="sub">{row.description}</p> : null}{row.pointsRequired !== null ? <p className="sub">Required points: {row.pointsRequired}</p> : null}</div>)}
    </Panel></>
}
