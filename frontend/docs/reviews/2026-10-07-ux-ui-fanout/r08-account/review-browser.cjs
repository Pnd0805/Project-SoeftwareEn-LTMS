process.env.LTMS_QA_ORIGIN = 'http://127.0.0.1:5176';

const { chromium, executablePath, fixture08a } = require('../browser-kit.cjs');
const path = require('node:path');

const origin = 'http://127.0.0.1:5176';
const evidence = path.resolve(__dirname);
const apiRequests = [];

async function ready(page) {
  await page.evaluate(() => document.fonts.ready);
}

async function screenshot(page, name, fullPage = true) {
  await ready(page);
  await page.screenshot({ path: path.join(evidence, name), fullPage });
}

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const page = await context.newPage();
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/v1/')) {
      apiRequests.push({ method: request.method(), path: url.pathname, body: request.postData() || null });
    }
  });

  const fixture = { signedIn: true };
  await fixture08a(page, fixture); // Registers all API/storage routes before the first navigation.

  await page.goto(`${origin}/register`);
  await page.locator('h1').waitFor();
  await screenshot(page, 'register-default-1280-dark.png');

  await page.getByLabel('Full name').fill('Review Applicant');
  await page.getByLabel('Email', { exact: true }).fill('review@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Review1234');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.locator('#register-email-error').waitFor();
  await screenshot(page, 'register-server-validation-1280-dark.png');

  await page.goto(`${origin}/login`);
  await page.locator('h1').waitFor();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('#login-email-error').waitFor();
  const loginErrors = await page.locator('.account-form .error').allTextContents();
  await screenshot(page, 'login-client-validation-1280-dark.png');

  await page.goto(`${origin}/me`);
  await page.locator('.account-profile-heading').waitFor();
  await page.locator('.account-profile .tblwrap').first().waitFor();
  await screenshot(page, 'profile-default-1280-dark.png');

  await page.getByLabel('Choose profile photo').setInputFiles({
    name: 'review-avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fixture avatar bytes'),
  });
  await page.getByRole('status').filter({ hasText: 'Photo saved.' }).waitFor();
  await screenshot(page, 'profile-avatar-saved-1280-dark.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/me`);
  await page.locator('.account-profile-heading').waitFor();
  const mobile = await page.evaluate(() => {
    const record = document.querySelector('.account-profile .split > .rail > .panel');
    const squads = document.querySelector('.tblwrap[aria-label="My squads"]');
    const history = document.querySelector('.tblwrap[aria-label="My tournament history"]');
    const rect = element => {
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top + scrollY), height: Math.round(box.height) };
    };
    return {
      recordPosition: record ? rect(record) : null,
      squadScroll: squads ? {
        clientWidth: squads.clientWidth,
        scrollWidth: squads.scrollWidth,
        tabIndex: squads.tabIndex,
        ariaLabel: squads.getAttribute('aria-label'),
      } : null,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    };
  });
  await screenshot(page, 'profile-mobile-390-dark.png');

  const registerBody = apiRequests.find(request => request.path === '/api/v1/auth/register')?.body;
  process.stdout.write(JSON.stringify({
    apiRequests,
    registerBody: registerBody ? JSON.parse(registerBody) : null,
    loginErrors,
    mobile,
    apiInterception: 'fixture08a intercepted API and storage requests before first navigation',
  }, null, 2) + '\n');

  await context.close();
  await browser.close();
}

run().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
