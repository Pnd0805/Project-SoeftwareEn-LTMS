import { test, expect } from "./support/fixtures"
import { api, loginToken } from "./support/api"
import { USERS } from "./support/env"

/** ผู้จัดยื่นคำขอจัดทัวร์ผ่านฟอร์ม /request (ขั้นแรกของวงจรทัวร์) */
test.describe("ยื่นคำขอจัดทัวร์", () => {
  test("กรอกฟอร์มครบแล้วส่ง ⇒ คำขอรอแอดมิน และเห็นในรายการคำขอของตัวเอง", async ({ page, signIn }) => {
    const name = `E2E Request ${Date.now().toString(36)}`
    const { regStart, regEnd, eventStart, eventEnd } = futureSchedule()

    await signIn(USERS.organizer.email)
    await page.goto("/request")
    await expect(page.getByRole("heading", { name: "Request a tournament" })).toBeVisible()

    await page.getByLabel("Name").fill(name)
    await page.getByLabel("Sport").selectOption({ label: "แบดมินตัน" })
    await page.getByLabel(/^Format/).selectOption({ label: "Single elimination" })
    await page.getByLabel(/^Organising faculty/).selectOption({ label: "คณะวิศวกรรมศาสตร์" })
    await page.getByLabel("Squad cap").fill("8")
    await page.getByLabel("Minimum squads").fill("2")
    await page.getByLabel("Entry opens").fill(regStart)
    await page.getByLabel("Entry closes").fill(regEnd)
    await page.getByLabel("First match date").fill(eventStart)
    await page.getByLabel("Last match date").fill(eventEnd)
    await page.getByLabel("Default venue").fill("E2E Gym")
    await page.getByRole("button", { name: "Send the request" }).click()

    await expect(page.getByText(`${name} is with an admin.`)).toBeVisible()

    const mine = await api<{ items: Array<{ id: number; name: string; status: string }> }>(
      "GET", "/me/tournament-requests?pageSize=100", await loginToken(USERS.organizer.email))
    expect(mine.items.find(i => i.name === name)?.status).toBe("pending_approval")
  })

  test("วันปิดรับสมัครอยู่ก่อนวันเปิด ⇒ ส่งไม่ผ่านและไม่สร้างคำขอ", async ({ page, signIn }) => {
    const name = `E2E Bad dates ${Date.now().toString(36)}`
    const { regStart, regEnd, eventStart, eventEnd } = futureSchedule()
    let created = false
    page.on("response", r => { if (r.request().method() === "POST" && /\/tournaments$/.test(r.url()) && r.ok()) created = true })

    await signIn(USERS.organizer.email)
    await page.goto("/request")
    await page.getByLabel("Name").fill(name)
    await page.getByLabel("Sport").selectOption({ label: "แบดมินตัน" })
    await page.getByLabel(/^Organising faculty/).selectOption({ label: "คณะวิศวกรรมศาสตร์" })
    await page.getByLabel("Squad cap").fill("8")
    await page.getByLabel("Minimum squads").fill("2")
    await page.getByLabel("Entry opens").fill(regEnd)     // สลับกัน
    await page.getByLabel("Entry closes").fill(regStart)
    await page.getByLabel("First match date").fill(eventStart)
    await page.getByLabel("Last match date").fill(eventEnd)
    await page.getByLabel("Default venue").fill("E2E Gym")
    await page.getByRole("button", { name: "Send the request" }).click()

    await expect(page.getByText(`${name} is with an admin.`)).toHaveCount(0)
    await expect(page.locator("[aria-invalid=true], [role=alert]").first()).toBeVisible()
    expect(created).toBe(false)
  })
})

/** ค่าสำหรับ <input type=datetime-local> / <input type=date> ตามเวลาไทย เริ่มจากตอนนี้ */
function futureSchedule() {
  const DAY = 86_400_000
  const thai = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString()
  const now = Date.now()
  return {
    regStart: thai(now + 1 * DAY).slice(0, 16),
    regEnd: thai(now + 7 * DAY).slice(0, 16),
    eventStart: thai(now + 14 * DAY).slice(0, 10),
    eventEnd: thai(now + 15 * DAY).slice(0, 10),
  }
}
