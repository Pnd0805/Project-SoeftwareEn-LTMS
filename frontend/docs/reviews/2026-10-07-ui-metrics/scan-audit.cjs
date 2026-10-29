const fs = require('node:fs')
const path = require('node:path')
const { chromium, executablePath, mockLogin } = require('../2026-10-07-ux-ui-fanout/browser-kit.cjs')

;(async () => {
  const out = path.join(__dirname, 'scan')
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ executablePath, headless: true })
  const evidence = []
  for (const [width, height, theme] of [[1440, 900, 'dark'], [390, 844, 'light']]) {
    const context = await browser.newContext({ viewport: { width, height } })
    await context.addInitScript(() => {
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Permission denied', 'NotAllowedError')
      }
    })
    const page = await context.newPage()
    await mockLogin(page)
    await page.goto('http://127.0.0.1:5175/')
    await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme)
    await page.evaluate(() => document.fonts.ready)
    const trigger = page.getByRole('button', { name: 'Scan', exact: true })
    await trigger.click()
    await page.getByText('Permission denied', { exact: false }).waitFor()
    const dialog = page.getByRole('dialog')
    const before = await dialog.innerText()
    await page.screenshot({ path: path.join(out, `scan-denied-${width}-${theme}.png`) })
    await page.getByLabel('Referee’s code').fill('K7M-2Q9')
    await page.getByRole('button', { name: 'Check in', exact: true }).click()
    await page.getByText('This is not an LTMS Check-in QR. Scan again.', { exact: false }).waitFor()
    const after = await dialog.innerText()
    const geometry = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      const r = d.getBoundingClientRect()
      return { width: innerWidth, pageWidth: document.documentElement.scrollWidth,
        dialog: { x: r.x, y: r.y, width: r.width, height: r.height },
        status: [...document.querySelectorAll('[role="status"]')].map(el => el.textContent),
        alerts: [...document.querySelectorAll('[role="alert"]')].map(el => el.textContent) }
    })
    await page.screenshot({ path: path.join(out, `scan-invalid-${width}-${theme}.png`) })
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    const focusAfterEscape = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 300))
    evidence.push({ viewport: `${width}x${height}`, theme, before, after, geometry, focusAfterEscape })
    await context.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))
})().catch(error => { console.error(error); process.exit(1) })
