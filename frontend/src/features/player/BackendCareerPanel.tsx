import { Link } from 'react-router-dom'
import { Badge, Banner, Panel, TableWrap } from '../../components/kit/primitives'
import { useUserCareer } from '../../hooks/useUser'
import { useSportTypes } from '../../hooks/useReference'

export function BackendCareerPanel({ userId }: { userId: number | undefined }) {
  const career = useUserCareer(userId)
  const sports = useSportTypes()
  const items = career.data?.items
  const hidden = career.data?.statsHidden || items === null
  return (
    <Panel quiet className="player-career journey-data">
      <h2 className="journey-heading">Tournament history</h2>
      {career.isPending ? <p className="sub" role="status">Loading tournament history…</p> : null}
      {career.error ? <div role="alert"><Banner kind="crit">
        {career.error instanceof Error ? career.error.message : 'Unable to load tournament history.'}{' '}
        <button className="btn ghost" type="button" onClick={() => void career.refetch()}>Retry history</button>
      </Banner></div> : null}
      {career.isSuccess && !hidden && items && !items.length ? <p className="sub">No tournament history yet.</p> : null}
      {hidden ? <p className="sub">This player keeps their tournament history private.</p> : null}
      {!hidden && items?.length ? (
        <TableWrap label="Player tournament history">
          <table>
            <thead><tr><th>Tournament</th><th>Sport</th><th>Team</th><th>Played</th><th>Won</th><th>Lost</th><th>Finish</th></tr></thead>
            <tbody>{items.map(row => (
              <tr key={`${row.tournament.id}:${row.team.id}`}>
                <td><Link to={`/t/${row.tournament.id}`}>{row.tournament.name}</Link></td>
                <td>{sports.data?.items.find(s => s.id === row.tournament.sportTypeId)?.name ?? `Sport #${row.tournament.sportTypeId}`}</td>
                <td><Link to={`/team/${row.team.id}`}>{row.team.name}</Link>{row.withdrawn ? <> <Badge kind="neutral">Team withdrew</Badge></> : null}</td>
                <td className="num">{row.played}</td><td className="num">{row.wins}</td><td className="num">{row.losses}</td>
                <td>{row.champion ? 'Champion' : row.tournament.status}</td>
              </tr>
            ))}</tbody>
          </table>
        </TableWrap>
      ) : null}
    </Panel>
  )
}
