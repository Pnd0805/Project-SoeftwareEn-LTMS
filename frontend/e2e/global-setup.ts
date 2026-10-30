import { execSync } from "node:child_process"
import { api, ApiError } from "./support/api"
import { E2E_API_URL, E2E_BASE_URL, PASSWORD, USERS } from "./support/env"

/**
 * ด่านก่อนเริ่มรอบ — ให้พังเร็วพร้อมข้อความที่บอกว่าต้องทำอะไร แทนที่จะพังทีละเทสด้วย timeout
 *
 * 1. (ถ้าตั้ง E2E_RESET_CMD) ล้างฐานกลับเป็นข้อมูล QA ก่อนเริ่ม
 *    เช่น  E2E_RESET_CMD="python ../database/qa-baseline.py restore && cd ../backend && npm run migrate"
 *    ไม่ตั้งก็รันได้ — เทสสร้างข้อมูลของตัวเอง (ชื่อไม่ซ้ำ) แต่ข้อมูลจะสะสมในฐาน dev
 * 2. หน้าเว็บกับ API ต้องตอบ
 * 3. บัญชีทดสอบทุกบัญชีต้องล็อกอินได้
 */
export default async function globalSetup() {
  const reset = process.env.E2E_RESET_CMD
  if (reset) {
    console.log(`[e2e] reset: ${reset}`)
    execSync(reset, { stdio: "inherit", shell: process.platform === "win32" ? "cmd.exe" : "/bin/bash" })
  }

  try {
    const res = await fetch(E2E_BASE_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    throw new Error(`[e2e] เปิดหน้าเว็บ ${E2E_BASE_URL} ไม่ได้ (${String(err)}) — รัน \`npm run dev\` ใน frontend/ หรือ \`docker compose up\` ก่อน`, { cause: err })
  }

  try {
    await api("GET", "/tournaments")
  } catch (err) {
    throw new Error(`[e2e] เรียก API ${E2E_API_URL} ไม่ได้ (${String(err)}) — backend รันอยู่ไหม? (VITE_USE_MOCK ต้องเป็น false)`, { cause: err })
  }

  const failed: string[] = []
  for (const u of Object.values(USERS)) {
    try {
      await api("POST", "/auth/login", null, { email: u.email, password: PASSWORD })
    } catch (err) {
      // บอกเหตุผลด้วย — INVALID_CREDENTIALS (ไม่มีบัญชี/รหัสผิด) · EMAIL_NOT_VERIFIED · TOO_MANY_LOGIN_ATTEMPTS ต่างกันคนละเรื่อง
      const code = err instanceof ApiError
        ? `${err.status} ${(err.body as { error?: { code?: string } } | null)?.error?.code ?? ""}`.trim()
        : String(err)
      failed.push(`${u.email} (${code})`)
    }
  }
  if (failed.length > 0) {
    throw new Error(`[e2e] ล็อกอินไม่ได้: ${failed.join(", ")}\n` +
      `  · 401 INVALID_CREDENTIALS ทุกบัญชี = ฐานไม่ใช่ข้อมูล QA (docker สร้างจาก seed.sql ซึ่งไม่มีบัญชีเหล่านี้)\n` +
      `    แก้: cd backend → python ../database/qa-baseline.py restore → npm run migrate  (ดู e2e/README.md)\n` +
      `  · 403 EMAIL_NOT_VERIFIED = backend เปิด REQUIRE_EMAIL_VERIFIED อยู่\n` +
      `  · 429 TOO_MANY_LOGIN_ATTEMPTS = รอ 15 นาที หรือรีสตาร์ท backend`)
  }
}
