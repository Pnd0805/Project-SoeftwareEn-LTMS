import { describe, expect, it } from 'vitest'
import { navSection } from './navSection'

describe('navSection', () => {
  it.each([
    ['/', '/'],
    ['/home/all', '/home/all'],
    ['/t/2/manage', '/home/all'],
    ['/home/teams', '/home/all'],
    ['/t/2', '/home/all'],
    ['/t/2/manage/progress', '/home/all'],
    ['/watch/2', '/home/all'],
    ['/mvp/2', '/home/all'],
    ['/teams', '/teams'],
    ['/team/7', '/teams'],
    ['/matches', '/matches'],
    ['/m/9', '/matches'],
    ['/m/9/fixture', '/matches'],
    ['/checkin/9', '/matches'],
    ['/inbox', '/inbox'],
    ['/inbox/requests', '/inbox'],
    ['/me', '/me'],
    ['/me/settings', '/me'],
    ['/admin', '/admin'],
    ['/admin/requests', '/admin'],
    ['/teams-old', null],
    ['/search/tournaments', null],
    ['/unknown', null],
  ] as const)('%s maps to %s', (pathname, expected) => {
    expect(navSection(pathname)).toBe(expected)
  })
})
