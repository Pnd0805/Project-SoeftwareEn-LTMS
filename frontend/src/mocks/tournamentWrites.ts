/**
 * src/mocks/tournamentWrites.ts — ทางเขียนฝั่งทัวร์นาเมนต์ในโหมด mock
 *
 * เหตุผลเดียวกับ `matchWrites` / `teamWrites` / `adminWrites`: หน้าจัดการอ่าน
 * ทัวร์นาเมนต์จาก store ทางเขียนจึงต้องลง store ที่เดียวกัน
 *
 * ── ทำไมถึงต้องมีไฟล์นี้ ──────────────────────────────────────────────────
 * `api/tournament.ts` ทำงานกับ `mockTournaments` (id 101, 102) ซึ่งเป็นคนละชุด
 * กับทัวร์นาเมนต์ใน seed ('t-fut', 't-fb') ที่คนกดจริงในเดโม ผลคือหน้าอนุมัติ
 * ใบสมัครและหน้าจับสายต้องปิดปุ่มไว้ เพราะส่งคำสั่งไปก็ไม่ตรงกับอะไรเลย
 *
 * `approveRegistration` / `rejectRegistration` / `approveAll` / `allowWithdraw`
 * เคยอยู่ใน store.ts แต่ถูกลบตอนสไลซ์ 2 ย้ายไป API — จึงเขียนขึ้นใหม่ที่นี่
 * ส่วนการจับสายยังเรียก `drawBracket` เดิมเพราะมันสร้างสายทั้งชุดให้อยู่แล้ว
 *
 * ทั้งไฟล์ตายตอน `VITE_USE_MOCK=false`
 */
import { commitStore, drawBracket, getState } from '../shared/store'
import { doubleEntered, hardFilter, regWindowClosed } from '../shared/rules'
import { numOf } from './storeBridge'
import type { Registration, State, Tournament } from '../shared/types'
import type { TournamentApplicationDto } from '../types/tournament.dto'

/** id ของทัวร์นาเมนต์/ใบสมัคร รับได้ทั้งตัวเลขของ DTO และ string ของ store */
export type TournamentRef = number | string

const findTour = (s: State, ref: TournamentRef): Tournament | undefined =>
  s.tournaments.find(t => t.id === String(ref)) ?? s.tournaments.find(t => numOf(t.id) === Number(ref))

const findReg = (s: State, ref: TournamentRef): Registration | undefined =>
  s.registrations.find(r => r.id === String(ref)) ?? s.registrations.find(r => numOf(r.id) === Number(ref))

// ── ใบสมัคร (Soft filter ของผู้จัด — FR-OM-04) ────────────────────────────

export function writeApproveRegistration(ref: TournamentRef): boolean {
  const s = getState()
  const r = findReg(s, ref)
  if (!r) return false
  r.status = 'approved'
  r.reason = undefined
  commitStore()
  return true
}

/** FR-OM-04 — ปฏิเสธต้องมีเหตุผล และเหตุผลนั้นต้องกลับไปถึงผู้ยื่น */
export function writeRejectRegistration(ref: TournamentRef, reason: string): boolean {
  const s = getState()
  const r = findReg(s, ref)
  if (!r) return false
  r.status = 'rejected'
  r.reason = reason || 'ไม่ผ่านการพิจารณาของผู้จัด'
  commitStore()
  return true
}

/** อนุมัติทุกใบที่ยังค้าง — คืนจำนวนที่อนุมัติไป */
export function writeApproveAllRegistrations(ref: TournamentRef): number {
  const s = getState()
  const t = findTour(s, ref)
  if (!t) return 0
  const pend = s.registrations.filter(r => r.tour === t.id && r.status === 'pending')
  pend.forEach(r => { r.status = 'approved'; r.reason = undefined })
  if (pend.length) commitStore()
  return pend.length
}

/**
 * FR-TR-04 — ผู้จัดอนุญาตให้ถอนตัวหลังสายออกแล้ว
 * store เก็บเป็นธงบนใบสมัคร การอนุญาตคือถอดทีมออกจากรายการที่อนุมัติ
 */
export function writeAllowWithdrawal(ref: TournamentRef): boolean {
  const s = getState()
  const r = findReg(s, ref)
  if (!r) return false
  r.status = 'rejected'
  r.withdrawRequested = false
  r.reason = 'ถอนตัวโดยได้รับอนุญาตจากผู้จัด'
  commitStore()
  return true
}

// ── การจับสาย (FR-MM-01) ──────────────────────────────────────────────────

/**
 * `drawBracket` สร้างแมตช์ทั้งสายให้เอง และ commit ให้ด้วย
 * `order` เป็น id ของทีมในฝั่ง store — ผู้เรียกที่ถือ id ตัวเลขต้องแปลงก่อน
 */
export function writeDrawTournament(ref: TournamentRef, teamRefs?: TournamentRef[]): boolean {
  const s = getState()
  const t = findTour(s, ref)
  if (!t) return false
  const order = teamRefs
    ?.map(x => s.teams.find(tm => tm.id === String(x))?.id
      ?? s.teams.find(tm => numOf(tm.id) === Number(x))?.id)
    .filter((x): x is string => !!x)

  /* ทีมเดียวกันลงสองช่องไม่ได้ — หน้าจอกันไว้แล้ว แต่ชั้น API ถูกเรียกตรงได้
     ถ้าปล่อยผ่าน buildBracket จะสร้างนัดที่ทีมแข่งกับตัวเอง ซึ่งไม่มีทางจบ */
  if (order && new Set(order).size !== order.length) return false

  drawBracket(t.id, order?.length ? order : undefined)
  return true
}

// ── อ่านกลับเป็น DTO หลังเขียน ─────────────────────────────────────────────

/** ใบสมัครใน store แปลงเป็น DTO เพื่อคืนให้ผู้เรียกหลังสั่งงานสำเร็จ */
export function storeApplicationDto(ref: TournamentRef): TournamentApplicationDto | null {
  const s = getState()
  const r = findReg(s, ref)
  if (!r) return null
  const team = s.teams.find(t => t.id === r.team)
  return {
    id: numOf(r.id),
    tournamentId: numOf(r.tour),
    teamId: numOf(r.team),
    team: { id: numOf(r.team), name: team?.name ?? '—' },
    /* store ไม่ได้เก็บผล hard filter ไว้ — คำนวณสดตอนอ่านในพาเนล */
    hardFilterPassed: r.status === 'rejected' ? false : true,
    hardFilterDetails: null,
    softFilterDocuments: null,
    status: r.status === 'rejected' ? 'rejected' : r.status === 'approved' ? 'approved' : 'pending',
    reviewedBy: null,
    reviewedAt: r.status === 'pending' ? null : new Date(r.at).toISOString(),
    rejectionReason: r.reason ?? null,
    appliedAt: new Date(r.at).toISOString(),
  }
}

// ── สมัครเข้าแข่ง (FR-TR-03) ──────────────────────────────────────────────

/**
 * เหตุผลที่สมัครไม่ได้ — null แปลว่าสมัครได้
 *
 * `registerSquad` เคยอยู่ใน store แต่ถูกลบตอนสไลซ์ 2 ย้ายไป API และ API เดิม
 * รู้จักแต่ `mockTournaments` ผลคือฟอร์มสมัครส่ง `Number('t-fut')` = NaN แล้วได้
 * 404 เงียบๆ — สมัครไม่ได้เลยสำหรับทัวร์นาเมนต์ทุกรายการใน seed
 *
 * ด่านทั้งหมดนี้หน้าจอแสดงให้เห็นอยู่แล้ว แต่ชั้น API ถูกเรียกตรงได้ จึงตรวจซ้ำ
 */
export function whyApplyBlocked(ref: TournamentRef, teamRef: TournamentRef, squad: string[]): string | null {
  const s = getState()
  const t = findTour(s, ref)
  if (!t) return 'ไม่พบการแข่งขัน'
  const tm = s.teams.find(x => x.id === String(teamRef))
    ?? s.teams.find(x => numOf(x.id) === Number(teamRef))
  if (!tm) return 'ไม่พบทีม'

  if (t.status !== 'public') return 'รายการนี้ยังไม่เปิดรับสมัคร'
  if (t.drawn) return 'จับสายไปแล้ว รับสมัครเพิ่มไม่ได้'
  const shut = regWindowClosed(t)
  if (shut) return shut

  if (s.registrations.some(r => r.tour === t.id && r.team === tm.id && r.status !== 'withdrawn')) {
    return 'ทีมนี้สมัครรายการนี้ไปแล้ว'
  }

  /* ที่นั่งเต็มแล้วรับเพิ่มไม่ได้ — นับเฉพาะที่อนุมัติแล้ว ตรงกับที่ `openToEnter` ใช้ */
  const taken = s.registrations.filter(r => r.tour === t.id && r.status === 'approved').length
  if (taken >= t.cap) return `รายการนี้เต็มแล้ว (${taken} จาก ${t.cap} ทีม)`

  /* Hard filter — คุณสมบัติรายบุคคลที่ระบบตรวจเอง ไม่ใช่ดุลพินิจผู้จัด (FR-PV-01) */
  const fails = hardFilter(s, tm, t, squad)
  if (fails.length) {
    return `ไม่ผ่านเงื่อนไขรับสมัคร: ${fails.map(f => `${f.user.name} — ${f.rule}`).join(', ')}`
  }

  /* คนเดียวลงสองทีมในรายการเดียวกันไม่ได้ */
  const dbl = doubleEntered(s, tm, t, squad)
  if (dbl.length) {
    return `ลงซ้ำสองทีมในรายการเดียวกัน: ${dbl.map(d => `${d.user.name} (${d.other.name})`).join(', ')}`
  }
  return null
}

/** คืน id ของใบสมัครที่สร้าง หรือ null เมื่อทำไม่ได้ */
export function writeApplyToTournament(
  ref: TournamentRef, teamRef: TournamentRef, squad: string[],
): string | null {
  const s = getState()
  const t = findTour(s, ref)
  const tm = s.teams.find(x => x.id === String(teamRef))
    ?? s.teams.find(x => numOf(x.id) === Number(teamRef))
  if (!t || !tm) return null
  if (whyApplyBlocked(ref, teamRef, squad)) return null

  const id = `r-${Date.now()}-${tm.id}`
  s.registrations.push({
    id, tour: t.id, team: tm.id, status: 'pending',
    at: Date.now(), squad: squad.length ? squad.slice() : tm.members.slice(),
  })
  commitStore()
  return id
}
