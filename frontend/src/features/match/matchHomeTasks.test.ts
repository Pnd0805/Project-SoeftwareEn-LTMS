import { describe, expect, it } from 'vitest'
import type { MatchListItemDto, MatchViewerContext } from '../../types/match.dto'
import { matchHomeTasks } from './matchHomeTasks'

const noCapabilities: MatchViewerContext['can'] = {
  submitResult: false,
  verifyResult: false,
  disputeResult: false,
  resolveDispute: false,
  editFixture: false,
  recordStats: false,
  manageCheckin: false,
  openCheckin: false,
  finishMatch: false,
  verifyCheckin: false,
}

const match = (id: number, can: Partial<MatchViewerContext['can']> = {}): MatchListItemDto => ({
  id,
  tournamentId: 7,
  bracketNodeId: null,
  nextMatchId: null,
  loserNextMatchId: null,
  roundNumber: 2,
  teamA: null,
  teamB: null,
  scheduledTime: null,
  scheduledEndTime: null,
  actualEndTime: null,
  venue: null,
  checkinOpenAt: null,
  status: 'scheduled',
  mode: 'onsite',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: null,
  tournament: { id: 7, name: 'Campus Cup', championTeamId: null, sportTypeId: 1, sportName: 'Basketball' },
  stage: 'Semi-final',
  tag: 'SF1',
  referees: [],
  availableReferees: [],
  roomCode: null,
  checkinToken: null,
  replayUrl: null,
  checkedIn: 0,
  lineupSize: 0,
  resultStatus: null,
  viewer: {
    roles: ['player'],
    myUserId: 71,
    myTeamId: 3,
    isTeamLeader: false,
    can: { ...noCapabilities, ...can },
  },
  score: null,
  outcome: null,
})

describe('matchHomeTasks', () => {
  it('maps true check-in and result capabilities to their direct destinations', () => {
    const tasks = matchHomeTasks([
      match(9, { openCheckin: true }),
      match(10, { submitResult: true }),
      match(11, { verifyResult: true }),
      match(12, { manageCheckin: true }),
      match(13, { verifyCheckin: true }),
      match(14, { finishMatch: true }),
      match(15, { resolveDispute: true }),
    ])

    expect(tasks.map(({ label, context, href }) => [label, context, href])).toEqual([
      ['Open check-in', 'Campus Cup · Match 9', '/checkin/9'],
      ['Record result', 'Campus Cup · Match 10', '/m/10'],
      ['Review result', 'Campus Cup · Match 11', '/m/11'],
      ['Open check-in', 'Campus Cup · Match 12', '/checkin/12'],
      ['Review check-in', 'Campus Cup · Match 13', '/checkin/13'],
      ['Finish match', 'Campus Cup · Match 14', '/m/14'],
      ['Resolve dispute', 'Campus Cup · Match 15', '/m/15'],
    ])
  })

  it('distinguishes review subjects while merging result and dispute capabilities into one card', () => {
    expect(matchHomeTasks([
      match(16, { verifyResult: true, resolveDispute: true, verifyCheckin: true }),
    ])).toEqual([
      {
        key: 'match:16:review-result',
        source: 'match',
        label: 'Resolve dispute',
        context: 'Campus Cup · Match 16',
        urgency: 'ready',
        href: '/m/16',
      },
      {
        key: 'match:16:review-checkin',
        source: 'match',
        label: 'Review check-in',
        context: 'Campus Cup · Match 16',
        urgency: 'ready',
        href: '/checkin/16',
      },
    ])
  })

  it('does not infer player check-in work when the server grants no capability', () => {
    expect(matchHomeTasks([match(9)])).toEqual([])
  })

  it('ignores a missing capability object instead of inferring from match status or role', () => {
    const playerMatch = match(9, { openCheckin: true, submitResult: true })
    playerMatch.status = 'in_progress'
    playerMatch.viewer.can = undefined as unknown as MatchViewerContext['can']

    expect(matchHomeTasks([playerMatch])).toEqual([])
  })
})
