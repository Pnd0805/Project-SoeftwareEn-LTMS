import type { Tournament } from '../../shared/types'
import type { Rel } from './TournamentCard'

export interface HomeCategory {
  key: string
  label: string
  items: Tournament[]
  rel: Rel
}

/** "All" mirrors the active filters instead of aliasing the first relationship tab. */
export function buildHomeCategories(
  visible: Tournament[],
  mineIds: ReadonlySet<string>,
  playingIds: ReadonlySet<string>,
  openIds: ReadonlySet<string>,
) {
  const mine = visible.filter(t => mineIds.has(t.id))
  const playing = visible.filter(t => !mineIds.has(t.id) && playingIds.has(t.id))
  const open = visible.filter(t => !mineIds.has(t.id) && !playingIds.has(t.id) && openIds.has(t.id))
  const rest = visible.filter(t => !mineIds.has(t.id) && !playingIds.has(t.id) && !openIds.has(t.id))
  const relations = new Map<string, Rel>()
  mine.forEach(t => relations.set(t.id, 'run'))
  playing.forEach(t => relations.set(t.id, 'playing'))

  const allCategories: HomeCategory[] = [
    { key: 'all', label: `All · ${visible.length}`, items: visible, rel: null },
    { key: 'mine', label: `Yours to run · ${mine.length}`, items: mine, rel: 'run' },
    { key: 'playing', label: `You're competing in · ${playing.length}`, items: playing, rel: 'playing' },
    { key: 'open', label: `Open for entry · ${open.length}`, items: open, rel: null },
    { key: 'rest', label: `Other tournaments · ${rest.length}`, items: rest, rel: null },
  ]
  const categories = visible.length
    ? allCategories.filter(category => category.key === 'all' || category.items.length)
    : []

  return { categories, relations }
}
