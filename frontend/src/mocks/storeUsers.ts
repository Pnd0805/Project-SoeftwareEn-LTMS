/**
 * src/mocks/storeUsers.ts — ให้ทุกคนใน seed ล็อกอินได้ในโหมด mock
 *
 * ── ปัญหาที่ไฟล์นี้แก้ ─────────────────────────────────────────────────────
 * `user.mock.ts` มีบัญชีอยู่ 5 ใบ แต่ seed มีผู้ใช้ 97 คน ทีม 20 กว่าทีม และแมตช์
 * หลายสิบนัด สิทธิ์เกือบทั้งหมดผูกกับความสัมพันธ์ ไม่ใช่ role — "หัวหน้าทีมที่ชนะ
 * นัดนี้" เท่านั้นที่ยืนยันผลได้ (FR-RS-02) "กรรมการของทัวร์นาเมนต์นี้" เท่านั้นที่
 * บันทึกสถิติได้ (FR-RM-03)
 *
 * ห้าบัญชีนั้นครอบคลุมความสัมพันธ์ได้ไม่กี่แบบ ปุ่มที่เหลือจึงไม่มีใครกดได้เลย
 * ไม่ใช่เพราะพัง แต่เพราะไม่มีตัวละครที่มีสิทธิ์ให้ล็อกอิน
 *
 * ที่นี่แปลงผู้ใช้ใน store ทุกคนเป็นบัญชีที่ล็อกอินได้ ใช้ id ตัวเลขชุดเดียวกับ
 * `numOf` ทั้งแอป และรหัสผ่านเดียวกันหมด — ข้อมูลปลอมที่มีอยู่แล้วจึงถูกใช้ได้จริง
 * โดยไม่ต้องกุตัวละครใหม่
 *
 * ตายพร้อมชั้น mock ตอน `VITE_USE_MOCK=false`
 */
import { getState } from '../shared/store'
import { numOf } from './storeBridge'
import type { MockUserRecord } from './user.mock'
import type { User as StoreUser } from '../shared/types'

/** รหัสผ่านเดียวสำหรับทุกบัญชีที่มาจาก seed — ตรงกับที่หน้า login เติมให้อยู่แล้ว */
export const STORE_USER_PASSWORD = 'password123'

/** ปีเกิดคร่าวๆ จาก dob ของ store ซึ่งเป็น ISO อยู่แล้ว */
const toRecord = (u: StoreUser): MockUserRecord => ({
  id: numOf(u.id),
  fullName: u.name,
  email: u.email,
  userType: u.role === 'Admin' ? 'staff' : 'student',
  /* store ใช้ 'Male'/'Female' — DTO ใช้ตัวพิมพ์เล็กตาม enum ของ schema */
  gender: u.gender === 'Male' ? 'male' : 'female',
  birthDate: u.dob,
  /* store เก็บคณะ/ภาควิชาเป็นชื่อ ไม่ใช่ id — ไม่มีตารางอ้างอิงให้แปลง จึงใส่ 0
     หน้าที่ต้องการชื่อจริงอ่านจาก store ได้ตรงๆ อยู่แล้ว */
  facultyId: 0,
  departmentId: 0,
  year: u.year,
  avatarUrl: null,
  contactInfo: null,
  address: null,
  totalPoints: 0,
  notificationPrefs: null,
  createdAt: '2026-02-08T12:00:00+07:00',
  passwordForMock: STORE_USER_PASSWORD,
})

const normalize = (email: string) => email.trim().toLowerCase()

/** หาบัญชีจากอีเมล — คืน undefined ถ้าไม่มีใครใน seed ใช้อีเมลนี้ */
export function findStoreUserByEmail(email: string): MockUserRecord | undefined {
  const needle = normalize(email)
  const u = getState().users.find(x => normalize(x.email) === needle)
  return u ? toRecord(u) : undefined
}

/** หาบัญชีจาก id ตัวเลข — ใช้ตอน getMe() หลังล็อกอินแล้ว */
export function findStoreUserById(id: number): MockUserRecord | undefined {
  const u = getState().users.find(x => numOf(x.id) === id)
  return u ? toRecord(u) : undefined
}

/**
 * รายชื่อทั้งหมดสำหรับตัวเลือก "ล็อกอินเป็นใครก็ได้" ในหน้า login
 * แนบสิ่งที่คนนั้นทำได้มาด้วย จะได้เลือกตัวละครที่ตรงกับสิ่งที่อยากทดสอบ
 */
export interface StoreUserOption {
  email: string
  name: string
  role: string
  /** สิ่งที่คนนี้กดได้ในเดโม เช่น 'หัวหน้า Nursing', 'กรรมการ 3 ทัวร์นาเมนต์' */
  can: string[]
}

export function storeUserOptions(): StoreUserOption[] {
  const s = getState()
  return s.users.map(u => {
    const can: string[] = []
    const led = s.teams.filter(t => t.leader === u.id)
    if (led.length) can.push(`หัวหน้าทีม ${led.map(t => t.name).join(', ')}`)
    const member = s.teams.filter(t => t.leader !== u.id && t.members.includes(u.id))
    if (member.length) can.push(`ผู้เล่น ${member.length} ทีม`)
    const orgs = s.tournaments.filter(t => t.organizer === u.id)
    if (orgs.length) can.push(`ผู้จัด ${orgs.map(t => t.name).join(', ')}`)
    const refs = s.tournaments.filter(t => (t.referees ?? []).includes(u.id))
    if (refs.length) can.push(`กรรมการ ${refs.length} ทัวร์นาเมนต์`)
    if (u.role === 'Admin') can.push('ผู้ดูแลระบบ')
    return { email: u.email, name: u.name, role: u.role, can }
  })
}
