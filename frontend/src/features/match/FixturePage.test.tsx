import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchDto } from '../../types/match.dto'

vi.mock('../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))

const updateAsync = vi.fn()
const bulkAssignAsync = vi.fn()
const requestReferee = vi.fn()
const match = {
  id: 23, tournamentId: 5, bracketNodeId: 1, nextMatchId: null, loserNextMatchId: null,
  roundNumber: 2, teamA: null, teamB: null,
  scheduledTime: '2026-10-01T03:00:00.000Z', scheduledEndTime: '2026-10-01T04:00:00.000Z',
  venue: 'Court 1', checkinOpenAt: null, status: 'scheduled', mode: 'onsite',
  createdAt: '2026-09-21T00:00:00.000Z', updatedAt: null,
  tournament: { id: 5, name: 'Campus Cup', championTeamId: null, sportTypeId: 1, sportName: 'Volleyball' },
  stage: 'Semi-final', tag: 'SF1', referees: [], availableReferees: [], roomCode: null,
  checkinToken: null, replayUrl: null, checkedIn: 0, lineupSize: 0, resultStatus: null,
  viewer: {
    roles: ['organizer'], myUserId: 9, myTeamId: null, isTeamLeader: false,
    can: {
      submitResult: false, verifyResult: false, disputeResult: false, resolveDispute: true,
      editFixture: true, recordStats: false, manageCheckin: true, verifyCheckin: false,
    },
  },
} as MatchDto

const idleMutation = { isPending: false, isError: false, isSuccess: false, error: null, mutate: vi.fn() }

vi.mock('../../hooks/useMatch', () => ({
  useMatch: () => ({ data: match, isPending: false, isError: false }),
  useUpdateMatch: () => ({ ...idleMutation, mutateAsync: updateAsync }),
  useAssignReferees: () => ({ ...idleMutation, mutateAsync: bulkAssignAsync }),
  useMatchReferees: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useUnassignMatchReferee: () => idleMutation,
}))

vi.mock('../../hooks/useAdmin', () => ({
  useTournamentReferees: () => ({
    data: { items: [{ id: 17, user: { id: 70, fullName: 'Ref One', avatarUrl: null }, isActive: true }] },
    isPending: false, isError: false,
  }),
  useTournamentRefereeRequests: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useRequestMatchReferee: () => ({ ...idleMutation, mutate: requestReferee }),
  useCancelTournamentRefereeRequest: () => idleMutation,
}))

import { FixturePage } from './FixturePage'

const renderPage = () => render(
  <MemoryRouter initialEntries={['/m/23/fixture']}>
    <Routes><Route path="/m/:id/fixture" element={<FixturePage />} /></Routes>
  </MemoryRouter>,
)

beforeEach(() => {
  updateAsync.mockReset().mockResolvedValue(match)
  bulkAssignAsync.mockReset().mockResolvedValue(match)
  requestReferee.mockReset()
})

describe('real-mode fixture referee consent flow', () => {
  it('requests one tournament referee without calling the removed bulk assignment route', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Request this match' }))
    expect(requestReferee).toHaveBeenCalledWith({ tournamentRefereeId: 17, matchId: 23 })
    expect(bulkAssignAsync).not.toHaveBeenCalled()
  })

  it('saves start, end and venue independently from referee requests', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }))
    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith(expect.objectContaining({
      scheduledTime: expect.any(String), scheduledEndTime: expect.any(String), venue: 'Court 1',
    })))
    expect(bulkAssignAsync).not.toHaveBeenCalled()
  })
})
