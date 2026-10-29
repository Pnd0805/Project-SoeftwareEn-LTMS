import type { WorkEntry, WorkKind } from './workQueue'

export type HomeTask = {
  key: string
  source: 'team' | 'referee' | 'match' | 'tournament' | 'admin' | 'mock'
  label: string
  context: string
  urgency: 'urgent' | 'waiting' | 'ready'
  href: string
  detail?: string
}

export type HomeTaskFeed = {
  source: HomeTask['source']
  label: string
  state: 'loading' | 'ready' | 'failed'
  tasks: HomeTask[]
  retry: () => void
}

const urgencyByKind: Record<WorkKind, HomeTask['urgency']> = {
  crit: 'urgent',
  warn: 'waiting',
  ok: 'ready',
}

const urgencyOrder: Record<HomeTask['urgency'], number> = {
  urgent: 0,
  waiting: 1,
  ready: 2,
}

export function composeHomeTasks(feeds: readonly HomeTaskFeed[]): {
  tasks: HomeTask[]
  loading: boolean
  failed: HomeTaskFeed[]
} {
  const seen = new Set<string>()
  const tasks = feeds.flatMap(feed => feed.tasks).filter(task => {
    if (seen.has(task.key)) return false
    seen.add(task.key)
    return true
  }).sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  return {
    tasks,
    loading: feeds.some(feed => feed.state === 'loading'),
    failed: feeds.filter(feed => feed.state === 'failed'),
  }
}

export function mockHomeTasks(entries: readonly WorkEntry[]): HomeTask[] {
  const duplicateCounts = new Map<string, number>()

  return entries.flatMap(entry => entry.items.map(item => {
    const identity = JSON.stringify([
      entry.kind, entry.what, entry.where, entry.href, item.href, item.label, item.sub,
    ])
    const duplicateIndex = duplicateCounts.get(identity) ?? 0
    duplicateCounts.set(identity, duplicateIndex + 1)

    return {
      key: `mock:${identity}${duplicateIndex ? `:${duplicateIndex}` : ''}`,
      source: 'mock',
      label: entry.what,
      context: entry.where,
      detail: [item.label, item.sub].filter(Boolean).join(' · ') || undefined,
      urgency: urgencyByKind[entry.kind],
      href: item.href,
    }
  }))
}
