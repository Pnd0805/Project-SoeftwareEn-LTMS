// Isolated fixture contexts; never access the live API or the visible demo session.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.NODE_PATH = '/private/tmp/ltms-ticket1-browser/node_modules'; require('node:module').Module._initPaths();
const kit = require('../../../reviews/2026-10-07-ux-ui-fanout/browser-kit.cjs');
const before = process.argv[2] === 'before', interactions = process.argv[2] === 'interactions', out = path.join(__dirname, before ? 'q20-before' : 'q20-after'); fs.mkdirSync(out, { recursive: true });
const origin = 'http://127.0.0.1:5183', records = [];
const cases = [['guest', '/home/all', 'mock', null], ['player', '/', 'mock', 'u-play'], ['leader', '/team/t-byt', 'mock', 'u-lead'], ['organizer', '/request', 'fixture05', {}], ['referee', '/matches', 'fixture06', {}], ['admin', '/admin/requests', 'fixture07', {}], ['bracket', '/t/t-fb/bracket', 'mock', 'u-play']];
async function setup(page, fixture, mode) {
  await page.route('**/api/v1/**', r => r.abort());
  await page.route('**/src/api/client.ts*', async r => { const response = await r.fetch(); await r.fulfill({ response, body: (await response.text()).replace(/export const USE_MOCK = .*?;/, `export const USE_MOCK = ${fixture === 'mock'};`) }); });
  if (fixture !== 'mock') await kit[fixture](page, mode);
  else {
    await page.goto(origin + '/login'); await page.locator('h1').waitFor();
    await page.evaluate(async id => { const s = await import('/src/shared/store.ts'), a = await import('/src/api/user.ts'), { numOf } = await import('/src/mocks/storeBridge.ts'); if (id) { s.login(id); a.setMockCurrentUser(numOf(id)); } else { s.signout(); a.setMockCurrentUser(null); } }, mode);
  }
}
async function capture(page, id, dialog = false) {
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(180);
  await page.locator('main').waitFor();
  const layout = await page.evaluate(() => {
    const rect = e => e ? { top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height } : null;
    return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, main: rect(document.querySelector('main')), firstContent: rect(document.querySelector('main')?.firstElementChild), sidebar: rect(document.querySelector('.shell>.sb')), header: rect(document.querySelector('header')), scan: rect(document.querySelector('.scan-trigger')), profile: rect(document.querySelector('.tb .avatar')), search: rect(document.querySelector('.tb .search')), firstMatch: rect(document.querySelector('.tour-bracket-scroll .bnode')), menu: rect(document.querySelector('.shell-menu')), current: document.querySelector('nav [aria-current=page]')?.textContent };
  });
  if (!before) assert.equal(layout.overflow, false, id + ' overflow');
  if (!before && !dialog && layout.width < 500) { assert(layout.main.top <= 120, id + ' shell exceeds 120px'); if (layout.scan) { assert(layout.scan.height >= 44 && layout.profile.width >= 44 && layout.search.height >= 44, id + ' small touch target'); } }
  if (layout.width >= 1280 && !id.startsWith('guest')) assert.equal(layout.sidebar.width, 232);
  await page.screenshot({ path: path.join(out, id + '.png'), fullPage: !dialog }); records.push({ id, ...layout });
}
async function checkInteractions(page, id, width) {
  const menu = page.getByRole('button', { name: 'Open navigation menu' }), search = page.getByRole('textbox', { name: 'Search' });
  await page.getByRole('button', { name: 'Skip to the main content' }).focus();
  assert(await page.getByRole('button', { name: 'Skip to the main content' }).evaluate(e => e === document.activeElement));
  for (const target of [menu, page.getByRole('button', { name: 'Scan', exact: true }), page.getByRole('link', { name: 'Open my profile' }), search]) { await page.keyboard.press('Tab'); assert(await target.evaluate(e => e === document.activeElement)); }
  await search.fill('Campus Cup'); await page.setViewportSize({ width: 1280, height: 800 }); await page.getByRole('navigation', { name: 'Main navigation' }).waitFor(); assert.equal(await search.inputValue(), 'Campus Cup');
  await page.setViewportSize({ width, height: 844 }); await menu.waitFor(); assert.equal(await search.inputValue(), 'Campus Cup');
  await menu.click(); const dialog = page.getByRole('dialog', { name: 'LTMS menu' }); await dialog.waitFor();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme); await dialog.getByRole('button', { name: /Switch to .* mode/ }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('ltms-theme')), theme === 'dark' ? 'light' : 'dark');
  await dialog.getByRole('button', { name: /Switch to .* mode/ }).click(); await page.keyboard.press('Escape');
  await menu.click(); await page.setViewportSize({ width: 1280, height: 800 }); await dialog.waitFor({ state: 'hidden' });
  await page.setViewportSize({ width, height: 844 }); await menu.waitFor(); assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  await menu.click(); await dialog.getByRole('link', { name: /^Inbox/ }).click(); await page.waitForURL('**/inbox'); await dialog.waitFor({ state: 'hidden' });
  await menu.click(); assert.equal(await dialog.getByRole('link', { name: /^Inbox/ }).getAttribute('aria-current'), 'page'); await page.keyboard.press('Escape');
  await search.fill('Campus Cup'); await search.press('Enter'); await page.waitForURL('**/search/Campus%20Cup');
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Fixture camera unavailable', 'NotAllowedError'); }; });
  const scan = page.getByRole('button', { name: 'Scan', exact: true }); await scan.click(); const camera = page.getByRole('dialog', { name: 'Scan check-in QR' }); await camera.waitFor();
  const failure = camera.getByRole('alert'); await failure.waitFor();
  assert.match(await failure.innerText(), /Camera unavailable.*Fixture camera unavailable/);
  assert.equal(await camera.getByRole('alert').count(), 1); assert.equal(await camera.getByRole('status').count(), 0);
  await camera.getByRole('button', { name: 'Retry camera', exact: true }).waitFor(); await camera.getByLabel('Referee’s code').waitFor();
  await page.keyboard.press('Escape'); await camera.waitFor({ state: 'hidden' }); await page.waitForFunction(() => document.querySelector('.scan-trigger') === document.activeElement);
  await page.evaluate(() => Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true }));
  const chooserPromise = page.waitForEvent('filechooser'); await scan.click(); const chooser = await chooserPromise;
  assert.equal(await chooser.element().getAttribute('capture'), 'environment'); assert.equal(await chooser.element().getAttribute('accept'), 'image/*'); assert.equal(await camera.count(), 0);
  await page.evaluate(async () => { const s = await import('/src/shared/store.ts'); const state = s.getState(); state.users.find(u => u.id === 'u-play').name = 'Narin Northside Community Championship Sporting Academy With A Very Long Account Name'; s.commitStore(state); });
  await page.reload(); await menu.waitFor(); await menu.click(); await dialog.waitFor(); await dialog.getByText(/Narin Northside Community/).waitFor(); await capture(page, 'long-account-' + id, true); await page.keyboard.press('Escape');
  await page.evaluate(() => { for (const e of document.querySelectorAll('.tb input,.tb button,.mobile-context span')) { const size = parseFloat(getComputedStyle(e).fontSize); e.style.fontSize = `${size * 2}px`; } });
  await capture(page, 'enlarged-text-' + id, true);
  await menu.click(); await dialog.getByRole('button', { name: 'Log out', exact: true }).click(); await page.waitForURL('**/login');
  records.push({ id: 'interactions-' + id, headerKeyboardOrder: true, themePersists: true, searchDraftSurvivesResize: true, resizeClosesMenu: true, inboxAndSearchNavigation: true, secureCameraRecovery: true, insecureFileChooser: true, longAccount: true, simulatedDoubleText: true, logout: true, physicalIPhone: 'unverified' });
}
(async () => {
  const browser = await kit.chromium.launch({ headless: true, executablePath: kit.executablePath });
  try {
    for (const [width, height] of (interactions ? [[390, 844], [320, 844]] : [[390, 844], [320, 844], [1280, 800], [1440, 900]])) for (const theme of ['dark', 'light']) for (const [name, route, fixture, mode] of cases.filter(c => interactions ? c[0] === 'player' : width < 500 || ['guest', 'player', 'admin'].includes(c[0]))) {
      const context = await browser.newContext({ viewport: { width, height } }); await context.addInitScript(t => localStorage.setItem('ltms-theme', t), theme);
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, fixture, mode);
      await page.goto(origin + route); await page.locator('main').waitFor(); if (name !== 'guest') await page.locator('.scan-trigger').waitFor(); await page.waitForTimeout(600);
      const id = `${name}-${width}-${theme}`; await capture(page, id);
      if (!before && width < 500 && name !== 'guest') {
        const menu = page.getByRole('button', { name: 'Open navigation menu' }); await menu.focus(); await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'LTMS menu' }); await dialog.waitFor();
        await page.waitForFunction(() => document.querySelector('.shell-menu-close') === document.activeElement);
        assert.equal(await dialog.getByRole('link', { name: 'Admin', exact: true }).count(), name === 'admin' ? 1 : 0);
        if (name !== 'organizer') assert(await dialog.locator('[aria-current=page]').count());
        const targets = await dialog.locator('a,button').evaluateAll(es => es.map(e => ({ label: e.textContent || e.getAttribute('aria-label'), height: e.getBoundingClientRect().height })));
        assert(targets.every(t => t.height >= 44), id + ' menu touch targets');
        await capture(page, 'menu-' + id, true); await page.keyboard.press('Shift+Tab'); await page.waitForFunction(() => document.querySelector('.shell-menu')?.contains(document.activeElement));
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); await page.waitForFunction(() => document.querySelector('.mobile-menu-trigger') === document.activeElement);
        records.push({ id: 'keyboard-' + id, namedDialog: true, initialCloseFocus: true, focusContained: true, escapeReturns: true, targets });
      }
      if (interactions) await checkInteractions(page, id, width);
      assert.deepEqual(errors, [], id); await context.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, interactions ? 'interactions.json' : 'measurements.json'), JSON.stringify(records, null, 2)); }
  console.log(`${records.length} shell records; ${records.filter(r => r.overflow).length} page overflow cases.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
