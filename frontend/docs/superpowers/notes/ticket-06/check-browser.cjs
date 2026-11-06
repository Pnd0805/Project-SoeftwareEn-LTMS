// Synthetic HTTP fixtures; every API request is intercepted. No live backend.
const { chromium } = require('playwright');
const fs = require('node:fs'), assert = require('node:assert/strict');
const { fixture: baseFixture } = require('../ticket-05/check-browser.cjs');
const origin = process.env.LTMS_QA_ORIGIN || 'http://127.0.0.1:5176';
const executablePath = process.env.LTMS_QA_BROWSER || '/Users/puriwat2953/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const teamA = { id: 11, sportTypeId: 1, name: 'Northside Community Championship Football Team' };
const teamB = { id: 12, sportTypeId: 1, name: 'Westside District Sporting Club and Academy' };
const players = Array.from({ length: 24 }, (_, i) => ({ userId: 700 + i, fullName: `Player ${i + 1} Northside Community Sporting Academy`, avatarUrl: null, checkinStatus: i < 5 ? 'checked_in' : null, checkedInAt: null }));
const definitions = Array.from({ length: 10 }, (_, i) => ({ statDefinitionId: i + 1, statKey: i ? `stat${i}` : 'goals', statLabelTh: i ? `Statistic ${i}` : 'Goals', dataType: 'integer', displayOrder: i }));
const checks = [];
function rawMatch(mode, id = 100) { return { id, tournamentId: 42, round: 1, teamA, teamB, scheduledTime: '2099-10-01T09:00:00Z', scheduledEndTime: '2099-10-01T11:00:00Z', actualEndTime: null, checkinOpenAt: '2099-10-01T08:30:00Z', venue: 'Northside Main Court', status: mode.status || 'finished', mode: 'onsite', resultStatus: mode.result || null, score: null, outcome: null, nextMatchId: 101, loserNextMatchId: null }; }
async function fixture(page, mode) {
  const fallbackWrites = await baseFixture(page, { tour: { organizer: { id: mode.organizer ? 99 : 77, fullName: 'Organizer' } } });
  const writes = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1', '');
    let data, status = 200;
    if (request.method() !== 'GET') {
      writes.push({ path, method: request.method(), body: JSON.parse(request.postData() || '{}') });
      status = 503; data = { error: { code: 'SYNTHETIC_FAILURE', message: 'Fixture: request failed. Your draft is retained.' } };
    } else if (path === '/me/referee-invitations') data = { items: [] };
    else if (path === '/me/referee-matches') data = { items: Array.from({ length: 30 }, (_, i) => ({ ...rawMatch(mode, 100 + i), tournament: { id: 42, name: 'Northside Street Cup', sportTypeId: 1 } })) };
    else if (path === '/tournaments/42/matches') data = { items: Array.from({ length: 30 }, (_, i) => ({ ...rawMatch(mode, 100 + i), round: Math.floor(i / 6) + 1 })), pagination: { page: 1, pageSize: 100, totalItems: 30, totalPages: 1 } };
    else if (/^\/sport-types\/1\/stat-definitions$/.test(path)) data = { items: definitions };
    else if (/^\/matches\/\d+$/.test(path)) data = rawMatch(mode, Number(path.split('/')[2]));
    else if (/\/matches\/\d+\/referees$/.test(path)) data = { items: mode.organizer || mode.unrelated ? [] : [{ id: 1, referee: { id: 99, fullName: 'Referee Northside', avatarUrl: null } }] };
    else if (/\/matches\/\d+\/lineups$/.test(path)) data = { matchId: 100, teamA: { teamId: 11, players }, teamB: { teamId: 12, players: players.map(p => ({ ...p, userId: p.userId + 100, checkinStatus: null })) } };
    else if (/\/matches\/\d+\/checkins$/.test(path)) data = { items: players.slice(0, 5).map((p, i) => ({ id: 50 + i, userId: p.userId, fullName: p.fullName, method: 'qr_onsite', status: 'checked_in', note: null, rejectionReason: null, documentType: null, documentS3Key: null, verifiedByReferee: null, checkedInAt: '2026-10-06T09:00:00Z', verifiedAt: null })) };
    else if (/\/matches\/\d+\/checkin-qr$/.test(path)) data = { qrPayload: 'Synthetic.Signed.Match100.Payload.CaseSensitive123', expiresAt: new Date(Date.now() + 1200000).toISOString() };
    else if (/\/matches\/\d+\/my-checkin$/.test(path)) { status = 404; data = { error: { code: 'CHECKIN_NOT_FOUND', message: 'No check-in yet' } }; }
    else if (/\/matches\/\d+\/result$/.test(path)) {
      if (!mode.result) { status = 404; data = { error: { code: 'RESULT_NOT_FOUND', message: 'No result yet' } }; }
      else data = { matchId: 100, status: mode.result, winnerTeamId: 11, scoreData: { '11': 3, '12': 1 }, submittedBy: { id: 99, fullName: 'Referee Northside', avatarUrl: null }, submittedRole: 'referee', createdAt: '2026-10-06T09:00:00Z', disputeReason: 'Score sheet differs', disputeRaisedBy: { id: 700, fullName: 'Team leader' }, disputeRaisedAt: '2026-10-06T09:10:00Z' };
    } else if (/\/matches\/\d+\/result\/complaints$/.test(path)) data = { matchId: 100, complaints: [] };
    else if (/\/matches\/\d+\/result\/dispute$/.test(path)) data = { matchId: 100, status: 'open', reason: 'The score sheet shows a different result.', raisedBy: { id: 700, fullName: 'Team leader' }, claimedScoreData: { '11': 2, '12': 3 }, evidence: [], raisedAt: '2026-10-06T09:10:00Z' };
    else if (/\/matches\/\d+\/stats$/.test(path)) data = { items: players.map(p => ({ userId: p.userId, fullName: p.fullName, stats: definitions.map((d, i) => ({ statKey: d.statKey, value: i + 1 })) })) };
    else if (/\/matches\/\d+\/mvp-votes$/.test(path)) data = { matchId: 100, window: { opensAt: '2026-10-06T09:00:00Z', closesAt: '2099-10-01T09:00:00Z', isOpen: true }, candidates: players.map(p => ({ userId: p.userId, fullName: p.fullName, avatarUrl: null, teamId: 11, stats: [{ statKey: 'goals', statLabelTh: 'Goals', value: 2 }] })), mine: null, winners: [], canVote: false };
    else if (/\/matches\/\d+\/predictions$/.test(path)) data = { matchId: 100, isOpen: false, closedReason: 'match_finished', total: 0, teams: [], mine: null, canPredict: false, closesAt: null };
    else { await route.fallback(); return; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return { writes, fallbackWrites };
}
async function capture(page, name, dialog = false) {
  await page.evaluate(() => document.fonts.ready);
  // Let the existing 150ms theme transition finish before measuring/capturing.
  await page.waitForTimeout(200);
  if (!dialog) await page.evaluate(() => { document.activeElement?.blur?.(); scrollTo({ top: 0, behavior: 'instant' }) });
  const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
    summary: [...document.querySelectorAll('.match-summary-frame')].map(e => ({ height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width })),
    lineups: [...document.querySelectorAll('.match-lineup-frame')].map(e => ({ height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width })),
    checkinFrames: [...document.querySelectorAll('.checkin-summary-frame')].map(e => ({ height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width })),
    squadFrames: [...document.querySelectorAll('.checkin-squad-frame')].map(e => ({ height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width })) }));
  assert(!layout.overflow, name + ' horizontal page overflow');
  for (const frames of [layout.summary, layout.lineups, layout.checkinFrames, layout.squadFrames]) if (frames.length === 2) { assert.equal(frames[0].height, frames[1].height); assert.equal(frames[0].width, frames[1].width); }
  await page.screenshot({ path: `${__dirname}/${name}.png`, fullPage: !dialog });
  checks.push({ name, ...layout });
}
module.exports = { fixture, rawMatch };
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height, theme] of [[1280,800,'dark'],[1280,800,'light'],[1440,900,'dark'],[1440,900,'light'],[390,844,'dark'],[390,844,'light']]) {
      const context = await browser.newContext({ viewport: { width, height } }), page = await context.newPage(), mode = {}, errors = [];
      page.on('pageerror', error => errors.push(error.message)); const { writes, fallbackWrites } = await fixture(page, mode);
      await page.goto(origin + '/m/100/overview'); await page.getByRole('button', { name: 'Review result', exact: true }).waitFor();
      await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(page, `match-${width}-${theme}`);
      await page.getByLabel(teamA.name, { exact: true }).fill('3'); await page.getByRole('button', { name: 'Lineup', exact: true }).click();
      await page.getByRole('region', { name: `${teamA.name} lineup` }).waitFor(); await capture(page, `lineup-${width}-${theme}`);
      await page.goBack(); await page.getByRole('button', { name: 'Review result', exact: true }).waitFor(); assert.equal(await page.getByLabel(teamA.name, { exact: true }).inputValue(), '3');
      await page.getByRole('button', { name: 'Review result', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Review result' }); await dialog.waitFor();
      const footer = await page.locator('.match-dialog-footer').evaluate(e => ({ bottom: e.getBoundingClientRect().bottom, viewport: innerHeight })); assert(footer.bottom <= footer.viewport);
      await capture(page, `result-review-${width}-${theme}`, true); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Stats', exact: true }).click(); await page.getByRole('region', { name: 'Recorded player statistics' }).waitFor(); await capture(page, `stats-${width}-${theme}`);
      mode.status = 'checkin_open'; await page.goto(origin + '/checkin/100'); await page.getByRole('heading', { name: 'Check-in QR' }).waitFor(); await page.locator('.checkin-qr-content svg').waitFor(); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(page, `checkin-${width}-${theme}`);
      assert.deepEqual(await page.locator('.checkin-squad-frame>.spread>.tag').allTextContents(), ['5 of 24 in', '0 of 24 in']);
      const qr = await page.locator('.checkin-qr-content svg').evaluate(e => [...e.querySelectorAll('path')].map(p => getComputedStyle(p).fill)); assert(qr.includes('rgb(229, 220, 200)') && qr.includes('rgb(10, 8, 16)'));
      if (width !== 1280) {
        mode.status = 'finished'; mode.result = 'disputed'; await page.goto(origin + '/m/100'); await page.getByRole('heading', { name: 'Dispute details' }).waitFor(); await capture(page, `dispute-${width}-${theme}`);
        await page.getByRole('button', { name: 'History', exact: true }).click(); await page.getByRole('heading', { name: 'Result history' }).waitFor(); await capture(page, `history-${width}-${theme}`);
        await page.getByRole('button', { name: 'Vote MVP', exact: true }).click(); await page.locator('.match-mvp-candidates').waitFor(); await capture(page, `mvp-${width}-${theme}`);
      }
      await page.goto(origin + '/watch/42'); await page.getByText('Watch is unavailable', { exact: true }).waitFor(); await capture(page, `watch-unavailable-${width}-${theme}`);
      await page.goto(origin + '/m/100/fixture'); await page.getByText('403 — not yours to set', { exact: true }).waitFor(); await capture(page, `fixture-denied-${width}-${theme}`);
      mode.result = null; await page.goto(origin + '/matches'); await page.getByRole('searchbox', { name: 'Search matches' }).waitFor(); await page.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(page, `matches-${width}-${theme}`);
      assert.equal(errors.length, 0, errors.join('\n')); assert.equal(writes.length + fallbackWrites.length, 0);
      checks.push({ name: `interactions-${width}-${theme}`, draftRetained: true, footer, qr, writes: [], errors }); await context.close();
      const fixtureContext = await browser.newContext({ viewport: { width, height } }), fixturePage = await fixtureContext.newPage();
      const fixtureErrors = []; fixturePage.on('pageerror', error => fixtureErrors.push(error.message));
      const fixtureRequests = await fixture(fixturePage, { organizer: true, status: 'scheduled' });
      await fixturePage.goto(origin + '/m/100/fixture'); await fixturePage.locator('.match-fixture-form').waitFor();
      await fixturePage.evaluate(t => document.documentElement.dataset.theme = t, theme); await capture(fixturePage, `fixture-${width}-${theme}`);
      assert.equal(fixtureErrors.length, 0, fixtureErrors.join('\n')); assert.equal(fixtureRequests.writes.length + fixtureRequests.fallbackWrites.length, 0); await fixtureContext.close();
    }
  } finally { await browser.close(); fs.writeFileSync(__dirname + '/checks.json', JSON.stringify(checks, null, 2)); }
})().catch(error => { console.error(error); process.exitCode = 1 });
