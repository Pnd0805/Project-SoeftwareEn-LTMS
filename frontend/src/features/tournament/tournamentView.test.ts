import { describe, expect, it } from 'vitest'
import type { Tournament } from '../../shared/types'
import type { TournamentDto } from '../../types/tournament.dto'
import { registrationClosedReason, tournamentView } from './tournamentView'

const tournament: Tournament = {
  id: '5', name: 'Registration Cup', sport: 'Basketball', format: 'single', channel: 'onsite',
  status: 'public', registrationOpen: false, date: '2099-10-01', venue: 'Gym', pin: null, cap: 8,
  organizer: '9001', referees: [],
  rules: { gender: 'any', ageMin: 'any', ageMax: 'any', faculty: 'any', major: 'any', year: 'any' },
  drawn: false, rounds: 1, champion: null,
}

describe('registration lifecycle view', () => {
  it('keeps a public tournament closed until the organizer explicitly opens registration', () => {
    expect(registrationClosedReason(tournament, 0, true))
      .toBe('Registration has not been opened by the organizer yet.')
    expect(registrationClosedReason({ ...tournament, registrationOpen: true }, 0, true)).toBe('')
  })

  it('preserves backend registration fields in the shared tournament view', () => {
    const dto = {
      id: 5, name: 'Registration Cup', sportTypeId: 2, bracketFormat: 'single_elimination',
      scopeType: 'faculty', organizingFacultyId: 1, organizingDepartmentId: null,
      requestedByUserId: 9001, status: 'public', registrationOpen: false,
      registrationStart: '2099-09-01T00:00:00+07:00', registrationEnd: '2099-09-30T23:59:59+07:00',
      eventStartDate: '2099-10-01', eventEndDate: null, maxTeams: 8, minTeams: 2, venue: 'Gym',
      disputeWindowHours: 24, genderRequirement: 'any', minAge: null, maxAge: null,
      rejectionReason: null, approvedBy: 1, approvedAt: '2099-01-01T00:00:00Z',
      createdAt: '2099-01-01T00:00:00Z', deletedAt: null,
    } satisfies TournamentDto

    expect(tournamentView(dto)).toMatchObject({
      registrationOpen: false,
      registrationStart: dto.registrationStart,
      registrationEnd: dto.registrationEnd,
    })
  })
})
