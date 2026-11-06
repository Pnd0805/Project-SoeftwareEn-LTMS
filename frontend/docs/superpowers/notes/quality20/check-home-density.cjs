const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.NODE_PATH = '/private/tmp/ltms-ticket1-browser/node_modules'; require('node:module').Module._initPaths();
const { chromium, executablePath } = require('../../../reviews/2026-10-07-ux-ui-fanout/browser-kit.cjs');
const phase = process.argv[2] || 'after';
const out = path.join(__dirname, `q14-${phase}`); fs.mkdirSync(out, { recursive: true });
const records = [];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const width of [1280, 1440, 390]) for (const theme of ['dark', 'light']) for (const count of [0, 1, 30]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 800 : width === 390 ? 844 : 900 }, colorScheme: theme });
      await context.addInitScript(t => localStorage.setItem('ltms-theme', t), theme);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/v1/**', route => route.abort());
      await page.goto('http://localhost:5183/login');
      await page.locator('h1').waitFor();
      await page.evaluate(async count => {
        const store = await import('/src/shared/store.ts');
        const auth = await import('/src/api/user.ts');
        const { numOf } = await import('/src/mocks/storeBridge.ts');
        store.login('u-play'); auth.setMockCurrentUser(numOf('u-play'));
        const state = store.getState();
        const invitation = state.invites.find(i => i.user === 'u-play' && i.status === 'pending');
        if (!invitation) throw new Error('Missing seed invitation');
        state.invites = state.invites.filter(i => i.user !== 'u-play').concat(Array.from({ length: count }, (_, index) => ({ ...invitation, id: `q14-invite-${index}` })));
        store.commitStore();
      }, count);
      await page.goto('http://localhost:5183/');
      await page.locator('.home-workspace').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const measure = selector => {
          const element = document.querySelector(selector), box = element.getBoundingClientRect();
          return { y: box.y, width: box.width, height: box.height, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflowY: getComputedStyle(element).overflowY };
        };
        return {
          task: measure('.home-task-body'), next: measure('.home-next-body'),
          taskPanel: measure('.home-task-panel'), nextPanel: measure('.home-next-match'),
          firstCard: measure('.capsule'), taskCount: document.querySelectorAll('.home-task-list li').length,
          countText: document.querySelector('.home-task-count')?.textContent ?? '',
          overflow: document.documentElement.scrollWidth > innerWidth,
          nextEmpty: document.querySelector('.home-next-empty')?.textContent ?? '',
        };
      });
      assert.equal(metrics.taskCount, count);
      assert.equal(errors.length, 0); assert.equal(metrics.overflow, false);
      if (width > 820) {
        assert.equal(metrics.task.height, metrics.next.height);
        assert.equal(metrics.taskPanel.height, metrics.nextPanel.height);
      }
      if (phase === 'after' && width > 820 && count < 3) assert.ok(metrics.task.height < 320);
      if (count === 30) {
        assert.ok(metrics.task.scrollHeight > metrics.task.clientHeight);
        const last = page.locator('.home-task-list a').last();
        await last.focus(); await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => document.activeElement?.textContent.includes('View matches')));
        // Focus the final task to prove keyboard scrolling keeps its destination reachable.
        await last.focus();
        assert.ok(await last.evaluate(e => {
          const body = e.closest('.home-task-body').getBoundingClientRect(), box = e.getBoundingClientRect();
          return box.bottom <= body.bottom + 1 && box.top >= body.top - 1;
        }));
      }
      await page.evaluate(() => { document.activeElement?.blur(); document.querySelector('.home-task-body').scrollTop = 0; scrollTo(0, 0); });
      await page.screenshot({ path: path.join(out, `${count}-tasks-${width}-${theme}.png`), fullPage: true });
      records.push({ count, width, theme, errors, ...metrics }); await context.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify(records, null, 2)); }
  console.log(`${phase}: ${records.length} Home captures; equal desktop peers; accurate counts; bounded 30-task queue; no page errors or overflow`);
})().catch(error => { console.error(error); process.exitCode = 1; });
