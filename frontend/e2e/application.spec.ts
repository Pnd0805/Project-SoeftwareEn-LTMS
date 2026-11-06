import { test, expect } from "./support/fixtures"
import { applyWithWholeTeam, createOpenTournament, type CreatedTournament } from "./support/api"
import { USERS } from "./support/env"

/**
 * สมัครทีมเข้าทัวร์ (หัวหน้าทีม) → พิจารณาใบสมัคร (ผู้จัด)
 * ทุกเทสสร้างทัวร์ที่เปิดรับสมัครใหม่ของตัวเอง ⇒ ไม่ชนกัน และไม่ขึ้นกับวันที่ใน seed
 */
test.describe("สมัครทีมเข้าทัวร์", () => {
  let t: CreatedTournament
  test.beforeEach(async () => { t = await createOpenTournament() })

  test("หัวหน้าทีมสมัครผ่านหน้าทัวร์ ⇒ สถานะรอผู้จัด", async ({ page, signIn }) => {
    await signIn(USERS.leader.email)
    await page.goto(`/t/${t.id}`)
    await expect(page.getByText("Open", { exact: true }).first()).toBeVisible()

    await page.getByRole("button", { name: "Register a squad" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Register a squad" })).toBeVisible()
    await expect(dialog.getByLabel("Team", { exact: true })).toContainText(USERS.leader.teamName)

    const submit = dialog.getByRole("button", { name: "Submit registration" })
    const players = dialog.getByRole("checkbox")
    await expect(players).toHaveCount(2)

    // แบดมินตัน 2–4 คน ⇒ เลือกคนเดียวยังส่งไม่ได้
    await players.nth(0).check()
    await expect(submit).toBeDisabled()
    await players.nth(1).check()
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(dialog).toBeHidden()
    await expect(page.getByText("Waiting on the organizer")).toBeVisible()
    await expect(page.getByText(USERS.leader.teamName).first()).toBeVisible()
  })

  test("ผู้จัดอนุมัติใบสมัครจากหน้าจัดการ ⇒ ทีมขึ้นในรายชื่อที่อนุมัติ", async ({ page, signIn, pageAs }) => {
    await applyWithWholeTeam(USERS.leader.email, t.id, USERS.leader.teamId)

    await signIn(USERS.organizer.email)
    await page.goto(`/t/${t.id}/manage/registrations`)
    const row = page.locator("tr, li, article, div").filter({ hasText: USERS.leader.teamName })
      .filter({ has: page.getByRole("button", { name: "Approve" }) }).last()
    await expect(row).toBeVisible()
    await row.getByRole("button", { name: "Approve" }).click()
    const dialog = page.getByRole("dialog")
    if (await dialog.isVisible({ timeout: 1500 }).catch(() => false)) {
      await dialog.getByRole("button", { name: /approve/i }).last().click()
    }
    await expect(page.locator("tr, li, article, div").filter({ hasText: USERS.leader.teamName })
      .filter({ has: page.getByRole("button", { name: "Approve" }) })).toHaveCount(0)

    // หัวหน้าทีมเห็นผลจากฝั่งตัวเอง
    const leaderPage = await pageAs(USERS.leader.email)
    await leaderPage.goto(`/t/${t.id}`)
    await expect(leaderPage.getByText("Waiting on the organizer")).toHaveCount(0)
    await expect(leaderPage.getByText(USERS.leader.teamName).first()).toBeVisible()
  })

  test("ทีมเดียวสมัครทัวร์เดียวกันซ้ำไม่ได้ (ไม่มีปุ่มสมัครแล้ว)", async ({ page, signIn }) => {
    await applyWithWholeTeam(USERS.leader.email, t.id, USERS.leader.teamId)

    await signIn(USERS.leader.email)
    await page.goto(`/t/${t.id}`)
    await expect(page.getByText("Waiting on the organizer")).toBeVisible()
    await expect(page.getByRole("button", { name: "Register a squad" })).toHaveCount(0)
  })

  test("ผู้เยี่ยมชมไม่เห็นปุ่มสมัคร", async ({ page }) => {
    await page.goto(`/t/${t.id}`)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.name, { ignoreCase: true })
    await expect(page.getByRole("button", { name: "Register a squad" })).toHaveCount(0)
  })
})
