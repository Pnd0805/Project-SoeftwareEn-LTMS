// Synthetic HTTP fixtures only. Every API request is intercepted; no live backend.
const { chromium } = require('playwright');
const fs = require('node:fs'), assert = require('node:assert/strict');
const { fixture: baseFixture } = require('../ticket-05/check-browser.cjs');
const origin = process.env.LTMS_QA_ORIGIN || 'http://127.0.0.1:5176';
const executablePath = process.env.LTMS_QA_BROWSER || '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const longName = 'Northside Community Championship Tournament for Engineering and Sporting Academies';
const person = (id, fullName) => ({ id, fullName, avatarUrl: null });
const requests = Array.from({ length: 18 }, (_, i) => ({ id: 50 + i, name: i ? `District ${i + 1} Championship` : longName, sportTypeId: 1, requestedBy: person(200 + i, 'Organizer Northside Community Sporting Academy'), eventStartDate: '2099-10-01', createdAt: '2026-10-01T09:00:00Z' }));
const scopes = Array.from({ length: 18 }, (_, i) => ({ id: 70 + i, user: person(300 + i, `Admin ${i + 1} Northside Community Department`), scopeType: 'faculty', facultyId: 1, createdAt: '2026-10-01T09:00:00Z' }));
const pagination = items => ({ page: 1, pageSize: 100, totalPages: 1, totalItems: items.length });
const list = items => ({ items, pagination: pagination(items) });
async function fixture(page, mode) {
  const fallbackWrites = await baseFixture(page, {}), writes = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1', '');
    let data, status = 200;
    if (request.method() !== 'GET') {
      writes.push({ path, method: request.method(), body: request.postData() ? JSON.parse(request.postData()) : null });
      if (mode.approve && path === '/tournaments/50/approve') { mode.removed = true; data = { id: 50, status: 'private' }; }
      else { status = 503; data = { error: { code: 'SYNTHETIC_FAILURE', message: 'Fixture: change failed. Your draft is retained.' } }; }
    } else if (path === '/me') data = { id: 99, fullName: 'Admin Northside', email: 'admin@example.test', userType: 'staff', facultyId: 1, departmentId: 1, roles: ['admin'], adminScope: mode.denied ? null : { id: 1, scopeType: mode.scope || 'university_wide', facultyId: mode.scope === 'faculty' ? 1 : null } };
    else if (path === '/admin/scopes') {
      if (mode.denied) { status = 403; data = { error: { code: 'INSUFFICIENT_ADMIN_SCOPE', message: 'Admin rights required' } }; }
      else data = list(scopes);
    } else if (path === '/admin/tournament-requests') {
      if (mode.requestError) { status = mode.requestError; data = { error: { code: 'READ_FAILED', message: 'Fixture: request source unavailable' } }; }
      else data = list(mode.empty ? [] : requests.filter(row => !mode.removed || row.id !== 50));
    } else if (path === '/admin/team-requests') {
      if (mode.scope === 'faculty') { status = 403; data = { error: { code: 'INSUFFICIENT_ADMIN_SCOPE', message: 'University Admin rights required' } }; }
      else data = list(Array.from({ length: 18 }, (_, i) => ({ id: 80 + i, team: { id: 11 + i, name: `Northside Community Sporting Club ${i + 1}`, sportTypeId: 1 }, requestedBy: person(400 + i, 'Team Leader Northside Community'), status: 'pending', createdAt: '2026-10-01T09:00:00Z' })));
    } else if (path === '/admin/amendment-requests') data = list(Array.from({ length: 12 }, (_, i) => ({ id: 90 + i, status: 'pending', tournamentId: 42, tournamentName: i ? `District ${i + 1} Championship` : longName, requestedBy: person(200 + i, 'Organizer Northside'), requestedAt: '2026-10-01T09:00:00Z', requestedChanges: { maxTeams: 16, eventStartDate: '2099-10-02', eligibilityRules: [{ faculty: 'Engineering', minimumAge: 18 }] } })));
    else if (path === '/admin/referee-requests') data = { items: Array.from({ length: 12 }, (_, i) => ({ userId: 500 + i, user: { ...person(500 + i, `External Referee ${i + 1} Northside Championship League`), email: `ref${i}@example.test` }, submittedAt: '2026-10-01T09:00:00Z', docsRequired: false, tournaments: [{ id: 42, name: longName, tournamentRefereeId: 600 + i, externalApprovalStatus: 'pending' }, { id: 43, name: 'Westside Community Tournament', tournamentRefereeId: 700 + i, externalApprovalStatus: 'pending' }] })) };
    else if (path === '/admin/users') data = list(Array.from({ length: 45 }, (_, i) => ({ id: 800 + i, fullName: `Player ${i + 1} Northside Community Sporting Academy`, email: `player${i}@example.test`, userType: 'student', facultyId: 1, adminScope: null, isSuspended: i % 5 === 0, suspendedReason: i % 5 === 0 ? 'Repeated spam in tournament feedback' : null, suspendedCategoryLabel: i % 5 === 0 ? 'Spam' : null, suspendedUntil: i % 5 === 0 ? '2099-10-01T09:00:00Z' : null })));
    else if (/^\/users\/\d+$/.test(path)) data = { id: Number(path.split('/')[2]), fullName: 'Player', userType: 'student', teams: [], tournaments: [], stats: [], badges: [], faculty: { id: 1, name: 'Engineering' } };
    else if (path === '/admin/team-requests/transfers') data = list(Array.from({ length: 18 }, (_, i) => ({ id: 100 + i, team: { id: 11 + i, name: `Northside Community Sporting Team ${i + 1}`, sportTypeId: 1 }, currentLeader: person(900 + i, 'Current Leader Northside Community'), proposedLeader: person(950 + i, 'Proposed Leader Sporting Academy'), status: 'pending', createdAt: '2026-10-01T09:00:00Z' })));
    else if (path === '/admin/audit-logs') data = list(Array.from({ length: 30 }, (_, i) => ({ id: 110 + i, actionType: 'user_suspended', entityType: 'user', entityId: 800 + i, actor: person(99, 'Admin Northside Community Department'), createdAt: '2026-10-01T09:00:00Z', details: { reason: 'Repeated spam', category: 'spam', previous: { content: 'Long recorded value '.repeat(16) } } })));
    else { await route.fallback(); return; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return { writes, fallbackWrites };
}
async function capture(page, name, dialog = false) {
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
  if (!dialog) await page.evaluate(() => { document.activeElement?.blur?.(); scrollTo({ top: 0, behavior: 'instant' }); });
  const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
    panels: [...document.querySelectorAll('.admin-workspace>.panel')].map(e => ({ padding: getComputedStyle(e).padding, width: e.getBoundingClientRect().width })),
    namedScrollAreas: [...document.querySelectorAll('.admin-workspace [role="region"]')].map(e => e.getAttribute('aria-label')) }));
  assert(!layout.overflow, name + ' horizontal overflow');
  await page.screenshot({ path: `${__dirname}/${name}.png`, fullPage: !dialog }); checks.push({ name, ...layout });
}
async function refresh(page) {
  await page.evaluate(async () => { const source = await (await fetch('/src/main.tsx')).text(), url = source.match(/from "([^"]*@tanstack_react-query[^"]*)"/)[1]; const { focusManager } = await import(url); focusManager.setFocused(false); focusManager.setFocused(true); });
}
const checks = [];
module.exports = { fixture };
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height, theme] of [[1280,800,'dark'],[1280,800,'light'],[1440,900,'dark'],[1440,900,'light'],[390,844,'dark'],[390,844,'light']]) {
      const context = await browser.newContext({ viewport: { width, height } }), page = await context.newPage(), mode = {}, errors = [];
      page.on('pageerror', e => errors.push(e.message)); const { writes, fallbackWrites } = await fixture(page, mode);
      await page.goto(origin + '/admin/requests'); await page.getByRole('article', { name: longName, exact: true }).waitFor();
      await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(page, `requests-${width}-${theme}`);
      await page.getByRole('article', { name: longName, exact: true }).getByRole('button', { name: 'Decline', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: longName, exact: true }); await dialog.waitFor(); await page.getByLabel(/Reason/).fill('Needs a confirmed venue'); await capture(page, `decline-${width}-${theme}`, true);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      for (const [tab, ready] of [['filters','Rule change queue'],['permanent','Official squad requests'],['referees','External referee requests'],['users','Admin user directory'],['scopes','Admin rights in your scope'],['audit','Audit records'],['transfers','Pending leader transfers']]) {
        await page.goto(origin + '/admin/' + tab); await page.getByRole('region', { name: ready, exact: true }).waitFor();
        await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(page, `${tab}-${width}-${theme}`);
      }
      await page.goto(origin + '/admin/feedback'); await page.getByLabel('Feedback ID').waitFor(); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(page, `feedback-${width}-${theme}`);
      mode.approve = true; await page.goto(origin + '/admin/requests'); await page.getByRole('article', { name: longName, exact: true }).getByRole('button', { name: 'Approve', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Approved ' + longName }).waitFor(); await page.getByRole('article', { name: longName, exact: true }).waitFor({ state: 'hidden' });
      await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(page, `receipt-${width}-${theme}`);
      assert.deepEqual(writes, [{ path: '/tournaments/50/approve', method: 'POST', body: null }]); assert.equal(fallbackWrites.length, 0); assert.deepEqual(errors, []);
      checks.push({ name: `interactions-${width}-${theme}`, receiptRetained: true, errors, writes }); await context.close();
    }
    for (const [name, mode, tab, expected] of [['faculty',{scope:'faculty'},'scopes','You can view rights in your faculty.'],['faculty-denied',{scope:'faculty'},'permanent','This queue is for university-wide admins.'],['staff-denied',{denied:true},'requests','403 — admin only'],['empty',{empty:true},'requests','Nothing waiting.']]) {
      const context = await browser.newContext({ viewport: { width:1440,height:900 } }), page = await context.newPage(); const { writes } = await fixture(page, mode);
      await page.goto(origin + '/admin/' + tab); await page.getByText(expected, { exact:true }).waitFor(); await capture(page, name);
      if (name === 'faculty') assert.equal(await page.getByRole('button', { name:'Review grant' }).count(), 0);
      if (name === 'faculty-denied' || name === 'staff-denied') assert.equal(await page.getByRole('button', { name:'Approve',exact:true }).count(), 0);
      assert.equal(writes.length,0); await context.close();
    }
    const context = await browser.newContext({ viewport: { width:1440,height:900 } }), page = await context.newPage(), mode = {};
    const { writes } = await fixture(page, mode); await page.goto(origin + '/admin/requests');
    await page.getByRole('article', { name:longName,exact:true }).getByRole('button', { name:'Decline',exact:true }).click(); await page.getByLabel(/Reason/).fill('Retained reason');
    mode.requestError = 503; await refresh(page); await page.getByText('Fixture: request source unavailable', { exact:false }).first().waitFor();
    assert.equal(await page.getByLabel(/Reason/).inputValue(),'Retained reason'); await capture(page,'refresh-failed',true);
    mode.requestError = 403; await refresh(page); await page.getByRole('dialog').waitFor({state:'hidden'}); assert.equal(await page.getByRole('article').count(),0); assert.equal(writes.length,0);
    checks.push({name:'source-access',draftRetained:true,deniedCacheHidden:true,writes:[]}); await context.close();
  } finally { await browser.close(); fs.writeFileSync(__dirname + '/checks.json', JSON.stringify(checks,null,2)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
