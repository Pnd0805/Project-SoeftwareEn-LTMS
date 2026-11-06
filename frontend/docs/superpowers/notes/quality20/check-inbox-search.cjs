// Isolated HTTP fixtures; no live backend or visible demo data is mutated.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.NODE_PATH = '/private/tmp/ltms-ticket1-browser/node_modules'; require('node:module').Module._initPaths();
const { chromium, executablePath, fixture08b } = require('../../../reviews/2026-10-07-ux-ui-fanout/browser-kit.cjs');
const before = process.env.LTMS_QA_BEFORE === 'true';
const out = path.join(__dirname, before ? 'q17-before' : 'q17-after'); fs.mkdirSync(out, { recursive: true });
const records = [], origin = 'http://127.0.0.1:5183';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width,height,theme] of [[1440,900,'dark'],[1440,900,'light'],[1280,800,'dark'],[1280,800,'light'],[390,844,'dark'],[390,844,'light']]) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(t => localStorage.setItem('ltms-theme', t), theme);
      const page = await context.newPage(), errors = [], mode = {}, record = { width, height, theme, errors };
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/v1/**', r => r.abort());
      await page.route('**/src/api/client.ts', async r => { const response = await r.fetch();
        await r.fulfill({ response, body: (await response.text()).replace(/export const USE_MOCK = .*?;/, 'export const USE_MOCK = false;') }); });
      const { writes } = await fixture08b(page, mode);
      async function shot(name) {
        await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(180);
        await page.evaluate(() => { document.activeElement?.blur?.(); scrollTo(0,0); });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
        await page.screenshot({ path: path.join(out, `${name}-${width}-${theme}.png`), fullPage: true });
      }
      await page.goto(origin + '/inbox');
      const accept = page.getByRole('button', { name: /^Accept team invitation:/ });
      await accept.waitFor(); await page.getByText('Court changed for the Northside Community Championship', { exact: true }).waitFor();
      await shot('inbox');
      record.inbox = await accept.evaluate(e => ({ firstActionY: e.getBoundingClientRect().top,
        firstActionInitiallyVisible: e.getBoundingClientRect().bottom <= innerHeight,
        height: document.documentElement.scrollHeight }));
      if (!before) {
        assert.equal(await page.getByText('3 pending', { exact: true }).count(), 1);
        if (width >= 1280) assert(record.inbox.firstActionInitiallyVisible);
        await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'All notifications marked read.' }).waitFor();
        const receipt = await page.getByRole('status').filter({ hasText: 'All notifications marked read.' }).evaluate(e => ({ top:e.getBoundingClientRect().top, bottom:e.getBoundingClientRect().bottom }));
        assert(receipt.top >= 0 && receipt.bottom <= height); record.readReceipt = receipt;
        assert.equal(await accept.isEnabled(), true); assert.equal(await page.getByText('3 pending', { exact: true }).count(), 1);
        mode.failMutation = true; await accept.click();
        await page.getByRole('alert').filter({ hasText: 'Invitation no longer available' }).waitFor();
        assert.equal(await accept.isEnabled(), true); await shot('inbox-failure'); mode.failMutation = false;
        assert.deepEqual(writes.map(w => [w.path,w.method,w.body]), [['/me/notifications/read-all','POST',null],['/invitations/12/accept','POST',null]]);
      } else assert.equal(writes.length, 0);
      await page.goto(origin + '/search/Northside');
      await page.getByRole('button', { name: /^Open player:/ }).last().waitFor(); await shot('search-all');
      record.search = { total: await page.locator('.search-summary').textContent(), height: await page.evaluate(() => document.documentElement.scrollHeight) };
      if (!before) {
        const players = page.getByRole('button', { name: 'Players 6', exact: true });
        await players.focus(); await page.keyboard.press('Space');
        assert.equal(await players.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByRole('button', { name: /^Open tournament:/ }).count(), 0);
        assert.equal(await page.getByRole('button', { name: /^Open team:/ }).count(), 0);
        assert.equal(await page.getByRole('button', { name: /^Open player:/ }).count(), 6);
        record.search.firstSelectedPlayerY = await page.getByRole('button', { name: /^Open player:/ }).first().evaluate(e => e.getBoundingClientRect().top);
        await shot('search-players');
        await page.getByRole('button', { name: 'Teams 6', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: /^Open team:/ }).count(), 6);
        assert.equal(await page.getByText(/Football · Ready · 4 players/).count(), 6);
        await page.getByRole('button', { name: 'All 19', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: /^Open tournament:/ }).count(), 7);
        mode.failure = '/users/search'; await page.reload();
        await page.getByRole('button', { name: 'Retry players', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: /^Open tournament:/ }).count(), 7);
        assert.equal(await page.getByRole('button', { name: /^Open team:/ }).count(), 6);
        assert.equal(await page.getByText(/Nothing matched/).count(), 0); await shot('search-partial');
        await page.getByRole('button', { name: 'Players 0', exact: true }).click();
        mode.failure = ''; await page.getByRole('button', { name: 'Retry players', exact: true }).click();
        await page.getByRole('button', { name: 'Players 6', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Players 6', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByLabel('Search terms').inputValue(), 'Northside');
        if (width === 1440 && theme === 'dark') {
          await page.route('**/api/v1/me/invitations', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: Array.from({length:30}, (_,i) => ({ id:100+i,team:{id:200+i,name:`Northside Community Sporting Team ${i+1}`},invitedBy:{id:4,fullName:'Captain Northside'},expiresAt:'2099-12-01T00:00:00Z' })) }) }));
          await page.goto(origin + '/inbox'); await page.getByText('32 pending', { exact: true }).waitFor();
          const queue = page.getByRole('region', { name: 'Pending invitations and assignments', exact: true });
          record.dense = await queue.evaluate(e => ({ height:e.clientHeight, scrollHeight:e.scrollHeight, rows:e.querySelectorAll('.inbox-request-row').length }));
          assert(record.dense.scrollHeight > record.dense.height);
          await queue.focus();
          const controls = await queue.getByRole('button').count();
          for (let i=0;i<controls;i++) await page.keyboard.press('Tab');
          record.dense.keyboard = await queue.evaluate(e => { const buttons=e.querySelectorAll('button'); return { scrollTop:e.scrollTop, lastControlFocused:document.activeElement===buttons[buttons.length-1], visible:document.activeElement.getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom+1 }; });
          assert(record.dense.keyboard.lastControlFocused && record.dense.keyboard.visible); await shot('inbox-dense');
          await page.unroute('**/api/v1/me/invitations');
          mode.empty = true; await page.reload(); await page.getByText('Nothing waiting on you', { exact: true }).waitFor(); await shot('inbox-empty');
          await page.goto(origin + '/search/Nothing'); await page.getByText('Nothing matched “Nothing”', { exact: true }).waitFor(); await shot('search-empty');
        }
      }
      assert.deepEqual(errors, []); records.push(record); await context.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out,'measurements.json'), JSON.stringify(records,null,2)); }
  console.log(JSON.stringify(records,null,2));
})().catch(e => { console.error(e); process.exitCode = 1 });
