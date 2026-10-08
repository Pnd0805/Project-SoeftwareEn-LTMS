// Isolated API fixtures only; no live backend or visible demo-store changes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.NODE_PATH = '/private/tmp/ltms-ticket1-browser/node_modules'; require('node:module').Module._initPaths();
const { chromium, executablePath, fixture07 } = require('../../../reviews/2026-10-07-ux-ui-fanout/browser-kit.cjs');
const before = process.env.LTMS_QA_BEFORE === 'true';
const out = path.join(__dirname, process.env.LTMS_QA_OUT || (before ? 'q19-before' : 'q19-after')); fs.mkdirSync(out, { recursive: true });
const origin = 'http://127.0.0.1:5183', records = [];
const longName = 'Northside Community Championship Tournament for Engineering and Sporting Academies';
async function setup(page, mode) {
  await page.route('**/api/v1/**', r => r.abort());
  await page.route('**/src/api/client.ts*', async r => { const response = await r.fetch(); await r.fulfill({ response, body: (await response.text()).replace(/export const USE_MOCK = .*?;/, 'export const USE_MOCK = false;') }); });
  const traffic = await fixture07(page, mode);
  await page.route('**/api/v1/admin/tournament-requests*', async r => {
    let status = mode.requestError || 200;
    const items = mode.empty ? [] : Array.from({ length: 30 }, (_, i) => ({ id: 50 + i, name: i ? `District ${i + 1} Championship` : longName, sportTypeId: 1, requestedBy: { id: 200 + i, fullName: 'Organizer Northside Community Sporting Academy', avatarUrl: null }, eventStartDate: '2099-10-01', createdAt: '2026-10-01T09:00:00Z' })).filter(row => !mode.removed || row.id !== 50);
    await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { items } : { error: { code: 'READ_FAILED', message: 'Fixture: request source unavailable' } }) });
  });
  return traffic;
}
async function capture(page, id, dialog = false) {
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(180);
  if (!dialog) await page.evaluate(() => { document.activeElement?.blur?.(); scrollTo(0, 0); });
  const layout = await page.evaluate(() => {
    const rect = e => e ? { top: e.getBoundingClientRect().top + scrollY, height: e.getBoundingClientRect().height, bottom: e.getBoundingClientRect().bottom + scrollY, left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right } : null;
    const queue = document.querySelector('.admin-review-list'), first = document.querySelector('.admin-review-item');
    return { width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, navigation: rect(document.querySelector('.admin-navigation')), workspace: rect(document.querySelector('.admin-workspace')), firstAction: rect(first?.querySelector('.btn.primary')), firstItem: rect(first), userAction: rect(document.querySelector('.admin-users tbody .btn')), userTable: rect(document.querySelector('.admin-users .tblwrap')), queue: queue ? { height: queue.clientHeight, scrollHeight: queue.scrollHeight, items: queue.querySelectorAll('[role=article]').length } : null, current: document.querySelector('.admin-navigation [aria-current=page]')?.textContent, groupCount: document.querySelectorAll('.admin-nav-group').length };
  });
  assert.equal(layout.overflow, false, id + ' horizontal overflow');
  if (!before && /^(requests|filters)-\d/.test(id) && layout.width >= 1280) assert(layout.firstAction.bottom <= layout.height, id + ' first action below fold');
  if (!before && /^users-\d/.test(id) && layout.width >= 1280) assert(layout.userAction.right <= layout.userTable.right && layout.userAction.left >= layout.userTable.left, id + ' action outside visible table');
  await page.screenshot({ path: path.join(out, id + '.png'), fullPage: !dialog }); records.push({ id, ...layout });
}
async function refresh(page) {
  await page.evaluate(async () => { const source = await (await fetch('/src/main.tsx')).text(), url = source.match(/from "([^"]*@tanstack_react-query[^"]*)"/)[1]; const { focusManager } = await import(url); focusManager.setFocused(false); focusManager.setFocused(true); });
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1280, 800], [1440, 900], [390, 844]]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height } }); await context.addInitScript(t => localStorage.setItem('ltms-theme', t), theme);
      const page = await context.newPage(), mode = {}, errors = []; page.on('pageerror', e => errors.push(e.message)); const { writes, fallbackWrites } = await setup(page, mode);
      const id = `${width}-${theme}`;
      for (const [tab, ready] of [['requests', 'Tournament request queue'], ['filters', 'Rule change queue'], ['scopes', 'Admin rights in your scope'], ['users', 'Admin user directory'], ['transfers', 'Pending leader transfers'], ['audit', 'Audit records']]) {
        await page.goto(origin + '/admin/' + tab); await page.getByRole('region', { name: ready, exact: true }).waitFor();
        if (tab === 'requests') await page.getByRole('article', { name: longName, exact: true }).waitFor();
        if (tab === 'users') await page.getByRole('button', { name: 'Suspend', exact: true }).first().waitFor();
        await capture(page, tab + '-' + id);
      }
      await page.goto(origin + '/admin/requests'); const first = page.getByRole('article', { name: longName, exact: true }); await first.waitFor();
      const queue = page.getByRole('region', { name: 'Tournament request queue' }); await queue.focus();
      for (let i = 0; i < 60; i++) await page.keyboard.press('Tab');
      assert(await queue.getByRole('button', { name: 'Approve', exact: true }).last().evaluate(e => e === document.activeElement));
      assert(await queue.evaluate(e => e.scrollTop > 0));
      await first.getByRole('button', { name: 'Decline', exact: true }).focus(); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: longName, exact: true }); await dialog.waitFor();
      const reason = page.getByLabel(/Reason/); await reason.fill('Needs a confirmed venue'); await page.getByRole('button', { name: 'Decline the request', exact: true }).click();
      await dialog.getByText('Fixture: change failed. Your draft is retained.').waitFor(); assert.equal(await reason.inputValue(), 'Needs a confirmed venue'); await capture(page, 'decline-failed-' + id, true);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert(await first.getByRole('button', { name: 'Decline', exact: true }).evaluate(e => e === document.activeElement));
      mode.requestError = 403; await refresh(page); await page.getByText('Fixture: request source unavailable', { exact: false }).waitFor();
      assert.equal(await page.getByRole('article').count(), 0); await capture(page, 'requests-denied-' + id);
      assert.deepEqual(writes, [{ path: '/tournaments/50/reject', method: 'POST', body: { reason: 'Needs a confirmed venue' } }]); assert.equal(fallbackWrites.length, 0); assert.deepEqual(errors, []);
      records.push({ id: 'interactions-' + id, keyboardQueue: true, failedDeclineDraft: true, dialogEscapeReturn: true, cachedDenialHidden: true, writes, errors }); await context.close();
    }
    for (const [id, mode, route, ready] of [['empty', { empty: true }, 'requests', 'Nothing waiting.'], ['faculty-denied', { scope: 'faculty' }, 'permanent', 'This queue is for university-wide admins.'], ['access-denied', { denied: true }, 'requests', '403 — admin only']]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await context.newPage(); const { writes } = await setup(page, mode);
      await page.goto(origin + '/admin/' + route); await page.getByText(ready, { exact: true }).waitFor(); await capture(page, id);
      assert.equal(await page.getByRole('button', { name: 'Approve', exact: true }).count(), 0); assert.equal(writes.length, 0); await context.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify(records, null, 2)); }
  console.log(`${records.length} Admin records; isolated fixtures, no page overflow/runtime errors.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
