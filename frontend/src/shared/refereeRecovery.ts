const time = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' }) + ' (UTC+7)' : null

export function refereeInvitationRecovery(row: { invitationStatus?: unknown; expiresAt?: unknown }) {
  if (row.invitationStatus === 'pending') return `Referee invitation is awaiting a response${time(row.expiresAt) ? ` until ${time(row.expiresAt)}` : ''}. Ask the invitee to decline it or the organizer to cancel it, then retry. An expired invitation stops blocking entry.`
  if (row.invitationStatus === 'accepted') return 'This person accepted the referee role. Change the team membership or ask the organizer to end the referee role before retrying; unchecking a player does not remove this team-wide conflict.'
  return ''
}

export function ownResultRecovery(status: unknown, mode: unknown) {
  if (status === 'submitted' && mode === 'onsite') return 'Resubmit the corrected result before it is verified.'
  if (status === 'submitted' && mode === 'online') return 'Use Edit result with a correction reason before it is verified.'
  if (status === 'verified') return 'Ask a team leader or another authorized referee to dispute it within the dispute window, or file a result complaint after that window.'
  return 'Ask a team leader or another authorized referee to review the result.'
}
