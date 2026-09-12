import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Crumb, Empty, Panel, TableWrap } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { ApiError, USE_MOCK } from '../../api/client'
import { useCancelTeamInvitation, useInviteMember, useTeamInvitations, useBackendTeam, useBackendTeamMembers } from '../../hooks/useTeam'
import { numOf } from '../../mocks/storeBridge'
import { useMe } from '../../hooks/useAuth'
import { useSearchUsers } from '../../hooks/useUser'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unable to load this team.'

export function TeamPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  // Search and legacy links still use store IDs in mock mode. The bridge is
  // intentionally disabled against the real backend, which accepts numeric IDs.
  const teamId = id && /^\d+$/.test(id) ? Number(id) : USE_MOCK && id ? numOf(id) : undefined
  const team = useBackendTeam(teamId)
  const members = useBackendTeamMembers(teamId)
  const { data: currentUser } = useMe()
  const invitations = useTeamInvitations(teamId)
  const invite = useInviteMember(teamId ?? 0)
  const cancelInvitation = useCancelTeamInvitation(teamId ?? 0)
  const [search, setSearch] = useState('')
  const users = useSearchUsers(search, !!teamId)

  if (teamId === undefined) {
    return <Empty icon="team" title="Invalid team link"><button className="btn" type="button" onClick={() => navigate('/teams')}>Back to teams</button></Empty>
  }
  if (team.isPending) return <Panel><span className="sub">Loading team…</span></Panel>
  if (team.isError || !team.data) {
    return <Empty icon="team" title="Could not load this team"><p className="sub">{errorMessage(team.error)}</p><button className="btn" type="button" onClick={() => team.refetch()}>Try again</button></Empty>
  }

  const data = team.data
  const isLeader = currentUser?.id === data.leader.id
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

      {isLeader ? <Panel quiet>
        <span className="tag"><em>//</em> Invitation management</span>
        <div className="hstack" style={{ marginTop: 10 }}>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users by name" aria-label="Search users to invite" />
        </div>
        {users.data?.items.map(person => <div className="spread" key={person.id}>
          <span>{person.fullName}</span>
          <button className="btn primary" type="button" disabled={invite.isPending} onClick={() => invite.mutate({ userId: person.id })}>Invite</button>
        </div>)}
        {search.trim().length >= 3 && users.isPending ? <span className="sub">Searching users…</span> : null}
        {search.trim().length >= 3 && users.isError ? <span className="sub">{errorMessage(users.error)}</span> : null}
        {invitations.isPending ? <span className="sub">Loading sent invitations…</span> : null}
        {invitations.data?.items.length ? <TableWrap><table><thead><tr><th>Invited user</th><th>Status</th><th /></tr></thead><tbody>
          {invitations.data.items.map(invitation => <tr key={invitation.id}><td>{invitation.invitedUser.fullName}</td><td className="sub">{invitation.status}</td><td>{invitation.status === 'pending' ? <button className="btn ghost" type="button" disabled={cancelInvitation.isPending} onClick={() => cancelInvitation.mutate(invitation.id)}>Cancel</button> : null}</td></tr>)}
        </tbody></table></TableWrap> : null}
      </Panel> : null}

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
