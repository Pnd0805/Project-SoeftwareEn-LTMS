// Isolated HTTP fixtures. All API requests are intercepted; no live backend.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.NODE_PATH = '/private/tmp/ltms-ticket1-browser/node_modules'; require('node:module').Module._initPaths();
const { chromium, executablePath, fixture05 } = require('../../../reviews/2026-10-07-ux-ui-fanout/browser-kit.cjs');
const before = process.env.LTMS_QA_BEFORE === 'true';
const out = path.join(__dirname, before ? 'q16-before' : 'q16-after'); fs.mkdirSync(out, { recursive: true });
const records = [];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height, theme] of [[1440,900,'dark'], [1440,900,'light'], [1280,800,'dark'], [390,844,'light']]) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(t => localStorage.setItem('ltms-theme', t), theme);
      const page = await context.newPage(), errors = [], failedWrites = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/v1/**', r => r.abort());
      await page.route('**/src/api/client.ts', async r => {
        const response = await r.fetch();
        await r.fulfill({ response, body: (await response.text()).replace(/export const USE_MOCK = .*?;/, 'export const USE_MOCK = false;') });
      });
      const writes = await fixture05(page, {});
      async function shot(name) {
        await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(180);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' overflow');
        await page.screenshot({ path: path.join(out, `${name}-${width}-${theme}.png`), fullPage: true });
      }
      await page.goto('http://127.0.0.1:5183/request');
      await page.getByLabel('Name', { exact: true }).waitFor();
      await shot('request');
      const request = await page.locator('.organizer-request-form').evaluate(e => ({ height: document.querySelector('button[type=submit]').getBoundingClientRect().bottom - e.getBoundingClientRect().top,
        firstFieldY: e.querySelector('input').getBoundingClientRect().top,
        sendY: document.querySelector('button[type=submit]').getBoundingClientRect().top,
        headings: [...e.querySelectorAll('h2')].map(h => h.textContent) }));
      if (!before) {
        assert.deepEqual(request.headings, ['Tournament', 'Schedule', 'Eligibility']);
        const footerRows = await page.locator('.request-actions button').evaluateAll(buttons => buttons.map(e => e.getBoundingClientRect().top));
        assert.equal(footerRows[0], footerRows[1]);
        await page.getByLabel('Name', { exact: true }).fill('Community Cup');
        await page.getByLabel('Default venue').fill('Court 1');
        await page.getByLabel(/Organising faculty/).selectOption('1');
        await page.getByRole('radio', { name: 'Only the faculty running it' }).click();
        await page.getByLabel('Year 2', { exact: true }).check();
        const summary = page.getByRole('complementary', { name: 'Request review summary' });
        await summary.getByText('Community Cup', { exact: true }).waitFor();
        assert.match(await summary.textContent(), /Engineering.*Year 2/s);
        const reviewStyle = await summary.locator('dd').first().evaluate(e => ({ color: getComputedStyle(e).color,
          background: getComputedStyle(e.closest('.panel')).backgroundColor }));
        request.reviewStyle = reviewStyle;
        await summary.focus();
        await page.keyboard.press('End');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Cancel');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Send the request');
        await page.route('**/api/v1/tournaments', async r => {
          if (r.request().method() === 'POST') {
            failedWrites.push(JSON.parse(r.request().postData()));
            await r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'UNAVAILABLE', message: 'Try sending again.' }) });
          } else await r.fallback();
        });
        await page.getByRole('button', { name: 'Send the request', exact: true }).click();
        await page.getByText('Could not send the request.', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Community Cup');
        assert.equal(await page.getByLabel('Default venue').inputValue(), 'Court 1');
        assert.equal(await page.getByLabel('Year 2', { exact: true }).isChecked(), true);
        assert.equal(failedWrites.length, 1);
        assert.deepEqual(failedWrites[0].eligibilityRules, [{ type: 'faculty', value: 1 }, { type: 'year', value: 2 }]);
        await shot('request-recovery');
      }
      await page.goto('http://127.0.0.1:5183/t/42/manage/referees');
      await page.getByRole('region', { name: 'Accepted appointments', exact: true }).waitFor();
      if (!before) {
        await page.getByText('6 accepted', { exact: true }).waitFor();
        assert.equal(await page.getByText('2 required per match', { exact: true }).count(), 1);
        assert.equal(await page.getByText('6 of 2 accepted', { exact: true }).count(), 0);
      }
      await shot('staffing');
      const staffing = await page.locator('.organizer-section:not([hidden])').innerText();
      await page.route('**/api/v1/tournaments/42/referees', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'UNAVAILABLE', message: 'Referee source unavailable.' }) }));
      await page.reload();
      await page.getByText("Couldn't load the referees.", { exact: true }).waitFor();
      assert.equal(await page.getByText('6 accepted', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Try again', exact: true }).count(), 1);
      await shot('staffing-error');
      assert.deepEqual(errors, []); assert.equal(writes.length, 0);
      records.push({ width, height, theme, request, staffing, retainedDraftAfterFailure: !before, failedWrites, errors });
      await context.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify(records, null, 2)); }
  console.log(JSON.stringify(records.map(({ width, theme, request, errors }) => ({ width, theme, request, errors })), null, 2));
})().catch(e => { console.error(e); process.exitCode = 1 });
