/**
 * หน้าตาของรางวัลแต่ละอัน — สองแกนแยกกัน
 *   ตระกูล: badge เป็นวงกลม · achievement เป็นหกเหลี่ยม
 *   ระดับ: bronze → silver → gold → legend ไล่ทั้งสีและน้ำหนักกรอบ คนที่แยกสีไม่ออกจึงยังเห็นลำดับ
 *
 * อ่านจาก `criteria` ก่อน เพราะ `icon_key` ในฐานเป็น NULL ทุกแถว และชื่อเป็นข้อความที่แก้ได้
 * ไอคอนจาก Lucide (ISC)
 */
import { Award, Crown, Flag, Flame, HeartHandshake, Medal, Target, Trophy, type LucideIcon } from 'lucide-react'
import type { RewardDto } from '../../api/rewards'

export type RewardRank = 'bronze' | 'silver' | 'gold' | 'legend'
export const RANK_ORDER: RewardRank[] = ['legend', 'gold', 'silver', 'bronze']

export interface RewardLook { icon: LucideIcon; rank: RewardRank; family: 'badge' | 'achievement' }

const supporterRank = (points: number): RewardRank => points >= 300 ? 'gold' : points >= 80 ? 'silver' : 'bronze'

function earnedLook(criteria: Record<string, unknown>): Pick<RewardLook, 'icon' | 'rank'> | null {
  const need = typeof criteria.gte === 'number' ? criteria.gte : 1
  if (criteria.stat === 'matches_played') return { icon: Flag, rank: 'bronze' }
  if (criteria.stat === 'wins' || 'wins' in criteria) return need >= 10 ? { icon: Flame, rank: 'silver' } : { icon: Medal, rank: 'silver' }
  if (criteria.stat === 'championships' || 'champion' in criteria) return need >= 3 ? { icon: Crown, rank: 'legend' } : { icon: Trophy, rank: 'gold' }
  if ('pickem' in criteria) return { icon: Target, rank: 'silver' }
  return null
}

/**
 * Badge คือของที่ซื้อด้วยแต้ม · Achievement คือของที่ได้จากผลงาน (ERD + OD-71 · หน้ารางวัลก็แบ่งแบบนี้)
 * ไม่อ่าน `reward_type` เพราะ migration 041 ลง "ลงแข่งครั้งแรก" กับ "ชนะครั้งแรก" เป็น badge ทั้งที่แจกตามเกณฑ์
 */
export const rewardFamily = (reward: Pick<RewardDto, 'pointsRequired'>): RewardLook['family'] =>
  reward.pointsRequired !== null ? 'badge' : 'achievement'

export function rewardLook(reward: RewardDto): RewardLook {
  const family = rewardFamily(reward)
  if (reward.pointsRequired !== null) return { family, icon: HeartHandshake, rank: supporterRank(reward.pointsRequired) }
  const earned = reward.criteria && typeof reward.criteria === 'object' ? earnedLook(reward.criteria as Record<string, unknown>) : null
  return { family, ...(earned ?? { icon: Award, rank: 'bronze' as const }) }
}

export const byRank = <T extends RewardDto>(rewards: T[]) => [...rewards].sort((a, b) =>
  RANK_ORDER.indexOf(rewardLook(a).rank) - RANK_ORDER.indexOf(rewardLook(b).rank))
