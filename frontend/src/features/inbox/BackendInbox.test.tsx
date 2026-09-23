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

vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(),
  USE_MOCK: false,
}))

const idle = { isPending: false, isError: false, isSuccess: false, error: null, mutate: vi.fn() }
const acceptMutate = vi.fn()
const declineMutate = vi.fn()

const request = {
  id: 91, tournamentId: 23, type: 'org_add_match', requestedBy: 9201,
  refereeA: { tournamentRefereeId: 34, user: { id: 9002, fullName: 'Somying', avatarUrl: null }, status: 'pending' },
  refereeB: null,
  matchA: { id: 30, roundNumber: 1, scheduledTime: '2026-11-20T03:00:00.000Z', scheduledEndTime: '2026-11-20T05:00:00.000Z' },
  matchB: null, status: 'open', createdAt: '2026-09-22T00:00:00.000Z', resolvedAt: null,
}

vi.mock('../../hooks/useTeam', () => ({
  useBackendMyInvitations: () => ({ data: { items: [] }, isPending: false }),
  useAnswerBackendInvitation: () => idle,
}))
vi.mock('../../hooks/useTournament', () => ({
  useMyTournamentApplications: () => ({ data: { items: [] }, isPending: false }),
}))
vi.mock('../../hooks/useAdmin', () => ({
  useAcceptRefereeInvitation: () => idle,
  useDeclineRefereeInvitation: () => idle,
  useMyRefereeInvitations: () => ({ data: { items: [] }, isPending: false }),
  useMyRefereeRequests: () => ({ data: { incoming: [request], outgoing: [] }, isPending: false }),
  useAcceptRefereeRequest: () => ({ ...idle, mutate: acceptMutate }),
  useDeclineRefereeRequest: () => ({ ...idle, mutate: declineMutate }),
}))

import { BackendInbox } from './BackendInbox'

const renderInbox = () => render(<MemoryRouter><BackendInbox /></MemoryRouter>)
const clickAccept = () => fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

beforeEach(() => vi.clearAllMocks())

describe('answering a match assignment request', () => {
  it('confirms the assignment only when the request actually applied', () => {
    acceptMutate.mockImplementation((_id, opts) =>
      opts.onSuccess({ ...request, status: 'applied', resolvedAt: '2026-09-22T02:00:00.000Z' }))
    renderInbox()
    clickAccept()

    expect(screen.getByText(/You are officiating match #30/)).toBeInTheDocument()
  })

  it('does not claim the match when the request came back closed instead of applied', () => {
    acceptMutate.mockImplementation((_id, opts) =>
      opts.onSuccess({ ...request, status: 'cancelled', resolvedAt: '2026-09-22T02:00:00.000Z' }))
    renderInbox()
    clickAccept()

    expect(screen.queryByText(/You are officiating/)).not.toBeInTheDocument()
    expect(screen.getByText(/did not come to you/)).toBeInTheDocument()
    expect(screen.getByText(/now cancelled/)).toBeInTheDocument()
  })

  it('says why a refused answer was refused', () => {
    acceptMutate.mockImplementation((_id, opts) =>
      opts.onError(new ApiError(409, { code: 'REFEREE_TIME_CONFLICT', message: 'ซ้อนเวลา' })))
    renderInbox()
    clickAccept()

    expect(screen.getByText(/already have a match that overlaps/)).toBeInTheDocument()
  })
})
