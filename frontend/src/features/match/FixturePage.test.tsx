import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchDto } from '../../types/match.dto'
import { ApiError } from '../../api/client'

vi.mock('../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))

const updateAsync = vi.fn()
const bulkAssignAsync = vi.fn()
const requestReferee = vi.fn()
let updateError: unknown = null
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
  useUpdateMatch: () => ({
    ...idleMutation, mutateAsync: updateAsync, isError: updateError !== null, error: updateError,
  }),
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
  updateError = null
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

  it('shows the backend scheduling reason and conflicting match instead of a generic failure', () => {
    updateError = new ApiError(409, {
      code: 'SCHEDULE_CONFLICT', message: 'schedule conflict', details: { conflictingMatchId: 91 },
    })

    renderPage()

    expect(screen.getByText(/overlapping fixture \(match #91\)/)).toBeInTheDocument()
  })

  /* R12 — หน้านี้ต้องแก้เวลาและกรรมการได้ตราบที่ M06/FR02 ยังยอม ซึ่งคือแมตช์ที่ยัง
     `scheduled` · เดิมใช้ "ยังไม่มีใครเช็คอิน" ซึ่งเปิดฟอร์มให้แมตช์ที่ปิดไปแล้วด้วย */
  it('locks the form on a match the server will no longer change, and says which state it is in', () => {
    match.status = 'checkin_open'
    try {
      renderPage()
      expect(screen.queryByRole('button', { name: 'Save schedule' })).not.toBeInTheDocument()
      expect(screen.getByText(/only lets the kick-off, venue and match/)).toBeInTheDocument()
      expect(screen.getByText(/Locked — Check-in open/)).toBeInTheDocument()
    } finally {
      match.status = 'scheduled'
    }
  })

  it('does not stop the organizer adding a referee beyond the BR-10 minimum', () => {
    renderPage()
    /* `needed` เป็นขั้นต่ำ ไม่ใช่เพดาน — ปุ่มต้องกดได้เสมอเมื่อแมตช์มีเวลาแล้ว */
    expect(screen.getByRole('button', { name: 'Request this match' })).toBeEnabled()
  })
})
