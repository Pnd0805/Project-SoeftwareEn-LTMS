import { test, expect } from "./support/fixtures"
import { PRIVATE_TOURNAMENT_ID } from "./support/env"
import { api } from "./support/api"

/** หน้าที่ผู้เยี่ยมชม (ไม่ล็อกอิน) เปิดได้ และหน้าที่ต้องกันไว้ */
test.describe("ผู้เยี่ยมชม", () => {
  test("หน้าแรกแสดงรายการทัวร์ที่เผยแพร่แล้ว", async ({ page }) => {
    const publicList = await api<{ items: Array<{ id: number; name: string }> }>("GET", "/tournaments")
    expect(publicList.items.length, "ข้อมูล QA ต้องมีทัวร์ public อย่างน้อยหนึ่งทัวร์").toBeGreaterThan(0)

    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Tournaments", level: 1 })).toBeVisible()
    await expect(page.getByText(publicList.items[0]!.name, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign in" }).or(page.getByRole("button", { name: "Sign in" })).first()).toBeVisible()
  })

  test("เปิดหน้ารายละเอียดทัวร์ public ได้", async ({ page }) => {
    const { items } = await api<{ items: Array<{ id: number; name: string }> }>("GET", "/tournaments")
    const t = items[0]!

    await page.goto(`/t/${t.id}`)

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.name, { ignoreCase: true })
    await expect(page.getByRole("heading", { name: "Details" })).toBeVisible()
  })

  // A2 — ทัวร์ที่ยังไม่เผยแพร่ต้องไม่หลุดให้คนนอกเห็น
  test("ทัวร์ private เปิดตรงด้วยลิงก์ก็มองไม่เห็น", async ({ page }) => {
    await page.goto(`/t/${PRIVATE_TOURNAMENT_ID}`)

    await expect(page.getByText("Tournament unavailable")).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0)
  })

  for (const path of ["/teams", "/matches", "/inbox", "/me", "/admin", "/request"]) {
    test(`หน้าที่ต้องล็อกอิน ${path} ส่งไปหน้าเข้าสู่ระบบ`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
    })
  }
})
