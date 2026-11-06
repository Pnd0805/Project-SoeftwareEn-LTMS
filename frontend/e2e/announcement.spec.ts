import { test, expect } from "./support/fixtures"
import { api, createOpenTournament, type CreatedTournament } from "./support/api"
import { USERS } from "./support/env"

/** ประกาศของทัวร์ — ผู้จัดโพสต์ แล้วผู้เยี่ยมชมเห็น */
test.describe("ประกาศ", () => {
  let t: CreatedTournament
  test.beforeEach(async () => { t = await createOpenTournament() })

  test("ผู้จัดโพสต์ประกาศ ⇒ ผู้เยี่ยมชมเห็นหัวข้อและข้อความ", async ({ page, signIn, browser }) => {
    const headline = `เลื่อนเวลาแข่ง (E2E ${Date.now().toString(36)})`
    const message = "รอบเช้าวันเสาร์เลื่อนไป 30 นาที กรุณามาเช็คอินตามเวลาใหม่"

    await signIn(USERS.organizer.email)
    await page.goto(`/t/${t.id}/announcements`)
    await page.getByRole("button", { name: "Post an announcement" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Announcement type").selectOption({ label: "schedule change" })
    await dialog.getByLabel("Headline").fill(headline)
    await dialog.getByLabel("Message").fill(message)
    await dialog.getByRole("button", { name: "Post" }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByText(headline)).toBeVisible()

    const guest = await (await browser.newContext()).newPage()
    await guest.goto(`/t/${t.id}/announcements`)
    await expect(guest.getByText(headline)).toBeVisible()
    await expect(guest.getByText(message)).toBeVisible()
    await expect(guest.getByRole("button", { name: "Post an announcement" })).toHaveCount(0)
    await guest.context().close()
  })

  test("หัวข้อว่างโพสต์ไม่ได้", async ({ page, signIn }) => {
    await signIn(USERS.organizer.email)
    await page.goto(`/t/${t.id}/announcements`)
    await page.getByRole("button", { name: "Post an announcement" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Message").fill("มีแต่ข้อความ ไม่มีหัวข้อ")
    await dialog.getByRole("button", { name: "Post" }).click()

    await expect(dialog).toBeVisible()
    const list = await api<{ items?: unknown[] } | unknown[]>("GET", `/tournaments/${t.id}/announcements`)
    expect(Array.isArray(list) ? list : list.items ?? []).toHaveLength(0)   // ทัวร์ใหม่ — ต้องยังไม่มีประกาศเลย
  })

  test("หัวหน้าทีมไม่มีปุ่มโพสต์ประกาศ", async ({ page, signIn }) => {
    await signIn(USERS.leader.email)
    await page.goto(`/t/${t.id}/announcements`)
    await expect(page.getByRole("heading", { name: "Announcements" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Post an announcement" })).toHaveCount(0)
  })
})
