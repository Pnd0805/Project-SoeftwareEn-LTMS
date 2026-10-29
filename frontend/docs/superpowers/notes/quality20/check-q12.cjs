// Intercepted fixtures only; no live backend or saved user data is changed.
const { chromium } = require('/private/tmp/ltms-ticket1-browser/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const origin = 'http://127.0.0.1:5193'
const out = path.resolve('docs/superpowers/notes/quality20')
const tour = { id: 23, name: 'Quality20 Northside Cup', sportTypeId: 1, bracketFormat: 'single_elimination', scopeType: 'faculty', organizingFacultyId: 1, organizingDepartmentId: null, requestedByUserId: 99, organizer: { id: 99, fullName: 'Cup organizer' }, status: 'public', registrationOpen: true, registrationStart: '2099-09-01T09:00:00Z', registrationEnd: '2099-09-20T09:00:00Z', eventStartDate: '2099-10-01', eventEndDate: '2099-10-02', maxTeams: 32, minTeams: 2, venue: 'Northside Stadium', disputeWindowHours: 24, genderRequirement: 'any', minAge: null, maxAge: null, rejectionReason: null, approvedBy: 1, createdAt: '2026-09-01', eligibilityRules: [], referees: [], applications: [], championTeamId: null, entryNotes: 'Bring student ID.' }
const me = { id: 9, fullName: 'Quality20 admin fixture', email: 'quality-admin@example.test', userType: 'staff', gender: 'other', birthDate: '2002-06-04', facultyId: 2, departmentId: 8, year: 3, totalPoints: 0, avatarUrl: null }
const comment = { id: 42, tournamentId: 23, author: { id: 8, fullName: 'Comment author with a long identifiable name', avatarUrl: null }, content: 'Inspect this comment before removal. ' + 'Long content remains readable. '.repeat(30), createdAt: '2026-10-01T00:00:00Z', isMine: false }
const review = { id: 55, rating: 2, content: 'Inspect this tournament review before removal.', author: { id: 8, fullName: 'Review author' } }
const error = message => ({ error: { code: 'FIXTURE_REJECTED', message } })
async function fixture(page, state) {
  await page.route('**/src/api/client.ts*', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()).replace(/export const USE_MOCK = [^;]+;/, 'export const USE_MOCK = false;') })
  })
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), p = new URL(req.url()).pathname.replace('/api/v1', '')
    let data = { items: [] }, status = 200
    if (req.method() !== 'GET') {
      state.writes.push({ path: p, method: req.method(), body: req.postData() ? JSON.parse(req.postData()) : null })
      if (p === '/auth/register') { status = 422; data = { error: { code: 'VALIDATION_FAILED', message: 'Fixture email rejection', fields: { email: 'This email is already registered.' } } } }
      else if (/^\/admin\/feedback\/\d+$/.test(p)) {
        if (state.failRemove) { state.failRemove = false; status = 403; data = error('Server denied this removal. Retry after checking permissions.') }
        else { state.removed.add(Number(p.split('/').pop())); status = 204 }
      } else if (/^\/admin\/feedback\/\d+\/restore$/.test(p)) { const id = Number(p.split('/').at(-2)); state.removed.delete(id); data = { id, restored: true } }
      else { status = 501; data = error('Unexpected fixture write ' + p) }
    } else if (p === '/me') data = me
    else if (p === '/faculties') data = { items: [{ id: 1, name: 'Science' }, { id: 2, name: 'Engineering' }] }
    else if (p === '/faculties/1/departments') data = { items: [{ id: 1, facultyId: 1, name: 'Mathematics' }] }
    else if (p === '/faculties/2/departments') data = { items: [{ id: 8, facultyId: 2, name: 'Software Engineering' }] }
    else if (p === '/sport-types') data = { items: [{ id: 1, name: 'Football', defaultMode: 'onsite', minMembers: 2, maxMembers: 30 }] }
    else if (p === '/tournaments/23') data = tour
    else if (p === '/tournaments/23/comments') data = { items: state.removed.has(42) ? [] : [comment], mine: null, canComment: false, canModerate: true, pagination: { page: 1, pageSize: 20, totalItems: state.removed.has(42) ? 0 : 1, totalPages: 1 } }
      else if (p === '/tournaments/23/feedback') data = { summary: { average: 2, count: state.removed.has(55) ? 0 : 1, distribution: {} }, status: 'open', canSubmit: false, mine: null, items: state.removed.has(55) ? [] : [review] }
    else if (p === '/admin/scopes') { if (state.denied) { status = 403; data = error('No admin scope') } else data = { items: [{ id: 1, user: { id: 9, fullName: me.fullName }, scopeType: 'university', facultyId: null, createdAt: '2026-10-01' }], pagination: { totalPages: 1 } } }
    else if (p === '/notifications') data = { items: [], unreadCount: 0, pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } }
    await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(data) })
  })
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready)
  const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, theme: document.documentElement.dataset.theme, overflow: document.documentElement.scrollWidth > innerWidth,
    dialog: (() => { const d = document.querySelector('[role=dialog]'); if (!d) return null; const r = d.getBoundingClientRect(), confirm = d.querySelector('button[type=submit]').getBoundingClientRect(); return { height: r.height, top: r.top, bottom: r.bottom, confirmVisible: confirm.bottom <= innerHeight && confirm.top >= 0 } })() }))
  assert.equal(layout.overflow, false, name)
  assert.equal(layout.theme, name.split('-').at(-1), name + ' theme')
  if (layout.dialog) assert.equal(layout.dialog.confirmVisible, true, name)
  await page.screenshot({ path: path.join(out, name + '.png') })
  return { name, ...layout }
}
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' })
  const checks = []
  try {
    for (const [width, height, theme] of [[1280, 800, 'dark'], [1280, 800, 'light'], [1440, 900, 'dark'], [1440, 900, 'light'], [390, 844, 'light']]) {
      const context = await browser.newContext({ viewport: { width, height } }), page = await context.newPage()
      await context.addInitScript(theme => localStorage.setItem('ltms-theme', theme), theme)
      const state = { writes: [], removed: new Set(), failRemove: true, denied: false }, errors = []
      page.on('pageerror', e => errors.push(e.message))
      await fixture(page, state)
      await page.goto(origin + '/register')
      await page.getByRole('option', { name: 'Engineering', exact: true }).waitFor({ state: 'attached' })
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      for (const label of ['Gender', 'Birth date', 'Faculty', 'Department', 'Year']) assert.equal(await page.getByLabel(label).inputValue(), '', label)
      checks.push(await capture(page, `q12-register-blank-${width}-${theme}`))
      await page.getByLabel('Full name').fill('Deliberate Student')
      await page.getByLabel('Email').fill('chosen@example.test')
      await page.getByLabel('Password').fill('password123')
      await page.getByRole('button', { name: 'Create account', exact: true }).click()
      await page.locator('[name=gender][aria-invalid=true]').waitFor()
      assert.equal(state.writes.length, 0)
      await page.getByLabel('Gender').selectOption('other')
      await page.getByLabel('Birth date').fill('2002-06-04')
      await page.getByLabel('Faculty').selectOption('1')
      await page.getByLabel('Department').selectOption('1')
      await page.getByLabel('Faculty').selectOption('2')
      assert.equal(await page.getByLabel('Department').inputValue(), '')
      await page.getByLabel('Department').selectOption('8')
      await page.getByLabel('Year').fill('3')
      await page.getByRole('button', { name: 'Create account', exact: true }).click()
      await page.getByText('This email is already registered.', { exact: true }).waitFor()
      assert.equal(await page.getByLabel('Department').inputValue(), '8')
      checks.push(await capture(page, `q12-register-error-${width}-${theme}`))
      assert.deepEqual(state.writes[0], { path: '/auth/register', method: 'POST', body: { fullName: 'Deliberate Student', email: 'chosen@example.test', password: 'password123', gender: 'other', birthDate: '2002-06-04', facultyId: 2, departmentId: 8, year: 3 } })
      await page.goto(origin + '/admin/feedback')
      await page.getByText(/Target context is unavailable/).waitFor()
      assert.equal(await page.getByLabel('Feedback ID').count(), 0)
      checks.push(await capture(page, `q12-admin-blocked-${width}-${theme}`))
      await page.goto(origin + '/t/23/community')
      const row = page.locator('.notif').filter({ hasText: 'Inspect this comment before removal.' })
      const trigger = row.getByRole('button', { name: 'Remove', exact: true })
      await trigger.click()
      let dialog = page.getByRole('dialog', { name: 'Remove feedback', exact: true })
      await dialog.waitFor()
      assert.equal(state.writes.length, 1)
      assert.match(await dialog.innerText(), /Comment #42/)
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'hidden' })
      assert.equal(await trigger.evaluate(e => e === document.activeElement), true)
      await trigger.click()
      await dialog.getByLabel('Reason (optional)').fill('Reviewed target')
      checks.push(await capture(page, `q12-comment-confirm-${width}-${theme}`))
      await dialog.getByRole('button', { name: 'Confirm removal' }).click()
      await dialog.getByRole('alert').waitFor()
      assert.equal(await dialog.getByLabel('Reason (optional)').inputValue(), 'Reviewed target')
      checks.push(await capture(page, `q12-comment-denied-${width}-${theme}`))
      await dialog.getByRole('button', { name: 'Confirm removal' }).click()
      await dialog.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: 'Restore removed item #42' }).click()
      dialog = page.getByRole('dialog', { name: 'Restore feedback', exact: true })
      assert.match(await dialog.innerText(), /Inspect this comment/)
      checks.push(await capture(page, `q12-comment-restore-${width}-${theme}`))
      await dialog.getByRole('button', { name: 'Confirm restore' }).click()
      await dialog.waitFor({ state: 'hidden' })
      await page.getByText('Feedback #42 restored.', { exact: true }).waitFor()
      const reviewRow = page.locator('.notif').filter({ hasText: 'Review author' })
      await reviewRow.getByRole('button', { name: 'Remove', exact: true }).click()
      dialog = page.getByRole('dialog')
      assert.match(await dialog.innerText(), /Review #55/)
      checks.push(await capture(page, `q12-review-confirm-${width}-${theme}`))
      await dialog.getByRole('button', { name: 'Cancel' }).click()
      assert.deepEqual(state.writes.slice(1).map(w => ({ path: w.path, method: w.method, body: w.body })), [
        { path: '/admin/feedback/42', method: 'DELETE', body: { reason: 'Reviewed target' } },
        { path: '/admin/feedback/42', method: 'DELETE', body: { reason: 'Reviewed target' } },
        { path: '/admin/feedback/42/restore', method: 'POST', body: null },
      ])
      assert.deepEqual(errors, [])
      checks.push({ width, theme, registerDraftRetained: true, targetConfirmed: true, cancellationSendsNothing: true, focusReturns: true, writes: state.writes, errors })
      await context.close()
    }
    fs.writeFileSync(path.join(out, 'q12-browser.json'), JSON.stringify(checks, null, 2) + '\n')
    console.log('Q12 browser checks passed:', checks.length)
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
