import { test, expect } from "./support/fixtures"
import { PASSWORD, USERS } from "./support/env"

/** ฟอร์มเข้าสู่ระบบ / ออกจากระบบ / สมัครสมาชิก — ไฟล์นี้ไฟล์เดียวที่ล็อกอินผ่านหน้าจอจริง */
test.describe("เข้าสู่ระบบ", () => {
  test("ล็อกอินด้วยอีเมลและรหัสผ่านที่ถูก แล้วเห็นชื่อตัวเอง", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(USERS.admin.email)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page).not.toHaveURL(/\/login$/)
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible()
    await expect(page.getByText(USERS.admin.name).first()).toBeVisible()
  })

  // ★ ผิดแค่ครั้งเดียว — ตัวจำกัดล็อกอินนับ 10 ครั้งต่อ (IP, อีเมล) รันซ้ำหลายรอบก็ไม่ถึง
  test("รหัสผ่านผิด แสดงข้อความผิดพลาดและยังอยู่หน้าเดิม", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(USERS.admin.email)
    await page.getByLabel("Password").fill("wrong-password-1")
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page.getByRole("alert")).toContainText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    await expect(page).toHaveURL(/\/login$/)
  })

  test("ช่องว่างไม่ส่งคำขอไปที่ server", async ({ page }) => {
    let calls = 0
    page.on("request", r => { if (r.url().includes("/auth/login")) calls++ })
    await page.goto("/login")
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page.getByRole("alert").first()).toBeVisible()
    expect(calls).toBe(0)
  })

  test("ออกจากระบบแล้วกลับเป็นผู้เยี่ยมชม", async ({ page, signIn }) => {
    await signIn(USERS.leader.email)
    await page.goto("/")
    await page.getByRole("button", { name: "Log out" }).click()
    // ★ token ถูกล้างหลัง POST /auth/logout ตอบกลับ (src/api/auth.ts) — ต้องรอให้หน้าเว็บกลับเป็นผู้เยี่ยมชมก่อน
    //   ถ้าเปิดหน้าถัดไปทันที บางรอบ token ยังอยู่ แล้วเทสนี้แดงแบบสุ่ม
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0)

    await page.goto("/teams")
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe("สมัครสมาชิก", () => {
  // อีเมลนอกมหาวิทยาลัย ⇒ ไม่มีขั้นกรอกคณะ/ชั้นปี · ชื่อไม่ซ้ำทุกรอบ ⇒ รันซ้ำได้โดยไม่ต้องล้างฐาน
  test("สมัครด้วยอีเมลภายนอก ไปหน้ายืนยันอีเมล แล้วล็อกอินได้", async ({ page }) => {
    const email = `e2e.${Date.now().toString(36)}@example.com`
    const password = "e2eTest1234"

    await page.goto("/register")
    await page.getByLabel("Full name").fill("ผู้ทดสอบ อีทูอี")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByLabel("Gender").selectOption({ label: "Female" })
    await page.getByLabel("Birth date").fill("2003-05-14")
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page).toHaveURL(/\/register\?step=otp/)
    expect(new URL(page.url()).searchParams.get("email")).toBe(email)

    // REQUIRE_EMAIL_VERIFIED=false (ค่าตั้งต้น) ⇒ ยังไม่ยืนยันก็ล็อกอินได้
    // ถ้าเปิดด่านยืนยันอีเมล เทสข้อนี้ต้องแก้ให้กรอก OTP (ดูจาก Mailpit) ก่อน
    await page.goto("/login")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible()
  })

  test("อีเมลที่สมัครแล้วสมัครซ้ำไม่ได้", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("Full name").fill("ซ้ำ ซ้ำ")
    await page.getByLabel("Email").fill("ref.ext1@gmail.com")   // กรรมการภายนอกใน seed — ยืนยันอีเมลแล้ว
    await page.getByLabel("Password").fill("e2eTest1234")
    await page.getByLabel("Gender").selectOption({ label: "Male" })
    await page.getByLabel("Birth date").fill("2000-01-01")
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page.getByText("อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว").first()).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })
})
