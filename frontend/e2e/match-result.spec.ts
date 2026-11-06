import { test, expect } from "./support/fixtures"
import { matchState } from "./support/api"
import { SEED_MATCHES } from "./support/env"

/**
 * ผลการแข่งขัน — ใช้แมตช์ใน seed เพราะสร้างแมตช์ที่ "แข่งจบแล้ว" ใหม่ผ่าน API ไม่ได้
 *   (แมตช์ต้องอยู่ในช่วงวันแข่งของทัวร์ และทัวร์ใหม่เริ่มแข่งได้เร็วสุดพรุ่งนี้ ⇒ เปิดเช็คอิน/เริ่มแข่งวันนี้ไม่ได้)
 *
 * ★ การยืนยัน/ตัดสินผลทำได้ครั้งเดียว — รอบถัดไปแมตช์จะไม่อยู่ในสถานะตั้งต้นแล้ว
 *   เทสจึงเช็คสถานะก่อน ถ้าไม่ตรงจะ skip พร้อมบอกวิธีรีเซ็ต (ไม่แดงหลอก)
 *   รีเซ็ต: cd backend → python ../database/qa-baseline.py restore → npm run migrate
 *   หรือตั้ง E2E_RESET_CMD ให้ล้างฐานทุกรอบ (ดู README)
 */
const RESET_HINT = "ต้อง restore ข้อมูล QA ก่อน (python ../database/qa-baseline.py restore แล้ว npm run migrate) — แมตช์นี้ถูกใช้ไปแล้วในรอบก่อน"

test.describe("ยืนยันผล (แมตช์ที่กรรมการส่งผลแล้ว)", () => {
  const m = SEED_MATCHES.awaitingConfirmation

  test.beforeEach(async () => {
    const s = await matchState(m.id, m.winnerLeader)
    test.skip(s.resultStatus !== "submitted", `แมตช์ #${m.id} สถานะผล = ${s.resultStatus} — ${RESET_HINT}`)
  })

  // อ่านอย่างเดียว — รันซ้ำได้ตราบที่ยังไม่มีใครยืนยัน
  test("ผู้เยี่ยมชมเห็นสกอร์ แต่ไม่มีปุ่มยืนยันหรือโต้แย้ง", async ({ page }) => {
    await page.goto(`/m/${m.id}`)
    await expect(page.getByText("Awaiting confirmation")).toBeVisible()
    await expect(page.getByRole("button", { name: "Confirm result" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Dispute this result", exact: true })).toHaveCount(0)
  })

  test("หัวหน้าทีมที่แพ้ไม่มีปุ่มยืนยัน — ต้องโต้แย้งแทน", async ({ page, signIn }) => {
    await signIn(m.loserLeader)
    await page.goto(`/m/${m.id}`)
    await expect(page.getByRole("button", { name: "Dispute this result", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Confirm result" })).toHaveCount(0)
  })

  test("ปุ่มโต้แย้งกดไม่ได้จนกว่าจะใส่เหตุผล", async ({ page, signIn }) => {
    await signIn(m.loserLeader)
    await page.goto(`/m/${m.id}`)
    // ปุ่มส่งปิดไว้จนกว่าจะกรอกเหตุผล (Reason (required))
    const submit = page.getByRole("button", { name: "Dispute this result", exact: true })
    await expect(submit).toBeDisabled()
    await page.getByRole("textbox", { name: "Dispute this result reason" }).fill("กรรมการนับแต้มเกมที่สองผิด (E2E)")
    await expect(submit).toBeEnabled()
    // ไม่กดส่งจริง — ข้อนี้ทดสอบแค่ด่านเหตุผล ไม่ให้เปลี่ยนสถานะแมตช์
    expect((await matchState(m.id, m.winnerLeader)).resultStatus).toBe("submitted")
  })

  // ★ เทสนี้เปลี่ยนสถานะแมตช์ — อยู่ท้ายสุดของกลุ่ม (รันตามลำดับไฟล์ เพราะ workers: 1)
  test("หัวหน้าทีมที่ชนะกดยืนยัน ⇒ ผลเป็นทางการ", async ({ page, signIn }) => {
    await signIn(m.winnerLeader)
    await page.goto(`/m/${m.id}`)
    await expect(page.getByText("You won, so you confirm.")).toBeVisible()

    // ★ มีปุ่ม "Confirm result" สองปุ่ม — ปุ่มในการ์ด Next action แค่พาเลื่อนลงมา
    //   ปุ่มที่ยืนยันจริงอยู่ในแผง Overview (ส่วน "Your confirmation")
    await page.getByRole("region", { name: "Overview" }).getByRole("button", { name: "Confirm result" }).click()
    const dialog = page.getByRole("dialog")
    if (await dialog.isVisible({ timeout: 1500 }).catch(() => false)) {
      await dialog.getByRole("button", { name: /confirm/i }).last().click()
    }

    await expect(page.getByText("Awaiting confirmation")).toHaveCount(0)
    await expect.poll(async () => (await matchState(m.id, m.winnerLeader)).resultStatus).toBe("verified")
  })
})

test.describe("ผู้จัดตัดสินข้อโต้แย้ง", () => {
  const m = SEED_MATCHES.disputed

  test.beforeEach(async () => {
    const s = await matchState(m.id, m.organizer)
    test.skip(s.resultStatus !== "disputed", `แมตช์ #${m.id} สถานะผล = ${s.resultStatus} — ${RESET_HINT}`)
  })

  test("ต้องเขียนเหตุผลก่อน ปุ่มตัดสินจึงกดได้", async ({ page, signIn }) => {
    await signIn(m.organizer)
    await page.goto(`/m/${m.id}`)
    const keep = page.getByRole("button", { name: "Keep the recorded score" })
    await expect(keep).toBeVisible()
    await expect(keep).toBeDisabled()

    await page.getByRole("textbox", { name: /Why/ }).fill("ตรวจใบบันทึกคะแนนของกรรมการแล้ว (E2E)")
    await expect(keep).toBeEnabled()
  })

  test("ยืนยันผลเดิม ⇒ ข้อโต้แย้งปิด และผลเป็นทางการ", async ({ page, signIn }) => {
    await signIn(m.organizer)
    await page.goto(`/m/${m.id}`)
    await page.getByRole("textbox", { name: /Why/ }).fill("ตรวจใบบันทึกคะแนนของกรรมการแล้ว ผลเดิมถูกต้อง (E2E)")
    await page.getByRole("button", { name: "Keep the recorded score" }).click()
    const dialog = page.getByRole("dialog")
    if (await dialog.isVisible({ timeout: 1500 }).catch(() => false)) {
      await dialog.getByRole("button", { name: /keep|confirm/i }).last().click()
    }

    await expect.poll(async () => (await matchState(m.id, m.organizer)).resultStatus).toBe("verified")
    await expect(page.getByRole("button", { name: "Keep the recorded score" })).toHaveCount(0)
  })
})
