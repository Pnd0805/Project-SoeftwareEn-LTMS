const path = require('node:path')
const { chromium, executablePath, fixture06, mockLogin } = require('../browser-kit.cjs')

const out = __dirname
const realOrigin = 'http://127.0.0.1:5176'
const mockOrigin = 'http://127.0.0.1:5175'

async function newPage(browser, width, height, theme) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme })
  await context.addInitScript(value => localStorage.setItem('ltms-theme', value), theme)
  return { context, page: await context.newPage() }
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

async function inspect(page, name) {
  await settle(page)
  const result = await page.evaluate(() => {
    const box = el => {
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right) }
    }
    const wrappers = [...document.querySelectorAll('.checkin-squad-frame .tblwrap')].map(el => ({
      clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, scrollLeft: el.scrollLeft,
      box: box(el),
    }))
    const actions = [...document.querySelectorAll('.checkin-squad-frame tbody tr button')].slice(0, 4).map(el => ({
      text: el.innerText.trim(), box: box(el), parent: box(el.closest('.tblwrap')),
    }))
    const qr = document.querySelector('.checkin-qr-content svg')
    const path = qr?.querySelector('path')
    return {
      url: location.href, viewport: { width: innerWidth, height: innerHeight },
      h1: [...document.querySelectorAll('h1')].map(el => el.innerText.trim()),
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      qr: qr ? {
        box: box(qr), paths: [...qr.querySelectorAll('path')].map(el => ({
          fill: getComputedStyle(el).fill, dLength: el.getAttribute('d')?.length ?? 0,
          bbox: (() => { const r = el.getBBox(); return { x: r.x, y: r.y, width: r.width, height: r.height } })(),
        })),
      } : null,
      wrappers, actions,
      bodyStart: (document.querySelector('main') || document.body).innerText.slice(0, 280),
    }
  })
  await page.screenshot({ path: path.join(out, name), fullPage: false })
  return result
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath })
  const results = []
  try {
    for (const [width, height, theme] of [[1280, 800, 'dark'], [1280, 800, 'light'], [1440, 900, 'light'], [390, 844, 'light']]) {
      const { context, page } = await newPage(browser, width, height, theme)
      await fixture06(page, { status: 'checkin_open' })
      await page.goto(`${realOrigin}/checkin/100`)
      await page.getByRole('heading', { name: 'Check-in QR' }).waitFor()
      await page.locator('.checkin-qr-content svg path').first().waitFor()
      results.push({ name: `checkin-${width}-${theme}`, ...await inspect(page, `checkin-${width}-${theme}.png`) })
      await context.close()
    }

    {
      const { context, page } = await newPage(browser, 1440, 900, 'light')
      await fixture06(page, { status: 'checkin_open' })
      await page.goto(`${realOrigin}/checkin/100`)
      await page.locator('.checkin-squad-frame').first().waitFor()
      await page.locator('.checkin-squad-frame').first().scrollIntoViewIfNeeded()
      results.push({ name: 'checkin-roster-actions-1440-light', ...await inspect(page, 'checkin-roster-actions-1440-light.png') })
      await context.close()
    }

    for (const [route, name, theme] of [
      ['/m/100/mvp', 'match-mvp-1440-light', 'light'],
      ['/mvp/42?match=100', 'tournament-mvp-1440-dark', 'dark'],
    ]) {
      const { context, page } = await newPage(browser, 1440, 900, theme)
      await fixture06(page, { status: 'finished', result: 'confirmed' })
      await page.goto(`${realOrigin}${route}`)
      await page.getByRole('heading', { name: /MVP/ }).first().waitFor()
      await page.locator('.match-mvp-candidates').scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      results.push({ name: name === 'match-mvp-1440-light' ? 'match-mvp-voting-1440-light' : name, ...await inspect(page, `${name === 'match-mvp-1440-light' ? 'match-mvp-voting-1440-light' : name}.png`) })
      await context.close()
    }

    {
      const { context, page } = await newPage(browser, 1440, 900, 'light')
      await mockLogin(page, 'u-play')
      await page.goto(`${mockOrigin}/watch/t-fb`)
      await page.getByRole('heading').first().waitFor()
      results.push({ name: 'watch-mock-1440-light', ...await inspect(page, 'watch-mock-1440-light.png') })
      await context.close()
    }

    {
      const { context, page } = await newPage(browser, 1280, 800, 'dark')
      await page.route('**/api/v1/**', route => route.abort())
      await page.goto(`${realOrigin}/watch/42`)
      await page.getByText('Watch is unavailable', { exact: true }).waitFor()
      results.push({ name: 'watch-real-unavailable-1280-dark', ...await inspect(page, 'watch-real-unavailable-1280-dark.png') })
      await context.close()
    }
  } finally {
    await browser.close()
  }
  process.stdout.write(JSON.stringify(results, null, 2) + '\n')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
