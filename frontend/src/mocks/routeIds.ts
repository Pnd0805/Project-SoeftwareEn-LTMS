/**
 * src/mocks/routeIds.ts — แปลง id ที่มากับ URL ให้เป็นของใน store
 *
 * ── ปัญหาที่ไฟล์นี้แก้ ─────────────────────────────────────────────────────
 * แอปมี id สองระบบพร้อมกันระหว่างย้ายไป API
 *   store   't-byt', 'u-12'      หน้าจอที่ยังอ่าน prototype สร้างลิงก์แบบนี้
 *   DTO     553102, 118330       หน้าจอที่อ่านจาก API สร้างลิงก์แบบนี้
 *
 * `TeamLinkView` วาง `/team/${t.id}` โดยไม่รู้ว่า id มาจากไหน — ลิงก์ที่ออกมา
 * จากชิปในหน้าแมตช์ (ซึ่งได้ TeamView มาจาก MatchTeamRef) จึงเป็น `/team/553102`
 * แล้ว TeamPage ที่ค้นด้วย `team(s, id)` หาไม่เจอ กดแล้วขึ้นหน้าว่าง
 *
 * ที่นี่รับทั้งสองแบบ ลองตรงๆ ก่อน แล้วค่อยเทียบด้วย `numOf`
 * ตายพร้อมชั้น mock ตอน `VITE_USE_MOCK=false` เพราะตอนนั้นเหลือ id ระบบเดียว
 */
import { numOf } from './storeBridge'
import type { State, Team, Tournament, User } from '../shared/types'

const pick = <T extends { id: string }>(rows: T[], ref?: string | null): T | undefined => {
  if (ref === undefined || ref === null || ref === '') return undefined
  const direct = rows.find(r => r.id === ref)
  if (direct) return direct
  const n = Number(ref)
  return Number.isFinite(n) ? rows.find(r => numOf(r.id) === n) : undefined
}

export const routeTeam = (s: State, ref?: string | null): Team | undefined =>
  pick(s.teams, ref)

export const routeUser = (s: State, ref?: string | null): User | undefined =>
  pick(s.users, ref)

export const routeTour = (s: State, ref?: string | null): Tournament | undefined =>
  pick(s.tournaments, ref)
