// Synthetic intercepted fixtures only. No live backend reads or mutations.
const { chromium } = require('playwright');
const fs = require('node:fs'), assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:5178';
const executablePath = '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const longName = 'Northside Community Championship for Engineering and Sporting Academies';
const teamName = 'Northside Community Sporting Team with a Long Registration Name';
const title = 'Court changed for the Northside Community Championship';
const person = (id, fullName) => ({ id, fullName, avatarUrl: null });
const tour = { id: 42, name: longName, sportTypeId: 1, bracketFormat: 'single_elimination', scopeType: 'university', organizingFacultyId: null, organizingDepartmentId: null, requestedByUserId: 7, status: 'public', registrationOpen: true, registrationStart: null, registrationEnd: null, eventStartDate: '2099-10-01', eventEndDate: null, maxTeams: 16, minTeams: 2, venue: 'Northside Community Hall', disputeWindowHours: 24, genderRequirement: 'any', minAge: null, maxAge: null, rejectionReason: null, approvedBy: 1, approvedAt: null, createdAt: '2026-10-01', deletedAt: null };
const invite = { id: 12, team: { id: 9, name: teamName, sportTypeId: 1 }, invitedBy: person(4, 'Captain Northside Sporting Academy'), expiresAt: '2099-12-01T00:00:00Z' };
const request = { id: 91, tournamentId: 42, type: 'org_swap', requestedBy: 7, refereeA: { tournamentRefereeId: 34, user: person(8, 'Referee Northside Community Sporting Academy'), status: 'pending' }, refereeB: { tournamentRefereeId: 35, user: person(9, 'Referee Westside Community Sporting Academy'), status: 'accepted' }, matchA: { id: 30, roundNumber: 1, scheduledTime: '2099-10-01T09:00:00Z', scheduledEndTime: '2099-10-01T11:00:00Z' }, matchB: { id: 31, roundNumber: 2, scheduledTime: '2099-10-02T09:00:00Z', scheduledEndTime: '2099-10-02T11:00:00Z' }, status: 'open', createdAt: '2026-10-01T00:00:00Z', resolvedAt: null };
const checks = process.env.LTMS_QA_MODE === 'mock' ? JSON.parse(fs.readFileSync(__dirname + '/checks.json', 'utf8')) : [];
async function fixture(page, mode) {
  const writes = [], reads = [];
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace('/api/v1', '');
    let data = { items: [] }, status = 200;
    if (req.method() !== 'GET') {
      writes.push({ path, method: req.method(), body: req.postData() });
      if (mode.failMutation) { status = 409; data = { error: { code: 'INVITATION_CLOSED', message: 'Invitation no longer available. Retry from the current list.' } }; }
      else if (path === '/me/notifications/31/read') { mode.read = true; data = { isRead: true }; }
      else if (path === '/me/notifications/read-all') { mode.allRead = true; data = { updated: 7, unreadCount: 0 }; }
      else if (path === '/invitations/12/accept') { mode.joined = true; data = {}; }
      else { status = 501; data = { error: { code: 'FIXTURE_UNHANDLED_WRITE', message: 'No synthetic handler' } }; }
    } else {
      reads.push(path);
      if (mode.denied === path || mode.failure === path) { status = mode.denied ? 403 : 501; data = { error: { code: 'SOURCE_UNAVAILABLE', message: 'Fixture: this source is unavailable.' } }; }
      else if (mode.loading === path) { await new Promise(resolve => mode.release = resolve); data = { items: [] }; }
      else if (path === '/me') data = { ...person(7, 'Player Northside'), email: 'player@example.test', userType: 'student', facultyId: 1, departmentId: 1, roles: ['player'] };
      else if (path === '/sport-types') data = { items: [{ id: 1, name: 'Football', defaultMode: 'onsite', minMembers: 2, maxMembers: 30 }] };
      else if (path === '/tournaments') data = { items: mode.empty ? [] : Array.from({ length: 7 }, (_, i) => ({ ...tour, id: 42 + i, name: i ? `${longName} ${i + 1}` : longName })) };
      else if (path === '/teams') data = { items: mode.empty ? [] : Array.from({ length: 6 }, (_, i) => ({ id: 9 + i, name: i ? `${teamName} ${i + 1}` : teamName, sportTypeId: 1, readinessStatus: 'Ready', memberCount: 4, logoUrl: null })) };
      else if (path === '/users/search') data = { items: mode.empty ? [] : Array.from({ length: 6 }, (_, i) => person(20 + i, `Northside Player ${i + 1} with a Long Community Sporting Academy Name`)) };
      else if (path === '/me/notifications') { const items = mode.empty ? [] : Array.from({ length: 7 }, (_, i) => ({ id: 31 + i, title: i ? `${title} ${i + 1}` : title, type: i < 4 ? 'tournament_announcement' : i < 6 ? 'comment_reported' : 'future_type', message: i ? 'Please review the venue and match schedule before your next tournament visit.' : 'Bring your student ID and arrive at the new venue.\n' + 'Reference'.repeat(35), relatedEntityType: 'tournament', relatedEntityId: 42, isRead: mode.allRead || (i === 0 && mode.read), createdAt: '2026-10-01T09:00:00Z' })); data = { items: url.searchParams.get('unread') === 'true' ? items.filter(n => !n.isRead) : items, unreadCount: items.filter(n => !n.isRead).length, pagination: { page: Number(url.searchParams.get('page') || 1), pageSize: 20, totalItems: 27, totalPages: 2 } }; }
      else if (path === '/me/invitations') data = { items: mode.empty || mode.joined ? [] : [invite] };
      else if (path === '/me/referee-invitations') data = { items: mode.empty ? [] : [{ id: 17, tournament: { id: 42, name: longName }, isExternal: true, createdAt: '2026-10-01T00:00:00Z' }] };
      else if (path === '/me/referee-requests') data = { incoming: mode.empty ? [] : [request], outgoing: mode.empty ? [] : [{ ...request, id: 92 }] };
      else if (path === '/me/applications') data = { items: mode.empty ? [] : Array.from({ length: 4 }, (_, i) => ({ id: 200 + i, tournament: { id: 42 + i, name: longName }, team: { id: 9, name: teamName }, status: ['pending', 'approved', 'rejected', 'withdrawn'][i], rejectionReason: i === 2 ? 'Missing signed consent form. '.repeat(12) : null, appliedAt: '2026-10-01T00:00:00Z' })) };
      else if (path === '/admin/scopes') { status = 403; data = { error: { code: 'DENIED', message: 'No admin rights' } }; }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return { writes, reads };
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  const theme = name.endsWith('-dark') ? 'dark' : 'light'; await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
  const layout = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, overflow: document.documentElement.scrollWidth > innerWidth, gap: getComputedStyle(document.querySelector('.search-page,.inbox-page')).gap,
    padding: [...document.querySelectorAll('.search-page .panel,.inbox-page .panel')].map(e => getComputedStyle(e).padding),
    principalFont: getComputedStyle(document.querySelector('h1')).fontFamily,
    radius: [...document.querySelectorAll('.search-page .panel,.inbox-page .panel')].map(e => getComputedStyle(e).borderRadius),
    unnamedButtons: [...document.querySelectorAll('#main button')].filter(e => !e.getAttribute('aria-label') && !e.textContent.trim()).length,
    dialogs: document.querySelectorAll('[role="dialog"]').length }));
  assert.equal(layout.theme, theme); assert(!layout.overflow, name + ' overflow'); assert.equal(layout.gap, '24px'); assert(layout.padding.every(x => x === '20px')); assert.equal(layout.unnamedButtons, 0); assert.equal(layout.dialogs, 0);
  await page.screenshot({ path: `${__dirname}/${name}.png`, fullPage: true }); checks.push({ name, ...layout });
}
async function refresh(page) {
  await page.evaluate(async () => { const source = await (await fetch('/src/main.tsx')).text(), url = source.match(/from "([^"]*@tanstack_react-query[^"]*)"/)[1]; const { focusManager } = await import(url); focusManager.setFocused(false); focusManager.setFocused(true); });
}
async function run() {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    if (process.env.LTMS_QA_MODE !== 'mock') for (const [width, height, theme] of [[1280,800,'dark'],[1280,800,'light'],[1440,900,'dark'],[1440,900,'light'],[390,844,'dark'],[390,844,'light']]) {
      const context = await browser.newContext({ viewport: { width, height } }), page = await context.newPage(), mode = {}, errors = [];
      page.on('pageerror', error => errors.push(error.message)); const { writes } = await fixture(page, mode);
      await page.addInitScript(theme => localStorage.setItem('ltms-theme', theme), theme);
      await page.goto(origin + '/search/Northside'); await page.getByRole('button', { name: 'Open tournament: ' + longName, exact: true }).waitFor(); await page.getByText('Northside Player 6 with a Long Community Sporting Academy Name').waitFor(); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(page, `search-${width}-${theme}`);
      await page.getByLabel('Search terms', { exact: true }).focus(); await page.keyboard.press('Tab'); assert.equal(await page.locator('#se-status').evaluate(e => e === document.activeElement), true);
      await page.keyboard.press('Tab'); assert.equal(await page.getByRole('button', { name: 'Open tournament: ' + longName, exact: true }).evaluate(e => e === document.activeElement), true);
      await page.keyboard.press('Enter'); await page.waitForURL('**/t/42');
      mode.empty = true; await page.goto(origin + '/search/NoMatch'); await page.getByText('Nothing matched “NoMatch”').waitFor(); await capture(page, `search-empty-${width}-${theme}`);
      mode.empty = false; mode.failure = '/teams'; await page.reload(); await page.getByRole('button', { name: 'Retry teams' }).waitFor(); assert.equal(await page.getByText(/Nothing matched/).count(), 0); await capture(page, `search-failed-${width}-${theme}`); mode.failure = ''; await page.getByRole('button', { name: 'Retry teams' }).click(); await page.getByRole('button', { name: 'Retry teams' }).waitFor({ state: 'hidden' }); assert.equal(await page.getByLabel('Search terms').inputValue(), 'NoMatch');
      mode.loading = '/teams'; await page.goto(origin + '/search/Northside'); await page.getByText('Searching teams…').waitFor(); await capture(page, `search-loading-${width}-${theme}`); mode.release(); mode.loading = '';
      await page.goto(origin + '/inbox'); await page.getByText(title, { exact: true }).waitFor(); await page.getByText('Request #92', { exact: false }).waitFor(); await capture(page, `inbox-${width}-${theme}`);
      await page.getByRole('button', { name: 'Unread only' }).click(); const mark = page.getByRole('button', { name: 'Mark read: ' + title, exact: true }); await mark.focus(); await page.keyboard.press('Enter'); await page.getByRole('status').filter({ hasText: 'Marked read: ' + title }).waitFor(); await page.getByText(title, { exact: true }).waitFor({ state: 'hidden' }); await capture(page, `read-outcome-${width}-${theme}`);
      await page.getByRole('button', { name: 'Accept team invitation: ' + teamName }).click(); await page.getByRole('status').filter({ hasText: 'You joined ' + teamName }).waitFor(); await page.getByRole('button', { name: 'Accept team invitation: ' + teamName }).waitFor({ state: 'hidden' }); await capture(page, `answer-outcome-${width}-${theme}`);
      mode.denied = '/me/notifications'; await refresh(page); await page.getByText('Unable to load inbox', { exact: true }).waitFor(); assert.equal(await page.locator('.inbox-notifications .notif').count(), 0); assert.equal(await page.getByText('Nothing here yet').count(), 0); await capture(page, `inbox-denied-${width}-${theme}`);
      mode.denied = ''; mode.failMutation = true; await page.getByRole('button', { name: 'Decline referee invitation: ' + longName }).click(); await page.getByRole('alert').filter({ hasText: 'Invitation no longer available' }).waitFor(); await capture(page, `answer-failed-${width}-${theme}`);
      mode.failure = '/me/applications'; await page.reload(); await page.getByRole('button', { name: 'Retry entry decisions' }).waitFor(); assert.equal(await page.getByText('Nothing waiting on you').count(), 0); await capture(page, `entries-failed-${width}-${theme}`);
      assert.deepEqual(writes, [{ path: '/me/notifications/31/read', method: 'PATCH', body: null }, { path: '/invitations/12/accept', method: 'POST', body: null }, { path: '/referee-invitations/17/decline', method: 'POST', body: null }]); assert.deepEqual(errors, []);
      checks.push({ name: `interactions-${width}-${theme}`, keyboardOrder: true, keyboardActivation: true, outcomesRetained: true, deniedCacheHidden: true, dialogs: 'Search and Inbox do not introduce dialogs', errors, writes }); await context.close();
    }
    // In-browser module interception selects the existing mock stack; no configuration changes.
    for (const [width, height, theme] of [[1280,800,'dark'],[1280,800,'light'],[1440,900,'dark'],[1440,900,'light'],[390,844,'dark'],[390,844,'light']]) {
      const context = await browser.newContext({ viewport: { width, height } }), page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message)); let network = 0;
      await page.route('**/api/v1/**', async r => { network++; await r.abort(); });
      await page.route('**/src/api/client.ts*', async r => { const response = await r.fetch(); await r.fulfill({ response, body: (await response.text()).replace('export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";', 'export const USE_MOCK = true;') }); });
      await page.addInitScript(({ tour, title }) => {
        const user = { id: 'u-7', name: 'Fixture Player', email: 'fixture@example.test', role: 'User', gender: 'Male', dob: '2000-01-01', faculty: 'Engineering', major: 'General', year: 1 };
        const state = { seq: 100, session: user.id, users: [user], teams: [], tournaments: [{ id: 't-42', name: tour.name, sport: 'Football', format: 'single', channel: 'onsite', status: 'public', venue: 'Northside Hall', referees: [], date: '2099-10-01', rules: {}, drawn: false }], registrations: [], matches: [], invites: [], refInvites: [], announcements: [], notifications: Array.from({ length: 7 }, (_, i) => ({ id: 'n-' + (31 + i), to: user.id, text: i ? `${title} ${i + 1}` : 'Long notification ' + 'Reference'.repeat(40), href: '/t/t-42', at: Date.now(), read: false })), picks: [], votes: [], follows: [], comments: [], feedback: [], permanentRequests: [] };
        localStorage.setItem('ltms.v1', JSON.stringify(state)); let hash = 0; for (const char of user.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; localStorage.setItem('ltms-mock-user-id', String(100000 + hash % 800000));
      }, { tour, title });
      await page.goto(origin + '/inbox'); await page.getByText('Long notification ', { exact: false }).waitFor(); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(page, `mock-inbox-${width}-${theme}`);
      assert.equal(await page.getByRole('heading', { name: 'Action requests' }).count(), 0); assert.equal(await page.getByRole('button', { name: 'Unread only' }).count(), 0);
      await page.getByRole('button', { name: /^Mark read:/ }).first().click(); await page.getByRole('status').filter({ hasText: 'Marked read: Long notification' }).waitFor(); await capture(page, `mock-read-outcome-${width}-${theme}`);
      await page.getByRole('button', { name: 'Mark all read' }).click(); await page.getByRole('status').filter({ hasText: 'All notifications marked read' }).waitFor(); await capture(page, `mock-outcome-${width}-${theme}`);
      assert.equal(network, 0); assert.deepEqual(errors, []); checks.push({ name: `mock-interactions-${width}-${theme}`, mockOnlyActions: true, retainedOutcome: true, network, errors }); await context.close();
    }
  } finally { await browser.close(); fs.writeFileSync(__dirname + '/checks.json', JSON.stringify(checks, null, 2)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
