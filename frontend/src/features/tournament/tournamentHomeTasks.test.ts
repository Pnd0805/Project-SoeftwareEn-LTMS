import { describe, expect, it } from 'vitest'
import type { TournamentDto } from '../../types/tournament.dto'
import { tournamentHomeTasks } from './tournamentHomeTasks'

const tournament = (id: number, status: TournamentDto['status'], name: string): TournamentDto => ({
  id,
  name,
  sportTypeId: 1,
  bracketFormat: 'single_elimination',
  scopeType: 'faculty',
  organizingFacultyId: 1,
  organizingDepartmentId: null,
  requestedByUserId: 9001,
  status,
  registrationOpen: false,
  registrationStart: null,
  registrationEnd: null,
  eventStartDate: '2026-12-01',
  eventEndDate: null,
  maxTeams: 8,
  minTeams: 2,
  venue: 'Gym',
  disputeWindowHours: 24,
  genderRequirement: 'any',
  minAge: null,
  maxAge: null,
  rejectionReason: null,
  approvedBy: null,
  approvedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  deletedAt: null,
})

describe('tournament home tasks', () => {
  it('offers setup only for a private organizer-owned tournament', () => {
    const tasks = tournamentHomeTasks([
      tournament(6, 'private', 'Private Cup'),
      tournament(7, 'public', 'Public Cup'),
      tournament(8, 'pending_approval', 'Pending Cup'),
      { ...tournament(9, 'private', 'Deleted Cup'), deletedAt: '2026-10-02T00:00:00Z' },
    ])

    expect(tasks).toEqual([{
      key: 'tournament:6',
      source: 'tournament',
      label: 'Continue setup',
      context: 'Private Cup',
      urgency: 'waiting',
      href: '/t/6/manage/progress',
    }])
  })
})
