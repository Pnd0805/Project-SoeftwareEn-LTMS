/** ค่ากลางของ E2E — แก้ที่นี่ที่เดียว */
export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173"
export const E2E_API_URL = process.env.E2E_API_URL ?? `${E2E_BASE_URL}/api/v1`

/** รหัสผ่านของทุกบัญชีในข้อมูล QA (database/qa-baseline.sql) */
export const PASSWORD = process.env.E2E_PASSWORD ?? "abcd1234"

/** frontend เก็บ token ใน sessionStorage คีย์นี้ (src/api/client.ts · TOKEN_KEY) */
export const TOKEN_KEY = "ltms.access-token"

/**
 * บัญชีจากข้อมูล QA ที่เทสใช้ — ถ้า baseline เปลี่ยน ให้แก้ตรงนี้
 * ตรวจครบทุกบัญชีตอนเริ่มรอบใน global-setup ⇒ ถ้าบัญชีหาย จะรู้ทันที ไม่ใช่ไปพังกลางเทส
 */
export const USERS = {
  admin: { email: "admin@ku.th", name: "สมชาย ใจดี" },          // แอดมินระดับมหาวิทยาลัย
  organizer: { email: "org1@ku.th", name: "ปกรณ์ จัดการดี" },   // ผู้จัดทัวร์ 1, 5, 7, 11, 12
  leader: { email: "b1.lead@ku.th", teamId: 1, teamName: "วิศวะ Smashers" }, // หัวหน้าทีมแบดมินตัน 2 คน
  leader2: { email: "b2.lead@ku.th", teamId: 2, teamName: "Sci Shuttle" },
  referee1: { email: "ref1@ku.th", userId: 21 },
  referee2: { email: "ref2@ku.th", userId: 22 },
} as const

/** ทัวร์ใน seed ที่เป็น private (ผู้เยี่ยมชมต้องมองไม่เห็น) */
export const PRIVATE_TOURNAMENT_ID = 3
