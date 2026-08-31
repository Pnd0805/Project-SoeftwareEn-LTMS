/**
 * src/components/kit/viewModels.ts
 *
 * รูปข้อมูลที่ kit component ต้องการ + ตัวแปลงจากรูปของ prototype
 *
 * แยกออกจากไฟล์ component เพราะ react-refresh บังคับว่าไฟล์ที่ export component
 * ต้อง export แต่ component เท่านั้น (ปน type/function แล้ว fast refresh พัง)
 *
 * ── ทำไมต้องมีชั้นนี้ ─────────────────────────────────────────────────────
 * ระหว่างย้ายจาก `shared/store` ไป API layer (PLAN.md v2) แต่ละโดเมนถือข้อมูลทีม
 * ในรูป DTO ของตัวเอง ไม่ได้อยู่ใน store — chip ที่บังคับให้ส่ง id มาค้น store
 * จะบล็อกทุกคนจนกว่า Teams จะย้ายเสร็จ ชั้นนี้ตัดโซ่นั้นออก
 */
import type { Match, Team } from '../../shared/types'

/** สิ่งเดียวที่ chip ต้องรู้เกี่ยวกับทีม — จงใจให้แคบที่สุด */
export interface TeamView {
  id: string | number
  name: string
  code?: string
  color?: string | null
  logoUrl?: string | null
}

export interface PlayerView {
  id: string | number
  name: string
}

/** `Team` (prototype) → `TeamView` — จุดเดียวที่รู้ว่า field ชื่อ `logo` ไม่ใช่ `logoUrl` */
export const toTeamView = (t: Team): TeamView => ({
  id: t.id, name: t.name, code: t.code, color: t.color, logoUrl: t.logo ?? null,
})

/**
 * สถานะแมตช์ที่ "วาดได้" — ไม่ผูกกับรูปข้อมูลฝั่งไหน
 *
 * prototype (`Match.status`) กับ schema (`matches.match_status`) ไม่ตรงกัน:
 * prototype มี `pending` / `confirmed` / `void` ส่วน schema มี `checkin_open` /
 * `in_progress` / `completed` — และ `pending` ของ prototype จริงๆ เป็นสถานะของ
 * **ผล** (`match_results.status='submitted'`) ไม่ใช่ของแมตช์
 *
 * ชุดนี้เลยเป็นภาษากลาง ครอบคลุมทั้งสองฝั่ง ใครจะ map มาจากอะไรก็ทำที่ต้นทางตัวเอง
 */
export type MatchState =
  | 'bye' | 'confirmed' | 'disputed' | 'pending'
  | 'checkin' | 'live' | 'scheduled' | 'waiting'

/** `Match` (prototype) → `MatchState` */
export const matchState = (m: Match): MatchState =>
  m.status === 'confirmed' ? (m.note === 'bye' ? 'bye' : 'confirmed')
    : m.status === 'disputed' ? 'disputed'
      : m.status === 'pending' ? 'pending'
        : m.a && m.b ? 'scheduled'
          : 'waiting'
