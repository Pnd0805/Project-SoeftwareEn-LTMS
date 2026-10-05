import { Link } from 'react-router-dom'
import { Badge, Banner, Panel, TableWrap } from '../../components/kit/primitives'
import { useUserCareer } from '../../hooks/useUser'
import { useSportTypes } from '../../hooks/useReference'

/**
 * U14 — ประวัติรายทัวร์ · OD-46: เจ้าของปิดสถิติไว้ ⇒ `{ items: null, statsHidden: true }` ตอบ 200
 * เดิมอ่าน `items.length` ตรง ๆ หน้าผู้เล่นที่ปิดสถิติจึงพังทั้งหน้า · null ≠ [] — [] คือ "ไม่เคยลงแข่ง"
 */
export function BackendCareerPanel({ userId }: { userId: number | undefined }) {
  const career = useUserCareer(userId); const sports = useSportTypes()
  const items = career.data?.items
  return <Panel quiet><h3>Career by tournament</h3>
    {career.isPending ? <p>Loading tournament history...</p> : null}
    {career.error ? <Banner kind="crit">{career.error instanceof Error ? career.error.message : 'Unable to load tournament history.'}<button className="btn" onClick={() => void career.refetch()}>Retry</button></Banner> : null}
    {career.isSuccess && (career.data.statsHidden || items === null) ? <p className="sub">This player keeps their tournament history private.</p> : null}
    {career.isSuccess && items && !items.length ? <p>No tournament history yet.</p> : null}
    {items?.length ? <TableWrap><table><thead><tr><th>Tournament</th><th>Sport</th><th>Team</th><th>Played</th><th>Won</th><th>Lost</th><th>Finish</th></tr></thead><tbody>{items.map(row => <tr key={`${row.tournament.id}:${row.team.id}`}><td><Link to={`/t/${row.tournament.id}`}>{row.tournament.name}</Link></td><td>{sports.data?.items.find(s => s.id === row.tournament.sportTypeId)?.name ?? `Sport #${row.tournament.sportTypeId}`}</td><td><Link to={`/team/${row.team.id}`}>{row.team.name}</Link>{row.withdrawn ? <> <Badge kind="neutral">Team withdrew</Badge></> : null}</td><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.champion ? 'Champion' : row.tournament.status}</td></tr>)}</tbody></table></TableWrap> : null}
  </Panel>
}
