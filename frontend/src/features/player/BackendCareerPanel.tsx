import { Link } from 'react-router-dom'
import { Banner, Panel, TableWrap } from '../../components/kit/primitives'
import { useUserCareer } from '../../hooks/useUser'
import { useSportTypes } from '../../hooks/useReference'
export function BackendCareerPanel({ userId }: { userId: number | undefined }) {
  const career = useUserCareer(userId); const sports = useSportTypes()
  return <Panel quiet><h3>Career by tournament</h3>
    {career.isPending ? <p>Loading tournament history...</p> : null}
    {career.error ? <Banner kind="crit">{career.error instanceof Error ? career.error.message : 'Unable to load tournament history.'}<button className="btn" onClick={() => void career.refetch()}>Retry</button></Banner> : null}
    {career.isSuccess && !career.data.items.length ? <p>No tournament history yet.</p> : null}
    {career.data?.items.length ? <TableWrap><table><thead><tr><th>Tournament</th><th>Sport</th><th>Team</th><th>Played</th><th>Won</th><th>Lost</th><th>Finish</th></tr></thead><tbody>{career.data.items.map(row => <tr key={`${row.tournament.id}:${row.team.id}`}><td><Link to={`/t/${row.tournament.id}`}>{row.tournament.name}</Link></td><td>{sports.data?.items.find(s => s.id === row.tournament.sportTypeId)?.name ?? `Sport #${row.tournament.sportTypeId}`}</td><td><Link to={`/team/${row.team.id}`}>{row.team.name}</Link></td><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.champion ? 'Champion' : row.tournament.status}</td></tr>)}</tbody></table></TableWrap> : null}
  </Panel>
}
