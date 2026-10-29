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
import { MyJoinRequests } from './MyJoinRequests'
import { useNavigate } from 'react-router-dom'
import { Badge, Banner, Empty, Field, Panel } from '../../components/kit/primitives'
import { Icon } from '../../components/kit/Icon'
import { Avatar } from '../../components/kit/Avatar'
import { Modal } from '../../components/kit/Modal'
import {
  useAnswerBackendInvitation, useBackendMyInvitations, useBackendMyTeams, useCreateTeam,
} from '../../hooks/useTeam'
import { useCancelMyApplication, useMyTournamentApplications, useWithdrawMyApplication } from '../../hooks/useTournament'
import { useSportTypes } from '../../hooks/useReference'
import { USE_MOCK } from '../../api/client'
import { EnterTournamentButton } from '../tournament/EnterTournamentButton'
import { useReviews } from '../../hooks/useLiveEngagement'
import { fmtDateTime } from '../../shared/dateFormat'

const errorMessage = (error: unknown, fallback = 'Something went wrong.') =>
  error instanceof Error ? error.message : fallback
const accessDenied = (error: unknown) => [401, 403].includes((error as { status?: number } | null)?.status ?? 0)

function SourceFeedback({ source, name }: {
  source: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }
  name: 'teams' | 'invitations' | 'entries'
}) {
  if (source.isPending) {
    return <p className="sub" role="status">{name === 'teams' ? 'Loading your teams…' : `Loading ${name}…`}</p>
  }
  if (!source.isError) return null
  const status = (source.error as { status?: number } | null)?.status
  const message = status === 401 ? `Sign in to see your ${name}.`
    : status === 403 ? `You cannot view your ${name}.` : `Could not load your ${name}.`
  return (
    <div role="alert">
      <Banner kind="crit">
        <b>{message}</b> <span>{errorMessage(source.error, 'Please try again.')}</span>{' '}
        <button className="btn ghost" type="button" onClick={() => void source.refetch()}>Retry {name}</button>
      </Banner>
    </div>
  )
}

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
    <Modal open={open} onClose={close} label="Create a team" title="Create team">
      <div className="sub">
        You become its leader. The squad stays Forming until enough invited players accept — the
        minimum size follows from the sport.
      </div>
      <Field label="Name" htmlFor="nt-name">
        <input id="nt-name" maxLength={150} value={name} onChange={e => setName(e.target.value)} placeholder="Byte Force" />
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
          disabled={!name.trim() || name.trim().length > 150 || sportTypeId === '' || create.isPending}
          onClick={() => create.mutate({ name: name.trim(), sportTypeId: Number(sportTypeId) }, {
            onSuccess: team => {
              setName('')
              setSportTypeId('')
              onClose()
              navigate(`/team/${team.id}`)
            },
          })}>
          {create.isPending ? 'Creating…' : 'Create team'}
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
  const [search, setSearch] = useState('')
  const [sportFilter, setSportFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [withdrawPrompt, setWithdrawPrompt] = useState<{ applicationId: number; tournamentId: number; name: string } | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const reviewBeforeWithdraw = useReviews(withdrawPrompt?.tournamentId)
  const finishWithdrawal = async () => {
    if (!withdrawPrompt) return
    await withdrawApplication.mutateAsync(withdrawPrompt.applicationId)
    setWithdrawPrompt(null)
  }

  // ข้อมูล cache ใช้ต่อได้เมื่อระบบสะดุด แต่การปฏิเสธสิทธิ์ต้องซ่อนข้อมูลและปุ่มเดิม
  const items = accessDenied(teams.error) ? [] : teams.data?.items ?? []
  const invites = accessDenied(invitations.error) ? [] : invitations.data?.items ?? []
  const entries = accessDenied(applications.error) ? [] : applications.data?.items ?? []
  const sportName = (sportTypeId: number) =>
    sportTypes.data?.items.find(x => x.id === sportTypeId)?.name ?? `Sport #${sportTypeId}`
  const filtered = items.filter(team => team.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (!sportFilter || team.sportTypeId === Number(sportFilter))
    && (!roleFilter || team.role === roleFilter))
  const filtering = !!(search || sportFilter || roleFilter)
  const clearFilters = () => { setSearch(''); setSportFilter(''); setRoleFilter('') }
  // ใช้กีฬาของทีมที่โหลดแล้ว เพื่อให้ตัวกรองยังใช้ได้เมื่อข้อมูลอ้างอิงล้มเหลว
  const teamSports = [...new Set(items.map(team => team.sportTypeId))]

  return (
    <>
      <div className="spread teams-page-heading">
        <h1 className="disp">Teams</h1>
        <button className="btn primary" type="button" onClick={() => setCreating(true)}>
          <Icon name="plus" size={13} /> Create a team
        </button>
      </div>

      {notice ? <div role="status"><Banner kind="ok">{notice}</Banner></div> : null}
      {answerInvitation.isError ? (
        <div role="alert"><Banner kind="crit"><b>Couldn't answer the invitation.</b> {errorMessage(answerInvitation.error)}</Banner></div>
      ) : null}

      {!USE_MOCK ? <MyJoinRequests /> : null}
      <div className="teams-workspace">
        <section className="vstack teams-list" aria-labelledby="teams-list">
          <div className="spread"><h2 id="teams-list" className="journey-heading">Your teams</h2>
            <span className="sub" aria-live="polite">{items.length ? `${filtered.length} of ${items.length} teams` : ''}</span>
          </div>
          <div className="teams-filters">
            <Field label="Search teams" htmlFor="teams-search">
              <input type="search" id="teams-search" placeholder="Team name" value={search} onChange={e => setSearch(e.target.value)} />
            </Field>
            <Field label="Sport" htmlFor="teams-sport">
              <select id="teams-sport" aria-label="Sport filter" value={sportFilter} onChange={e => setSportFilter(e.target.value)}>
                <option value="">All sports</option>
                {teamSports.map(id => <option key={id} value={id}>{sportName(id)}</option>)}
              </select>
            </Field>
            <Field label="Role" htmlFor="teams-role">
              <select id="teams-role" aria-label="Role filter" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">All roles</option><option value="leader">Leader</option><option value="member">Member</option>
              </select>
            </Field>
          </div>
          {filtering ? <button className="btn ghost teams-clear" type="button" onClick={clearFilters}>Clear filters</button> : null}
          <SourceFeedback source={teams} name="teams" />
          {filtered.map(team => (
          <Panel key={team.id} className={`team-list-row ${team.role === 'leader' ? 'team-list-leader' : 'team-list-member'}`}>
            <div className="spread">
              <div className="vstack" style={{ gap: 5 }}>
                <div className="team-list-identity"><Avatar name={team.name} avatarUrl={team.logoUrl} size={40} alt={team.name} />
                  <h3 className="disp team-list-name">{team.name}</h3>
                  {team.role === 'leader' ? <span className="team-leader-sticker">Leader</span> : null}
                </div>
                <span className="sub">
                  {team.memberCount} member{team.memberCount === 1 ? '' : 's'} · {sportName(team.sportTypeId)}
                </span>
              </div>
              <span className="hstack">
                <Badge kind={team.readinessStatus === 'Ready' ? 'ok' : 'warn'}>{team.readinessStatus}</Badge>
                <Badge kind={team.officialStatus === 'Official' ? 'ok' : 'neutral'}>{team.officialStatus}</Badge>
                {team.role !== 'leader' ? <Badge kind="neutral">Member</Badge> : null}
              </span>
            </div>
            {team.readinessStatus === 'Forming' ? (
              <div className="sub">Needs more accepted players to enter a tournament.</div>
            ) : null}
            <div className="hstack">
              <button className="btn" type="button" onClick={() => navigate(`/team/${team.id}`)}>
                {team.role === 'leader' ? 'Manage team' : 'View team'} <Icon name="chev" size={11} />
              </button>
              {team.role === 'leader' && team.readinessStatus === 'Ready' ? (
                USE_MOCK ? (
                  <button className="btn ghost" type="button" onClick={() => navigate('/')}>Find tournament</button>
                ) : (
                  <EnterTournamentButton team={team} />
                )
              ) : null}
            </div>
          </Panel>
        ))}
        {teams.isSuccess && items.length > 0 && !filtered.length ? <Empty icon="search" title="No matching teams" sub="Try another name, sport or role." /> : null}

        {teams.isSuccess && !items.length ? (
          <Empty icon="team" title="You're not in a squad yet" sub="Create one, or wait for an invitation.">
            <button className="btn primary" type="button" onClick={() => setCreating(true)}>
              <Icon name="plus" size={13} /> Create a team
            </button>
          </Empty>
        ) : null}
        </section>

        <div className="teams-work-rail">
          <section className="teams-invitations" aria-labelledby="teams-invitations">
            <Panel>
              <h2 id="teams-invitations" className="journey-heading">Invitations</h2>
              <SourceFeedback source={invitations} name="invitations" />
              {invitations.isSuccess && !invites.length ? <p className="sub">No invitations right now.</p> : null}
              {invites.length ? <Banner kind="warn" icon="team">
                Accepting shares your faculty, year and date of birth with the organizer of any tournament
                this squad enters — that is how the eligibility check works.
              </Banner> : null}
              {invites.map(invitation => {
                const busy = answerInvitation.isPending && answerInvitation.variables?.invitationId === invitation.id
                return (
                  <div className="teams-work-row" key={invitation.id}>
                    <span>
                      <b>{invitation.team.name}</b><br />
                      <span className="sub">
                        Invited by {invitation.invitedBy.fullName} · expires {fmtDateTime(invitation.expiresAt)}
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
          </section>

          <section className="teams-entries" aria-labelledby="teams-entries">
            <Panel quiet>
              <h2 id="teams-entries" className="journey-heading">Entries</h2>
              <SourceFeedback source={applications} name="entries" />
              {cancelApplication.isError ? <div role="alert"><Banner kind="crit"><b>Couldn't cancel the application.</b> {errorMessage(cancelApplication.error)}</Banner></div> : null}
              {withdrawApplication.isError ? <div role="alert"><Banner kind="crit"><b>Couldn't withdraw.</b> {errorMessage(withdrawApplication.error)}</Banner></div> : null}
              {applications.isSuccess && !entries.length ? <p className="sub">No tournament entries yet.</p> : null}
              {entries.map(application => (
                <div className="teams-work-row" key={application.id}>
                  <span>
                    <b>{application.team.name}</b><br /><span className="sub">{application.tournament.name}</span>
                    {application.rejectionReason ? <><br /><span className="sub">{application.rejectionReason}</span></> : null}
                  </span>
                  <span className="hstack">
                    <Badge kind={application.status === 'approved' ? 'ok' : application.status === 'pending' ? 'warn' : 'crit'}>{application.status}</Badge>
                    <button className="btn" type="button" aria-label={`View entry for ${application.team.name} in ${application.tournament.name}`}
                      onClick={() => navigate(`/t/${application.tournament.id}`)}>View entry <Icon name="chev" size={11} /></button>
                    {application.status === 'pending' ? (
                      <button className="btn ghost" type="button" disabled={cancelApplication.isPending}
                        onClick={() => cancelApplication.mutate(application.id)}>Cancel</button>
                    ) : null}
                    {application.status === 'approved' ? (
                      <button className="btn ghost" type="button" disabled={withdrawApplication.isPending}
                        onClick={() => USE_MOCK ? withdrawApplication.mutate(application.id)
                          : setWithdrawPrompt({ applicationId: application.id, tournamentId: application.tournament.id, name: application.tournament.name })}>Withdraw</button>
                    ) : null}
                  </span>
                </div>
              ))}
            </Panel>
          </section>

        </div>
      </div>

      <Modal open={!!withdrawPrompt} onClose={() => setWithdrawPrompt(null)} label="Withdraw from tournament" title={withdrawPrompt?.name}>
        {reviewBeforeWithdraw.query.isPending ? <p className="sub">Checking the review window…</p> : null}
        {reviewBeforeWithdraw.query.data?.status === 'open' && reviewBeforeWithdraw.query.data.canSubmit ? <>
          <p className="sub">After withdrawal your team may no longer be eligible to review this tournament. You can review it now, or skip.</p>
          <Field label="Rating" htmlFor="withdraw-rating"><select id="withdraw-rating" value={reviewRating} onChange={event => setReviewRating(Number(event.target.value))}>
            {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value}/5</option>)}
          </select></Field>
          <Field label="Review (optional)" htmlFor="withdraw-review"><textarea id="withdraw-review" maxLength={1000} value={reviewText} onChange={event => setReviewText(event.target.value)} /></Field>
          {reviewBeforeWithdraw.submit.isError ? <p className="sub" role="alert">{errorMessage(reviewBeforeWithdraw.submit.error)}</p> : null}
          <button className="btn primary" type="button" disabled={reviewBeforeWithdraw.submit.isPending || withdrawApplication.isPending}
            onClick={async () => { try { await reviewBeforeWithdraw.submit.mutateAsync({ rating: reviewRating, content: reviewText }); await finishWithdrawal() } catch { /* errors appear above */ } }}>
            Save review and withdraw
          </button>
        </> : null}
        {reviewBeforeWithdraw.query.isError ? <p className="sub">Could not check review eligibility. You can still withdraw.</p> : null}
        {withdrawApplication.isError ? <p className="sub" role="alert">{errorMessage(withdrawApplication.error)}</p> : null}
        <div className="hstack"><button className="btn ghost" type="button" onClick={() => setWithdrawPrompt(null)}>Cancel</button>
          <button className="btn" type="button" disabled={withdrawApplication.isPending || reviewBeforeWithdraw.query.isPending}
            onClick={() => void finishWithdrawal().catch(() => {})}>{reviewBeforeWithdraw.query.data?.status === 'open' ? 'Skip review and withdraw' : 'Withdraw'}</button></div>
      </Modal>

      <CreateTeamModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
