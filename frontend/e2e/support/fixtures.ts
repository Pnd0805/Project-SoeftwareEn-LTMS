import { test as base, expect, type Page } from "@playwright/test"
import { loginToken } from "./api"
import { TOKEN_KEY } from "./env"

/**
 * `signIn(email)` — เข้าระบบแบบไม่ผ่านฟอร์ม เพื่อให้เทสที่ไม่ได้ทดสอบการล็อกอินไม่ต้องพึ่งหน้าล็อกอิน
 *
 * ★ ทำไมใช้ addInitScript ไม่ใช่ storageState
 *   frontend เก็บ token ใน **sessionStorage** (src/api/client.ts) ซึ่ง storageState ของ Playwright ไม่เก็บ
 *   ⇒ ใส่ token ก่อนสคริปต์ของหน้าเว็บรัน แอปจึงเห็นว่าล็อกอินอยู่แล้วตั้งแต่โหลดครั้งแรก
 * ★ ใส่ token **ครั้งเดียวต่อแท็บ** (มีธงกำกับ) — init script รันทุกครั้งที่โหลดหน้า
 *   ถ้าใส่ทุกครั้ง กด Log out แล้วเปิดหน้าถัดไป token จะถูกใส่กลับ ⇒ ทดสอบการออกจากระบบไม่ได้
 * ★ ใช้ได้ครั้งเดียวต่อ page (context) — สลับคนให้เปิด context ใหม่ (`browser.newContext()`) แทน
 */
const INJECTED_FLAG = "e2e.token-injected"
function injectToken([key, value, flag]: readonly [string, string, string]) {
  if (window.sessionStorage.getItem(flag)) return
  window.sessionStorage.setItem(key, value)
  window.sessionStorage.setItem(flag, "1")
}
type Fixtures = {
  signIn: (email: string) => Promise<void>
  pageAs: (email: string) => Promise<Page>
}

export const test = base.extend<Fixtures>({
  signIn: async ({ page }, use) => {
    await use(async (email: string) => {
      const token = await loginToken(email)
      await page.addInitScript(injectToken, [TOKEN_KEY, token, INJECTED_FLAG] as const)
    })
  },

  /** หน้าใหม่ของอีกคนในเทสเดียวกัน (เช่น หัวหน้าทีมสมัคร แล้วผู้จัดอนุมัติ) — ปิดให้เองตอนจบเทส */
  pageAs: async ({ browser }, use) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = []
    await use(async (email: string) => {
      const context = await browser.newContext()
      contexts.push(context)
      const token = await loginToken(email)
      await context.addInitScript(injectToken, [TOKEN_KEY, token, INJECTED_FLAG] as const)
      return context.newPage()
    })
    await Promise.all(contexts.map(c => c.close()))
  },
})

export { expect }
