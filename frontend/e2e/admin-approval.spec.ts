import { test, expect } from "./support/fixtures"
import { api, loginToken, requestTournament } from "./support/api"
import { USERS } from "./support/env"

/** คิวคำขอจัดทัวร์ของแอดมิน (Admin → Tournament requests) */
test.describe("แอดมินพิจารณาคำขอจัดทัวร์", () => {
  test("อนุมัติคำขอจากหน้าแอดมิน ⇒ ทัวร์เป็น private และหายจากคิว", async ({ page, signIn }) => {
    const t = await requestTournament(USERS.organizer.email)

    await signIn(USERS.admin.email)
    await page.goto("/admin")
    const card = requestCard(page, t.name)
    await expect(card).toBeVisible()
    await card.getByRole("button", { name: "Approve" }).click()
    const confirm = page.getByRole("dialog")
    await expect(confirm.getByRole("heading", { name: `Approve ${t.name}?` })).toBeVisible()
    await confirm.getByRole("button", { name: "Confirm approval" }).click()

    await expect(requestCard(page, t.name)).toHaveCount(0)
    expect(await statusOf(t.id)).toBe("private")
  })

  test("ปฏิเสธคำขอพร้อมเหตุผล ⇒ ผู้จัดเห็นสถานะ rejected และเหตุผล", async ({ page, signIn }) => {
    const t = await requestTournament(USERS.organizer.email)
    const reason = "วันแข่งชนกับสัปดาห์สอบ (E2E)"

    await signIn(USERS.admin.email)
    await page.goto("/admin")
    const card = requestCard(page, t.name)
    await card.getByRole("button", { name: "Decline" }).click()
    await page.getByRole("dialog").getByRole("textbox").first().fill(reason)
    await confirmIfAsked(page, "Decline")

    await expect(requestCard(page, t.name)).toHaveCount(0)
    const mine = await api<{ items: Array<{ id: number; status: string; rejectionReason: string | null }> }>(
      "GET", "/me/tournament-requests?pageSize=100", await loginToken(USERS.organizer.email))
    expect(mine.items.find(i => i.id === t.id)).toMatchObject({ status: "rejected", rejectionReason: reason })
  })

  test("ผู้ใช้ทั่วไปเปิดหน้าแอดมินได้แค่หน้า 403", async ({ page, signIn }) => {
    await signIn(USERS.leader.email)
    await page.goto("/admin")

    await expect(page.getByText("403 — admin only")).toBeVisible()
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0)
  })
})

/** การ์ดคำขอหนึ่งใบ — หาจากหัวข้อชื่อทัวร์ แล้วขึ้นไปหากรอบที่มีปุ่ม Approve */
function requestCard(page: import("@playwright/test").Page, name: string) {
  return page.locator("article, li, section > div, div")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Approve" }) })
    .last()
}

/** บางปุ่มเปิดกล่องยืนยันก่อน — ถ้ามีกล่องให้กดปุ่มยืนยันในกล่อง */
async function confirmIfAsked(page: import("@playwright/test").Page, label: string) {
  const dialog = page.getByRole("dialog")
  if (await dialog.isVisible({ timeout: 1500 }).catch(() => false)) {
    await dialog.getByRole("button", { name: new RegExp(label, "i") }).last().click()
  }
}

async function statusOf(id: number) {
  const mine = await api<{ items: Array<{ id: number; status: string }> }>(
    "GET", "/me/tournament-requests?pageSize=100", await loginToken(USERS.organizer.email))
  return mine.items.find(i => i.id === id)?.status
}
