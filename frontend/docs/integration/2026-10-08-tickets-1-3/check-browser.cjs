const { chromium } = require('/private/tmp/ltms-ticket1-browser/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const out = __dirname
const origin = process.env.LTMS_CHECK_ORIGIN || 'http://127.0.0.1:5196'
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' })
  const checks = []
  try {
    for (const [width, height] of (process.env.LTMS_CHECK_MOBILE ? [[390, 844]] : [[1280, 800], [1440, 900], [390, 844]])) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage(); await page.clock.install()
      const errors = [], posts = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/v1/**', async route => {
        const request = route.request()
        const p = new URL(request.url()).pathname.replace('/api/v1', '')
        let data, status = 200
        if (request.method() === 'POST') posts.push({ path: p, body: request.postDataJSON() })
        if (p === '/me') { status = 401; data = { error: { code: 'UNAUTHORIZED', message: 'Not signed in' } } }
        else if (p === '/faculties') data = { items: [{ id: 2, name: 'Engineering' }] }
        else if (p === '/faculties/2/departments') data = { items: [{ id: 8, facultyId: 2, name: 'Software Engineering' }] }
        else if (p === '/auth/register') { status = 201; data = { id: 9, fullName: 'Test Student', email: 'chosen@example.test', emailVerificationSent: false } }
        else if (p === '/auth/resend-verification') data = { message: 'Generic acknowledgment' }
        else if (p === '/auth/verify-email') {
          if (request.postDataJSON().code === '007431') data = { message: 'Verified', emailVerified: true }
          else { status = 400; data = { error: { code: 'INVALID_OTP', message: 'Code expired. Request a new code.' } } }
        } else throw new Error(`Unexpected fixture request: ${p}`)
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      })
      await page.goto(origin + '/register')
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
      await page.getByRole('option', { name: 'Engineering', exact: true }).waitFor({ state: 'attached' })
      await page.locator('select[name=facultyId]').selectOption('2')
      await page.getByRole('option', { name: 'Software Engineering', exact: true }).waitFor({ state: 'attached' })
      for (const [label, value] of Object.entries({ 'Full name': 'Test Student', Email: 'chosen@example.test', Password: 'password123', 'Birth date': '2002-06-04', Year: '3' })) await page.getByLabel(label, { exact: true }).fill(value)
      await page.locator('select[name=gender]').selectOption('other')
      await page.locator('select[name=departmentId]').selectOption('8')
      await page.screenshot({ path: path.join(out, `register-${width}-${theme}.png`), fullPage: true })
      const create = page.getByRole('button', { name: 'Create account', exact: true }); if (width === 390) { await create.focus(); await create.press('Enter') } else await create.click()
      await page.getByRole('heading', { name: 'Verify email', exact: true }).waitFor({ timeout: 5000 }).catch(async error => { console.error({ posts, text: await page.locator('body').innerText(), fields: await page.locator('input,select').evaluateAll(es => es.map(e => ({ name: e.name, value: e.type === 'password' ? '[redacted]' : e.value, valid: e.validity.valid, message: e.validationMessage }))) }); throw error })
      assert.equal(await page.getByRole('alert').count(), 1)
      assert.match(await page.getByRole('alert').innerText(), /Email could not be sent/)
      assert.equal(await page.getByRole('button', { name: /Resend in/ }).isDisabled(), true)
      await page.screenshot({ path: path.join(out, `otp-${width}-${theme}.png`), fullPage: true })
      await page.getByLabel('Code', { exact: true }).fill('111111')
      await page.getByRole('button', { name: 'Verify email', exact: true }).click()
      await page.getByRole('alert').filter({ hasText: 'Code expired' }).waitFor()
      assert.equal(await page.getByRole('alert').count(), 1)
      assert.equal(await page.getByLabel('Code', { exact: true }).inputValue(), '111111')
      await page.clock.fastForward(61000); await page.getByRole('button', { name: 'Resend code', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'Request received' }).waitFor()
      assert.equal(await page.getByRole('button', { name: /Resend in/ }).isDisabled(), true)
      await page.getByLabel('Code', { exact: true }).fill('007431')
      await page.getByRole('button', { name: 'Verify email', exact: true }).click()
      const heading = page.getByRole('heading', { name: 'Email verified', exact: true })
      await heading.waitFor()
      await page.waitForFunction(() => document.activeElement?.tagName === 'H1')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      assert.equal(overflow, false); assert.deepEqual(errors, [])
      assert.equal(posts.at(-1).body.code, '007431')
      assert.equal(posts.length, 4)
      await page.screenshot({ path: path.join(out, `verified-${width}-${theme}.png`), fullPage: true })
      await page.keyboard.press('Tab')
      assert.equal(await page.getByRole('link', { name: 'Sign in', exact: true }).evaluate(e => e === document.activeElement), true)
      checks.push({ width, height, theme, registrationPayload: posts[0].body, leadingZeros: true, deliveryFailure: true, retry: true, resendCooldown: true, successFocus: true, overflow, pageErrors: errors })
      await context.close()
    }
    fs.writeFileSync(path.join(out, 'browser-checks.json'), JSON.stringify(checks, null, 2) + '\n')
    console.log(`PASS: ${checks.length} viewport/theme cases, registration -> OTP -> resend -> verification, leading zeros, focus and overflow.`)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
