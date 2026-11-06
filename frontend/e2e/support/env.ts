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
  referee3: { email: "ref3@ku.th", userId: 23 },                 // กรรมการที่ยังว่าง — ใช้ทดสอบตอบรับคำเชิญ
  newbie: { email: "newbie@ku.th" },                             // มีทีมเดียว — ใช้สร้างทีมใหม่ (ลบทิ้งหลังเทส)
  viewer: { email: "viewer1@ku.th", userId: 31, name: "ชนาธิป แฟนกีฬา" }, // ไม่มีทีม — ใช้เป็นผู้ถูกเชิญ
} as const

/** บัญชีที่ถูกระงับใน seed (ถึง 7 พ.ย. 2569) — ไม่อยู่ใน USERS เพราะล็อกอินไม่ได้โดยเจตนา */
export const SUSPENDED_EMAIL = "banned@ku.th"

/**
 * แมตช์ใน seed ที่เทสผลการแข่งใช้ — ทำได้ "ครั้งเดียวต่อการล้างฐาน" (ยืนยัน/ตัดสินแล้วย้อนไม่ได้)
 * ถ้าสถานะไม่ตรง เทสจะ skip พร้อมบอกให้ restore ข้อมูล QA
 */
export const SEED_MATCHES = {
  /** แบดมินตัน Faculty League R1 · วิศวะ Smashers 2–1 Sci Shuttle · กรรมการส่งผลแล้ว รอผู้ชนะยืนยัน */
  awaitingConfirmation: { id: 5, winnerLeader: "b1.lead@ku.th", loserLeader: "b2.lead@ku.th" },
  /** แบดมินตันกระชับมิตร R2 · BBA Birdies vs Sci Shuttle · มีข้อโต้แย้งรอผู้จัด (org1) ตัดสิน */
  disputed: { id: 13, organizer: "org1@ku.th" },
} as const

/** ทัวร์ใน seed ที่เป็น private (ผู้เยี่ยมชมต้องมองไม่เห็น) */
export const PRIVATE_TOURNAMENT_ID = 3
