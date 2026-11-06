/**
 * ตัวช่วยยิง API ตรงสำหรับ "เตรียมข้อมูล" — ไม่ได้ใช้ทดสอบหน้าจอ
 *
 * ★ ทำไมเตรียมผ่าน API ไม่ใช่คลิกผ่านหน้าเว็บทุกขั้น
 *   เทสแต่ละไฟล์ทดสอบหน้าจอเดียว (เช่น หัวหน้าทีมกดสมัคร) ขั้นก่อนหน้า (ขอจัดทัวร์ → แอดมินอนุมัติ →
 *   เชิญกรรมการ → เผยแพร่ → เปิดรับสมัคร) มีเทสของตัวเองแยกไว้แล้ว ถ้าคลิกซ้ำทุกไฟล์
 *   เทสจะช้าและพังเพราะหน้าจออื่นที่ไม่เกี่ยว
 *
 * ★ ทำไมสร้างทัวร์ใหม่ทุกครั้ง ไม่ใช้ทัวร์ใน seed
 *   ข้อมูล QA ผูกกับวันที่ (ทัวร์ใน seed ปิดรับสมัครตั้งแต่ 16 ต.ค. 2569)
 *   ทัวร์ที่สร้างเองตั้งวันที่จาก "ตอนนี้" ⇒ เทสไม่หมดอายุไปตามปฏิทิน
 */
import { E2E_API_URL, PASSWORD } from "./env"

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: unknown, readonly path: string) {
    super(`${path} → ${status}: ${JSON.stringify(body).slice(0, 300)}`)
  }
}

export async function api<T = unknown>(method: string, path: string, token?: string | null, body?: unknown): Promise<T> {
  const res = await fetch(E2E_API_URL + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: unknown = text
  try { json = text ? JSON.parse(text) : null } catch { /* ไม่ใช่ JSON — คืนข้อความดิบ */ }
  if (!res.ok) throw new ApiError(res.status, json, `${method} ${path}`)
  return json as T
}

const tokenCache = new Map<string, string>()

/** ล็อกอินด้วยรหัสกลางของข้อมูล QA · แคชไว้ทั้งรอบเพราะ token อายุ 7 วัน */
export async function loginToken(email: string): Promise<string> {
  const cached = tokenCache.get(email)
  if (cached) return cached
  const res = await api<{ accessToken: string }>("POST", "/auth/login", null, { email, password: PASSWORD })
  tokenCache.set(email, res.accessToken)
  return res.accessToken
}

const DAY = 24 * 60 * 60 * 1000
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export type CreatedTournament = { id: number; name: string }

/** ผู้จัดยื่นคำขอจัดทัวร์ (สถานะ pending_approval) — ยังไม่ผ่านแอดมิน */
export async function requestTournament(organizerEmail: string, overrides: Record<string, unknown> = {}): Promise<CreatedTournament> {
  const now = Date.now()
  const name = (overrides.name as string | undefined) ?? `E2E ${now.toString(36)}`
  const body = {
    name,
    sportTypeId: 3, // แบดมินตัน — 2–4 คน/ทีม ⇒ ทีม b1–b6 ใน seed สมัครได้เลย
    bracketFormat: "single_elimination",
    scopeType: "faculty",
    organizingFacultyId: 1,
    registrationStart: new Date(now - 60 * 60 * 1000).toISOString(),
    registrationEnd: new Date(now + 7 * DAY).toISOString(),
    eventStartDate: isoDate(now + 14 * DAY),
    eventEndDate: isoDate(now + 15 * DAY),
    maxTeams: 8,
    minTeams: 2,
    venue: "E2E Court",
    genderRequirement: "any",
    ...overrides,
  }
  const res = await api<{ id: number }>("POST", "/tournaments", await loginToken(organizerEmail), body)
  return { id: res.id, name }
}

/**
 * ทัวร์ที่ "เปิดรับสมัครอยู่" พร้อมใช้: ขอจัด → แอดมินอนุมัติ → เชิญกรรมการ 2 คน → ตอบรับ → เผยแพร่ → เปิดรับสมัคร
 * แบดมินตันแข่งที่สนามและมีสถิติ ⇒ ต้องมีกรรมการพร้อมอย่างน้อย 2 คนก่อนเผยแพร่ (BR-11)
 */
export async function createOpenTournament(opts: { organizer?: string; admin?: string; referees?: Array<{ email: string; userId: number }> } = {}) {
  const organizer = opts.organizer ?? "org1@ku.th"
  const admin = opts.admin ?? "admin@ku.th"
  const referees = opts.referees ?? [{ email: "ref1@ku.th", userId: 21 }, { email: "ref2@ku.th", userId: 22 }]
  const org = await loginToken(organizer)

  const t = await requestTournament(organizer)
  await api("POST", `/tournaments/${t.id}/approve`, await loginToken(admin))
  for (const ref of referees) {
    const inv = await api<{ id: number }>("POST", `/tournaments/${t.id}/referees`, org, { userId: ref.userId })
    await api("POST", `/referee-invitations/${inv.id}/accept`, await loginToken(ref.email), {})
  }
  await api("POST", `/tournaments/${t.id}/publish`, org)
  await api("POST", `/tournaments/${t.id}/open-registration`, org)
  return t
}

/** สมัครทีมเข้าทัวร์ด้วยสมาชิกทุกคนในทีม — ใช้เตรียมข้อมูลให้เทสฝั่งผู้จัด */
export async function applyWithWholeTeam(leaderEmail: string, tournamentId: number, teamId: number) {
  const token = await loginToken(leaderEmail)
  const members = await api<{ items?: Array<{ userId: number }> } | Array<{ userId: number }>>("GET", `/teams/${teamId}/members`, token)
  const list = Array.isArray(members) ? members : members.items ?? []
  return api<{ id: number }>("POST", `/tournaments/${tournamentId}/applications`, token, {
    teamId,
    playerIds: list.map(m => m.userId),
  })
}

/**
 * ทัวร์ที่ "พร้อมจัดสาย": เปิดรับสมัคร → ทีม b1 กับ b2 สมัครและผู้จัดอนุมัติ → ปิดรับสมัคร
 * ยังไม่จัดสาย — ให้เทสกดจัดสายเองผ่านหน้าจอ
 */
export async function createDrawReadyTournament() {
  const t = await createOpenTournament()
  const org = await loginToken("org1@ku.th")
  for (const [leader, teamId] of [["b1.lead@ku.th", 1], ["b2.lead@ku.th", 2]] as const) {
    const app = await applyWithWholeTeam(leader, t.id, teamId)
    await api("POST", `/applications/${app.id}/approve`, org)
  }
  await api("POST", `/tournaments/${t.id}/close-registration`, org)
  return t
}

/** ทัวร์ที่ผ่านแอดมินแล้ว (private) — ยังไม่เชิญกรรมการ */
export async function createApprovedTournament(organizerEmail = "org1@ku.th") {
  const t = await requestTournament(organizerEmail)
  await api("POST", `/tournaments/${t.id}/approve`, await loginToken("admin@ku.th"))
  return t
}

export async function createTeam(leaderEmail: string, name: string, sportTypeId = 3) {
  return api<{ id: number; name: string }>("POST", "/teams", await loginToken(leaderEmail), { name, sportTypeId })
}

/** ลบทีม (soft delete) — ใช้เก็บกวาดหลังเทส · ลบไม่ได้ก็ไม่ต้องแดง */
export async function deleteTeam(leaderEmail: string, teamId: number) {
  await api("DELETE", `/teams/${teamId}`, await loginToken(leaderEmail)).catch(() => undefined)
}

export type MatchState = { status: string; resultStatus: string | null }

/** สถานะปัจจุบันของแมตช์ — เทสที่ใช้แมตช์ใน seed เช็คก่อนว่ายังเป็นสถานะตั้งต้นอยู่ไหม */
export async function matchState(matchId: number, viewerEmail: string): Promise<MatchState> {
  const m = await api<{ status: string; result?: { status?: string } | null; resultStatus?: string | null }>(
    "GET", `/matches/${matchId}`, await loginToken(viewerEmail))
  return { status: m.status, resultStatus: m.resultStatus ?? m.result?.status ?? null }
}
