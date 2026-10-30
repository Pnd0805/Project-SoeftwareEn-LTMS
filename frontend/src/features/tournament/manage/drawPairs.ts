/**
 * คู่รอบแรกตามลำดับที่ส่งให้ backend — ต้องตรงกับ `placeTeamsInSlots` (seed แบบ manual)
 * ทีมต้น ๆ ได้ bye ก่อน แล้วทีมที่เหลือจับคู่กันทีละสองทีมตามลำดับ
 *
 * เดิมหน้านี้จับคู่ i กับ size-1-i ซึ่งไม่ตรงกับแมตช์ที่ backend สร้างจริงเมื่อมี 4 ทีมขึ้นไป
 */
export function drawPairs(teamCount: number, size: number): [number, number | null][] {
  const byes = Math.max(0, size - teamCount)
  const pairs: [number, number | null][] = []
  let next = 0
  for (let pair = 0; pair < size >> 1; pair++) {
    if (pair < byes) pairs.push([next++, null])
    else { pairs.push([next, next + 1]); next += 2 }
  }
  return pairs
}

/** เทียบคู่แบบไม่สนฝั่ง — backend อาจเก็บทีมสลับฝั่งกับลำดับที่แสดง */
export const pairKey = (a: string | null | undefined, b: string | null | undefined) =>
  [a, b].filter(Boolean).sort().join('|')
