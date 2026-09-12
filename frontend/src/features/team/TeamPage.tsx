import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Crumb, Empty, Panel, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { ApiError, USE_MOCK } from '../../api/client'
import { useBackendTeam, useBackendTeamMembers } from '../../hooks/useTeam'
import { numOf } from '../../mocks/storeBridge'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unable to load this team.'

export function TeamPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  // Search and legacy links still use store IDs in mock mode. The bridge is
  // intentionally disabled against the real backend, which accepts numeric IDs.
  const teamId = id && /^\d+$/.test(id) ? Number(id) : USE_MOCK && id ? numOf(id) : undefined
  const team = useBackendTeam(teamId)
  const members = useBackendTeamMembers(teamId)

  if (teamId === undefined) {
    return <Empty icon="team" title="Invalid team link"><button className="btn" type="button" onClick={() => navigate('/teams')}>Back to teams</button></Empty>
  }
  if (team.isPending) return <Panel><span className="sub">Loading team…</span></Panel>
  if (team.isError || !team.data) {
    return <Empty icon="team" title="Could not load this team"><p className="sub">{errorMessage(team.error)}</p><button className="btn" type="button" onClick={() => team.refetch()}>Try again</button></Empty>
  }

  const data = team.data
  const membersForbidden = members.error instanceof ApiError && members.error.status === 403
  return (
    <>
      <Crumb back={{ label: 'Teams', onClick: () => navigate('/teams') }}>{data.name}</Crumb>
      <Panel>
        <div className="spread">
          <span className="vstack" style={{ gap: 5 }}>
            <h1 className="disp" style={{ fontSize: 32 }}>{data.name}</h1>
            <span className="sub">Team leader: {data.leader.fullName} · Sport #{data.sportTypeId}</span>
          </span>
          <span className="hstack">
            <Badge kind={data.readinessStatus === 'Ready' ? 'ok' : 'warn'}>{data.readinessStatus}</Badge>
            <Badge kind={data.officialStatus === 'Official' ? 'ok' : 'neutral'}>{data.officialStatus}</Badge>
          </span>
        </div>
      </Panel>

      <Panel quiet>
        <div className="spread"><span className="tag"><em>//</em> Members · {data.memberCount}</span></div>
        {members.isPending ? <span className="sub">Loading members…</span> : null}
        {membersForbidden ? <span className="sub">Only team members can view this roster.</span> : null}
        {members.isError && !membersForbidden ? <div className="hstack"><span className="sub">{errorMessage(members.error)}</span><button className="btn ghost" type="button" onClick={() => members.refetch()}>Try again</button></div> : null}
        {members.data?.items.length === 0 ? <span className="sub">No members found.</span> : null}
        {members.data?.items.length ? (
          <TableWrap><table><thead><tr><th>Player</th><th>Position</th><th>Joined</th><th /></tr></thead><tbody>
            {members.data.items.map((member) => <tr key={member.userId}>
              <td><span className="hstack"><span className="avatar">{member.fullName.slice(0, 1)}</span>{member.fullName}{member.userId === data.leader.id ? <span className="tag"> · captain</span> : null}</span></td>
              <td className="sub">{member.position}</td><td className="sub">{new Date(member.joinedAt).toLocaleDateString()}</td>
              <td><button className="btn ghost" type="button" onClick={() => navigate(`/player/${member.userId}`)}>Profile <Icon name="chev" size={11} /></button></td>
            </tr>)}
          </tbody></table></TableWrap>
        ) : null}
      </Panel>
    </>
  )
}
