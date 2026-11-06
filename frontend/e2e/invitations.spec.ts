import { test, expect } from "./support/fixtures"
import { api, createApprovedTournament, createTeam, deleteTeam, loginToken } from "./support/api"
import { USERS } from "./support/env"

/** คำเชิญ — หัวหน้าทีมเชิญสมาชิก · ผู้จัดเชิญกรรมการ · ผู้ถูกเชิญตอบรับจากหน้าของตัวเอง */
test.describe("เชิญเข้าทีม", () => {
  let teamId: number | undefined
  test.afterEach(async () => {
    if (teamId) await deleteTeam(USERS.newbie.email, teamId)
    teamId = undefined
  })

  test("หัวหน้าทีมค้นหาแล้วเชิญ ⇒ ผู้ถูกเชิญกดตอบรับ ⇒ ทีมมีสมาชิก 2 คน", async ({ page, signIn, pageAs }) => {
    const team = await createTeam(USERS.newbie.email, `E2E Invite ${Date.now().toString(36)}`)
    teamId = team.id

    await signIn(USERS.newbie.email)
    await page.goto(`/team/${team.id}`)
    await page.getByRole("button", { name: "Invite players", exact: true }).first().click()
    await page.getByLabel("Search users to invite").fill(USERS.viewer.name)
    await page.getByRole("button", { name: `Invite ${USERS.viewer.name}` }).click()
    await expect(page.getByRole("button", { name: `Cancel invitation to ${USERS.viewer.name}` })).toBeVisible()

    const invitee = await pageAs(USERS.viewer.email)
    await invitee.goto("/teams")
    const invitations = invitee.getByRole("region", { name: /Invitations/i }).or(invitee.locator("section").filter({ hasText: /^Invitations/i }))
    await expect(invitee.getByText(team.name).first()).toBeVisible()
    await invitations.first().getByRole("button", { name: "Accept invitation" }).first().click()

    await expect.poll(async () => {
      const m = await api<{ items: unknown[] }>("GET", `/teams/${team.id}/members`, await loginToken(USERS.newbie.email))
      return m.items.length
    }).toBe(2)
  })
})

test.describe("เชิญกรรมการ", () => {
  test("กรรมการเห็นคำเชิญในหน้า Matches แล้วกดตอบรับ", async ({ page, signIn }) => {
    const t = await createApprovedTournament()
    const inv = await api<{ id: number }>("POST", `/tournaments/${t.id}/referees`, await loginToken(USERS.organizer.email),
      { userId: USERS.referee3.userId })

    await signIn(USERS.referee3.email)
    await page.goto("/matches")
    const acceptButtons = page.getByRole("button", { name: "Accept appointment" })
    await expect(acceptButtons.first()).toBeVisible()
    const before = await acceptButtons.count()
    const card = page.locator("article, li, section, div").filter({ hasText: t.name })
      .filter({ has: page.getByRole("button", { name: "Accept appointment" }) }).last()
    await expect(card).toBeVisible()
    await card.getByRole("button", { name: "Accept appointment" }).click()
    const dialog = page.getByRole("dialog")
    if (await dialog.isVisible({ timeout: 1500 }).catch(() => false)) {
      await dialog.getByRole("button", { name: /accept|confirm/i }).last().click()
    }

    // ★ นับปุ่มทั้งหน้า ไม่ใช่หา "การ์ดที่หายไป" — กรรมการคนนี้อาจมีคำเชิญค้างจากทัวร์อื่นอยู่ด้วย
    await expect(acceptButtons).toHaveCount(before - 1)
    const mine = await api<{ items: Array<{ id: number }> }>("GET", "/me/referee-invitations", await loginToken(USERS.referee3.email))
    expect(mine.items.some(i => i.id === inv.id)).toBe(false)   // ไม่ค้างในรายการคำเชิญแล้ว
  })
})
