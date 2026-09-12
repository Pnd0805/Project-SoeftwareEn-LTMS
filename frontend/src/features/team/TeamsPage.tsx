import { useNavigate } from 'react-router-dom'
import { Badge, Empty, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { useAnswerBackendInvitation, useBackendMyInvitations, useBackendMyTeams } from '../../hooks/useTeam'
import { useMyTournamentApplications } from '../../hooks/useTournament'

function teamErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load your teams.'
}

/**
 * Current-backend team list. Team creation and invitation management remain on
 * their legacy/mock views until their full UI DTOs are reconciled.
 */
export function TeamsPage() {
  const navigate = useNavigate()
  const teams = useBackendMyTeams()
  const invitations = useBackendMyInvitations()
  const answerInvitation = useAnswerBackendInvitation()
  const applications = useMyTournamentApplications()

  if (teams.isPending) {
    return <Panel><span className="sub">Loading your teams…</span></Panel>
  }

  if (teams.isError) {
    return (
      <Empty icon="team" title="Could not load your teams">
        <p className="sub">{teamErrorMessage(teams.error)}</p>
        <button className="btn" type="button" onClick={() => teams.refetch()}>Try again</button>
      </Empty>
    )
  }

  const items = teams.data?.items ?? []
  if (!items.length && !invitations.data?.items.length) {
    return (
      <Empty icon="team" title="You are not in any teams yet">
        <p className="sub">Create a team or accept an invitation to register for a tournament.</p>
      </Empty>
    )
  }

  return (
    <>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 32 }}>Teams</h1>
        <span className="tag">{items.length} team{items.length === 1 ? '' : 's'}</span>
      </div>

      {invitations.data?.items.length ? <Panel>
        <span className="tag"><em>//</em> Team invitations</span>
        {invitations.data.items.map((invitation) => <div className="spread" key={invitation.id}>
          <span><b>{invitation.team.name}</b><br /><span className="sub">Invited by {invitation.invitedBy.fullName} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</span></span>
          <span className="hstack">
            <button className="btn ghost" type="button" disabled={answerInvitation.isPending} onClick={() => answerInvitation.mutate({ invitationId: invitation.id, accept: false })}>Decline</button>
            <button className="btn primary" type="button" disabled={answerInvitation.isPending} onClick={() => answerInvitation.mutate({ invitationId: invitation.id, accept: true })}>Accept</button>
          </span>
        </div>)}
      </Panel> : null}

      {applications.data?.items.length ? <Panel quiet>
        <span className="tag"><em>//</em> Your tournament applications</span>
        {applications.data.items.map(application => <div className="spread" key={application.id}>
          <span><b>{application.team.name}</b><br /><span className="sub">{application.tournament.name}</span>{application.rejectionReason ? <><br /><span className="sub">{application.rejectionReason}</span></> : null}</span>
          <Badge kind={application.status === 'approved' ? 'ok' : application.status === 'pending' ? 'warn' : 'crit'}>{application.status}</Badge>
        </div>)}
      </Panel> : null}

      {items.map((team) => (
        <Panel key={team.id}>
          <div className="spread">
            <span className="vstack" style={{ gap: 5 }}>
              <b className="disp" style={{ fontSize: 21 }}>{team.name}</b>
              <span className="sub">{team.memberCount} member{team.memberCount === 1 ? '' : 's'} · Sport #{team.sportTypeId}</span>
            </span>
            <span className="hstack">
              <Badge kind={team.readinessStatus === 'Ready' ? 'ok' : 'warn'}>{team.readinessStatus}</Badge>
              <Badge kind={team.officialStatus === 'Official' ? 'ok' : 'neutral'}>{team.officialStatus}</Badge>
              <span className="tag">{team.role}</span>
              <button className="btn ghost" type="button" onClick={() => navigate(`/team/${team.id}`)}>
                Open <Icon name="chev" size={11} />
              </button>
            </span>
          </div>
        </Panel>
      ))}
    </>
  )
}
