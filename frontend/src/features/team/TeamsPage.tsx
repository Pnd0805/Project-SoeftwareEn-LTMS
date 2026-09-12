import { useNavigate } from 'react-router-dom'
import { Badge, Empty, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { useBackendMyTeams } from '../../hooks/useTeam'

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
  if (!items.length) {
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
