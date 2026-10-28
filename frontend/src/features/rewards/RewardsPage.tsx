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
import { Badge, Banner, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import type { RewardDto } from '../../api/rewards'

function RewardName({ reward }: { reward: RewardDto }) {
  // iconKey is an object key, not an image URL. Use the existing trophy until assets are delivered.
  return (
    <span className="hstack">
      <span role="img" aria-label="Reward badge">
        <Icon name="trophy" size={28} />
      </span>
      <b>{reward.name}</b>
    </span>
  )
}

export function PublicRewards({ userId }: { userId: number }) {
  const rewards = useUserRewards(userId)
  return (
    <Panel quiet>
      <h3>Rewards</h3>
      {rewards.isPending ? <p>Loading rewards…</p> : null}
      {rewards.isError ? (
        <Banner kind="crit">
          Unable to load rewards.{' '}
          <button className="btn" onClick={() => void rewards.refetch()}>
            Retry
          </button>
        </Banner>
      ) : null}
      {rewards.isSuccess && !rewards.data.items.length ? <p>No displayed rewards.</p> : null}
      {rewards.data?.items.map((row) => (
        <div className="vstack" key={row.id}>
          <RewardName reward={row} />
          {row.description ? <p className="sub">{row.description}</p> : null}
        </div>
      ))}
    </Panel>
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
    <>
      <h1 className="disp">My rewards</h1>
      <Link className="btn ghost" to="/me">
        Back to profile
      </Link>
      <p className="sub">
        เหรียญที่ได้รับจะแสดงบนโปรไฟล์อัตโนมัติ เลือกซ่อนได้ เหรียญอาจถูกริบเมื่อผลการแข่งขันเปลี่ยน
      </p>

      {/* Points summary banner */}
      <Panel quiet style={{ margin: '16px 0' }}>
        <div className="spread" style={{ alignItems: 'center' }}>
          <div>
            <span className="tag">ยอดแต้มสะสมของฉัน</span>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>
              {totalPoints}{' '}
              <span className="sub" style={{ fontSize: '14px', fontWeight: 'normal' }}>
                แต้ม
              </span>
            </div>
          </div>
          <p className="sub" style={{ margin: 0 }}>
            สะสมแต้มจากการทายผล Pick'em และกิจกรรมการแข่งขัน เพื่อนำมาแลกรับ Badge พิเศษ
          </p>
        </div>
      </Panel>

      {/* Feedback banners */}
      {display.error ? (
        <Banner kind="crit">
          {display.error instanceof Error
            ? display.error.message
            : 'Unable to change display.'}
        </Banner>
      ) : null}
      {display.isSuccess ? <p role="status">Reward display saved.</p> : null}

      {redeemSuccessMsg ? <Banner kind="ok">{redeemSuccessMsg}</Banner> : null}
      {redeemError ? <Banner kind="crit">{redeemError}</Banner> : null}

      {/* Earned rewards */}
      <Panel>
        <h2>Earned rewards</h2>
        {rewards.isPending ? <p>Loading rewards…</p> : null}
        {rewards.isError ? (
          <Banner kind="crit">
            {rewards.error instanceof Error ? rewards.error.message : 'Unable to load rewards.'}{' '}
            <button className="btn" onClick={() => void rewards.refetch()}>
              Retry
            </button>
          </Banner>
        ) : null}
        {rewards.isSuccess && !rewards.data.items.length ? (
          <p>No earned rewards yet.</p>
        ) : null}
        {rewards.data?.items.map((row) => (
          <div className="spread" key={row.id}>
            <div>
              <RewardName reward={row} />
              {row.description ? <p className="sub">{row.description}</p> : null}
              <p className="sub">
                Earned{' '}
                {new Date(row.earnedAt).toLocaleString('en-GB', {
                  timeZone: 'Asia/Bangkok',
                })}
              </p>
              <Badge kind={row.isDisplayed ? 'ok' : 'neutral'}>
                {row.isDisplayed ? 'Displayed on profile' : 'Hidden from profile'}
              </Badge>
            </div>
            <label className="hstack">
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
        ))}
      </Panel>

      {/* Reward Catalogue - Clearly separated into 2 groups */}
      <Panel quiet>
        <h2>Reward catalogue</h2>
        {catalogue.isPending ? <p>Loading catalogue…</p> : null}
        {catalogue.isError ? (
          <Banner kind="crit">
            Unable to load catalogue.{' '}
            <button className="btn" onClick={() => void catalogue.refetch()}>
              Retry
            </button>
          </Banner>
        ) : null}
        {catalogue.isSuccess && !catalogue.data.items.length ? (
          <p>No rewards available yet.</p>
        ) : null}

        {catalogue.isSuccess && catalogue.data.items.length > 0 ? (
          <div className="vstack" style={{ gap: '24px' }}>
            {/* Group 1: แลกได้ด้วยแต้ม (Redeemable with points) */}
            <div className="vstack" style={{ gap: '12px' }}>
              <div className="hstack" style={{ alignItems: 'center', gap: '8px' }}>
                <span className="tag">ร้านค้าแลก Badge</span>
                <h3 style={{ margin: 0 }}>แลกได้ด้วยแต้ม</h3>
              </div>
              {!purchasableRewards.length ? (
                <p className="sub">ยังไม่มีรายการที่เปิดให้แลกด้วยแต้มในขณะนี้</p>
              ) : (
                purchasableRewards.map((row) => {
                  const isOwned = ownedIds.has(row.id)
                  const required = row.pointsRequired ?? 0
                  const isAffordable = totalPoints >= required
                  const shortage = required - totalPoints
                  const isProcessing = redeemingId === row.id || redeemMutation.isPending

                  return (
                    <div
                      className="spread"
                      key={row.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid var(--line, #333)',
                      }}
                    >
                      <div>
                        <RewardName reward={row} />
                        {row.description ? <p className="sub">{row.description}</p> : null}
                        <p className="sub" style={{ color: 'var(--amber, #f59e0b)' }}>
                          ราคา: {required} แต้ม
                        </p>
                      </div>
                      <div className="hstack" style={{ alignItems: 'center', gap: '8px' }}>
                        {isOwned ? (
                          <Badge kind="ok">มีแล้ว</Badge>
                        ) : (
                          <button
                            type="button"
                            className="btn"
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
                })
              )}
            </div>

            {/* Group 2: ได้จากความสำเร็จ (Achievements) */}
            <div className="vstack" style={{ gap: '12px' }}>
              <div className="hstack" style={{ alignItems: 'center', gap: '8px' }}>
                <span className="tag">ความสำเร็จในการแข่งขัน</span>
                <h3 style={{ margin: 0 }}>ได้จากความสำเร็จ</h3>
              </div>
              {!achievementRewards.length ? (
                <p className="sub">ไม่มีรายการเหรียญความสำเร็จ</p>
              ) : (
                achievementRewards.map((row) => {
                  const isOwned = ownedIds.has(row.id)
                  return (
                    <div
                      className="spread"
                      key={row.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid var(--line, #333)',
                      }}
                    >
                      <div>
                        <RewardName reward={row} />
                        {row.description ? <p className="sub">{row.description}</p> : null}
                        <p className="sub">ได้จากการทำตามเงื่อนไขความสำเร็จในการแข่งขัน</p>
                      </div>
                      <div className="hstack" style={{ alignItems: 'center' }}>
                        {isOwned ? (
                          <Badge kind="ok">ปลดล็อคแล้ว</Badge>
                        ) : (
                          <Badge kind="neutral">ยังไม่ได้รับ</Badge>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : null}
      </Panel>
    </>
  )
}
