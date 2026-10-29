import type { SportType } from '../../types/dto'

/** OD-56 — แต้ม 10/7/4/0 แยกชั้นได้ครบ · backend ไม่ส่งชื่อชั้นมาโดยเจตนา (สองแหล่งที่ต้องตรงกันคือที่ที่บั๊กเกิด) */
export const pickLabel = (points: number, rules?: SportType['pickemPoints']) =>
  !rules ? 'Prediction settled' : points === rules.spotOn ? 'Spot on' : points === rules.close ? 'Close'
    : points === rules.sideOnly ? 'Right side' : points === 0 ? 'Wrong side' : 'Prediction settled'

/** กฎเป็นประโยค — ซ่อนชั้นกลางเมื่อ spotOn === close เพราะ "คลาดไม่เกิน 0 ได้ 7" อ่านไม่รู้เรื่องและเป็นไปไม่ได้ */
export function pickemRules(sport: SportType | undefined, tolerance?: { spotOn: number; close: number }): string[] | null {
  const tol = tolerance
  const pts = sport?.pickemPoints
  if (!tol || !pts) return null
  const within = (n: number) => (n === 0 ? 'exactly right' : `off by at most ${n} per side`)
  const lines = [`Right winner, score ${within(tol.spotOn)} → ${pts.spotOn} points`]
  if (tol.close !== tol.spotOn) lines.push(`Right winner, score ${within(tol.close)} → ${pts.close} points`)
  lines.push(`Right winner only → ${pts.sideOnly} points`, 'Wrong winner → 0, however close the score')
  return lines
}
