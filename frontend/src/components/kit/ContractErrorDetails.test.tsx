import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { ContractErrorDetails } from './ContractErrorDetails'
it('distinguishes the broken existing fields from the fields requested by the organizer', () => {
  render(<ContractErrorDetails error={new ApiError(409, { code: 'TOURNAMENT_DATA_CONFLICT', message: 'Conflict', conflictingFields: { eventStartDate: 'must follow registrationEnd' }, requestedFields: ['genderRequirement'] })} />)
  expect(screen.getByText('event Start Date: must follow registrationEnd')).toBeInTheDocument()
  expect(screen.getByText('Requested fields: gender Requirement')).toBeInTheDocument()
})
it('shows affected teams and players from server metadata without substituting the approved count', () => {
  render(<ContractErrorDetails error={new ApiError(409, { code: 'AMENDMENT_BREAKS_APPROVED_TEAMS', message: 'Conflict', affectedTeamCount: 1, affectedTeams: [{ teamId: 3, teamName: 'Alpha', players: [{ userId: 5, fullName: 'Player A', reason: 'age' }] }] })} />)
  expect(screen.getByText('Affected approved teams: 1')).toBeInTheDocument()
  expect(screen.getByText('Player A · age')).toBeInTheDocument()
})
it('explains the server time window in Bangkok without creating a missing closing time', () => {
  render(<ContractErrorDetails error={new ApiError(409, { code: 'TOO_EARLY_FOR_MATCH', message: 'Early', opensAt: '2026-10-07T03:00:00Z' })} />)
  expect(screen.getByText(/Available from:.*10:00:00.*UTC\+7/)).toBeInTheDocument()
  expect(screen.queryByText(/Check-in closed/)).not.toBeInTheDocument()
})

it('uses result status and mode from an own-result error rather than interpreting its message', () => {
  const { rerender } = render(<ContractErrorDetails error={new ApiError(403, { code: 'CANNOT_DISPUTE_OWN_RESULT', message: 'Unrelated message', resultStatus: 'verified', mode: 'online' })} />)
  expect(screen.getByText(/Ask a team leader or another authorized referee to dispute/)).toBeInTheDocument()
  expect(screen.queryByText(/Use Edit result/)).not.toBeInTheDocument()
  rerender(<ContractErrorDetails error={new ApiError(403, { code: 'CANNOT_DISPUTE_OWN_RESULT', message: 'Unrelated message', resultStatus: 'submitted', mode: 'onsite' })} />)
  expect(screen.getByText(/Resubmit the corrected result/)).toBeInTheDocument()
})
it('explains stale expired invitations with the delivered deadline and a new invitation recovery', () => {
  render(<ContractErrorDetails error={new ApiError(409, { code: 'REFEREE_INVITATION_EXPIRED', message: 'Expired', expiresAt: '2026-10-14T03:00:00Z' })} />)
  expect(screen.getByText(/14\/10\/2026, 10:00:00.*Refresh your invitations/)).toBeInTheDocument()
})

it.each(['MATCH_NOT_SCHEDULED', 'SCHEDULE_INCOMPLETE'])('shows optional schedule recovery metadata for 409 %s without parsing the message', code => {
  render(<ContractErrorDetails error={new ApiError(409, { code, message: 'Fill in the form', missing: ['scheduledTime', null, 'venue', 'venue', '__proto__'] })} />)
  expect(screen.getByText(/The organizer must complete the match schedule/)).toBeInTheDocument()
  expect(screen.getByText('Missing schedule fields: Kick-off, Venue.')).toBeInTheDocument()
})

it('supports an unscheduled FR02 match with no extra metadata', () => {
  render(<ContractErrorDetails error={new ApiError(409, { code: 'MATCH_NOT_SCHEDULED', message: 'Unrelated text' })} />)
  expect(screen.getByText(/The organizer must complete/)).toBeInTheDocument()
  expect(screen.queryByText(/Missing schedule fields/)).not.toBeInTheDocument()
})

it.each([
  [400, 'SCHEDULE_INCOMPLETE'], [400, 'MATCH_NOT_SCHEDULED'],
  [404, 'USER_NOT_FOUND'], [404, 'NO_ACTIVE_DISPUTE'], [409, 'NO_ACTIVE_DISPUTE'],
  [404, 'REFEREE_NOT_ASSIGNED'], [409, 'REFEREE_NOT_ASSIGNED'],
] as const)('does not give match-scheduling recovery for %i %s', (status, code) => {
  render(<ContractErrorDetails error={new ApiError(status, { code, message: 'Set the fixture', missing: ['venue'] })} />)
  expect(screen.queryByText(/The organizer must complete|Missing schedule fields/)).not.toBeInTheDocument()
})
