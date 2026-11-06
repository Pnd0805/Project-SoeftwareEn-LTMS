'use strict'

const path = require('node:path')
const { chromium, executablePath, fixture05, mockLogin } = require('../browser-kit.cjs')

const output = __dirname
const realOrigin = 'http://127.0.0.1:5176'
const mockOrigin = 'http://127.0.0.1:5175'
const inspected = []

async function ready(page, selector) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15000 })
  await page.evaluate(() => document.fonts.ready)
}

async function observe(page, name, fullPage = true) {
  await page.evaluate(() => scrollTo(0, 0))
  const metrics = await page.evaluate(() => ({
    title: document.title,
    viewport: `${innerWidth}x${innerHeight}`,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    horizontalPageOverflow: document.documentElement.scrollWidth > innerWidth,
    headings: [...document.querySelectorAll('h1,h2,h3')].filter(e => e.getClientRects().length).map(e => e.innerText.trim()),
    internalRegions: [...document.querySelectorAll('.organizer-registrations>.tblwrap,.organizer-referee-group>.tblwrap,.organizer-assignment-frame>.tblwrap,.organizer-entry-grid>.panel')]
      .filter(e => e.getClientRects().length)
      .map(e => ({ className: e.className, clientHeight: e.clientHeight, scrollHeight: e.scrollHeight, tabIndex: e.tabIndex, role: e.getAttribute('role'), label: e.getAttribute('aria-label') })),
  }))
  await page.screenshot({ path: path.join(output, name), fullPage })
  inspected.push({ screenshot: name, ...metrics })
}

async function fixturePage(browser, viewport, theme = 'dark') {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const apiRequests = []
  page.on('request', request => {
    if (request.url().includes('/api/v1/')) apiRequests.push({ method: request.method(), url: new URL(request.url()).pathname })
  })
  const writes = await fixture05(page, {})
  page.on('pageerror', error => inspected.push({ pageError: error.message }))
  await page.goto(`${realOrigin}/t/42/manage/progress`)
  await ready(page, '.organizer-workspace')
  await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
  return { context, page, writes, apiRequests }
}

async function inspectFixture(browser, viewport, suffix, theme = 'dark') {
  const { context, page, writes, apiRequests } = await fixturePage(browser, viewport, theme)
  try {
    const routes = ['progress', 'registrations', 'entry', 'draw', 'referees', 'feedback']
    for (const route of routes) {
      if (route !== 'progress') {
        await page.goto(`${realOrigin}/t/42/manage/${route}`)
        await ready(page, '.organizer-workspace')
        await page.waitForTimeout(150)
      }
      await observe(page, `${route}-${suffix}-${theme}.png`)
      if (route === 'registrations') {
        await page.getByRole('button', { name: 'Review', exact: true }).first().click()
        await page.getByRole('dialog', { name: 'Northside FC' }).waitFor({ state: 'visible' })
        await observe(page, `registration-review-${suffix}-${theme}.png`, false)
        await page.keyboard.press('Escape')
      }
      if (route === 'referees') {
        await page.getByRole('button', { name: 'Appoint a referee', exact: true }).click()
        await page.getByRole('dialog', { name: /Northside Street Cup/ }).waitFor({ state: 'visible' })
        await page.getByLabel('Search by name or email').fill('Candidate')
        await page.getByRole('cell', { name: /Candidate 1 Northside/ }).waitFor({ state: 'visible' })
        await observe(page, `referee-finder-${suffix}-${theme}.png`, false)
        await page.keyboard.press('Escape')
      }
      if (route === 'draw') {
        const assignmentCount = await page.locator('select[aria-label^="Ask a referee to take match "]').count()
        inspected.push({ route: 'draw-assignment-select-count', viewport: `${viewport.width}x${viewport.height}`, count: assignmentCount })
      }
    }
    return { writes, apiRequests }
  } finally {
    await context.close()
  }
}

async function inspectMockRequest(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const apiRequests = []
  page.on('request', request => {
    if (request.url().includes('/api/v1/')) apiRequests.push({ method: request.method(), url: new URL(request.url()).pathname })
  })
  page.on('pageerror', error => inspected.push({ pageError: error.message }))
  await mockLogin(page, 'u-org')
  await page.goto(`${mockOrigin}/request`)
  await ready(page, 'h1')
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await observe(page, 'request-mock-1280-dark.png')
  await page.getByLabel('Organising faculty — who puts it on').selectOption({ label: 'Engineering' })
  await page.getByRole('radio', { name: 'Only the faculty running it' }).click()
  const decisionCopy = await page.locator('.organizer-request-form').innerText()
  inspected.push({ route: 'request-decision-copy', hasOwnerExplanation: /decides this one/i.test(decisionCopy), facultyChoice: 'Engineering', admissionMode: 'Only the faculty running it' })
  await context.close()
  return apiRequests
}

;(async () => {
  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    const mockApiRequests = await inspectMockRequest(browser)
    const desktop = await inspectFixture(browser, { width: 1440, height: 900 }, '1440', 'dark')
    const mobile = await inspectFixture(browser, { width: 390, height: 844 }, '390', 'light')
    const summary = {
      mockOrigin,
      realFixtureOrigin: realOrigin,
      allRealApiInterceptedBeforeNavigation: true,
      mockApiRequestsAbortedBeforeLoginNavigation: true,
      mockApiRequestCount: mockApiRequests.length,
      realApiRequestCount: desktop.apiRequests.length,
      realFixtureNonGetWrites: desktop.writes.length,
      mobileFixtureNonGetWrites: mobile.writes.length,
      inspections: inspected,
    }
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } finally {
    await browser.close()
  }
})().catch(error => {
  process.stderr.write(`${error.stack || error}\n`)
  process.exitCode = 1
})
