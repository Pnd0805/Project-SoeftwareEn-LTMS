const fs = require('node:fs');
const path = require('node:path');
const { chromium, executablePath, fixture08b, mockLogin } = require('../browser-kit.cjs');

const outDir = __dirname;
const mockOrigin = 'http://127.0.0.1:5175';
const realFixtureOrigin = 'http://127.0.0.1:5176';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function measure(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    const activeName = active?.getAttribute('aria-label') || active?.innerText?.trim().replace(/\s+/g, ' ').slice(0, 100) || active?.tagName || null;
    const boxes = [...document.querySelectorAll('button, a, input, select, textarea, [role="button"]')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map(el => {
        const r = el.getBoundingClientRect();
        return { name: el.getAttribute('aria-label') || el.innerText?.trim().replace(/\s+/g, ' ').slice(0, 50) || el.tagName,
          width: Math.round(r.width), height: Math.round(r.height), role: el.getAttribute('role') || el.tagName.toLowerCase() };
      });
    const overflows = [...document.querySelectorAll('body *')].filter(el => {
      const style = getComputedStyle(el), r = el.getBoundingClientRect();
      return (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1 && r.width > 0;
    }).slice(0, 30).map(el => ({ className: String(el.className || '').slice(0, 90), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    return { viewport: { width: innerWidth, height: innerHeight }, document: { clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight }, activeName, activeTag: active?.tagName || null,
      activeRole: active?.getAttribute('role') || null, visibleTargetCount: boxes.length,
      targetsBelow44: boxes.filter(b => b.height < 44 || b.width < 44).slice(0, 40), scrollRegions: overflows };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const report = { previews: [], interactions: [], limitations: ['Fixture handlers intercept all /api/v1 requests; no live backend was contacted.', 'The 640x400 viewport models the CSS viewport available at 200% zoom from a 1280x800 desktop; it does not change browser device scale.'] };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const mockPage = await context.newPage();
    await mockLogin(mockPage, 'u-play');
    await mockPage.goto(mockOrigin + '/');
    await mockPage.getByRole('heading', { name: /Home/i }).waitFor();
    await mockPage.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await sleep(250);
    await mockPage.screenshot({ path: path.join(outDir, 'shell-keyboard-1440-dark.png'), fullPage: false });
    await mockPage.keyboard.press('Tab');
    const firstStop = await measure(mockPage);
    await mockPage.keyboard.press('Enter');
    await sleep(100);
    const skipResult = await mockPage.evaluate(() => ({ activeId: document.activeElement?.id || null,
      activeTag: document.activeElement?.tagName || null, activeText: document.activeElement?.innerText?.trim().slice(0, 80) || null }));
    report.interactions.push({ name: 'Signed-in shell skip to main', firstStop, afterActivate: skipResult });

    const previewOpener = mockPage.locator('button[aria-haspopup="dialog"]').first();
    await previewOpener.waitFor();
    const previewName = await previewOpener.innerText();
    await previewOpener.click();
    const mockDialog = mockPage.getByRole('dialog');
    await mockDialog.waitFor();
    await sleep(250);
    const mockDialogDetails = await mockDialog.evaluate(el => ({ label: el.getAttribute('aria-label'), labelledby: el.getAttribute('aria-labelledby'),
      title: el.querySelector('h1,h2,h3,[role="heading"]')?.innerText?.trim() || null,
      firstFocused: el.contains(document.activeElement), activeText: document.activeElement?.innerText?.trim() || null,
      clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, overflowY: getComputedStyle(el).overflowY }));
    await mockPage.screenshot({ path: path.join(outDir, 'tournament-preview-keyboard-1440-dark.png'), fullPage: false });
    for (let i = 0; i < 14; i++) { await mockPage.keyboard.press('Tab'); await sleep(80); }
    const mockDialogAfterTabs = await mockPage.evaluate(() => ({ dialogCount: document.querySelectorAll('[role="dialog"]').length,
      inside: !!document.querySelector('[role="dialog"]')?.contains(document.activeElement),
      activeName: document.activeElement?.getAttribute('aria-label') || document.activeElement?.innerText?.trim().slice(0, 80) || document.activeElement?.tagName }));
    await mockPage.keyboard.press('Escape');
    await sleep(250);
    const mockEscapeReturn = await mockPage.evaluate(() => ({ dialogCount: document.querySelectorAll('[role="dialog"]').length,
      activeText: document.activeElement?.innerText?.trim().replace(/\s+/g, ' ').slice(0, 100), activeTag: document.activeElement?.tagName }));
    await previewOpener.click();
    await mockDialog.waitFor();
    await sleep(200);
    await mockPage.locator('.modal-bg').click({ position: { x: 4, y: 4 } });
    await sleep(250);
    const mockBackdropReturn = await mockPage.evaluate(() => ({ dialogCount: document.querySelectorAll('[role="dialog"]').length,
      activeText: document.activeElement?.innerText?.trim().replace(/\s+/g, ' ').slice(0, 100), activeTag: document.activeElement?.tagName }));
    report.interactions.push({ name: 'Mock tournament preview dialog', openerText: previewName, dialogDetails: mockDialogDetails,
      after14SettledTabs: mockDialogAfterTabs, afterEscape: mockEscapeReturn, afterBackdrop: mockBackdropReturn });

    await mockPage.setViewportSize({ width: 640, height: 400 });
    await sleep(150);
    await mockPage.screenshot({ path: path.join(outDir, 'home-200pct-reflow-640x400.png'), fullPage: false });
    report.previews.push({ route: '/', viewport: '640x400 CSS px (200% zoom equivalent)', ...(await measure(mockPage)) });
    await mockPage.setViewportSize({ width: 390, height: 844 });
    await sleep(150);
    await mockPage.screenshot({ path: path.join(outDir, 'home-narrow-390x844-dark.png'), fullPage: false });
    report.previews.push({ route: '/', viewport: '390x844', ...(await measure(mockPage)) });
    const narrowOpener = mockPage.locator('button[aria-haspopup="dialog"]').first();
    await narrowOpener.click();
    await mockDialog.waitFor();
    await sleep(250);
    await mockPage.screenshot({ path: path.join(outDir, 'tournament-preview-narrow-390x844-dark.png'), fullPage: false });
    report.previews.push({ route: '/ (tournament preview dialog)', viewport: '390x844', ...(await measure(mockPage)) });
    report.interactions.push({ name: 'Mock tournament preview dialog at 390x844', details: await mockDialog.evaluate(el => ({ clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
      box: (() => { const r=el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }; })(),
      footer: [...el.querySelectorAll('button,a')].map(e => ({ text: e.innerText.trim(), visible: e.getBoundingClientRect().bottom <= innerHeight && e.getBoundingClientRect().top >= 0 })) })) });
    await context.close();

    const realContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const searchPage = await realContext.newPage();
    const fixtureMode = {};
    await fixture08b(searchPage, fixtureMode);
    await searchPage.goto(realFixtureOrigin + '/search/Northside');
    const resultButton = searchPage.getByRole('button', { name: /^Open tournament:/ }).first();
    await resultButton.waitFor();
    await searchPage.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await sleep(300);
    const searchInitialFocus = await searchPage.evaluate(() => ({ id: document.activeElement?.id || null, tag: document.activeElement?.tagName || null }));
    await searchPage.keyboard.press('Tab');
    const searchSecondFocus = await searchPage.evaluate(() => ({ id: document.activeElement?.id || null, tag: document.activeElement?.tagName || null }));
    await searchPage.keyboard.press('Tab');
    const searchThirdFocus = await searchPage.evaluate(() => ({ text: document.activeElement?.getAttribute('aria-label') || document.activeElement?.innerText?.trim().slice(0, 100), tag: document.activeElement?.tagName || null }));
    await searchPage.keyboard.press('Enter');
    await searchPage.waitForURL('**/t/42');
    await sleep(250);
    await searchPage.screenshot({ path: path.join(outDir, 'search-keyboard-route-1440-dark.png'), fullPage: false });
    report.interactions.push({ name: 'Real fixture search keyboard path', initialFocus: searchInitialFocus, secondTab: searchSecondFocus,
      thirdTab: searchThirdFocus, destination: new URL(searchPage.url()).pathname });

    await searchPage.setViewportSize({ width: 390, height: 844 });
    await searchPage.goto(realFixtureOrigin + '/search/Northside');
    await searchPage.getByRole('button', { name: /^Open tournament:/ }).first().waitFor();
    await searchPage.evaluate(() => document.documentElement.dataset.theme = 'light');
    await sleep(200);
    report.previews.push({ route: '/search/Northside', viewport: '390x844 real fixture', ...(await measure(searchPage)) });

    await realContext.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, 'browser-observations.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
