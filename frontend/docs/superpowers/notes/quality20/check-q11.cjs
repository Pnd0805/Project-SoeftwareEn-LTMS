const { chromium } = require('/private/tmp/ltms-ticket1-browser/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const origin = 'http://127.0.0.1:5193'
const out = path.resolve('docs/superpowers/notes/quality20')
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' })
  const checks = []
  try {
    for (const [width, height, theme] of [[1280, 800, 'dark'], [1280, 800, 'light'], [1440, 900, 'dark'], [1440, 900, 'light'], [390, 844, 'light']]) {
      const context = await browser.newContext({ viewport: { width, height } })
      await context.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError') } })
      const page = await context.newPage()
      await page.route('**/api/v1/**', r => r.abort())
      await page.goto(origin + '/login')
      await page.evaluate(async () => {
        const s = await import('/src/shared/store.ts'), a = await import('/src/api/user.ts'), bridge = await import('/src/mocks/storeBridge.ts')
        s.login('u-play'); a.setMockCurrentUser(bridge.numOf('u-play'))
      })
      await page.goto(origin + '/')
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      const trigger = page.getByRole('button', { name: 'Scan', exact: true })
      await trigger.click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('alert').filter({ hasText: 'Permission denied' }).waitFor()
      assert.equal(await dialog.getByText('Starting camera…', { exact: true }).count(), 0)
      await page.screenshot({ path: path.join(out, `q11-denied-${width}-${theme}.png`) })
      await dialog.getByLabel('Referee’s code').fill('wrong')
      await dialog.getByRole('button', { name: 'Check in', exact: true }).click()
      await dialog.getByRole('alert').filter({ hasText: 'not an LTMS' }).waitFor()
      assert.equal(await dialog.getByRole('alert').count(), 1)
      assert.equal(await dialog.getByLabel('Referee’s code').inputValue(), 'wrong')
      const geometry = await dialog.evaluate(d => ({ height: d.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth, cancel: [...d.querySelectorAll('button')].find(e => e.textContent === 'Cancel').getBoundingClientRect().bottom <= innerHeight, alerts: [...d.querySelectorAll('[role=alert]')].map(e => e.textContent) }))
      assert.equal(geometry.overflow, false); assert.equal(geometry.cancel, true)
      await page.screenshot({ path: path.join(out, `q11-invalid-${width}-${theme}.png`) })
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'hidden' })
      assert.equal(await trigger.evaluate(e => e === document.activeElement), true)
      checks.push({ width, height, theme, geometry, escapeReturnsFocus: true })
      await context.close()
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await page.route('**/src/api/client.ts', async route => { const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()).replace(/export const USE_MOCK = [^;]+;/, 'export const USE_MOCK = false;') }) })
    let statsFailed = true, statsReads = 0
    await page.route('**/api/v1/**', async route => {
      const p = new URL(route.request().url()).pathname.replace('/api/v1', '')
      let data = { items: [] }, status = 200
      if (p === '/me') data = { id: 9, fullName: 'Quality profile fixture', email: 'quality@example.test', userType: 'student', gender: 'other', birthDate: '2002-06-04', facultyId: 2, departmentId: 8, year: 3, totalPoints: 17, avatarUrl: null }
      else if (p === '/users/9/stats') { statsReads++; status = statsFailed ? 503 : 200; data = statsFailed ? { error: { code: 'SOURCE_FAILED', message: 'Fixture statistics unavailable' } } : { userId: 9, overall: { matchesPlayed: 12, wins: 8, losses: 4, winRate: 0.67, championCount: 1 }, bySport: [] } }
      else if (p === '/notifications') data = { items: [], unreadCount: 0, pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } }
      else if (p === '/faculties') data = { items: [{ id: 2, name: 'Engineering' }] }
      else if (p === '/faculties/2/departments') data = { items: [{ id: 8, facultyId: 2, name: 'Software Engineering' }] }
      else if (p === '/me/pickem') data = { totalPoints: 17, correct: 0, settled: 0, items: [] }
      else if (p === '/admin/scopes') { status = 403; data = { error: { code: 'FORBIDDEN', message: 'Fixture no scope' } } }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto(origin + '/me')
    const retry = page.getByRole('button', { name: 'Retry stats', exact: true })
    await retry.waitFor()
    await page.screenshot({ path: path.join(out, 'q11-profile-failed-1440-dark.png') })
    statsFailed = false
    await retry.click()
    await retry.waitFor({ state: 'hidden' })
    await page.getByRole('heading', { name: 'Quality profile fixture' }).waitFor()
    checks.push({ profileRetry: true, statsReads, accountRetained: true })
    await context.close()
    fs.writeFileSync(path.join(out, 'q11-browser.json'), JSON.stringify(checks, null, 2) + '\n')
    console.log('Q11 browser checks passed:', checks.length)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
