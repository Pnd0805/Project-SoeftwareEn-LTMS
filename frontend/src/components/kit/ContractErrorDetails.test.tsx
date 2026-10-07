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
