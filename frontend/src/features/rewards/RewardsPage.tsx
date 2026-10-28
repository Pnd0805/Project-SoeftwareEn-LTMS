import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import {
  useMyRewards,
  useRedeemReward,
  useRewardCatalogue,
  useRewardDisplay,
  useUserRewards,
} from '../../hooks/useRewards'
import { ApiError } from '../../api/client'
import { Badge, Banner } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import type { RewardDto } from '../../api/rewards'
import './rewards.css'

function getBadgeTier(reward: RewardDto): 'bronze' | 'silver' | 'gold' | 'achievement' | 'emerald' {
  if (reward.pointsRequired === null) return 'achievement'
  const name = reward.name.toLowerCase()
  const key = (reward.iconKey ?? '').toLowerCase()
  if (name.includes('gold') || key.includes('gold') || (reward.pointsRequired && reward.pointsRequired >= 200)) {
    return 'gold'
  }
  if (name.includes('silver') || key.includes('silver') || (reward.pointsRequired && reward.pointsRequired >= 80)) {
    return 'silver'
  }
  if (name.includes('bronze') || key.includes('bronze')) {
    return 'bronze'
  }
  return 'emerald'
}

function RewardBadgeEmblem({ reward }: { reward: RewardDto }) {
  const tier = getBadgeTier(reward)
  return (
    <div className={`badge-emblem ${tier}`}>
      <span role="img" aria-label="Reward badge">
        <Icon name={tier === 'gold' || tier === 'achievement' ? 'star' : 'trophy'} size={26} />
      </span>
    </div>
  )
}

function RewardName({ reward }: { reward: RewardDto }) {
  // Retain accessibility label for tests and screen readers
  return (
    <span className="hstack" style={{ alignItems: 'center', gap: '8px' }}>
      <span role="img" aria-label="Reward badge" style={{ display: 'none' }}>
        <Icon name="trophy" size={28} />
      </span>
      <b className="reward-card-name">{reward.name}</b>
    </span>
  )
}

export function PublicRewards({ userId }: { userId: number }) {
  const rewards = useUserRewards(userId)
  return (
    <div className="panel quiet vstack" style={{ gap: '16px' }}>
      <div className="hstack" style={{ alignItems: 'center', gap: '8px' }}>
        <span className="tag">Showcase</span>
        <h3 style={{ margin: 0 }}>Rewards</h3>
      </div>
      {rewards.isPending ? <p className="sub">Loading rewards…</p> : null}
      {rewards.isError ? (
        <Banner kind="crit">
          Unable to load rewards.{' '}
          <button className="btn" onClick={() => void rewards.refetch()}>
            Retry
          </button>
        </Banner>
      ) : null}
      {rewards.isSuccess && !rewards.data.items.length ? (
        <p className="sub">No displayed rewards.</p>
      ) : null}
      <div className="rewards-grid">
        {rewards.data?.items.map((row) => (
          <div className="reward-card is-owned" key={row.id}>
            <div className="reward-card-top">
              <RewardBadgeEmblem reward={row} />
              <div className="reward-card-info">
                <RewardName reward={row} />
                {row.description ? <p className="reward-card-desc">{row.description}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RewardsPage() {
  const me = useMe()
  const currentUser = me.data
  const totalPoints = currentUser?.totalPoints ?? 0

  // Refresh points when entering page because points may change if match results change
  useEffect(() => {
    if (typeof me.refetch === 'function') {
      void me.refetch()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rewards = useMyRewards(currentUser?.id)
  const catalogue = useRewardCatalogue()
  const display = useRewardDisplay()
  const redeemMutation = useRedeemReward()

  const [redeemingId, setRedeemingId] = useState<number | null>(null)
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null)
  const [redeemError, setRedeemError] = useState<string | null>(null)

  const ownedIds = new Set((rewards.data?.items ?? []).map((r) => r.id))

  const handleRedeem = (reward: RewardDto) => {
    if (reward.pointsRequired === null) return
    setRedeemError(null)
    setRedeemSuccessMsg(null)
    setRedeemingId(reward.id)

    redeemMutation.mutate(reward.id, {
      onSuccess: (data) => {
        setRedeemingId(null)
        setRedeemSuccessMsg(`แลกรับ "${reward.name}" สำเร็จ! (ใช้ไป ${data.pointsSpent} แต้ม)`)
      },
      onError: (err) => {
        setRedeemingId(null)
        if (err instanceof ApiError) {
          if (err.code === 'REWARD_NOT_FOUND') {
            setRedeemError('ไม่มีเหรียญรางวัลนี้หรือถูกปิดการใช้งานแล้ว กรุณารีโหลดรายการ')
          } else if (err.code === 'REWARD_NOT_PURCHASABLE') {
            setRedeemError('เหรียญรางวัลนี้ไม่ได้เปิดให้แลกด้วยแต้ม')
          } else if (err.code === 'REWARD_ALREADY_OWNED') {
            setRedeemError('คุณครอบครองเหรียญรางวัลนี้อยู่แล้ว')
          } else if (err.code === 'INSUFFICIENT_POINTS') {
            const req =
              typeof err.extra?.pointsRequired === 'number'
                ? (err.extra.pointsRequired as number)
                : reward.pointsRequired
            const cur =
              typeof err.extra?.totalPoints === 'number'
                ? (err.extra.totalPoints as number)
                : totalPoints
            const shortage = req != null && cur != null ? Math.max(0, req - cur) : null
            setRedeemError(
              shortage !== null
                ? `แต้มไม่พอสำหรับแลก "${reward.name}" (ขาดอีก ${shortage} แต้ม)`
                : 'แต้มสะสมไม่เพียงพอสำหรับแลกเหรียญนี้',
            )
          } else if (err.status === 401) {
            setRedeemError('กรุณาเข้าสู่ระบบก่อนทำรายการแลกเหรียญรางวัล')
          } else {
            setRedeemError(err.message || 'เกิดข้อผิดพลาดในการแลกเหรียญรางวัล')
          }
        } else if (err instanceof Error) {
          setRedeemError(err.message)
        } else {
          setRedeemError('เกิดข้อผิดพลาดในการแลกเหรียญรางวัล')
        }
      },
    })
  }

  const purchasableRewards = (catalogue.data?.items ?? []).filter(
    (item) => item.pointsRequired !== null,
  )
  const achievementRewards = (catalogue.data?.items ?? []).filter(
    (item) => item.pointsRequired === null,
  )

  return (
    <div className="rewards-container">
      {/* Header with Title and Back to Profile */}
      <div className="rewards-header">
        <div className="rewards-header-title">
          <span className="tag">Store & Badges</span>
          <h1 className="disp">My rewards</h1>
          <p className="sub" style={{ marginTop: '2px' }}>
            เหรียญที่ได้รับจะแสดงบนโปรไฟล์อัตโนมัติ เลือกซ่อนได้ เหรียญอาจถูกริบเมื่อผลการแข่งขันเปลี่ยน
          </p>
        </div>
        <Link className="btn ghost" to="/me" style={{ alignSelf: 'flex-start' }}>
          <Icon name="chevL" size={13} /> Back to profile
        </Link>
      </div>

      {/* Hero Points Card */}
      <div className="rewards-hero-card">
        <div className="rewards-hero-left">
          <span className="tag" style={{ color: '#2dd4bf' }}>ยอดแต้มสะสมของฉัน</span>
          <div className="rewards-points-display">
            <span className="rewards-points-number">{totalPoints}</span>
            <span className="rewards-points-unit">แต้ม</span>
          </div>
          <p className="sub" style={{ maxWidth: '520px', lineHeight: 1.5 }}>
            สะสมแต้มจากการทายผล Pick'em และกิจกรรมการแข่งขัน เพื่อนำมาแลกรับ Badge พิเศษ
          </p>
        </div>

        <div className="rewards-hero-stats">
          <div className="rewards-stat-pill">
            <span className="val">{ownedIds.size}</span>
            <span className="lbl">เหรียญของฉัน</span>
          </div>
          <div className="rewards-stat-pill">
            <span className="val">{purchasableRewards.length}</span>
            <span className="lbl">เปิดให้แลก</span>
          </div>
          <div className="rewards-stat-pill">
            <span className="val">{achievementRewards.length}</span>
            <span className="lbl">เหรียญความสำเร็จ</span>
          </div>
        </div>
      </div>

      {/* Action / Error Banners */}
      {display.error ? (
        <Banner kind="crit">
          {display.error instanceof Error ? display.error.message : 'Unable to change display.'}
        </Banner>
      ) : null}
      {display.isSuccess ? <p role="status">Reward display saved.</p> : null}

      {redeemSuccessMsg ? <Banner kind="ok">{redeemSuccessMsg}</Banner> : null}
      {redeemError ? <Banner kind="crit">{redeemError}</Banner> : null}

      {/* Section 1: Earned rewards */}
      <section className="rewards-section">
        <div className="rewards-section-header">
          <div className="rewards-section-title-wrap">
            <div className="rewards-section-icon">
              <Icon name="trophy" size={20} />
            </div>
            <div>
              <h2>Earned rewards</h2>
              <span className="sub">เหรียญรางวัลที่คุณปลดล็อคหรือแลกรับมาแล้ว</span>
            </div>
          </div>
          {rewards.data?.items.length ? (
            <Badge kind="ok">{rewards.data.items.length} ใบ</Badge>
          ) : null}
        </div>

        {rewards.isPending ? <p className="sub">Loading rewards…</p> : null}
        {rewards.isError ? (
          <Banner kind="crit">
            {rewards.error instanceof Error ? rewards.error.message : 'Unable to load rewards.'}{' '}
            <button className="btn" onClick={() => void rewards.refetch()}>
              Retry
            </button>
          </Banner>
        ) : null}

        {rewards.isSuccess && !rewards.data.items.length ? (
          <div className="reward-empty-card">
            <Icon name="trophy" size={32} />
            <b>No earned rewards yet.</b>
            <p className="sub">ร่วมกิจกรรมการแข่งขันหรือนำแต้มมาแลกรับ Badge เพื่อเริ่มสะสมคอลเลกชันของคุณ</p>
          </div>
        ) : null}

        {rewards.data?.items.length ? (
          <div className="rewards-grid">
            {rewards.data.items.map((row) => (
              <div className="reward-card is-owned" key={row.id}>
                <div className="reward-card-top">
                  <RewardBadgeEmblem reward={row} />
                  <div className="reward-card-info">
                    <RewardName reward={row} />
                    {row.description ? <p className="reward-card-desc">{row.description}</p> : null}
                    <p className="sub" style={{ fontSize: '12px', marginTop: '4px' }}>
                      Earned{' '}
                      {new Date(row.earnedAt).toLocaleString('en-GB', {
                        timeZone: 'Asia/Bangkok',
                      })}
                    </p>
                  </div>
                </div>

                <div className="reward-card-bottom">
                  <Badge kind={row.isDisplayed ? 'ok' : 'neutral'}>
                    {row.isDisplayed ? 'Displayed on profile' : 'Hidden from profile'}
                  </Badge>
                  <label className="profile-toggle-label">
                    <input
                      type="checkbox"
                      checked={!row.isDisplayed}
                      disabled={display.isPending || rewards.isFetching}
                      onChange={(e) =>
                        display.mutate({ id: row.id, isDisplayed: !e.target.checked })
                      }
                    />
                    Hide {row.name} from profile
                  </label>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Section 2: Reward catalogue */}
      <section className="rewards-section" style={{ marginTop: '12px' }}>
        <div className="rewards-section-header">
          <div className="rewards-section-title-wrap">
            <div className="rewards-section-icon">
              <Icon name="star" size={20} />
            </div>
            <div>
              <h2>Reward catalogue</h2>
              <span className="sub">รายการเหรียญตราทั้งหมดในระบบ</span>
            </div>
          </div>
        </div>

        {catalogue.isPending ? <p className="sub">Loading catalogue…</p> : null}
        {catalogue.isError ? (
          <Banner kind="crit">
            Unable to load catalogue.{' '}
            <button className="btn" onClick={() => void catalogue.refetch()}>
              Retry
            </button>
          </Banner>
        ) : null}

        {catalogue.isSuccess && !catalogue.data.items.length ? (
          <div className="reward-empty-card">
            <Icon name="star" size={32} />
            <b>No rewards available yet.</b>
            <p className="sub">ยังไม่มีรายการเหรียญในแคตตาล็อกขณะนี้</p>
          </div>
        ) : null}

        {catalogue.isSuccess && catalogue.data.items.length > 0 ? (
          <div className="vstack" style={{ gap: '32px' }}>
            {/* Group 1: แลกได้ด้วยแต้ม */}
            <div className="vstack" style={{ gap: '16px' }}>
              <div className="hstack" style={{ alignItems: 'center', gap: '10px' }}>
                <span className="tag" style={{ color: '#f59e0b' }}>ร้านค้าแลก Badge</span>
                <h3 style={{ margin: 0, fontSize: '18px' }}>แลกได้ด้วยแต้ม</h3>
              </div>

              {!purchasableRewards.length ? (
                <div className="reward-empty-card" style={{ padding: '24px' }}>
                  <p className="sub">ยังไม่มีรายการที่เปิดให้แลกด้วยแต้มในขณะนี้</p>
                </div>
              ) : (
                <div className="rewards-grid">
                  {purchasableRewards.map((row) => {
                    const isOwned = ownedIds.has(row.id)
                    const required = row.pointsRequired ?? 0
                    const isAffordable = totalPoints >= required
                    const shortage = required - totalPoints
                    const isProcessing = redeemingId === row.id || redeemMutation.isPending

                    return (
                      <div className={`reward-card ${isOwned ? 'is-owned' : ''}`} key={row.id}>
                        <div className="reward-card-top">
                          <RewardBadgeEmblem reward={row} />
                          <div className="reward-card-info">
                            <RewardName reward={row} />
                            {row.description ? (
                              <p className="reward-card-desc">{row.description}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="reward-card-bottom">
                          <span className="reward-card-price">
                            🪙 {required} แต้ม
                          </span>
                          {isOwned ? (
                            <Badge kind="ok">มีแล้ว</Badge>
                          ) : (
                            <button
                              type="button"
                              className={`btn ${isAffordable ? 'primary' : ''}`}
                              disabled={!isAffordable || isProcessing}
                              aria-disabled={!isAffordable || isProcessing}
                              onClick={() => handleRedeem(row)}
                            >
                              {isProcessing && redeemingId === row.id
                                ? 'กำลังแลก…'
                                : isAffordable
                                ? `แลก (${required} แต้ม)`
                                : `แต้มไม่พอ (ขาดอีก ${shortage} แต้ม)`}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Group 2: ได้จากความสำเร็จ */}
            <div className="vstack" style={{ gap: '16px' }}>
              <div className="hstack" style={{ alignItems: 'center', gap: '10px' }}>
                <span className="tag" style={{ color: '#a855f7' }}>ความสำเร็จในการแข่งขัน</span>
                <h3 style={{ margin: 0, fontSize: '18px' }}>ได้จากความสำเร็จ</h3>
              </div>

              {!achievementRewards.length ? (
                <div className="reward-empty-card" style={{ padding: '24px' }}>
                  <p className="sub">ไม่มีรายการเหรียญความสำเร็จ</p>
                </div>
              ) : (
                <div className="rewards-grid">
                  {achievementRewards.map((row) => {
                    const isOwned = ownedIds.has(row.id)
                    return (
                      <div className={`reward-card ${isOwned ? 'is-owned' : ''}`} key={row.id}>
                        <div className="reward-card-top">
                          <RewardBadgeEmblem reward={row} />
                          <div className="reward-card-info">
                            <RewardName reward={row} />
                            {row.description ? (
                              <p className="reward-card-desc">{row.description}</p>
                            ) : null}
                            <p className="sub" style={{ fontSize: '12px', marginTop: '4px' }}>
                              ได้จากการทำตามเงื่อนไขความสำเร็จในการแข่งขัน
                            </p>
                          </div>
                        </div>

                        <div className="reward-card-bottom">
                          <span className="tag" style={{ margin: 0 }}>รางวัลทัวร์นาเมนต์</span>
                          {isOwned ? (
                            <Badge kind="ok">ปลดล็อคแล้ว</Badge>
                          ) : (
                            <Badge kind="neutral">ยังไม่ได้รับ</Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
