import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { conflictOfInterestDetails } from './registrationErrors'

describe('competition role conflict feedback', () => {
  it('names the conflicting tournament role and recovery path', () => {
    const error = new ApiError(409, {
      code: 'TEAM_CONFLICT_OF_INTEREST', message: 'conflict', role: 'referee', tournamentId: 44,
    })

    expect(conflictOfInterestDetails(error)).toEqual([
      expect.stringContaining('referee of tournament #44'),
      expect.stringContaining('Remove that player'),
    ])
  })
})
