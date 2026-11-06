import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: true }))
import { follow, getFollows, setFollowNotifications, unfollow } from './engagement'
beforeEach(() => localStorage.clear())
it('persists an explicit bell choice and resets it when unfollowed and followed again', async () => {
  const first = await follow(9, 'player:u-test')
  expect(first.notifications?.['player:u-test']).toBe(false)
  await setFollowNotifications(9, 'player:u-test', true, first)
  expect((await getFollows(9)).notifications?.['player:u-test']).toBe(true)
  await unfollow(9, 'player:u-test')
  const repeated = await follow(9, 'player:u-test')
  expect(repeated.notifications?.['player:u-test']).toBe(false)
  expect((await getFollows(8)).targets).toEqual([])
})
it('migrates existing mock follows as notifications off', async () => {
  localStorage.setItem('ltms-follows-9', JSON.stringify(['player:u-test']))
  expect(await getFollows(9)).toMatchObject({ targets: ['player:u-test'], notifications: { 'player:u-test': false } })
})
it('retains follows when only the saved notification preferences are corrupt', async () => {
  localStorage.setItem('ltms-follows-9', JSON.stringify(['player:u-test']))
  localStorage.setItem('ltms-follows-9-notifications', 'broken json')
  expect(await getFollows(9)).toMatchObject({ targets: ['player:u-test'], notifications: { 'player:u-test': false } })
})
