import { test, expect } from './support/fixtures'
import { prepareApplicationPaginationCase } from './support/application-pagination'
import { PASSWORD } from './support/env'

test('a leader with 20+ applications sees a new registration after submission and reload', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const { email, team, tournament } = await prepareApplicationPaginationCase()

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()

  await page.goto(`/t/${tournament.id}`)
  await page.getByRole('button', { name: 'Register a squad', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Team', { exact: true }).selectOption(String(team.id))
  const players = dialog.getByRole('checkbox')
  await expect(players).toHaveCount(2)
  for (const player of await players.all()) await player.check()
  const submitted = page.waitForResponse(response => response.request().method() === 'POST'
    && response.url().endsWith(`/tournaments/${tournament.id}/applications`))
  await dialog.getByRole('button', { name: 'Submit registration' }).click()
  expect((await submitted).status()).toBe(201)
  await expect(dialog).toBeHidden()
  const entry = page.getByRole('region', { name: 'Entry feedback' })
  await expect(entry.getByText('Waiting on the organizer', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Register a squad', exact: true })).toHaveCount(0)

  await page.reload()
  await expect(entry.getByText('Waiting on the organizer', { exact: true })).toBeVisible()
  await expect(entry.getByText(team.name, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Register a squad', exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('registration-success.png'), fullPage: true })
})
