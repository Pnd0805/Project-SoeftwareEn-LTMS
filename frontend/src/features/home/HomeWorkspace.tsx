import { HomeTaskPanel } from './HomeTaskPanel'
import type { HomeTaskFeed } from './homeTasks'
import { NextMatchPanel, type UpcomingMatch } from './NextMatchPanel'

export function HomeWorkspace({ feeds, matches }: {
  feeds: readonly HomeTaskFeed[]
  matches: {
    data?: { items: readonly UpcomingMatch[] }
    isPending: boolean
    isError: boolean
    error?: unknown
    refetch: () => unknown
  }
}) {
  const status = (matches.error as { status?: number } | null)?.status
  const denied = matches.isError && (status === 401 || status === 403)

  return <div className="home-workspace">
    <HomeTaskPanel feeds={feeds} />
    <NextMatchPanel matches={denied ? [] : matches.data?.items ?? []}
      pending={matches.isPending} failed={matches.isError}
      onRetry={() => { void matches.refetch() }} />
  </div>
}
