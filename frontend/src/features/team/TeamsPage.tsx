/**
 * src/features/team/TeamsPage.tsx
 *
 * Your squads, the invitations waiting on you, and your tournament entries.
 * Adding a Player creates an Invitation, never a membership — accepting is what
 * exposes that player's eligibility data to an organizer, so the banner says so
 * before they click.
 *
 * backend: GET /me/teams · GET /me/invitations · POST /invitations/:id/accept|decline ·
 *   POST /teams · GET /me/applications · POST /applications/:id/cancel|withdraw
 * การจัดการรายชื่อ โลโก้ คำร้อง Official และการลบทีมอยู่ที่หน้าทีม (/team/:id)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Empty, Field, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Modal } from '../../components/kit/Modal'
import {
  useAnswerBackendInvitation, useBackendMyInvitations, useBackendMyTeams, useCreateTeam,
} from '../../hooks/useTeam'
import { useCancelMyApplication, useMyTournamentApplications, useWithdrawMyApplication } from '../../hooks/useTournament'
import { useSportTypes } from '../../hooks/useReference'
import { USE_MOCK } from '../../api/client'
import { EnterTournamentButton } from '../tournament/EnterTournamentButton'

const errorMessage = (error: unknown, fallback = 'Something went wrong.') =>
  error instanceof Error ? error.message : fallback

/** FR-TM-01 — POST /teams (409 TEAM_NAME_TAKEN · 422 TEAM_QUOTA_EXCEEDED) */
function CreateTeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const sportTypes = useSportTypes()
  const create = useCreateTeam()
  const [name, setName] = useState('')
  const [sportTypeId, setSportTypeId] = useState<number | ''>('')
  const sports = sportTypes.data?.items ?? []

  const close = () => { create.reset(); onClose() }

  return (
    <Modal open={open} onClose={close} label="Create a team" title="A squad names its sport when it is created">
      <div className="sub">
        You become its leader. The squad stays Forming until enough invited players accept — the
        minimum size follows from the sport.
      </div>
      <Field label="Name" htmlFor="nt-name">
        <input id="nt-name" value={name} onChange={e => setName(e.target.value)} placeholder="Byte Force" />
      </Field>
      <Field label="Sport" htmlFor="nt-sport">
        {sportTypes.isPending ? <div className="sub">Loading sports…</div>
          : sportTypes.isError ? (
            <div className="sub">
              Couldn't load the sports.{' '}
              <button className="btn ghost" type="button" onClick={() => void sportTypes.refetch()}>Try again</button>
            </div>
          ) : (
            <select id="nt-sport" value={sportTypeId}
              onChange={e => setSportTypeId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Choose a sport</option>
              {sports.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
      </Field>
      {create.isError ? <Banner kind="crit"><b>Couldn't create the squad.</b> {errorMessage(create.error)}</Banner> : null}
      <div className="hstack">
        <button className="btn" type="button" onClick={close}>Cancel</button>
        <button className="btn primary" type="button"
          disabled={!name.trim() || sportTypeId === '' || create.isPending}
          onClick={() => create.mutate({ name: name.trim(), sportTypeId: Number(sportTypeId) }, {
            onSuccess: team => {
              setName('')
              setSportTypeId('')
              onClose()
              navigate(`/team/${team.id}`)
            },
          })}>
          {create.isPending ? 'Creating…' : 'Create the squad'}
        </button>
      </div>
    </Modal>
  )
}

export function TeamsPage() {
  const navigate = useNavigate()
  const teams = useBackendMyTeams()
  const invitations = useBackendMyInvitations()
  const answerInvitation = useAnswerBackendInvitation()
  const applications = useMyTournamentApplications()
  const cancelApplication = useCancelMyApplication()
  const withdrawApplication = useWithdrawMyApplication()
  const sportTypes = useSportTypes()
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (teams.isPending) {
    return <Panel><span className="sub">Loading your teams…</span></Panel>
  }

  if (teams.isError) {
    const status = (teams.error as { status?: number } | null)?.status
    return (
      <Empty icon="team" title={status === 401 ? 'Sign in to see your teams' : 'Could not load your teams'}>
        <p className="sub">{errorMessage(teams.error, 'Unable to load your teams.')}</p>
        <button className="btn" type="button" onClick={() => teams.refetch()}>Try again</button>
      </Empty>
    )
  }

  const items = teams.data.items
  const invites = invitations.data?.items ?? []
  const sportName = (sportTypeId: number) =>
    sportTypes.data?.items.find(x => x.id === sportTypeId)?.name ?? `Sport #${sportTypeId}`

  return (
    <>
      <div className="spread">
        <h1 className="disp" style={{ fontSize: 32 }}>Teams</h1>
        <button className="btn primary" type="button" onClick={() => setCreating(true)}>
          <Icon name="plus" size={13} /> Create a team
        </button>
      </div>

      {notice ? <Banner kind="ok">{notice}</Banner> : null}

      {invites.length ? (
        <Panel>
          <span className="tag"><em>//</em> Invitations waiting on you</span>
          <Banner kind="warn" icon="team">
            Accepting shares your faculty, year and date of birth with the organizer of any tournament
            this squad enters — that is how the eligibility check works.
          </Banner>
          {answerInvitation.isError ? (
            <Banner kind="crit"><b>Couldn't answer the invitation.</b> {errorMessage(answerInvitation.error)}</Banner>
          ) : null}
          {invites.map(invitation => {
            const busy = answerInvitation.isPending && answerInvitation.variables?.invitationId === invitation.id
            return (
              <div className="spread" key={invitation.id}>
                <span>
                  <b>{invitation.team.name}</b><br />
                  <span className="sub">
                    Invited by {invitation.invitedBy.fullName} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="hstack">
                  <button className="btn ghost" type="button" disabled={answerInvitation.isPending}
                    onClick={() => {
                      setNotice(null)
                      answerInvitation.mutate({ invitationId: invitation.id, accept: false }, {
                        onSuccess: () => setNotice(`Declined the invitation from ${invitation.team.name}.`),
                      })
                    }}>
                    {busy && !answerInvitation.variables?.accept ? 'Declining…' : 'Decline'}
                  </button>
                  <button className="btn primary" type="button" disabled={answerInvitation.isPending}
                    onClick={() => {
                      setNotice(null)
                      answerInvitation.mutate({ invitationId: invitation.id, accept: true }, {
                        onSuccess: () => setNotice(`You joined ${invitation.team.name}.`),
                      })
                    }}>
                    {busy && answerInvitation.variables?.accept ? 'Accepting…' : 'Accept invitation'}
                  </button>
                </span>
              </div>
            )
          })}
        </Panel>
      ) : null}

      {applications.data?.items.length ? (
        <Panel quiet>
          <span className="tag"><em>//</em> Your tournament applications</span>
          {cancelApplication.isError ? <Banner kind="crit"><b>Couldn't cancel the application.</b> {errorMessage(cancelApplication.error)}</Banner> : null}
          {withdrawApplication.isError ? <Banner kind="crit"><b>Couldn't withdraw.</b> {errorMessage(withdrawApplication.error)}</Banner> : null}
          {applications.data.items.map(application => (
            <div className="spread" key={application.id}>
              <span>
                <b>{application.team.name}</b><br /><span className="sub">{application.tournament.name}</span>
                {application.rejectionReason ? <><br /><span className="sub">{application.rejectionReason}</span></> : null}
              </span>
              <span className="hstack">
                <Badge kind={application.status === 'approved' ? 'ok' : application.status === 'pending' ? 'warn' : 'crit'}>{application.status}</Badge>
                {application.status === 'pending' ? (
                  <button className="btn ghost" type="button" disabled={cancelApplication.isPending}
                    onClick={() => cancelApplication.mutate(application.id)}>Cancel</button>
                ) : null}
                {application.status === 'approved' ? (
                  <button className="btn ghost" type="button" disabled={withdrawApplication.isPending}
                    onClick={() => withdrawApplication.mutate(application.id)}>Withdraw</button>
                ) : null}
              </span>
            </div>
          ))}
        </Panel>
      ) : null}

      {items.map(team => (
        <Panel key={team.id}>
          <div className="spread">
            <span className="vstack" style={{ gap: 5 }}>
              <b className="disp" style={{ fontSize: 21 }}>{team.name}</b>
              <span className="sub">
                {team.memberCount} member{team.memberCount === 1 ? '' : 's'} · {sportName(team.sportTypeId)}
              </span>
            </span>
            <span className="hstack">
              <Badge kind={team.readinessStatus === 'Ready' ? 'ok' : 'warn'}>{team.readinessStatus}</Badge>
              <Badge kind={team.officialStatus === 'Official' ? 'ok' : 'neutral'}>{team.officialStatus}</Badge>
              <Badge kind="neutral">{team.role === 'leader' ? 'You lead this squad' : 'You play here'}</Badge>
            </span>
          </div>
          {team.readinessStatus === 'Forming' ? (
            <div className="sub">Forming — it needs more accepted players before it can register for a tournament.</div>
          ) : null}
          <div className="hstack">
            <button className="btn" type="button" onClick={() => navigate(`/team/${team.id}`)}>
              {team.role === 'leader' ? 'Manage the squad' : 'Open'} <Icon name="chev" size={11} />
            </button>
            {team.role === 'leader' && team.readinessStatus === 'Ready' ? (
              USE_MOCK ? (
                <button className="btn ghost" type="button" onClick={() => navigate('/')}>Find a tournament to enter</button>
              ) : (
                <EnterTournamentButton team={team} />
              )
            ) : null}
          </div>
        </Panel>
      ))}

      {!items.length && !invites.length ? (
        <Empty icon="team" title="You're not in a squad yet" sub="Create one, or wait for an invitation.">
          <button className="btn primary" type="button" onClick={() => setCreating(true)}>
            <Icon name="plus" size={13} /> Create a team
          </button>
        </Empty>
      ) : null}

      <CreateTeamModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
