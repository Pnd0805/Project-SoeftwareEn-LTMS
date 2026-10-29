/**
 * src/features/match/resultRules.ts — ตรวจผลและสถิติก่อนส่ง (สไลซ์ 3)
 *
 * ของพวกนี้เป็นการตรวจฝั่งหน้าจอเพื่อบอกคนกรอกทันทีว่าอะไรขัดกันเอง
 * **ไม่ใช่การบังคับ** — backend ต้องตรวจซ้ำเสมอ เพราะฝั่งหน้าจอถูกข้ามได้ (DC-02)
 *
 * ── ทำไมกฎต้องแยกตามกีฬา ─────────────────────────────────────────────────
 * "แต้มรายคนรวมกันต้องเท่าสกอร์" จริงเฉพาะกีฬาที่สองอย่างนี้เป็นหน่วยเดียวกัน
 * วอลเลย์บอลนับสกอร์เป็นเซตแต่นับสถิติเป็นแต้ม — บังคับให้เท่ากันคือผิด
 * ดู `playerStatSumsToScore` และ `assistNeedsGoal` ใน shared/rules.ts
 */
import { assistNeedsGoal, playerStatSumsToScore } from '../../shared/rules'

/** ค่าสถิติของผู้เล่นหนึ่งคน keyed ด้วย statKey จาก sport_stat_definitions */
export interface StatEntry {
  userId: number
  teamId: number
  values: Record<string, number>
}

export interface ResultCheckInput {
  sportName: string
  /** ชื่อทีมไว้ประกอบข้อความ ไม่ได้ใช้ตัดสิน */
  teamA: { id: number; name: string } | null
  teamB: { id: number; name: string } | null
  scoreA: number
  scoreB: number
  entries: StatEntry[]
  /** statKey ที่ฟอร์มนี้เปิดให้กรอก — ใช้ดูว่ามีช่องประตู/แอสซิสต์ไหม */
  statKeys: string[]
  /** กรอกช่องตัวตัดสินครบทั้งสองฝั่งหรือยัง */
  deciderGiven?: boolean
}

/** statKey ที่นับเป็น "คะแนนที่ทำได้" ตามที่ sport_stat_definitions ใช้จริง */
const SCORING_KEYS = ['goals', 'points', 'kills', 'score']
const ASSIST_KEY = 'assists'

const sumOf = (entries: StatEntry[], teamId: number, key: string) =>
  entries.filter(e => e.teamId === teamId).reduce((n, e) => n + (e.values[key] ?? 0), 0)

/**
 * คืนรายการปัญหาที่พบ — ว่างแปลว่าผ่าน
 * ข้อความเป็นภาษาไทยเพราะแสดงให้คนกรอกอ่านตรงๆ (NF-US-03)
 */
export function checkResult(input: ResultCheckInput): string[] {
  const problems: string[] = []
  const { sportName, teamA, teamB, scoreA, scoreB, entries, statKeys } = input

  if (scoreA < 0 || scoreB < 0) problems.push('สกอร์ติดลบไม่ได้')

  /* ตัวตัดสิน (จุดโทษ/ทายเบรก) ใช้เมื่อสกอร์เสมอเท่านั้น — 2–1 (5–4 จุดโทษ)
     ไม่เคยเกิดขึ้นจริง เพราะถ้าชนะในเวลาก็ไม่ต้องยิงจุดโทษ */
  if (input.deciderGiven && scoreA !== scoreB) {
    problems.push('สกอร์ไม่เสมอ จึงไม่ต้องมีตัวตัดสิน — ลบค่าในช่องตัวตัดสินออก')
  }

  const scoringKey = SCORING_KEYS.find(k => statKeys.includes(k))
  const hasAssist = statKeys.includes(ASSIST_KEY)

  const sides: [{ id: number; name: string } | null, number][] = [[teamA, scoreA], [teamB, scoreB]]

  for (const [team, score] of sides) {
    if (!team) continue
    const name = team.name

    /* ประตูรายคนรวมกันต้องเท่าสกอร์ — เฉพาะกีฬาที่หน่วยตรงกัน */
    if (scoringKey && playerStatSumsToScore(sportName)) {
      const scored = sumOf(entries, team.id, scoringKey)
      if (scored !== score) {
        problems.push(
          `${name}: สกอร์ ${score} แต่รวมของผู้เล่นได้ ${scored} — ต้องเท่ากัน`,
        )
      }
    }

    if (!hasAssist || !assistNeedsGoal(sportName)) continue
    const assists = sumOf(entries, team.id, ASSIST_KEY)
    if (assists === 0) continue

    /* แอสซิสต์ต้องมีประตูรองรับ และหนึ่งประตูมีแอสซิสต์ได้ไม่เกินหนึ่ง */
    const goals = scoringKey ? sumOf(entries, team.id, scoringKey) : score
    if (goals === 0) {
      problems.push(`${name}: มีแอสซิสต์ ${assists} ทั้งที่ไม่มีประตูเลย`)
    } else if (assists > goals) {
      problems.push(
        `${name}: แอสซิสต์ ${assists} มากกว่าประตู ${goals} — หนึ่งประตูมีแอสซิสต์ได้ไม่เกินหนึ่ง`,
      )
    }
  }

  return problems
}

// ══════════════ การจับสาย ══════════════

/**
 * ทีมเดียวกันลงสองช่องไม่ได้ — จะกลายเป็นแข่งกับตัวเอง
 * ตรวจที่ชื่อช่องด้วย เพื่อบอกให้ชัดว่าซ้ำตรงไหน
 */
export function checkDraw(positions: string[], nameOf: (id: string) => string): string[] {
  const seen = new Map<string, number[]>()
  positions.forEach((id, i) => {
    if (!id) return
    const at = seen.get(id) ?? []
    at.push(i + 1)
    seen.set(id, at)
  })
  return [...seen.entries()]
    .filter(([, at]) => at.length > 1)
    .map(([id, at]) => `${nameOf(id)} ถูกวางไว้ ${at.length} ช่อง (ช่อง ${at.join(', ')}) — ทีมเดียวกันแข่งกันเองไม่ได้`)
}
