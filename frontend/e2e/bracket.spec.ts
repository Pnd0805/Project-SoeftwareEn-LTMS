import { test, expect } from "./support/fixtures"
import { api, createDrawReadyTournament, type CreatedTournament } from "./support/api"
import { USERS } from "./support/env"

/** ผู้จัดจัดสายการแข่งจากแท็บ Manage → Draw (ทัวร์ใหม่ที่มี 2 ทีมอนุมัติแล้ว และปิดรับสมัครแล้ว) */
test.describe("จัดสายการแข่ง", () => {
  let t: CreatedTournament
  test.beforeEach(async () => { t = await createDrawReadyTournament() })

  test("กดจัดสายแบบสุ่ม ⇒ ได้แมตช์ที่มีทั้งสองทีม และทุกคนเห็นในแท็บ Bracket", async ({ page, signIn, pageAs }) => {
    await signIn(USERS.organizer.email)
    await page.goto(`/t/${t.id}/manage/draw`)
    await expect(page.getByText("Not drawn yet")).toBeVisible()

    await page.getByRole("button", { name: "Draw random bracket" }).click()
    const dialog = page.getByRole("dialog")
    if (await dialog.isVisible({ timeout: 1500 }).catch(() => false)) {
      await dialog.getByRole("button", { name: /draw|confirm/i }).last().click()
    }
    await expect(page.getByText("Not drawn yet")).toHaveCount(0)

    // ฝั่ง server มีแมตช์จริง 1 แมตช์ที่มีทั้งสองทีม
    const { items } = await api<{ items: Array<{ teamA: { id: number } | null; teamB: { id: number } | null }> }>(
      "GET", `/tournaments/${t.id}/matches`)
    expect(items).toHaveLength(1)
    expect([items[0]!.teamA?.id, items[0]!.teamB?.id].sort()).toEqual([USERS.leader.teamId, USERS.leader2.teamId].sort())

    // หัวหน้าทีมเห็นคู่ของตัวเองในแท็บ Bracket
    const leader = await pageAs(USERS.leader.email)
    await leader.goto(`/t/${t.id}/bracket`)
    // ★ filter visible — ชื่อทีมอยู่ใน <option> ของตัวเลือก "Highlight team" ด้วย ซึ่งมองไม่เห็น
    await expect(leader.getByText(USERS.leader.teamName).filter({ visible: true }).first()).toBeVisible()
    await expect(leader.getByText(USERS.leader2.teamName).filter({ visible: true }).first()).toBeVisible()
  })

  test("ก่อนจัดสาย ยังไม่มีแมตช์ให้ตั้งกรรมการ", async ({ page, signIn }) => {
    await signIn(USERS.organizer.email)
    await page.goto(`/t/${t.id}/manage/draw`)
    await expect(page.getByText("Draw the bracket first — there are no matches to staff yet.")).toBeVisible()
  })

  test("หัวหน้าทีม (ไม่ใช่ผู้จัด) ไม่มีแท็บ Manage", async ({ page, signIn }) => {
    await signIn(USERS.leader.email)
    await page.goto(`/t/${t.id}`)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("link", { name: "Manage", exact: true })).toHaveCount(0)
  })
})
