import { test, expect } from "./support/fixtures"
import { api, applyWithWholeTeam, createOpenTournament, loginToken } from "./support/api"
import { PASSWORD, SUSPENDED_EMAIL, USERS } from "./support/env"

test.describe("กล่องแจ้งเตือน", () => {
  test("ผู้จัดอนุมัติใบสมัคร ⇒ หัวหน้าทีมได้แจ้งเตือนใน Inbox", async ({ page, signIn }) => {
    const t = await createOpenTournament()
    const app = await applyWithWholeTeam(USERS.leader2.email, t.id, USERS.leader2.teamId)
    await api("POST", `/applications/${app.id}/approve`, await loginToken(USERS.organizer.email))

    await signIn(USERS.leader2.email)
    await page.goto("/inbox")
    await expect(page.getByRole("heading", { name: /^Inbox/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Open: ใบสมัครได้รับการอนุมัติ" }).first()).toBeVisible()
  })

  test("Mark all read ⇒ ไม่เหลือรายการที่ยังไม่อ่าน", async ({ page, signIn }) => {
    await signIn(USERS.leader2.email)
    await page.goto("/inbox")
    const markAll = page.getByRole("button", { name: "Mark all read" })
    if (await markAll.isEnabled()) await markAll.click()

    await expect(page.getByRole("heading", { name: /unread/i })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /^Mark read:/ })).toHaveCount(0)
  })
})

test.describe("ค้นหา", () => {
  test("ค้นหาชื่อทัวร์ ⇒ เจอทัวร์และกดเข้าไปได้", async ({ page, signIn }) => {
    const { items } = await api<{ items: Array<{ id: number; name: string }> }>("GET", "/tournaments")
    const target = items.find(i => /^[\x20-\x7e]+$/.test(i.name)) ?? items[0]!   // ชื่ออังกฤษพิมพ์ง่ายกว่า

    await signIn(USERS.leader.email)
    await page.goto("/search")
    await page.getByRole("searchbox", { name: "Search terms" }).fill(target.name)
    await page.keyboard.press("Enter")

    await expect(page.getByRole("button", { name: /^Tournaments [1-9]/ })).toBeVisible()
    await page.getByRole("button", { name: `Open tournament: ${target.name}` }).click()
    await expect(page).toHaveURL(new RegExp(`/t/${target.id}`))
  })

  test("คำที่ไม่ตรงอะไรเลย ⇒ 0 results", async ({ page, signIn }) => {
    await signIn(USERS.leader.email)
    await page.goto(`/search/${encodeURIComponent("zzqq-ไม่มีแน่นอน-e2e")}`)
    await expect(page.getByText("0 results")).toBeVisible()
  })
})

test.describe("บัญชีถูกระงับ", () => {
  test("ล็อกอินไม่ได้ และเห็นเหตุผล", async ({ page }) => {
    const probe = await fetch(`${process.env.E2E_API_URL ?? `${process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173"}/api/v1`}/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: SUSPENDED_EMAIL, password: PASSWORD }),
    })
    test.skip(probe.status !== 403, `${SUSPENDED_EMAIL} ไม่ได้ถูกระงับแล้ว (การระงับใน seed หมดอายุ 7 พ.ย. 2569) — restore ข้อมูล QA ใหม่ หรือข้ามเทสนี้`)

    await page.goto("/login")
    await page.getByLabel("Email").fill(SUSPENDED_EMAIL)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page.getByRole("alert").first()).toContainText("ถูกระงับ")
    await expect(page).toHaveURL(/\/login$/)
  })
})
