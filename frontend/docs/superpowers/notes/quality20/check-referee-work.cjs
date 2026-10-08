// Isolated HTTP fixtures only. No live API or visible browser data is mutated.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.NODE_PATH = '/private/tmp/ltms-ticket1-browser/node_modules'; require('node:module').Module._initPaths();
const { chromium, executablePath, fixture06 } = require('../../../reviews/2026-10-07-ux-ui-fanout/browser-kit.cjs');
const out = path.join(__dirname, process.env.LTMS_QA_OUTPUT || 'q15-redesign'); fs.mkdirSync(out, { recursive: true });
const records = [], origin = 'http://127.0.0.1:5183';
const teamA = 'Northside Community Championship Football Team';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height, theme] of [[1440,900,'dark'], [1440,900,'light'], [1280,800,'dark'], [390,844,'dark'], [390,844,'light'], [1440,560,'dark']]) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
      await context.addInitScript(t => localStorage.setItem('ltms-theme', t), theme);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/v1/**', route => route.abort());
      await page.route('**/src/api/client.ts', async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/export const USE_MOCK = .*?;/, 'export const USE_MOCK = false;');
        await route.fulfill({ response, body });
      });
      const requests = await fixture06(page, {});
      const record = { width, height, theme, errors };
      async function shot(name) {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(180);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + ' page overflow');
        await page.screenshot({ path: path.join(out, `${name}-${width}-${height}-${theme}.png`), fullPage: name !== 'review' });
      }
      await page.goto(origin + '/matches');
      const queue = page.getByRole('region', { name: 'Needs your score', exact: true });
      await queue.waitFor();
      assert.equal(await queue.getByRole('button', { name: 'Record result', exact: true }).count(), 30);
      assert.equal(await page.getByRole('button', { name: 'Scores 30', exact: true }).getAttribute('aria-pressed'), 'true');
      record.queue = await queue.evaluate(e => ({ width: e.clientWidth, height: e.clientHeight, scrollHeight: e.scrollHeight,
        columns: getComputedStyle(e).gridTemplateColumns.split(' ').length,
        cards: [...e.querySelectorAll('.refcard')].map(card => ({ width: card.clientWidth, height: card.clientHeight,
          overflow: card.scrollHeight > card.clientHeight + 1,
          actionInCard: card.querySelector('.refcard-actions').getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom })),
        firstCardY: e.querySelector('.refcard').getBoundingClientRect().top,
        firstActionY: e.querySelector('.refcard .primary').getBoundingClientRect().top,
        initiallyVisibleActions: [...e.querySelectorAll('.refcard .primary')].filter(button => {
          const b = button.getBoundingClientRect(), queue = e.getBoundingClientRect();
          return b.top >= Math.max(0, queue.top) && b.bottom <= Math.min(innerHeight, queue.bottom);
        }).length }));
      assert.equal(record.queue.columns, width < 820 ? 1 : 2);
      assert(record.queue.scrollHeight > record.queue.height);
      assert(record.queue.cards.every(card => !card.overflow && card.actionInCard));
      await shot('queue');
      // Native Tab reaches both actions on every task and scrolls the queue.
      await queue.focus();
      for (let i = 0; i < 60; i++) await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.activeElement === document.querySelector('.refcard:last-child .refcard-actions .btn:last-child')));
      record.keyboard = await queue.evaluate(e => ({ scrollTop: e.scrollTop, activeVisible: document.activeElement.getBoundingClientRect().bottom <= e.getBoundingClientRect().bottom + 1 }));
      assert(record.keyboard.scrollTop > 0 && record.keyboard.activeVisible);
      await page.getByRole('button', { name: 'Rooms 0', exact: true }).click();
      assert.equal(await page.locator('.match-bucket-scroll').count(), 1);
      assert.equal(await page.locator('.refcard').count(), 0);
      await shot('empty-category');
      await page.getByRole('button', { name: 'Scores 30', exact: true }).click();
      await queue.getByRole('button', { name: 'Record result', exact: true }).first().click();
      await page.getByRole('button', { name: 'Review result', exact: true }).waitFor();
      const form = page.locator('.match-result-form');
      const table = page.getByRole('region', { name: 'Player statistics entry', exact: true });
      assert.equal(await table.locator('tbody tr').count(), 48);
      assert.equal(await table.locator('input').count(), 480);
      await form.getByLabel(teamA, { exact: true }).fill('3');
      await form.getByRole('combobox', { name: 'Statistics team', exact: true }).selectOption('12');
      await form.getByRole('searchbox', { name: 'Find player', exact: true }).fill('Nobody');
      assert.equal(await page.locator('#stat-700-goals').count(), 0);
      const statisticProblem = page.getByRole('link', { name: `Check ${teamA} statistics`, exact: true });
      if (await statisticProblem.count()) {
        await statisticProblem.click();
        await page.waitForFunction(() => document.activeElement?.id === 'stat-700-goals');
        record.hiddenStatisticValidation = 'rendered';
      } else {
        // Existing real adapter supplies sportName="", so sport-specific totals
        // are exercised with complete DTOs in ResultForm.workspace.test.tsx.
        record.hiddenStatisticValidation = 'unit coverage; real adapter has no sport name';
        await page.getByRole('button', { name: 'Clear player filters', exact: true }).click();
        await form.getByLabel(teamA, { exact: true }).fill('0');
        await page.getByRole('link', { name: /Enter a winning score/ }).click();
        assert(await page.locator('#sc-a').evaluate(e => e === document.activeElement));
        await form.getByLabel(teamA, { exact: true }).fill('3');
      }
      assert.equal(await form.getByRole('searchbox', { name: 'Find player', exact: true }).inputValue(), '');
      await page.locator('#stat-700-goals').fill('3');
      await form.scrollIntoViewIfNeeded();
      record.form = await page.getByRole('region', { name: 'Result entry fields', exact: true }).evaluate(e => ({ height: e.clientHeight, scrollHeight: e.scrollHeight, width: e.clientWidth, scrollWidth: e.scrollWidth,
        footerOutside: !e.contains(document.querySelector('.match-result-footer')),
        scoreBeforeStats: !!(document.querySelector('.match-score-inputs').compareDocumentPosition(document.querySelector('.match-result-form .tblwrap')) & Node.DOCUMENT_POSITION_FOLLOWING) }));
      assert(record.form.scrollHeight > record.form.height && record.form.footerOutside && record.form.scoreBeforeStats);
      assert(await page.locator('.match-result-footer').evaluate(e => {
        const frame = e.closest('.match-section').getBoundingClientRect();
        return e.getBoundingClientRect().bottom <= frame.bottom;
      }), 'Result footer must remain visible outside the scrolling fields');
      await shot('result-form');
      await form.getByRole('combobox', { name: 'Statistics team', exact: true }).selectOption('12');
      await form.getByRole('searchbox', { name: 'Find player', exact: true }).fill('Player 24 ');
      assert.equal(await table.locator('tbody tr').count(), 1);
      await page.getByRole('button', { name: 'Clear player filters', exact: true }).click();
      assert.equal(await page.locator('#stat-700-goals').inputValue(), '3');
      assert.equal(await form.getByLabel(teamA, { exact: true }).inputValue(), '3');
      if (width === 1440 && height === 900 && theme === 'dark') {
        const fields = page.getByRole('region', { name: 'Result entry fields', exact: true });
        await fields.focus();
        // Two scores, two filters, the horizontal table region, then 480 inputs.
        for (let i = 0; i < 485; i++) await page.keyboard.press('Tab');
        assert(await page.locator('#stat-823-stat9').evaluate(e => e === document.activeElement));
        record.statisticsKeyboard = await fields.evaluate(e => ({ scrollTop: e.scrollTop,
          activeVisible: document.activeElement.getBoundingClientRect().bottom <= e.getBoundingClientRect().bottom + 1 }));
        assert(record.statisticsKeyboard.scrollTop > 0 && record.statisticsKeyboard.activeVisible);
        await page.keyboard.press('Tab');
        assert(await page.locator('.match-result-footer>.btn').evaluate(e => e === document.activeElement));
      }
      await page.getByRole('button', { name: 'Review result', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Review result', exact: true });
      await dialog.waitFor();
      record.reviewFooter = await page.locator('.match-dialog-footer').evaluate(e => ({ top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom, viewport: innerHeight }));
      assert(record.reviewFooter.top >= 0 && record.reviewFooter.bottom <= height);
      await shot('review');
      if (width === 1440 && height === 900 && theme === 'dark') {
        await dialog.getByRole('button', { name: 'Submit result', exact: true }).click();
        await dialog.getByRole('alert').waitFor();
        assert.match(await dialog.getByRole('alert').textContent(), /draft is retained/);
        record.failedSubmit = requests.writes;
        assert.equal(requests.writes.length, 1);
        await dialog.getByRole('button', { name: 'Back to edit', exact: true }).click();
        assert.equal(await page.locator('#stat-700-goals').inputValue(), '3');
      } else assert.equal(requests.writes.length, 0);
      assert.equal(requests.fallbackWrites.length, 0);
      assert.deepEqual(errors, []);
      records.push(record);
      await context.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify(records, null, 2)); }
  console.log(JSON.stringify(records.map(({ width, height, theme, queue, keyboard, errors }) => ({ width, height, theme, columns: queue.columns, cardHeight: queue.cards[0].height, firstActionY: queue.firstActionY, initiallyVisibleActions: queue.initiallyVisibleActions, keyboard, errors })), null, 2));
})().catch(error => { console.error(error); process.exitCode = 1 });
