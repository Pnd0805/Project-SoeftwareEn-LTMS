import { ApiError } from '../../api/client'
import { ownResultRecovery, refereeInvitationRecovery } from '../../shared/refereeRecovery'
import { missingScheduleFields, scheduleErrorKind, scheduleFieldLabels } from '../../shared/matchScheduleErrors'

const field = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2')
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
  ? `${new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} (UTC+7)` : null
const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** Supplement the server message with delivered recovery details, without inventing counts or dates. */
export function ContractErrorDetails({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return null
  const e = error.extra
  if (scheduleErrorKind(error) === 'match') return <div>
    <p>The organizer must complete the match schedule before retrying this action.</p>
    {missingScheduleFields(error).length ? <p>Missing schedule fields: {missingScheduleFields(error).map(key => scheduleFieldLabels[key]).join(', ')}.</p> : null}
  </div>
  if (error.code === 'CANNOT_DISPUTE_OWN_RESULT') return <p>{ownResultRecovery(e.resultStatus, e.mode)}</p>
  if (error.code === 'REFEREE_INVITATION_EXPIRED') return <p>This referee invitation expired{date(e.expiresAt) ? ` at ${date(e.expiresAt)}` : ''}. Refresh your invitations and ask the organizer for a new invitation.</p>
  if (error.code === 'REFEREE_INVITATION_PENDING') return <p>Invitation{typeof e.tournamentRefereeId === 'number' ? ` #${e.tournamentRefereeId}` : ''} is awaiting a response{date(e.expiresAt) ? ` until ${date(e.expiresAt)}` : ''}. Ask the invitee to respond or cancel the invitation before inviting again.</p>
  if (error.code === 'TEAM_CONFLICT_OF_INTEREST') return <div>{(Array.isArray(e.conflicts) ? e.conflicts : [e]).map(record).map((row, i) => {
    const recovery = row.role === 'organizer' ? 'The tournament organizer cannot join a team entered in that tournament. Choose another eligible team or person.'
      : row.role === 'referee' ? refereeInvitationRecovery(row, 'team') : ''
    return recovery ? <p key={i}>{typeof row.userId === 'number' ? `Player #${row.userId}: ` : ''}{recovery}</p> : null
  })}</div>
  if (error.code === 'REFEREE_IDENTITY_KEY_INVALID') return <p>Upload new JPEG or PNG identity documents from your own account and submit them again.</p>
  if (error.code === 'TOURNAMENT_DATA_CONFLICT') return <div>
    <p>Existing fields to correct in the same request:</p>
    <ul>{Object.entries(record(e.conflictingFields)).map(([key, value]) => <li key={key}>{field(key)}: {String(value)}</li>)}</ul>
    {strings(e.requestedFields).length ? <p>Requested fields: {strings(e.requestedFields).map(field).join(', ')}</p> : null}
  </div>
  if (error.code === 'AMENDMENT_BREAKS_APPROVED_TEAMS') return <div>
    {typeof e.affectedTeamCount === 'number' ? <p>Affected approved teams: {e.affectedTeamCount}</p> : null}
    <ul>{(Array.isArray(e.affectedTeams) ? e.affectedTeams : []).map(record).map(team => <li key={String(team.teamId)}>
      {String(team.teamName ?? `Team #${team.teamId}`)}
      <ul>{(Array.isArray(team.players) ? team.players : []).map(record).map(player => <li key={String(player.userId)}>{String(player.fullName ?? `Player #${player.userId}`)} · {String(player.reason)}</li>)}</ul>
    </li>)}</ul>
  </div>
  if (error.code === 'TOURNAMENT_FULL') return <p>Approved teams: {typeof e.approvedTeams === 'number' ? e.approvedTeams : 'Not provided'} · Capacity: {typeof e.maxTeams === 'number' ? e.maxTeams : 'Not provided'}</p>
  if (error.code === 'TOO_EARLY_FOR_MATCH' || error.code === 'TOO_LATE_FOR_MATCH') return <div>
    {date(e.scheduledTime) ? <p>Scheduled: {date(e.scheduledTime)}</p> : null}
    {date(e.opensAt) ? <p>Available from: {date(e.opensAt)}</p> : null}
    {date(e.closesAt) ? <p>Check-in closed at: {date(e.closesAt)}. Ask the organizer to reschedule.</p> : null}
  </div>
  if (error.code === 'USE_AMENDMENT_REQUEST') return <div>
    {strings(e.amendmentFields).length ? <p>Request an amendment for: {strings(e.amendmentFields).map(field).join(', ')}</p> : null}
    {strings(e.immutableFields).length ? <p>Cannot change after creation: {strings(e.immutableFields).map(field).join(', ')}</p> : null}
  </div>
  return null
}
