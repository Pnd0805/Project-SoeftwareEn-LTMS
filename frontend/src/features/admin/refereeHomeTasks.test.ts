import { describe, expect, it } from 'vitest'
import type { BackendRefereeRequestDto, MyRefereeInvitationDto } from '../../types/admin.dto'
import { refereeHomeTasks } from './refereeHomeTasks'

const invitation = (id = 12): MyRefereeInvitationDto => ({
  id,
  tournament: {
    id: 7,
    name: 'Campus Cup',
    sportTypeId: 1,
    eventStartDate: '2026-10-12T00:00:00.000Z',
  },
  isExternal: false,
  createdAt: '2026-10-01T00:00:00.000Z',
})

const request = (id = 31, status: BackendRefereeRequestDto['status'] = 'open'): BackendRefereeRequestDto => ({
  id,
  tournamentId: 7,
  type: 'org_add_match',
  requestedBy: 84,
  refereeA: {
    tournamentRefereeId: 11,
    user: { id: 22, fullName: 'Referee A', avatarUrl: null },
    status: 'active',
  },
  refereeB: null,
  matchA: { id: 45, roundNumber: 2, scheduledTime: null, scheduledEndTime: null },
  matchB: null,
  status,
  createdAt: '2026-10-01T00:00:00.000Z',
  resolvedAt: null,
})

describe('refereeHomeTasks', () => {
  it('links invitations to Matches and only open incoming requests to the inbox', () => {
    const tasks = refereeHomeTasks([invitation()], [request(), request(32, 'applied')])

    expect(tasks.map(({ label, context, href }) => [label, context, href])).toEqual([
      ['Accept', 'Campus Cup', '/matches'],
      ['Review', 'Tournament 7 · Match 45', '/inbox'],
    ])
  })

  it('uses stable source and ID keys and collapses duplicate server rows', () => {
    const invite = invitation(19)
    const incoming = request(58)

    expect(refereeHomeTasks([invite, invite], [incoming, incoming]).map(task => task.key)).toEqual([
      'referee:invitation:19',
      'referee:request:58',
    ])
  })
})
