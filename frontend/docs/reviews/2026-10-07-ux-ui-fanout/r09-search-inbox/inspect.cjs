const path = require('node:path')
const {
  chromium,
  executablePath,
  fixture08b,
  mockLogin,
} = require('../browser-kit.cjs')

const output = path.join(__dirname, 'live-evidence')
const apiHost = 'http://127.0.0.1:5176'
const mockHost = 'http://127.0.0.1:5175'

async function makePage(browser, fixtureMode = null, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport, colorScheme: 'dark' })
  await context.addInitScript(() => localStorage.setItem('ltms-theme', 'dark'))
  const page = await context.newPage()
  const apiRequests = []
  page.on('request', request => {
    if (request.url().includes('/api/v1/')) apiRequests.push({ method: request.method(), url: request.url() })
  })
  if (fixtureMode !== null) await fixture08b(page, fixtureMode)
  return { context, page, apiRequests }
}

async function waitForInbox(page) {
  await page.getByRole('heading', { name: 'Inbox', exact: false }).waitFor()
  await page.getByRole('heading', { name: 'Action requests' }).waitFor()
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath })
  const results = {}

  {
    const { context, page, apiRequests } = await makePage(browser, {})
    await page.goto(`${apiHost}/search/Northside`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Tournaments', exact: false }).waitFor()
    await page.screenshot({ path: path.join(output, 'search-1280-dark.png') })
    await page.screenshot({ path: path.join(output, 'search-1280-dark-full.png'), fullPage: true })
    const teamRow = page.locator('.search-results').filter({ has: page.getByRole('heading', { name: 'Teams' }) }).first()
    results.search = {
      url: page.url(),
      summary: await page.locator('.search-summary').textContent(),
      categoryHeadings: await page.locator('.search-results h2').allTextContents(),
      firstTeamMetadata: await teamRow.locator('.who .tag').first().textContent(),
      apiPaths: apiRequests.map(item => new URL(item.url).pathname),
    }
    await context.close()
  }

  {
    const mode = {}
    const { context, page, apiRequests } = await makePage(browser, mode)
    await page.goto(`${apiHost}/inbox`, { waitUntil: 'domcontentloaded' })
    await waitForInbox(page)
    await page.screenshot({ path: path.join(output, 'inbox-1280-dark.png') })
    await page.screenshot({ path: path.join(output, 'inbox-1280-dark-full.png'), fullPage: true })
    const teamInvitation = page.getByRole('button', { name: /Accept team invitation:/ }).first()
    await teamInvitation.click()
    await page.getByText(/You joined Northside Community Sporting Team/).waitFor()
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('.inbox-requests h3')).some(node => node.textContent.includes('Team invitations')))
    await page.screenshot({ path: path.join(output, 'inbox-team-accepted-receipt.png') })
    results.inboxAfterAccept = {
      notice: await page.locator('.inbox-requests [role="status"]').first().textContent(),
      teamInvitationGroupRemaining: await page.locator('.inbox-requests h3').filter({ hasText: 'Team invitations' }).count(),
      apiPaths: apiRequests.map(item => new URL(item.url).pathname),
    }
    await context.close()
  }

  {
    const mode = { denied: '/me/notifications' }
    const { context, page, apiRequests } = await makePage(browser, mode)
    await page.goto(`${apiHost}/inbox`, { waitUntil: 'domcontentloaded' })
    await waitForInbox(page)
    await page.getByText('Unable to load inbox').waitFor()
    await page.screenshot({ path: path.join(output, 'inbox-notifications-denied.png') })
    results.notificationDenied = {
      message: await page.locator('.inbox-page [role="alert"]').first().textContent(),
      retryButtonCount: await page.getByRole('button', { name: 'Retry notifications' }).count(),
      apiPaths: apiRequests.map(item => new URL(item.url).pathname),
    }
    await context.close()
  }

  {
    const mode = { denied: '/me/referee-requests' }
    const { context, page, apiRequests } = await makePage(browser, mode)
    await page.goto(`${apiHost}/inbox`, { waitUntil: 'domcontentloaded' })
    await waitForInbox(page)
    await page.getByText('Unable to load referee requests').waitFor()
    await page.screenshot({ path: path.join(output, 'inbox-action-source-denied.png'), fullPage: true })
    results.actionSourceDenied = {
      sourceMessage: await page.getByText('Unable to load referee requests').locator('..').textContent(),
      retryButtonCount: await page.getByRole('button', { name: 'Retry referee requests' }).count(),
      matchAssignmentsHeadingCount: await page.getByRole('heading', { name: /Match assignments/ }).count(),
      apiPaths: apiRequests.map(item => new URL(item.url).pathname),
    }
    await context.close()
  }

  {
    const mode = { loading: '/me/referee-requests' }
    const { context, page, apiRequests } = await makePage(browser, mode)
    await page.goto(`${apiHost}/inbox`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Loading referee requests…').waitFor()
    await page.screenshot({ path: path.join(output, 'inbox-action-source-pending.png') })
    results.actionSourcePending = {
      loadingVisible: await page.getByText('Loading referee requests…').isVisible(),
      apiPaths: apiRequests.map(item => new URL(item.url).pathname),
    }
    if (typeof mode.release === 'function') mode.release()
    await context.close()
  }

  {
    const { context, page, apiRequests } = await makePage(browser, null)
    await mockLogin(page)
    await page.goto(`${mockHost}/search/Northside`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Search' }).waitFor()
    results.mockSearch = {
      url: page.url(),
      apiRequests: apiRequests.length,
      categoryHeadings: await page.locator('.search-results h2').allTextContents(),
    }
    await page.goto(`${mockHost}/inbox`, { waitUntil: 'domcontentloaded' })
    await waitForInbox(page)
    results.mockInbox = {
      url: page.url(),
      actionRequestsVisible: await page.getByRole('heading', { name: 'Action requests' }).isVisible(),
      apiRequests: apiRequests.length,
    }
    await context.close()
  }

  console.log(JSON.stringify(results, null, 2))
  await browser.close()
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
