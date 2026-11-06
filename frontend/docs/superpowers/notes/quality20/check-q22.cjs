// Production chunks, isolated mock sessions, no live backend, no change to port 5193.
const { chromium } = require('/private/tmp/ltms-ticket1-browser/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const dist = path.resolve('dist')
const out = path.resolve('docs/superpowers/notes/quality20')
const checks = []
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' })
  const server = http.createServer((req, res) => {
    const name = req.url.split('?')[0]
    const file = path.join(dist, name.includes('.') ? name : 'index.html')
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.woff2') ? 'font/woff2' : 'text/html')
    try { res.end(fs.readFileSync(file)) } catch { res.statusCode = 404; res.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    const seedContext = await browser.newContext()
    const source = await seedContext.newPage()
    await source.route('**/api/v1/**', route => route.abort())
    await source.goto('http://127.0.0.1:5193/login')
    const fixture = await source.evaluate(async () => {
      const { SEED } = await import('/src/shared/seed.ts'), { numOf } = await import('/src/mocks/storeBridge.ts')
      const seed = SEED()
      return { seed, ids: { 'u-play': numOf('u-play'), 'u-admin': numOf('u-admin'), 'u-org': numOf('u-org') }, match: seed.matches.find(m => m.tour === 't-vlr' && m.a && m.b && m.note !== 'bye').id }
    })
    await seedContext.close()
    async function session(user = 'u-admin', theme = 'dark', width = 1440, height = 900) {
      const context = await browser.newContext({ viewport: { width, height } })
      await context.addInitScript(({ fixture, user, theme }) => {
        const seed = { ...fixture.seed, session: user }
        localStorage.setItem('ltms.v1', JSON.stringify(seed))
        if (user) localStorage.setItem('ltms-mock-user-id', String(fixture.ids[user]))
        localStorage.setItem('ltms-theme', theme)
      }, { fixture, user, theme })
      const page = await context.newPage()
      await page.route('**/api/v1/**', route => route.abort())
      return { context, page }
    }
    async function capture(page, name, width, theme) {
      const geometry = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, overflow: document.documentElement.scrollWidth > innerWidth }))
      assert.equal(geometry.theme, theme)
      assert.equal(geometry.overflow, false)
      await page.screenshot({ path: path.join(out, `q22-${name}-${width}-${theme}.png`) })
      checks.push({ name, width, theme, ...geometry })
    }
    for (const [width, height, theme] of [[1280, 800, 'dark'], [1280, 800, 'light'], [1440, 900, 'dark'], [1440, 900, 'light']]) {
      for (const [name, url, chunk, label] of [
        ['admin', '/admin', 'AdminPage', 'Loading admin'],
        ['request', '/request', 'RequestPage', 'Loading tournament request'],
        ['match', `/m/${fixture.match}`, 'MatchPage', 'Loading match'],
      ]) {
        const { context, page } = await session('u-admin', theme, width, height)
        let release
        const gate = new Promise(resolve => { release = resolve })
        await page.route(`**/assets/${chunk}-*.js`, async route => { await gate; await route.continue() })
        if (name !== 'match') {
          await page.goto(origin + '/')
          await page.getByRole('heading', { name: 'Home', exact: true }).waitFor()
          if (name === 'request') await page.getByRole('button', { name: 'Request tournament', exact: true }).click()
          else await page.locator(`a[href="${url}"]`).first().click()
        } else await page.goto(origin + url)
        const status = page.getByRole('status').filter({ hasText: label })
        await status.waitFor()
        await page.getByRole('navigation', { name: 'Main navigation' }).waitFor()
        await capture(page, `${name}-loading`, width, theme)
        release()
        await status.waitFor({ state: 'hidden' })
        await page.locator('h1').first().waitFor()
        assert.equal(await page.getByText('This page could not load.', { exact: true }).count(), 0)
        await capture(page, `${name}-loaded`, width, theme)
        await context.close()
      }
      const { context, page } = await session('u-admin', theme, width, height)
      let fail = true, documents = 0
      page.on('request', request => { if (request.resourceType() === 'document') documents++ })
      await page.route('**/assets/RequestPage-*.js', route => {
        if (fail) { fail = false; return route.abort('failed') }
        return route.continue()
      })
      await page.goto(origin + '/request?quality=1#review')
      await page.getByText('This page could not load.', { exact: true }).waitFor()
      await capture(page, 'chunk-failure', width, theme)
      const before = documents
      await page.getByRole('button', { name: 'Reload page', exact: true }).click()
      await page.getByRole('heading', { name: 'Request a tournament', exact: true }).waitFor({ timeout: 10000 })
      assert.ok(documents > before, 'Chunk retry must request a fresh document even with a URL fragment')
      assert.equal(new URL(page.url()).pathname, '/request')
      assert.equal(new URL(page.url()).search, '?quality=1')
      checks.push({ name: 'chunk-document-retry', width, theme, documents, retainedRouteAndQuery: true })
      await context.close()
    }
    // Every existing route form remains reachable; no acceptance score is inferred.
    const { context, page } = await session('u-admin')
    await page.goto(origin + '/')
    await page.getByRole('heading', { name: 'Home', exact: true }).waitFor()
    await page.locator('#home-find').fill('Football')
    const categories = page.locator('.home-category-tabs button')
    await categories.last().click()
    assert.ok(new URL(page.url()).pathname.startsWith('/home/'))
    assert.equal(await page.locator('#home-find').inputValue(), 'Football')
    checks.push({ name: 'root-home-category-retains-filter', filter: 'Football' })
    for (const route of ['/', '/home/all', '/t/t-vlr', '/t/t-vlr/bracket', '/t/t-vlr/manage/setup', `/m/${fixture.match}`, `/m/${fixture.match}/fixture`, `/m/${fixture.match}/progress`, `/checkin/${fixture.match}`, '/mvp/t-vlr', '/team/t-byt', '/player/u-play', '/watch/t-vlr', '/search', '/search/cup', '/teams', '/matches', '/inbox', '/me', '/request', '/admin', '/admin/users', '/register', '/login']) {
      await page.goto(origin + route)
      await page.locator('h1, .empty b').first().waitFor()
      assert.equal(await page.getByText('This page could not load.', { exact: true }).count(), 0)
      assert.equal(await page.getByText('This page could not be drawn.', { exact: true }).count(), 0)
      checks.push({ name: 'route-smoke', route, heading: await page.locator('h1, .empty b').first().textContent() })
    }
    await context.close()
    const anonymous = await session(null)
    const scriptRequests = []
    anonymous.page.on('request', request => { if (request.url().endsWith('.js')) scriptRequests.push(request.url()) })
    await anonymous.page.goto(origin + '/admin')
    await anonymous.page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor()
    assert.equal(new URL(anonymous.page.url()).pathname, '/login')
    assert.ok(!scriptRequests.some(url => /AdminPage-/.test(url)))
    checks.push({ name: 'anonymous-private-redirect', adminChunkFetched: false })
    await anonymous.context.close()
    const player = await session('u-play')
    await player.page.goto(origin + '/admin')
    await player.page.getByText('403 — admin only', { exact: true }).waitFor()
    checks.push({ name: 'signed-in-non-admin-denied' })
    await player.context.close()
    console.log('Q22 production browser checks passed:', checks.length)
  } finally {
    fs.writeFileSync(path.join(out, 'q22-browser.json'), JSON.stringify(checks, null, 2) + '\n')
    await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); process.exit(1) })
