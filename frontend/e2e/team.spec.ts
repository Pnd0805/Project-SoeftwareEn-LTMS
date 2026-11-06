import { test, expect } from "./support/fixtures"
import { api, loginToken } from "./support/api"

/**
 * สร้างทีมจากหน้า /teams
 * ★ ใช้บัญชี newbie@ku.th (มีทีมเดียว) และลบทีมที่สร้างทิ้งหลังจบทุกเทส
 *   เพดานทีม Unofficial คือ 5 ทีม/คน — ถ้าไม่ลบ รันครบ 4 รอบเทสนี้จะเริ่มพังเอง
 */
const OWNER = "newbie@ku.th"
const created: number[] = []

test.afterEach(async () => {
  const token = await loginToken(OWNER)
  while (created.length) {
    const id = created.pop()!
    await api("DELETE", `/teams/${id}`, token).catch(() => { /* ลบไปแล้ว/ลบไม่ได้ — ไม่ให้เทสแดงเพราะการเก็บกวาด */ })
  }
})

test.describe("ทีม", () => {
  test("สร้างทีมใหม่ ⇒ ไปหน้าทีม และผู้สร้างเป็นหัวหน้าทีม", async ({ page, signIn }) => {
    const name = `E2E Team ${Date.now().toString(36)}`

    await signIn(OWNER)
    await page.goto("/teams")
    await page.getByRole("button", { name: "Create a team" }).first().click()

    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Name").fill(name)
    await dialog.getByLabel("Sport").selectOption({ label: "แบดมินตัน" })
    await dialog.getByRole("button", { name: /^Create/ }).last().click()

    await expect(page).toHaveURL(/\/team\/\d+$/)
    created.push(Number(page.url().split("/").pop()))
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name, { ignoreCase: true })
  })

  test("ปุ่มสร้างกดไม่ได้จนกว่าจะกรอกชื่อและเลือกกีฬา", async ({ page, signIn }) => {
    await signIn(OWNER)
    await page.goto("/teams")
    await page.getByRole("button", { name: "Create a team" }).first().click()

    const dialog = page.getByRole("dialog")
    const create = dialog.getByRole("button", { name: /^Create/ }).last()
    await expect(create).toBeDisabled()
    await dialog.getByLabel("Name").fill("   ")
    await expect(create).toBeDisabled()
    await dialog.getByLabel("Name").fill("ชื่อทีม")
    await expect(create).toBeDisabled()     // ยังไม่เลือกกีฬา
    await dialog.getByLabel("Sport").selectOption({ label: "แบดมินตัน" })
    await expect(create).toBeEnabled()
  })

  test("ชื่อทีมซ้ำในกีฬาเดียวกันสร้างไม่ได้", async ({ page, signIn }) => {
    await signIn(OWNER)
    await page.goto("/teams")
    await page.getByRole("button", { name: "Create a team" }).first().click()

    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Name").fill("วิศวะ Smashers")   // ทีมแบดมินตันใน seed
    await dialog.getByLabel("Sport").selectOption({ label: "แบดมินตัน" })
    await dialog.getByRole("button", { name: /^Create/ }).last().click()

    await expect(page).toHaveURL(/\/teams$/)
    // ★ หาจากข้อความ ไม่ใช่ role=alert — <Banner> (components/kit/primitives.tsx) ไม่มี role
    //   ⇒ โปรแกรมอ่านหน้าจอไม่ประกาศ error นี้ (เรื่อง a11y ที่ควรแก้ฝั่งคอมโพเนนต์)
    await expect(dialog.getByText("Couldn't create the squad.")).toBeVisible()
    await expect(dialog.getByText("มีทีมชื่อนี้ในประเภทกีฬานี้แล้ว")).toBeVisible()
  })
})
