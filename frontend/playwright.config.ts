import { defineConfig, devices } from "@playwright/test"

/**
 * E2E ของ LTMS — รันกับ frontend + backend + MySQL จริง (ไม่ใช่ mock)
 *
 * E2E_BASE_URL  ที่อยู่หน้าเว็บ (ค่าเริ่มต้น http://127.0.0.1:5173 = `npm run dev`)
 *               ใช้กับ docker compose ได้ด้วย: E2E_BASE_URL=http://127.0.0.1:8080
 *               ★ API ยิงผ่าน `${E2E_BASE_URL}/api/v1` ทั้งสองแบบ (Vite proxy / nginx) — ไม่ต้องตั้งแยก
 *
 * ★ workers: 1 — ทุกไฟล์ใช้ฐานข้อมูลเดียวกัน และหลายเทสเขียนข้อมูล (สร้างทัวร์ · สมัคร · อนุมัติ)
 *   รันขนานกันแล้วคิวของแอดมิน/ผู้จัดจะมีของจากเทสอื่นปนเข้ามา
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173"

/**
 * ไม่ได้ตั้ง E2E_BASE_URL ⇒ เปิด Vite ให้เองที่ 127.0.0.1:5173 (ถ้ามีเปิดอยู่แล้วก็ใช้ตัวเดิม)
 * ★ ต้องบังคับ --host 127.0.0.1 — Vite ตั้งต้นฟังที่ `localhost` ซึ่งบน Windows + Node 17 ขึ้นไป
 *   มักได้แค่ ::1 (IPv6) ⇒ เบราว์เซอร์เปิด localhost:5173 ได้ แต่ 127.0.0.1:5173 ต่อไม่ติด
 * ตั้ง E2E_BASE_URL (เช่น docker ที่ 8080) ⇒ ไม่เปิดอะไรเพิ่ม ใช้ที่อยู่นั้นตรง ๆ
 */
const webServer = process.env.E2E_BASE_URL
  ? undefined
  : {
      command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    }

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  webServer,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "en-US",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
  ],
})
