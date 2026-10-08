// Bounded, read-only visual inspection. Synthetic fixture routes answer /api/v1;
// a catch-all abort route is installed first so unhandled calls cannot reach a backend.
const path = require('node:path')
const { chromium, executablePath, fixture06 } = require('../browser-kit.cjs')

const origin = 'http://127.0.0.1:5176'
const out = __dirname

async function capture(page, name, fullPage = true) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(out, name), fullPage })
}

async function setup(browser, mode) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
  const page = await context.newPage()
  let aborts = 0
  await page.route('**/api/v1/**', async route => {
    aborts += 1
    await route.abort()
  })
  await fixture06(page, mode)
  return { context, page, abortCount: () => aborts }
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath })
  const inspected = []
  try {
    // Referee result entry and its review dialog; no submit action is taken.
    const referee = await setup(browser, { status: 'finished' })
    await referee.page.goto(`${origin}/m/100/overview`)
    await referee.page.getByRole('button', { name: 'Review result', exact: true }).waitFor()
    await referee.page.getByLabel('Northside Community Championship Football Team', { exact: true }).fill('3')
    await referee.page.getByRole('button', { name: 'Review result', exact: true }).click()
    await referee.page.getByRole('dialog', { name: 'Review result' }).waitFor()
    await capture(referee.page, 'result-review-1440-dark.png', false)
    inspected.push({ route: '/m/100/overview', state: 'result review dialog', screenshot: 'result-review-1440-dark.png' })
    await referee.page.keyboard.press('Escape')
    await referee.page.getByRole('dialog', { name: 'Review result' }).waitFor({ state: 'hidden' })

    await referee.page.getByRole('button', { name: 'Lineup', exact: true }).click()
    await referee.page.getByRole('region', { name: 'Northside Community Championship Football Team lineup' }).waitFor()
    await capture(referee.page, 'lineup-1440-dark.png')
    inspected.push({ route: '/m/100/lineup', state: 'both team lineups', screenshot: 'lineup-1440-dark.png' })
    await referee.page.getByRole('button', { name: 'History', exact: true }).click()
    await referee.page.getByRole('heading', { name: 'Result history', exact: true }).waitFor()
    await capture(referee.page, 'history-1440-dark.png')
    inspected.push({ route: '/m/100/progress', state: 'result history', screenshot: 'history-1440-dark.png' })
    await referee.page.getByRole('button', { name: 'Stats', exact: true }).click()
    await referee.page.getByRole('region', { name: 'Recorded player statistics' }).waitFor()
    inspected.push({ route: '/m/100/stats', state: 'recorded player statistics', screenshot: 'real-stats-1440-dark.png (Ticket 09)' })
    inspected.push({ apiFallbackAborts: referee.abortCount() })
    await referee.context.close()

    // Organizer fixture editor and dispute decision panel; no saves or decisions are submitted.
    const organizerMode = { organizer: true, status: 'scheduled' }
    const organizer = await setup(browser, organizerMode)
    await organizer.page.goto(`${origin}/m/100/fixture`)
    await organizer.page.locator('.match-fixture-form').waitFor()
    await capture(organizer.page, 'fixture-1440-dark.png')
    inspected.push({ route: '/m/100/fixture', state: 'organizer editor', screenshot: 'fixture-1440-dark.png' })
    await organizer.page.setViewportSize({ width: 390, height: 844 })
    await organizer.page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
    await capture(organizer.page, 'fixture-390-light.png')
    inspected.push({ route: '/m/100/fixture', state: 'organizer editor, narrow light', screenshot: 'fixture-390-light.png' })

    organizerMode.status = 'finished'
    organizerMode.result = 'disputed'
    await organizer.page.setViewportSize({ width: 1440, height: 900 })
    await organizer.page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await organizer.page.goto(`${origin}/m/100/overview`)
    await organizer.page.getByText('Resolve the dispute — your decision is final', { exact: true }).waitFor()
    await capture(organizer.page, 'dispute-1440-dark.png')
    inspected.push({ route: '/m/100/overview', state: 'organizer dispute resolution', screenshot: 'dispute-1440-dark.png' })
    inspected.push({ apiFallbackAborts: organizer.abortCount() })
    await organizer.context.close()
  } finally {
    await browser.close()
  }
  process.stdout.write(JSON.stringify({ inspected }, null, 2) + '\n')
}

main().catch(error => {
  process.stderr.write(`${error.stack || error}\n`)
  process.exitCode = 1
})
