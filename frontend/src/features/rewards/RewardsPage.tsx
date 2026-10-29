import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '../../hooks/useAuth'
import {
  useMyRewards,
  useRedeemReward,
  useRewardCatalogue,
  useRewardDisplay,
} from '../../hooks/useRewards'
import { ApiError } from '../../api/client'
import { Badge, Banner, Empty, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import type { RewardDto } from '../../api/rewards'
import { RewardBadgeEmblem } from './RewardBadgeEmblem'
import './rewards.css'

function RewardName({ reward }: { reward: RewardDto }) {
  // Retain accessibility label for tests and screen readers
  return (
    <span className="hstack" style={{ alignItems: 'center', gap: '8px' }}>
      <span role="img" aria-label="Reward badge" style={{ display: 'none' }}>
        <Icon name="trophy" size={28} />
      </span>
      <b className="badge-card-title">{reward.name}</b>
    </span>
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
    <div className="account-workspace rewards-workspace">
      {/* Header and Back Link */}
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <span className="tag"><em>//</em> Rewards & Badges</span>
          <h1 className="disp" style={{ margin: '4px 0 6px 0' }}>My rewards</h1>
          <p className="sub">
            เหรียญที่ได้รับจะแสดงบนโปรไฟล์อัตโนมัติ เลือกซ่อนได้ เหรียญอาจถูกริบเมื่อผลการแข่งขันเปลี่ยน
          </p>
        </div>
        <Link className="btn ghost" to="/me" style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }}>
          <Icon name="chevL" size={13} /> Back to profile
        </Link>
      </div>

      {/* LTMS Minimal Street Points Statline */}
      <div className="statline">
        <div>
          <span className="tag"><em>//</em> ยอดแต้มสะสมของฉัน</span>
          <span className="v">{totalPoints}</span>
          <span className="sub">แต้มสำหรับแลกซื้อ</span>
        </div>
        <div>
          <span className="tag"><em>//</em> Badges held</span>
          <span className="v">{ownedIds.size}</span>
          <span className="sub">ครอบครองแล้ว</span>
        </div>
        <div>
          <span className="tag"><em>//</em> In store</span>
          <span className="v">{purchasableRewards.length}</span>
          <span className="sub">รายการที่เปิดให้แลก</span>
        </div>
        <div>
          <span className="tag"><em>//</em> Achievements</span>
          <span className="v">{achievementRewards.length}</span>
          <span className="sub">ความสำเร็จทั้งหมด</span>
        </div>
      </div>

      {/* Feedback banners */}
      {display.error ? (
        <Banner kind="crit">
          {display.error instanceof Error ? display.error.message : 'Unable to change display.'}
        </Banner>
      ) : null}
      {display.isSuccess ? <p role="status">Reward display saved.</p> : null}

      {redeemSuccessMsg ? <Banner kind="ok">{redeemSuccessMsg}</Banner> : null}
      {redeemError ? <Banner kind="crit">{redeemError}</Banner> : null}

      {/* Earned rewards */}
      <Panel>
        <div className="spread">
          <div>
            <span className="tag"><em>//</em> Collection</span>
            <h2 style={{ margin: '2px 0 0 0' }}>Earned rewards</h2>
          </div>
          {rewards.data?.items.length ? (
            <Badge kind="ok">{rewards.data.items.length} badges</Badge>
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
          <Empty
            icon="trophy"
            title="No earned rewards yet."
            sub="ร่วมกิจกรรมการแข่งขันหรือนำแต้มมาแลกรับ Badge เพื่อเริ่มสะสมคอลเลกชันของคุณ"
          />
        ) : null}

        {rewards.data?.items.length ? (
          <div className="badge-grid" style={{ marginTop: 12 }}>
            {rewards.data.items.map((row) => (
              <div className="badge-card is-owned" key={row.id}>
                <div className="badge-card-header">
                  <RewardBadgeEmblem reward={row} />
                  <div className="badge-card-content">
                    <RewardName reward={row} />
                    {row.description ? <p className="badge-card-desc">{row.description}</p> : null}
                    <p className="sub" style={{ fontSize: 12, marginTop: 4 }}>
                      Earned{' '}
                      {new Date(row.earnedAt).toLocaleString('en-GB', {
                        timeZone: 'Asia/Bangkok',
                      })}
                    </p>
                  </div>
                </div>

                <div className="badge-card-footer">
                  <Badge kind={row.isDisplayed ? 'ok' : 'neutral'}>
                    {row.isDisplayed ? 'Displayed on profile' : 'Hidden from profile'}
                  </Badge>
                  <label className="reward-display-toggle">
                    <input
                      type="checkbox"
                      aria-label={`Hide ${row.name} from profile`}
                      checked={!row.isDisplayed}
                      disabled={display.isPending || rewards.isFetching}
                      onChange={(e) =>
                        display.mutate({ id: row.id, isDisplayed: !e.target.checked })
                      }
                    />
                    <span>Hide from profile</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      {/* Reward catalogue - Divided into 2 clear Minimal Street groups */}
      <Panel quiet>
        <span className="tag"><em>//</em> Catalogue</span>
        <h2 style={{ margin: '2px 0 0 0' }}>Reward catalogue</h2>

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
          <Empty
            icon="star"
            title="No rewards available yet."
            sub="ยังไม่มีรายการเหรียญในแคตตาล็อกขณะนี้"
          />
        ) : null}

        {catalogue.isSuccess && catalogue.data.items.length > 0 ? (
          <div className="vstack" style={{ gap: 28, marginTop: 8 }}>
            {/* Group 1: แลกได้ด้วยแต้ม */}
            <div className="vstack" style={{ gap: 12 }}>
              <div className="hstack" style={{ alignItems: 'center', gap: 8 }}>
                <span className="tag"><em>//</em> ร้านค้าแลก Badge</span>
                <h3 style={{ margin: 0, fontSize: 18 }}>แลกได้ด้วยแต้ม</h3>
              </div>

              {!purchasableRewards.length ? (
                <p className="sub">ยังไม่มีรายการที่เปิดให้แลกด้วยแต้มในขณะนี้</p>
              ) : (
                <div className="badge-grid">
                  {purchasableRewards.map((row) => {
                    const isOwned = ownedIds.has(row.id)
                    const required = row.pointsRequired ?? 0
                    const isAffordable = totalPoints >= required
                    const shortage = required - totalPoints
                    const isProcessing = redeemingId === row.id || redeemMutation.isPending

                    return (
                      <div className={`badge-card ${isOwned ? 'is-owned' : ''}`} key={row.id}>
                        <div className="badge-card-header">
                          <RewardBadgeEmblem reward={row} />
                          <div className="badge-card-content">
                            <RewardName reward={row} />
                            {row.description ? (
                              <p className="badge-card-desc">{row.description}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="badge-card-footer">
                          <span className="badge-card-price">
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
            <div className="vstack" style={{ gap: 12 }}>
              <div className="hstack" style={{ alignItems: 'center', gap: 8 }}>
                <span className="tag"><em>//</em> ความสำเร็จในการแข่งขัน</span>
                <h3 style={{ margin: 0, fontSize: 18 }}>ได้จากความสำเร็จ</h3>
              </div>

              {!achievementRewards.length ? (
                <p className="sub">ไม่มีรายการเหรียญความสำเร็จ</p>
              ) : (
                <div className="badge-grid">
                  {achievementRewards.map((row) => {
                    const isOwned = ownedIds.has(row.id)
                    return (
                      <div className={`badge-card ${isOwned ? 'is-owned' : ''}`} key={row.id}>
                        <div className="badge-card-header">
                          <RewardBadgeEmblem reward={row} />
                          <div className="badge-card-content">
                            <RewardName reward={row} />
                            {row.description ? (
                              <p className="badge-card-desc">{row.description}</p>
                            ) : null}
                            <p className="sub" style={{ fontSize: 12, marginTop: 4 }}>
                              ได้จากการทำตามเงื่อนไขความสำเร็จในการแข่งขัน
                            </p>
                          </div>
                        </div>

                        <div className="badge-card-footer">
                          <span className="tag" style={{ margin: 0 }}><em>//</em> Achievement</span>
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
      </Panel>
    </div>
  )
}
