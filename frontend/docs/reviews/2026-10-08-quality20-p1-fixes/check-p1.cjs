const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
process.env.NODE_PATH = '/private/tmp/ltms-ticket1-browser/node_modules';
require('node:module').Module._initPaths();
const kit = require('../2026-10-07-ux-ui-fanout/browser-kit.cjs');
const phase = process.argv[2] || 'after';
const out = path.join(__dirname, phase);
const origin = process.env.QUALITY20_ORIGIN || 'http://localhost:5185';
fs.mkdirSync(out, { recursive: true });

async function contrast(locator) {
  return locator.evaluate(e => {
    const s = getComputedStyle(e);
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = value => rgb(value).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const a = luminance(s.color), b = luminance(s.backgroundColor);
    return { text: e.textContent, foreground: s.color, background: s.backgroundColor, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
  });
}

(async () => {
  const browser = await kit.chromium.launch({ headless: true, executablePath: kit.executablePath });
  const records = [], failures = [];
  try {
    for (const [width, height] of [[320, 844], [390, 844], [1280, 800], [1440, 900], [700, 844], [701, 844]]) {
      for (const theme of ['dark', 'light']) {
        for (const name of ['home', 'team', 'admin']) {
          const context = await browser.newContext({ viewport: { width, height } });
          try {
            await context.addInitScript(t => localStorage.setItem('ltms-theme', t), theme);
            const page = await context.newPage(), errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.route('**/api/v1/**', r => r.abort());
            if (name === 'admin') {
              await page.route('**/src/api/client.ts*', async r => {
                const response = await r.fetch();
                await r.fulfill({ response, body: (await response.text()).replace(/export const USE_MOCK = .*?;/, 'export const USE_MOCK = false;') });
              });
              await kit.fixture07(page, {});
            } else {
              await page.goto(origin + '/login');
              await page.evaluate(async id => {
                const store = await import('/src/shared/store.ts'), auth = await import('/src/api/user.ts');
                const bridge = await import('/src/mocks/storeBridge.ts');
                store.login(id); auth.setMockCurrentUser(bridge.numOf(id));
              }, name === 'team' ? 'u-lead' : 'u-play');
            }
            await page.goto(origin + (name === 'admin' ? '/admin/requests' : name === 'team' ? '/team/t-byt' : '/'));
            await page.locator('main h1').waitFor();
            await page.evaluate(() => document.fonts.ready);
            const record = { name, width, height, theme, errors };
            if (name === 'admin') {
              const heading = page.getByRole('heading', { name: /Tournament requests/ });
              await heading.waitFor();
              record.headingTop = await heading.evaluate(e => e.getBoundingClientRect().top);
              record.approveTop = await page.getByRole('button', { name: 'Approve', exact: true }).first().evaluate(e => e.getBoundingClientRect().top);
              record.navigationVisible = await page.getByRole('navigation', { name: 'Admin sections' }).isVisible();
              if (width <= 700) {
                const trigger = page.getByRole('button', { name: 'Sections: Tournament requests', exact: true });
                if (!await trigger.count()) failures.push(`${width}/${theme}: mobile section disclosure absent`);
                else {
                  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
                  assert.equal(record.navigationVisible, false);
                  assert(record.headingTop < height * .65, 'Current task heading must precede the unused navigation');
                  await trigger.focus(); await page.keyboard.press('Enter');
                  const nav = page.getByRole('navigation', { name: 'Admin sections' });
                  await nav.waitFor();
                  assert.equal(await nav.getByRole('link').count(), 10);
                  await nav.getByRole('link', { name: 'Rule changes', exact: true }).click();
                  await page.getByRole('button', { name: 'Sections: Rule changes', exact: true }).waitFor();
                  await page.waitForFunction(() => document.activeElement?.id === 'admin-workspace');
                  assert.equal(await nav.isVisible(), false);
                  record.selectedRoute = new URL(page.url()).pathname;
                  assert.equal(record.selectedRoute, '/admin/filters');
                  record.workspaceFocused = true;
                  const selected = page.getByRole('button', { name: 'Sections: Rule changes', exact: true });
                  await selected.focus(); await page.keyboard.press('Space'); await nav.waitFor();
                  await page.keyboard.press('Space'); await nav.waitFor({ state: 'hidden' });
                  record.keyboardToggle = true;
                  await page.setViewportSize({ width: 1280, height: 800 });
                  await nav.waitFor(); assert.equal(await nav.getByRole('link').count(), 10);
                  await page.setViewportSize({ width, height });
                  await selected.waitFor(); assert.equal(await selected.getAttribute('aria-expanded'), 'false');
                  assert.equal(await nav.isVisible(), false);
                  record.resizeRestoresCollapsed = true;
                  await page.goto(origin + '/admin/requests'); await heading.waitFor();
                }
              } else {
                assert.equal(record.navigationVisible, true);
                assert.equal(await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link').count(), 10);
              }
            } else {
              if (name === 'home' && width <= 820) {
                await page.getByRole('button', { name: 'Open navigation menu' }).click();
                await page.getByRole('dialog', { name: 'LTMS menu' }).waitFor();
                record.navigationMenuOpened = true;
              }
              const selector = name === 'home' ? '.sb .item .pill, .bell i' : '.form-guide span';
              const badges = page.locator(selector);
              await badges.first().waitFor();
              if (name === 'team') {
                await page.locator('.form-guide').first().evaluate(e => {
                  if (!e.querySelector('.L')) {
                    const loss = document.createElement('span'); loss.className = 'L'; loss.textContent = 'L';
                    loss.dataset.testFixture = 'missing-loss-style'; e.appendChild(loss);
                  }
                });
              }
              record.badges = [];
              for (let i = 0; i < await badges.count(); i++) {
                if (!await badges.nth(i).isVisible()) continue;
                const color = await contrast(badges.nth(i)); record.badges.push(color);
                if (color.ratio < 4.5) failures.push(`${name}/${width}/${theme}: ${color.text} contrast ${color.ratio.toFixed(2)}`);
              }
              assert(record.badges.length > 0, 'Must measure visible badges');
            }
            record.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
            assert.equal(record.overflow, false); assert.deepEqual(errors, []);
            await page.screenshot({ path: path.join(out, `${name}-${width}-${theme}.png`), fullPage: true });
            records.push(record);
          } finally { await context.close(); }
        }
      }
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify({ phase, origin, records, failures }, null, 2) + '\n');
  }
  assert.deepEqual(failures, [], 'P1 contrast and mobile disclosure acceptance');
  console.log(`P1 checks passed: ${records.length} route/theme/viewport records`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
