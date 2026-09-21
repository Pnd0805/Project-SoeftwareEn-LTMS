import { describe, expect, it } from 'vitest'
import type { Tournament } from '../../shared/types'
import { buildHomeCategories } from './homeView'

const tournament = (id: string, champion: string | null = null) => ({
  id, name: id, sport: 'Football', format: 'single', channel: 'onsite', status: 'public',
  date: '2026-10-01', venue: 'Main field', pin: null, cap: 8, organizer: 'u-1',
  referees: [], rules: { gender: 'any', ageMin: 'any', ageMax: 'any', faculty: 'any', major: 'any', year: 'any' },
  drawn: champion !== null, rounds: 1, champion,
}) satisfies Tournament

describe('home tournament categories', () => {
  it('keeps every filtered tournament in an explicit All category', () => {
    const visible = [tournament('mine'), tournament('playing'), tournament('open'), tournament('finished', 'team-1')]
    const { categories, relations } = buildHomeCategories(
      visible, new Set(['mine']), new Set(['playing']), new Set(['open']),
    )

    expect(categories[0]?.key).toBe('all')
    expect(categories[0]?.items.map(t => t.id)).toEqual(['mine', 'playing', 'open', 'finished'])
    expect(relations.get('mine')).toBe('run')
    expect(relations.get('playing')).toBe('playing')
  })

  it('does not hide finished tournaments from Other tournaments at the All stage', () => {
    const finished = tournament('finished', 'team-1')
    const { categories } = buildHomeCategories([finished], new Set(), new Set(), new Set())

    expect(categories.find(category => category.key === 'rest')?.items).toEqual([finished])
  })

  it('leaves the category list empty when the active filters have no results', () => {
    const { categories } = buildHomeCategories([], new Set(), new Set(), new Set())
    expect(categories).toEqual([])
  })
})
