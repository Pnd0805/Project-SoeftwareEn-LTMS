// Synthetic fixtures only: all API/storage requests are intercepted.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const origin = process.env.LTMS_QA_ORIGIN || 'http://127.0.0.1:5177';
const executablePath = process.env.LTMS_QA_BROWSER || '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const name = 'Alexandria Northside Community Sporting Academy Department of Software Engineering';
const me = { id: 9, fullName: name, email: 'alexandria.northside.software.engineering@example.test', userType: 'student', gender: 'other', birthDate: '2002-06-04', facultyId: 2, departmentId: 8, year: 3, totalPoints: 17, avatarUrl: '/fixture-photo.png', contactInfo: null, address: null };
const error = (code, message, fields) => ({ error: { code, message, ...(fields ? { fields } : {}) } });
const checks = [], writes = [];
async function fixture(page, mode) {
  await page.route('**/fixture-photo.png', route => route.fulfill({ status: 404, body: '' }));
  await page.route('https://fixture-storage.test/**', route => route.fulfill({ status: 200, body: '' }));
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1', '');
    let data, status = 200;
    if (req.method() !== 'GET') {
      const body = JSON.parse(req.postData() || '{}');
      writes.push({ path, method: req.method(), body });
      if (mode.hold) await mode.hold;
      if (path === '/auth/login' || path === '/auth/register') {
        status = 422; data = error('VALIDATION_FAILED', 'Fixture rejection', { email: 'This email is already registered. Please use another address or sign in to recover your existing account.' });
      } else if (path === '/uploads/presign') data = { uploadUrl: 'https://fixture-storage.test/avatar', objectKey: 'avatar/9/fixture.png' };
      else if (path === '/me' && mode.saveFailure) { status = 400; data = error('AVATAR_KEY_NOT_FOUND', 'Fixture: missing object'); }
      else if (path === '/me') { mode.avatar = body.avatarUrl; data = { ...me, avatarUrl: mode.avatar }; }
      else { status = 501; data = error('FIXTURE_UNHANDLED', path); }
    } else if (path === '/me') {
      if (!mode.signedIn) { status = 401; data = error('UNAUTHORIZED', 'Fixture: signed out'); }
      else data = { ...me, avatarUrl: mode.avatar === undefined ? me.avatarUrl : mode.avatar };
    } else if (path === '/faculties') {
      if (mode.referenceFailure) { status = 503; data = error('SOURCE_FAILED', 'Fixture: source unavailable'); }
      else data = { items: [{ id: 1, name: 'Science' }, { id: 2, name: 'Engineering and Northside Community Sporting Academy' }] };
    } else if (path === '/faculties/1/departments') data = { items: [{ id: 1, facultyId: 1, name: 'Mathematics' }] };
    else if (path === '/faculties/2/departments') data = { items: [{ id: 7, facultyId: 2, name: 'Civil Engineering' }, { id: 8, facultyId: 2, name: 'Software Engineering and Interdisciplinary Sporting Systems' }] };
    else if (path === '/sport-types') data = { items: [{ id: 1, name: 'Football' }] };
    else if (path === '/users/9/stats') {
      if (mode.statsFailure) { status = 503; data = error('SOURCE_FAILED', 'Fixture: statistics unavailable'); }
      else data = { userId: 9, overall: { matchesPlayed: 12, wins: 8, losses: 4, winRate: 0.67, championCount: 1 }, bySport: [{ sportTypeId: 1, sportName: 'Football', matchesPlayed: 12, wins: 8, losses: 4 }] };
    } else if (path === '/me/teams') data = { items: Array.from({ length: 8 }, (_, i) => ({ id: 20 + i, name: 'Northside Software Engineering Community Sporting Club ' + (i + 1), sportTypeId: 1, role: i ? 'member' : 'leader', memberCount: 12 })) };
    else if (path === '/me/following') data = { items: [{ id: 30, fullName: name, avatarUrl: null }] };
    else if (path === '/users/9/career') data = { items: Array.from({ length: 8 }, (_, i) => ({ tournament: { id: 40 + i, name: 'Northside Interdisciplinary Sporting Championship for Engineering Academies ' + (i + 1), sportTypeId: 1, status: 'completed' }, team: { id: 20, name: 'Northside Software Engineering Community Sporting Club' }, played: 4, wins: 3, losses: 1, champion: i === 0 })) };
    else if (path === '/me/pickem') data = { totalPoints: 17, correct: 2, settled: 3, items: [{ matchId: 5, tournament: { id: 40, name: 'Northside Community Sporting Championship' }, teamA: { id: 20, name: 'Northside Software Engineering Community Sporting Club' }, teamB: { id: 21, name: 'Westside Interdisciplinary Academy Community Sporting Club' }, status: 'settled', pointsEarned: 7 }] };
    else if (path === '/notifications') data = { items: [], unreadCount: 0, pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };
    else if (path === '/admin/scopes') { status = 403; data = error('FORBIDDEN', 'Fixture: no admin access'); }
    else { status = 501; data = error('FIXTURE_UNHANDLED', path); }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
}
async function capture(page, id) {
  if (process.env.LTMS_QA_FEEDBACK_CAPTURE_ONLY && !/^profile-(save-failure|saved)-/.test(id)) return;
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { document.activeElement?.blur?.(); scrollTo({ top: 0, behavior: 'instant' }); });
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    width: innerWidth, height: innerHeight, theme: document.documentElement.dataset.theme,
    headingFont: getComputedStyle(document.querySelector('.account-workspace h1')).fontFamily,
    panelPadding: getComputedStyle(document.querySelector('.account-workspace .auth-card, .account-profile-heading')).padding,
    majorGap: getComputedStyle(document.querySelector('.account-profile, .account-workspace .auth-card')).gap,
    rootCorners: getComputedStyle(document.querySelector('.account-workspace .auth-card, .account-profile-heading')).borderRadius,
    colorScheme: getComputedStyle(document.querySelector('.account-workspace')).colorScheme,
    scrollAreas: [...document.querySelectorAll('.account-profile .tblwrap')].map(e => ({ label: e.getAttribute('aria-label'), tabIndex: e.tabIndex, height: e.clientHeight, overflowX: e.scrollWidth > e.clientWidth, overflowY: e.scrollHeight > e.clientHeight })),
    fields: [...document.querySelectorAll('.account-workspace input:not([type=file]), .account-workspace select')].map(e => ({ name: e.name, label: e.labels?.[0]?.textContent.trim(), height: e.getBoundingClientRect().height, invalid: e.getAttribute('aria-invalid') })),
  }));
  assert.equal(layout.overflow, false, id + ' page overflow');
  assert.equal(layout.panelPadding, '20px');
  assert.equal(layout.rootCorners, '2px');
  assert.match(layout.headingFont, /Barlow Condensed/);
  assert.equal(layout.colorScheme, layout.theme);
  for (const region of layout.scrollAreas) { assert(region.label); assert.equal(region.tabIndex, 0); assert(region.height <= 440); }
  for (const field of layout.fields) { assert(field.label, id + ' missing label'); assert(field.height >= 44, id + ' small field'); }
  await page.screenshot({ path: `${__dirname}/${id}.png`, fullPage: true });
  checks.push({ id, ...layout });
}
async function run() {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1280,800], [1440,900], [390,844]]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(t => { localStorage.setItem('ltms-theme', t); }, theme);
      const page = await context.newPage(), mode = {}, errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await fixture(page, mode);
      const id = `${width}-${theme}`;
      await page.goto(origin + '/login');
      await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
      await capture(page, 'login-' + id);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.locator('#login-password-error').waitFor();
      await capture(page, 'login-validation-' + id);
      await page.getByLabel('Email', { exact: true }).fill('account@example.test');
      await page.getByLabel('Password', { exact: true }).fill('1');
      let release; mode.hold = new Promise(resolve => { release = resolve; });
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('button', { name: 'Signing in…', exact: true }).waitFor();
      assert(await page.getByRole('button', { name: 'Signing in…' }).isDisabled());
      await capture(page, 'login-pending-' + id); release(); mode.hold = null;
      await page.locator('#login-email-error').waitFor();
      assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), 'account@example.test');
      await capture(page, 'login-failure-' + id);
      await page.getByRole('link', { name: 'Create account', exact: true }).click();
      await page.getByRole('option', { name: /Engineering and/ }).waitFor({ state: 'attached' });
      await page.getByLabel('Full name', { exact: true }).fill(name);
      await page.getByLabel('Email', { exact: true }).fill('account@example.test');
      await page.getByLabel('Password', { exact: true }).fill('password123');
      await page.getByRole('combobox', { name: 'Faculty', exact: true }).selectOption('2');
      await page.getByRole('option', { name: /Software Engineering/ }).waitFor({ state: 'attached' });
      await page.getByRole('combobox', { name: 'Department', exact: true }).selectOption('8');
      await capture(page, 'register-' + id);
      mode.hold = new Promise(resolve => { release = resolve; });
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await page.getByRole('button', { name: 'Creating account…' }).waitFor();
      await capture(page, 'register-pending-' + id); release(); mode.hold = null;
      await page.locator('#register-email-error').waitFor();
      assert.equal(await page.getByRole('combobox', { name: 'Department', exact: true }).inputValue(), '8');
      await capture(page, 'register-failure-' + id);
      if (width === 390) {
        mode.referenceFailure = true;
        await page.reload();
        await page.getByLabel('Full name', { exact: true }).fill('Retained source failure draft');
        await page.getByRole('button', { name: 'Retry faculties' }).waitFor({ timeout: 15000 });
        await capture(page, 'register-source-failure-' + id);
        mode.referenceFailure = false;
        await page.getByRole('button', { name: 'Retry faculties' }).click();
        await page.getByRole('option', { name: /Engineering and/ }).waitFor({ state: 'attached' });
        assert.equal(await page.getByLabel('Full name', { exact: true }).inputValue(), 'Retained source failure draft');
      }
      mode.signedIn = true; mode.statsFailure = width === 390;
      await page.goto(origin + '/me');
      await page.getByRole('heading', { name, exact: true }).waitFor();
      await page.getByText('Northside Software Engineering Community Sporting Club 8', { exact: true }).waitFor();
      if (mode.statsFailure) await page.getByText('Statistics are unavailable').waitFor({ timeout: 15000 });
      assert.equal(await page.locator('.account-identity > .avatar').textContent(), 'A');
      await capture(page, 'profile-' + id);
      await page.getByRole('button', { name: 'Change photo' }).focus();
      assert(await page.getByRole('button', { name: 'Change photo' }).evaluate(e => e === document.activeElement));
      assert.equal(await page.getByRole('button', { name: 'Change photo' }).evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
      await page.keyboard.press('Tab');
      assert(await page.getByRole('button', { name: 'Remove Photo' }).evaluate(e => e === document.activeElement));
      const squads = page.getByRole('region', { name: 'My squads' });
      await squads.focus();
      const beforeScroll = await squads.evaluate(e => e.scrollLeft);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
      if (width === 390) assert(await squads.evaluate(e => e.scrollLeft) > beforeScroll);
      mode.saveFailure = true;
      await page.getByLabel('Choose profile photo').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('synthetic fixture only') });
      await page.locator('.account-profile-heading [role=alert]').waitFor();
      await capture(page, 'profile-save-failure-' + id);
      mode.saveFailure = false;
      await page.getByLabel('Choose profile photo').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('synthetic fixture only') });
      await page.getByText('Photo saved.', { exact: true }).waitFor();
      assert.equal(await page.locator('.account-profile-heading [role=alert]').count(), 0);
      await capture(page, 'profile-saved-' + id);
      await page.getByRole('button', { name: 'Remove Photo' }).click();
      await page.getByText('Photo removed.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Upload photo' }).waitFor();
      checks.push({ id: 'interactions-' + id, keyboardFocus: true, dialog: 'Account pages have no dialog; existing file chooser is native.', errors });
      assert.deepEqual(errors, []);
      await context.close();
    }
    for (const write of writes.filter(w => w.path === '/me')) assert.deepEqual(Object.keys(write.body), ['avatarUrl']);
  } finally {
    fs.writeFileSync(`${__dirname}/${process.env.LTMS_QA_FEEDBACK_CAPTURE_ONLY ? 'feedback-checks' : 'checks'}.json`, JSON.stringify({ checks, writes }, null, 2));
    await browser.close();
  }
  console.log(`${checks.length} browser records; ${writes.length} intercepted writes; no page overflow/runtime errors.`);
}
if (require.main === module) run().catch(e => { console.error(e); process.exitCode = 1; });
