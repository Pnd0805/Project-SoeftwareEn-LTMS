// Isolated contexts and intercepted API fixtures; the existing server stays on 5193.
const { chromium } = require('/private/tmp/ltms-ticket1-browser/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const origin = 'http://127.0.0.1:5193'
const out = path.resolve('docs/superpowers/notes/quality20')
const checks = []
async function capture(page, name, width, theme) {
  await page.screenshot({ path: path.join(out, `q21-${name}-${width}-${theme}.png`), fullPage: true })
  const geometry = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, overflow: document.documentElement.scrollWidth > innerWidth }))
  assert.equal(geometry.theme, theme)
  assert.equal(geometry.overflow, false)
  checks.push({ name, width, theme, ...geometry })
}
async function realFixture(page) {
  await page.route('**/src/api/client.ts*', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()).replace(/export const USE_MOCK = [^;]+;/, 'export const USE_MOCK = false;') })
  })
  await page.route('**/api/v1/**', async route => {
    assert.equal(route.request().method(), 'GET')
    const p = new URL(route.request().url()).pathname.replace('/api/v1', '')
    let data = { items: [] }
    if (p === '/me') data = { id: 9, fullName: 'Quality21 real-contract profile', email: 'quality21@example.test', userType: 'student', gender: 'other', birthDate: '2002-06-04', facultyId: 2, departmentId: 8, year: 3, totalPoints: 17, avatarUrl: null }
    else if (p === '/users/9/stats') data = { userId: 9, overall: { matchesPlayed: 12, wins: 8, losses: 4, winRate: 0.67, championCount: 1 }, bySport: [] }
    else if (p === '/notifications') data = { items: [], unreadCount: 0, pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } }
    else if (p === '/me/pickem') data = { totalPoints: 17, correct: 0, settled: 0, items: [] }
    else if (p === '/tournaments/23/matches') data = { items: [{ id: 13, round: 1, teamA: { id: 1, name: 'Northside', sportTypeId: 1 }, teamB: { id: 2, name: 'Southside', sportTypeId: 1 }, scheduledTime: '2026-10-01T10:00:00Z', scheduledEndTime: null, venue: 'Main Stadium', status: 'completed', resultStatus: 'verified', score: { a: 3, b: 1 }, outcome: null }] }
    else if (p === '/matches/13/mvp-votes') data = { matchId: 13, window: { isOpen: false, opensAt: '2026-10-01T12:00:00Z', closesAt: '2026-10-02T12:00:00Z' }, candidates: [{ userId: 8, fullName: 'Closed-window candidate', teamId: 1, avatarUrl: null, stats: [{ statKey: 'goals', statLabelTh: 'Goals', value: 3 }], votes: 8 }], totalVotes: 8, winners: [8], mine: null, canVote: false }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
  })
}
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' })
  try {
    for (const [width, height, theme] of [[1280, 800, 'dark'], [1280, 800, 'light'], [1440, 900, 'dark'], [1440, 900, 'light']]) {
      const context = await browser.newContext({ viewport: { width, height } })
      await context.addInitScript(theme => localStorage.setItem('ltms-theme', theme), theme)
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/v1/**', route => route.abort())
      await page.goto(origin + '/login')
      const expected = await page.evaluate(async () => {
        const store = await import('/src/shared/store.ts'), api = await import('/src/api/user.ts'), bridge = await import('/src/mocks/storeBridge.ts'), career = await import('/src/shared/career.ts')
        store.login('u-play'); api.setMockCurrentUser(bridge.numOf('u-play'))
        const state = store.getState(), rows = career.careerByTournament(state, 'u-play')
        return { played: rows.reduce((sum, row) => sum + row.p, 0), won: rows.reduce((sum, row) => sum + row.w, 0) }
      })
      await page.goto(origin + '/me')
      await page.getByText('Confirmed career record', { exact: false }).waitFor()
      const summary = page.locator('.statline').first()
      assert.equal(await summary.getByText('Matches played', { exact: true }).evaluate(el => el.parentElement.querySelector('.v').textContent), String(expected.played))
      assert.equal(await summary.getByText('Won', { exact: true }).evaluate(el => el.parentElement.querySelector('.v').textContent), String(expected.won))
      await capture(page, 'mock-profile', width, theme)
      await page.goto(origin + '/mvp/t-vlr')
      await page.getByRole('heading', { name: 'Match MVP' }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Vote', exact: true }).count(), 0)
      await page.getByText(/Voting is unavailable in this preview/).waitFor()
      const options = await page.getByLabel('MVP match').locator('option').evaluateAll(items => items.map(item => item.value))
      await page.getByLabel('MVP match').selectOption(options.at(-1))
      assert.equal(new URL(page.url()).searchParams.get('match'), options.at(-1))
      await capture(page, 'mock-mvp', width, theme)
      await page.goto(origin + '/watch/t-vlr')
      await page.getByText('No video available', { exact: true }).waitFor()
      assert.equal(await page.getByRole('link', { name: 'Watch replay', exact: true }).count(), 0)
      const matchPath = await page.getByRole('link', { name: 'Open match', exact: true }).getAttribute('href')
      await capture(page, 'mock-watch', width, theme)
      await page.getByRole('link', { name: 'Open match', exact: true }).click()
      assert.equal(new URL(page.url()).pathname, matchPath)
      await page.locator('h1').waitFor()
      await page.goto(origin + '/watch/t-fut')
      await page.getByText('Nothing to watch yet', { exact: true }).waitFor()
      assert.equal(await page.getByRole('link', { name: 'View bracket' }).getAttribute('href'), '/t/t-fut/bracket')
      await capture(page, 'mock-watch-empty', width, theme)
      await page.getByRole('link', { name: 'View bracket' }).click()
      assert.equal(new URL(page.url()).pathname, '/t/t-fut/bracket')
      await page.locator('h1').waitFor()
      assert.deepEqual(errors, [])
      await context.close()

      const realContext = await browser.newContext({ viewport: { width, height } })
      await realContext.addInitScript(theme => localStorage.setItem('ltms-theme', theme), theme)
      const real = await realContext.newPage()
      const realErrors = []
      real.on('pageerror', error => realErrors.push(error.message))
      await realFixture(real)
      await real.goto(origin + '/me')
      await real.getByRole('heading', { name: 'Quality21 real-contract profile' }).waitFor()
      const realSummary = real.locator('.statline').first()
      assert.equal(await realSummary.getByText('Matches played', { exact: true }).evaluate(el => el.parentElement.querySelector('.v').textContent), '12')
      await capture(real, 'real-profile', width, theme)
      await real.goto(origin + '/mvp/23?match=13')
      await real.getByText('Voting is closed.', { exact: true }).waitFor()
      await real.getByText('8 votes', { exact: true }).waitFor()
      assert.equal(await real.getByRole('button', { name: 'Vote', exact: true }).count(), 0)
      await capture(real, 'real-mvp-closed', width, theme)
      await real.goto(origin + '/watch/23')
      await real.getByText('Watch is unavailable', { exact: true }).waitFor()
      assert.equal(await real.getByRole('link', { name: 'View bracket' }).getAttribute('href'), '/t/23/bracket')
      await capture(real, 'real-watch-unavailable', width, theme)
      assert.deepEqual(realErrors, [])
      await realContext.close()
    }
    fs.writeFileSync(path.join(out, 'q21-browser.json'), JSON.stringify(checks, null, 2) + '\n')
    console.log('Q21 browser checks passed:', checks.length)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
