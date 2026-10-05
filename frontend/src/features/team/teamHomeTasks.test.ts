import { describe, expect, it } from 'vitest'
import type { BackendMyInvitationDto, BackendMyTeamDto } from '../../types/team.dto'
import { teamHomeTasks } from './teamHomeTasks'

const now = new Date('2026-10-04T12:00:00.000Z')

const invitation = (id: number, expiresAt: string): BackendMyInvitationDto => ({
  id,
  team: { id: 8, name: 'Northside FC', sportTypeId: 1 },
  invitedBy: { id: 4, fullName: 'Lee Captain', avatarUrl: null },
  expiresAt,
})

const team = (id: number, role: BackendMyTeamDto['role']): BackendMyTeamDto => ({
  id,
  name: `Team ${id}`,
  sportTypeId: 1,
  readinessStatus: 'Forming',
  officialStatus: 'Unofficial',
  memberCount: 2,
  role,
})

describe('teamHomeTasks', () => {
  it('maps a valid invitation and a forming leader team to direct actions', () => {
    expect(teamHomeTasks(
      [invitation(3, '2026-10-05T12:00:00.000Z')],
      [team(7, 'leader'), team(9, 'member')],
      now,
    ).map(task => [task.label, task.context, task.href])).toEqual([
      ['Accept', 'Northside FC', '/teams'],
      ['Complete team', 'Team 7', '/team/7'],
    ])
  })

  it('shows the valid invitation expiry in concise English with the viewer local time', () => {
    const expiresAt = new Date(2026, 9, 5, 12, 30).toISOString()

    expect(teamHomeTasks([invitation(3, expiresAt)], [], now)).toEqual([
      {
        key: 'team:invitation:3',
        source: 'team',
        label: 'Accept',
        context: 'Northside FC',
        detail: 'Expires 05 Oct, 12:30',
        urgency: 'urgent',
        href: '/teams',
      },
    ])
  })

  it('omits invitations that expire at or before now', () => {
    expect(teamHomeTasks([invitation(3, now.toISOString())], [], now)).toEqual([])
  })

  it('omits invalid invitation expiry dates', () => {
    expect(teamHomeTasks([invitation(3, 'not-a-date')], [], now)).toEqual([])
  })

  it('does not create a team management task for a member', () => {
    expect(teamHomeTasks([], [team(9, 'member')], now)).toEqual([])
  })
})
