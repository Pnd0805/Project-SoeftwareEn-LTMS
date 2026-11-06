import { useState } from 'react'
import { Panel } from '../../components/kit/primitives'
import { usePickemLeaderboard } from '../../hooks/useLiveEngagement'

export function PickemLeaderboardPanel({ tournamentId }: { tournamentId: number }) {
  const [page, setPage] = useState(1)
  const leaderboard = usePickemLeaderboard(tournamentId, page, 20)
  const data = !leaderboard.isError && !leaderboard.isPending ? leaderboard.data : undefined
  const pagination = data?.pagination
  const readable = pagination?.page === page
  return <Panel quiet>
    <div className="spread"><span className="tag"><em>//</em> Pick'em leaderboard</span>
      <button className="btn ghost" disabled={leaderboard.isFetching} onClick={() => void leaderboard.refetch()}>Refresh leaderboard</button>
    </div>
    <p className="sub">New results can take up to 5 seconds to appear.</p>
    {leaderboard.isPending ? <p className="sub">Loading leaderboard…</p> : null}
    {leaderboard.isError || (data && !readable) ? <p role="alert" className="sub">Unable to load leaderboard. Please refresh and try again.</p> : null}
    {readable && data ? <>
      {data.items.length === 0 ? <p className="sub">{pagination.totalItems === 0 ? 'No settled predictions yet.' : 'No entries on this page.'}</p> : null}
      {data.items.map(row => <div className="spread" key={row.user.id}>
        <span>#{row.rank} {row.user.fullName}</span><span>{row.points} points · {row.correct}/{row.settled}</span>
      </div>)}
      <div className="hstack">
        <button className="btn" disabled={page <= 1 || leaderboard.isFetching} onClick={() => setPage(page - 1)}>Previous leaderboard page</button>
        <span className="tag">Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.totalItems} players</span>
        <button className="btn" disabled={page >= pagination.totalPages || leaderboard.isFetching} onClick={() => setPage(page + 1)}>Next leaderboard page</button>
      </div>
    </> : null}
  </Panel>
}
