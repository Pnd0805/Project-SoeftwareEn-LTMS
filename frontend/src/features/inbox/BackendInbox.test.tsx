/**
 * R18 — ตอบรับคำขอคุมแมตช์แล้วต้องรู้ว่าได้คุมจริงไหม
 *
 * FR06 ตอบ 200 พร้อมใบคำขอที่มี `status` ติดมา และสถานะนั้นเป็น `cancelled` ได้
 * เมื่อมีใบอื่นบนแมตช์เดียวกันถูก apply ไปก่อน (`refereeChangeRequest.repo.apply`
 * ปิดใบที่แตะแมตช์เดียวกันทั้งหมด — เป็นครึ่ง backend ของ R18 ที่ยังไม่ได้แก้)
 * หน้าจอเคยขึ้นว่า "You are officiating" ทุกครั้งที่ไม่ throw กรรมการจึงไปยืนคุมแมตช์
 * ที่ตัวเองไม่ได้คุม
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { BackendRefereeRequestDto } from '../../types/admin.dto'

vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(),
  USE_MOCK: false,
}))

const idle = { isPending: false, isError: false, isSuccess: false, error: null, mutate: vi.fn() }
const acceptMutate = vi.fn()
const declineMutate = vi.fn()
const cancelMutate = vi.fn()
let outgoing: typeof request[] = []

const request: BackendRefereeRequestDto = {
  id: 91, tournamentId: 23, type: 'org_add_match', requestedBy: 9201,
  refereeA: { tournamentRefereeId: 34, user: { id: 9002, fullName: 'Somying', avatarUrl: null }, status: 'pending' },
  refereeB: null,
  matchA: { id: 30, roundNumber: 1, scheduledTime: '2026-11-20T03:00:00.000Z', scheduledEndTime: '2026-11-20T05:00:00.000Z' },
  matchB: null, status: 'open', createdAt: '2026-09-22T00:00:00.000Z', resolvedAt: null,
}
let incoming: BackendRefereeRequestDto[] = [request]

vi.mock('../../hooks/useTeam', () => ({
  useBackendMyInvitations: () => ({ data: { items: [] }, isPending: false }),
  useAnswerBackendInvitation: () => idle,
}))
vi.mock('../../hooks/useTournament', () => ({
  useMyTournamentApplications: () => ({ data: { items: [] }, isPending: false }),
}))
vi.mock('../../hooks/useAdmin', () => ({
  useCancelRefereeRequest: () => ({ ...idle, mutate: cancelMutate }),
  useAcceptRefereeInvitation: () => idle,
  useDeclineRefereeInvitation: () => idle,
  useMyRefereeInvitations: () => ({ data: { items: [] }, isPending: false }),
  useMyRefereeRequests: () => ({ data: { incoming, outgoing }, isPending: false }),
  useAcceptRefereeRequest: () => ({ ...idle, mutate: acceptMutate }),
  useDeclineRefereeRequest: () => ({ ...idle, mutate: declineMutate }),
}))

import { BackendInbox } from './BackendInbox'

const renderInbox = () => render(<MemoryRouter><BackendInbox /></MemoryRouter>)
const clickAccept = () => fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

beforeEach(() => { vi.clearAllMocks(); outgoing = []; incoming = [request] })

describe('answering a match assignment request', () => {
  it('preserves the BE cross-tournament message and links the conflicting match', () => {
    acceptMutate.mockImplementation((_id, opts) => opts.onError(new ApiError(409, {
      code: 'REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT', message: 'Your existing match overlaps this invitation.', conflictsWith: { matchId: 8 },
    })));
    renderInbox(); clickAccept();
    expect(screen.getByText('Your existing match overlaps this invitation.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open match #8 to request withdrawal/ })).toHaveAttribute('href', '/m/8');
    expect(screen.queryByText(/You are officiating/)).not.toBeInTheDocument();
  });
  it('renders a tournament withdrawal without matchA and lets the receiving organizer decide', () => {
    incoming = [{ ...request, type: 'ref_withdraw', matchA: null, withdrawScope: 'tournament', reason: 'Cannot attend this tournament' }]
    renderInbox()
    expect(screen.getByText('Tournament #23')).toBeInTheDocument()
    expect(screen.getByText(/Cannot attend this tournament/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open tournament' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })
  it('confirms the assignment only when the request actually applied', () => {
    acceptMutate.mockImplementation((_id, opts) =>
      opts.onSuccess({ ...request, status: 'applied', resolvedAt: '2026-09-22T02:00:00.000Z' }))
    renderInbox()
    clickAccept()

    expect(screen.getByText(/Request #91 applied/)).toBeInTheDocument()
  })

  it('does not claim the match when the request came back closed instead of applied', () => {
    acceptMutate.mockImplementation((_id, opts) =>
      opts.onSuccess({ ...request, status: 'cancelled', resolvedAt: '2026-09-22T02:00:00.000Z' }))
    renderInbox()
    clickAccept()

    expect(screen.queryByText(/You are officiating/)).not.toBeInTheDocument()
    expect(screen.getByText(/is cancelled/)).toBeInTheDocument()
    expect(screen.getByText(/Assignments were not changed/)).toBeInTheDocument()
  })

  it('says why a refused answer was refused', () => {
    acceptMutate.mockImplementation((_id, opts) =>
      opts.onError(new ApiError(409, { code: 'REFEREE_TIME_CONFLICT', message: 'ซ้อนเวลา' })))
    renderInbox()
    clickAccept()

    expect(screen.getByText(/already have a match that overlaps/)).toBeInTheDocument()
  })
})

it('keeps acceptance pending when the second referee has not answered', () => {
  acceptMutate.mockImplementation((_id, opts) => opts.onSuccess({ ...request, type: 'org_swap', status: 'open' }))
  renderInbox(); clickAccept()
  expect(screen.getByText(/other referee still needs to answer/)).toBeInTheDocument()
  expect(screen.queryByText(/applied\./)).not.toBeInTheDocument()
})

it('shows outgoing consent states and allows withdrawing only open requests', () => {
  outgoing = [{ ...request, id: 101 }, { ...request, id: 102, status: 'applied' }]
  cancelMutate.mockImplementation((_id, opts) => opts.onSuccess())
  renderInbox()
  expect(screen.getAllByRole('button', { name: 'Withdraw request' })).toHaveLength(1)
  expect(screen.getAllByText(/Somying: pending/)).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw request' }))
  expect(cancelMutate).toHaveBeenCalledWith(101, expect.any(Object))
  expect(screen.getByText('Request #101 withdrawn.')).toBeInTheDocument()
})
