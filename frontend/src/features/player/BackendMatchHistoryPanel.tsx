import { Link } from 'react-router-dom'
import { Badge, Banner, Panel, TableWrap } from '../../components/kit/primitives'
import { useUserMatchHistory } from '../../hooks/useUser'
import { fmtDate } from '../../shared/rules'

export function BackendMatchHistoryPanel({ userId }: { userId: number | undefined }) {
  const history = useUserMatchHistory(userId)
  const hidden = history.data?.statsHidden || history.data?.items === null
  return <Panel quiet><h3>Match history</h3>
    {history.isPending ? <p>Loading match history…</p> : null}
    {history.isError ? <Banner kind="crit">Unable to load match history. <button className="btn" onClick={() => void history.refetch()}>Retry</button></Banner> : null}
    {hidden ? <p className="sub">This player keeps their match history private.</p> : null}
    {history.isSuccess && !hidden && !history.data.items?.length ? <p>No match history yet.</p> : null}
    {!hidden && history.data?.items?.length ? <TableWrap><table>
      <thead><tr><th>Played</th><th>Tournament</th><th>Team</th><th>Opponent</th><th>Score</th><th>Result</th><th /></tr></thead>
      <tbody>{history.data.items.map(row => <tr key={row.matchId}>
        <td>{row.playedAt ? fmtDate(row.playedAt) : '—'}</td>
        <td><Link to={`/t/${row.tournament.id}`}>{row.tournament.name}</Link></td>
        <td><Link to={`/team/${row.team.id}`}>{row.team.name}</Link>{row.withdrawn ? <> <Badge kind="neutral">Team withdrew</Badge></> : null}</td>
        <td>{row.opponent ? <Link to={`/team/${row.opponent.id}`}>{row.opponent.name}</Link> : '—'}</td>
        <td>{row.scoreData && row.opponent ? `${row.scoreData[String(row.team.id)] ?? '—'} – ${row.scoreData[String(row.opponent.id)] ?? '—'}` : '—'}</td>
        <td>{row.result === 'win' ? 'Win' : row.result === 'loss' ? 'Loss' : '—'}</td>
        <td><Link className="btn" to={`/m/${row.matchId}`}>Open match #{row.matchId}</Link></td>
      </tr>)}</tbody>
    </table></TableWrap> : null}
  </Panel>
}
