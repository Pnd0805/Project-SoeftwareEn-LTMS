// Run against a mock-only Vite preview on 5177. Uses the existing demo dataset.
const { chromium } = require('playwright');
const fs = require('node:fs'), assert = require('node:assert/strict');
const executablePath = process.env.LTMS_QA_BROWSER || '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const origin = process.env.LTMS_QA_ORIGIN || 'http://127.0.0.1:5177';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath }), checks = [];
  try {
    for (const [width, height] of [[1280,800],[1440,900],[390,844]]) for (const theme of ['dark','light']) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(t => localStorage.setItem('ltms-theme', t), theme);
      const page = await context.newPage(), errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/v1/**', route => { requests.push(route.request().url()); return route.abort(); });
      await page.goto(origin + '/login');
      await page.getByRole('button', { name: 'Reset demo data' }).waitFor();
      assert.equal(await page.locator('.account-demo .who').count(), 5);
      assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), 'player@ltms.test');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${__dirname}/mock-login-${width}-${theme}.png`, fullPage: true });
      await page.locator('.account-demo .who').last().click();
      await page.getByRole('button', { name: 'Signing in…' }).waitFor();
      assert.equal(await page.locator('.account-demo .who:disabled').count(), 5);
      try { await page.waitForURL(origin + '/', { timeout: 5000, waitUntil: 'commit' }); }
      catch (e) { console.error('Mock redirect diagnostic:', page.url(), await page.locator('body').innerText()); throw e; }
      await page.getByRole('link', { name: 'Open my profile' }).waitFor();
      await page.goto(origin + '/me');
      await page.locator('.account-profile-heading').waitFor();
      assert.equal(await page.locator('.account-profile').getByText('MVP votes received').count(), 1);
      const chooserEvent = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: /Upload photo|Change photo/ }).focus();
      await page.keyboard.press('Enter');
      const chooser = await chooserEvent;
      assert.equal(chooser.isMultiple(), false);
      await chooser.setFiles([]);
      await page.screenshot({ path: `${__dirname}/mock-profile-${width}-${theme}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []); assert.deepEqual(requests, []);
      checks.push({ width, height, theme, demoRoles: 5, demoPendingDisabled: true, playerRedirect: '/', mockProfile: true, keyboardNativeFileChooser: true, overflow: false, errors, backendRequests: requests });
      await context.close();
    }
  } finally { fs.writeFileSync(`${__dirname}/mock-checks.json`, JSON.stringify(checks, null, 2)); await browser.close(); }
  console.log(`${checks.length} mock-mode records; no backend requests, page overflow or runtime errors.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
