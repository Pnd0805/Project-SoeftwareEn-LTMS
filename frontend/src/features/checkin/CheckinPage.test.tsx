import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchCheckinDto, MatchDto } from '../../types/match.dto'

vi.mock('../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))

const mutation = { isPending: false, isError: false, isSuccess: false, data: undefined, error: null, mutate: vi.fn() }
const refetch = vi.fn()
let checkinsQuery: Record<string, unknown>

const match = {
  id: 12,
  tournamentId: 3,
  teamA: {
    id: 7, name: 'Blue Team', code: 'BLU', color: null, logoUrl: null,
    players: [{ id: 9201, fullName: 'Checked Player', avatarUrl: null }],
  },
  teamB: null,
  mode: 'onsite',
  checkinToken: null,
  roomCode: null,
  viewer: {
    roles: ['referee'], myUserId: 77, myTeamId: null, isTeamLeader: false,
    can: {
      submitResult: true, verifyResult: true, disputeResult: false, resolveDispute: false,
      editFixture: false, recordStats: true, manageCheckin: true, verifyCheckin: true,
    },
  },
} as MatchDto

vi.mock('../../hooks/useMatch', () => ({
  useMatch: () => ({ data: match, isPending: false, isError: false }),
  useCheckins: () => checkinsQuery,
  useMyCheckin: () => ({ data: null, isPending: false, isFetching: false, isError: false }),
  useCheckin: () => mutation,
  useVerifyCheckin: () => mutation,
  useUpdateMatch: () => mutation,
}))

import { CheckinPage } from './CheckinPage'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/checkin/12']}>
      <Routes><Route path="/checkin/:id" element={<CheckinPage />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  refetch.mockReset()
  mutation.mutate.mockReset()
  match.mode = 'onsite'
  match.teamB = null
  match.roomCode = null
  checkinsQuery = {
    data: undefined, isPending: true, isFetching: true, isError: false, refetch,
  }
})

it('does not announce complete check-in from cached data after access is denied', () => {
  match.teamB = { ...match.teamA!, id: 8, name: 'Red Team', players: [] }
  checkinsQuery = {
    data: { items: [{ id: 41, user: { id: 9201 }, status: 'success', method: 'manual_by_referee' }] },
    isPending: false, isFetching: false, isError: true, error: { status: 403 }, refetch,
  }
  renderPage()
  expect(screen.queryByText('Everyone is through.')).not.toBeInTheDocument()
  expect(screen.queryByText('Checked in')).not.toBeInTheDocument()
  expect(screen.queryByText('0 · 0 verified')).not.toBeInTheDocument()
})

describe('referee check-in roster state', () => {
  it('counts verified players from the readable check-in source rather than stale lineup metadata', () => {
    checkinsQuery = {
      data: { items: [{ id: 41, user: { id: 9201, fullName: 'Checked Player' }, status: 'success', method: 'manual_by_referee' }] },
      isPending: false, isFetching: false, isError: false, refetch,
    }
    renderPage()
    expect(screen.getByText('1 of 1 in')).toBeInTheDocument()
  })
  it('does not claim Not yet or offer a manual write while the list is loading', () => {
    renderPage()

    expect(screen.getByText('Checking...')).toBeInTheDocument()
    expect(screen.queryByText('Not yet')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify by hand' })).not.toBeInTheDocument()
  })

  it('does not claim Not yet or offer a manual write when the list read fails', () => {
    checkinsQuery = {
      data: undefined, isPending: false, isFetching: false, isError: true, refetch,
    }
    renderPage()

    expect(screen.getAllByText('Status unavailable').length).toBeGreaterThan(0)
    expect(screen.queryByText('Not yet')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify by hand' })).not.toBeInTheDocument()
  })

  it('offers manual verification only after a successful list proves the row is missing', () => {
    checkinsQuery = {
      data: { items: [] }, isPending: false, isFetching: false, isError: false, refetch,
    }
    renderPage()

    expect(screen.getByText('Not yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify by hand' })).toBeInTheDocument()
  })

  it('keeps an existing check-in visible during a background refresh', () => {
    const row = {
      id: 41, matchId: 12,
      user: { id: 9201, fullName: 'Checked Player', avatarUrl: null },
      method: 'manual_by_referee', status: 'success', rejectionReason: null,
      note: 'QR unavailable', documentType: null, documentS3Key: null,
      verifiedByReferee: null, checkedInAt: '2026-09-21T10:00:00.000Z', verifiedAt: null,
    } satisfies MatchCheckinDto
    checkinsQuery = {
      data: { items: [row] }, isPending: false, isFetching: true, isError: false, refetch,
    }
    renderPage()

    expect(screen.getByText('Checked in')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify by hand' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  /* R11 — กด reject แล้วต้องมีทางกลับ และต้องระบุเหตุผลได้ (OD-19 · 21 ก.ย.) */
  it('asks for a reason instead of rejecting with a canned one', () => {
    checkinsQuery = {
      data: {
        items: [{
          id: 41, matchId: 12,
          user: { id: 9201, fullName: 'Checked Player', avatarUrl: null },
          method: 'qr_onsite', status: 'success', rejectionReason: null, note: null,
          documentType: null, documentS3Key: null, verifiedByReferee: null,
          checkedInAt: '2026-09-21T10:00:00.000Z', verifiedAt: null,
        } satisfies MatchCheckinDto],
      },
      isPending: false, isFetching: false, isError: false, refetch,
    }
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(mutation.mutate).not.toHaveBeenCalled()

    const why = screen.getByLabelText('Reason shown to the player')
    fireEvent.change(why, { target: { value: 'สแกนแทนกัน' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revoke check-in' }))

    expect(mutation.mutate).toHaveBeenCalledWith(
      { userId: 9201, input: { status: 'rejected', rejectionReason: 'สแกนแทนกัน' } },
      expect.anything(),
    )
  })

  it('still lets a referee verify a player whose check-in was rejected', () => {
    checkinsQuery = {
      data: {
        items: [{
          id: 41, matchId: 12,
          user: { id: 9201, fullName: 'Checked Player', avatarUrl: null },
          method: 'qr_onsite', status: 'rejected', rejectionReason: 'สแกนแทนกัน', note: null,
          documentType: null, documentS3Key: null, verifiedByReferee: null,
          checkedInAt: '2026-09-21T10:00:00.000Z', verifiedAt: null,
        } satisfies MatchCheckinDto],
      },
      isPending: false, isFetching: false, isError: false, refetch,
    }
    renderPage()

    expect(screen.getByText('Rejected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Verify by hand' }))
    /* โมดัลต้องบอกด้วยว่ากำลังกดให้ใหม่หลังถูกปฏิเสธ ไม่ใช่เคสกล้องเสียธรรมดา */
    expect(screen.getByText(/This check-in was rejected/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'ตรวจบัตรแล้ว ตัวจริง' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify check-in' }))
    expect(mutation.mutate).toHaveBeenCalledWith(
      { method: 'manual_by_referee', userId: 9201, note: 'ตรวจบัตรแล้ว ตัวจริง' },
      expect.anything(),
    )
  })

  it('lets match staff publish a room code for a real-mode online match', () => {
    match.mode = 'online'
    checkinsQuery = {
      data: { items: [] }, isPending: false, isFetching: false, isError: false, refetch,
    }
    renderPage()

    fireEvent.change(screen.getByLabelText(/Room code/), { target: { value: 'LTMS-8842' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(mutation.mutate).toHaveBeenCalledWith({ roomCode: 'LTMS-8842' })
  })
})
