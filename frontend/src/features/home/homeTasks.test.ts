import { describe, expect, it } from 'vitest'
import type { HomeTask, HomeTaskFeed } from './homeTasks'
import { composeHomeTasks, mockHomeTasks } from './homeTasks'
import type { WorkEntry } from './workQueue'

describe('home tasks', () => {
  it('turns each nested mock work item into a stable direct-link task', () => {
    const entry: WorkEntry = {
      kind: 'crit',
      what: '2 disputed results to settle',
      where: 'Campus Cup · your decision is final',
      href: '/m/12',
      items: [
        { label: 'Semi-final 1', sub: 'Law vs Science', href: '/m/12' },
        { label: 'Semi-final 2', sub: 'Engineering vs Medicine', href: '/m/13' },
      ],
    }

    const tasks = mockHomeTasks([entry])

    expect(tasks.map(task => task.href)).toEqual(['/m/12', '/m/13'])
    expect(tasks).toHaveLength(entry.items.length)
    expect(tasks.map(task => task.urgency)).toEqual(['urgent', 'urgent'])
    expect(tasks.map(task => task.source)).toEqual(['mock', 'mock'])
    expect(tasks.map(task => task.key)).toEqual(mockHomeTasks([entry]).map(task => task.key))
    expect(new Set(tasks.map(task => task.key)).size).toBe(tasks.length)
  })

  it('orders urgent, waiting, then ready tasks and keeps the first duplicate key', () => {
    const task = (key: string, urgency: HomeTask['urgency']): HomeTask => ({
      key,
      source: 'mock',
      label: key,
      context: 'Campus Cup',
      urgency,
      href: `/${key}`,
    })
    const feed = (tasks: HomeTask[]): HomeTaskFeed => ({
      source: 'mock',
      label: 'Your tasks',
      state: 'ready',
      tasks,
      retry: () => {},
    })

    const result = composeHomeTasks([
      feed([task('match:13', 'ready')]),
      feed([task('team:4', 'waiting')]),
      feed([task('match:12', 'urgent'), { ...task('match:12', 'urgent'), label: 'Duplicate' }]),
    ])

    expect(result.tasks.map(item => item.key)).toEqual(['match:12', 'team:4', 'match:13'])
    expect(result.loading).toBe(false)
    expect(result.failed).toEqual([])
  })

  it('reports loading and failed feeds independently', () => {
    const loading: HomeTaskFeed = { source: 'team', label: 'Team invitations', state: 'loading', tasks: [], retry: () => {} }
    const failed: HomeTaskFeed = { source: 'match', label: 'Matches', state: 'failed', tasks: [], retry: () => {} }

    const result = composeHomeTasks([loading, failed])

    expect(result.loading).toBe(true)
    expect(result.failed).toEqual([failed])
  })
})
