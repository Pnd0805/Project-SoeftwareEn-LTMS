import { render, screen } from '@testing-library/react'
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
  checkinsQuery = {
    data: undefined, isPending: true, isFetching: true, isError: false, refetch,
  }
})

describe('referee check-in roster state', () => {
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
  })
})
