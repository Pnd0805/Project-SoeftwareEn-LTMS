/**
 * คิว "Requests to organize" ของแอดมินคณะ
 *
 * รายงาน 23 ก.ย.: "The decision did not go through. ทัวร์นาเมนต์นี้เปิดรับนอกคณะของคุณ…"
 * คิวส่งคำขอที่แอดมินคณะอนุมัติไม่ได้มาให้ด้วย เพราะ backend กรองคิวกับตรวจสิทธิ์
 * ด้วยกฎคนละชุด (`adminScopeWhere` ดูแค่คณะผู้จัด · `adminCoversEligibility` ดูกฎคณะต่อ)
 * เรากรองล่วงหน้าไม่ได้ — `/me` ไม่บอกขอบเขตแอดมินของคนที่ล็อกอิน — แต่พอ server
 * ตอบมาแล้วต้องไม่ลืม ไม่ใช่ปล่อยให้กดซ้ำได้คำตอบเดิมทุกครั้ง
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'

vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(),
  USE_MOCK: false,
}))

const idle = { isPending: false, isError: false, isSuccess: false, error: null, data: undefined, mutate: vi.fn() }
const emptyList = { data: { items: [] }, isPending: false, isError: false, isSuccess: true, error: null }
const reviewMutate = vi.fn()
const reviewState = { ...idle, mutate: reviewMutate }
const amendmentQueue = { ...emptyList, data: { items: [] as Array<{ id: number; tournamentId: number; tournamentName: string; requestedBy: { id: number; fullName: string }; selfRequested: boolean; requestedChanges: Record<string, unknown>; status: string; requestedAt: string }> } }
const amendmentMutate = vi.fn()
const viewer = { scope: { scopeType: 'faculty', facultyId: 1 } as { scopeType: string; facultyId: number | null } | null }
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 9001, adminScope: viewer.scope }, isPending: false, isError: false }) }))

const request = (id: number, name: string) => ({
  id, name, sportTypeId: 1,
  requestedBy: { id: 9213, fullName: 'กันตพงศ์ อินทรีย์', avatarUrl: null },
  eventStartDate: '2026-12-01', createdAt: '2026-09-18T15:11:00.000Z',
})

const tournamentQueue = { ...emptyList, data: { items: [request(24, 'บาสเกตบอลสัมพันธ์'), request(25, 'แบดมินตันหญิง')] } }
const pendingRequests = vi.fn<(enabled: boolean) => typeof tournamentQueue>(() => tournamentQueue)
const amendmentRequests = vi.fn<(enabled: boolean) => typeof amendmentQueue>(() => amendmentQueue)
vi.mock('../../hooks/useAdmin', () => ({
  useAdminAccess: () => ({ data: true, isPending: false, isError: false, isSuccess: true, error: null }),
  usePendingTournamentRequests: (enabled: boolean) => pendingRequests(enabled),
  useReviewTournamentRequest: () => reviewState,
  useTeamRequests: () => emptyList,
  useApproveTeamRequest: () => idle,
  useRejectTeamRequest: () => idle,
  useExternalRefereeRequests: () => emptyList,
  useAmendmentRequests: (enabled: boolean) => amendmentRequests(enabled),
  useAmendmentImpact: (id: number) => ({ isSuccess: true, isError: false, isFetching: false, isPending: false, refetch: vi.fn(), data: { requestId: id, tournamentId: 22, tournamentName: 'Self request', status: 'pending', requestedChanges: { maxTeams: 8 }, reason: null, selfRequested: true, alreadyDecided: false, canApprove: true, blockers: [] } }),
  useApproveAmendment: () => ({ ...idle, mutate: amendmentMutate, reset: vi.fn() }),
  useRejectAmendment: () => idle,
}))
vi.mock('../../hooks/useTournament', () => ({ useTournaments: () => emptyList, useTournament: () => ({ data: { eventStartDate: '2026-12-01' } }), useEligibilityRules: () => emptyList }))
vi.mock('../../hooks/useReference', () => ({ useSportTypes: () => ({ data: { items: [{ id: 1, name: 'ฟุตบอล' }] } }), useFaculties: () => emptyList }))
vi.mock('./AdminRefereesTab', () => ({ AdminRefereesTab: () => null }))
vi.mock('./AdminUsersTab', () => ({ AdminUsersTab: () => null }))
vi.mock('./AdminFeedbackTab', () => ({ AdminFeedbackTab: () => null }))

import { AdminPage } from './AdminPage'

/* mutation state ของ mock เป็น object ธรรมดา ไม่ได้บอก React ว่าเปลี่ยน — กรณีที่
   หน้าจอไม่ได้ตั้ง state ของตัวเองจึงต้องสั่ง render ซ้ำเองเพื่ออ่านผลหลังคำขอเด้ง
   และต้องสร้าง element ใหม่ทุกครั้ง ไม่งั้น React ข้ามการ render เพราะเป็นตัวเดิม */
const ui = (path = '/admin/requests') => (
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/admin/:tab?" element={<AdminPage />} /></Routes>
  </MemoryRouter>
)
const renderPage = () => render(ui())

const rowOf = (name: string) => screen.getByText(name).closest('.vstack') as HTMLElement
const approveIn = (name: string) => within(rowOf(name)).getByRole('button', { name: 'Approve' })

const failWith = (code: string, message: string) => {
  reviewMutate.mockImplementation((_vars, opts) => {
    const error = new ApiError(403, { code, message })
    reviewState.isError = true
    reviewState.error = error as unknown as null
    opts.onError?.(error)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  viewer.scope = { scopeType: 'faculty', facultyId: 1 }
  tournamentQueue.isError = false
  tournamentQueue.error = null
  amendmentQueue.isError = false
  amendmentQueue.error = null
  amendmentQueue.data.items = []
  reviewState.isError = false
  reviewState.error = null
  reviewMutate.mockImplementation(() => {})
})

describe('Round 5 queue permissions', () => {
  it.each([
    { scopeType: 'root', facultyId: null },
    { scopeType: 'faculty', facultyId: null },
  ])('blocks direct queue access for $scopeType / $facultyId without hiding oversight', scope => {
    viewer.scope = scope
    renderPage()
    expect(pendingRequests).toHaveBeenCalledWith(false)
    expect(amendmentRequests).toHaveBeenCalledWith(false)
    expect(screen.getByText('Tournament queue access unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Requests to organize/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Hard-filter changes/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Admin rights' })).toBeInTheDocument()
    expect(screen.queryByText('แบดมินตันหญิง')).not.toBeInTheDocument()
    expect(screen.queryByText('Nothing waiting.')).not.toBeInTheDocument()
  })

  it('blocks the amendment deep link as well', () => {
    viewer.scope = { scopeType: 'root', facultyId: null }
    render(ui('/admin/filters'))
    expect(screen.getByText('Tournament queue access unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve the change' })).not.toBeInTheDocument()
  })

  it.each(['requests', 'filters'])('shows a denied %s queue instead of cached rows or an empty state', tab => {
    const error = new ApiError(403, { code: 'INSUFFICIENT_ADMIN_SCOPE', message: 'Scope denied' })
    if (tab === 'requests') { tournamentQueue.isError = true; tournamentQueue.error = error as unknown as null }
    else {
      amendmentQueue.isError = true; amendmentQueue.error = error as unknown as null
      amendmentQueue.data.items = [{ id: 7, tournamentId: 22, tournamentName: 'Stale amendment', requestedBy: { id: 9001, fullName: 'Admin' }, selfRequested: true, requestedChanges: {}, status: 'pending', requestedAt: '2026-10-07' }]
    }
    render(ui(`/admin/${tab}`))
    expect(screen.getByText('Queue access denied.')).toBeInTheDocument()
    expect(screen.queryByText('Nothing waiting.')).not.toBeInTheDocument()
    expect(screen.queryByText('แบดมินตันหญิง')).not.toBeInTheDocument()
    expect(screen.queryByText('Stale amendment')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve the change' })).not.toBeInTheDocument()
  })

  it.each(['root', 'faculty'])('closes a pending decision if the viewer changes to another %s scope', scopeType => {
    const view = renderPage()
    fireEvent.click(approveIn('แบดมินตันหญิง'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    viewer.scope = { scopeType, facultyId: scopeType === 'faculty' ? 2 : null }
    view.rerender(ui())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(reviewMutate).not.toHaveBeenCalled()
  })

  it('continues to enable queues for university admins', () => {
    viewer.scope = { scopeType: 'university_wide', facultyId: null }
    renderPage()
    expect(pendingRequests).toHaveBeenCalledWith(true)
    expect(amendmentRequests).toHaveBeenCalledWith(true)
    expect(approveIn('แบดมินตันหญิง')).toBeEnabled()
  })
})

describe('a request above a faculty admin’s scope', () => {
  it('keeps offering Approve until the server has actually refused it', () => {
    renderPage()
    expect(approveIn('แบดมินตันหญิง')).toBeEnabled()
    expect(screen.queryByText(/not yours to approve/)).not.toBeInTheDocument()
  })

  it('marks the row the server refused, and only that row', () => {
    failWith('ELIGIBILITY_OUT_OF_SCOPE', 'ทัวร์นาเมนต์นี้เปิดรับนอกคณะของคุณ')
    renderPage()
    fireEvent.click(approveIn('แบดมินตันหญิง'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))

    expect(within(rowOf('แบดมินตันหญิง')).getByText('Above your scope')).toBeInTheDocument()
    expect(approveIn('แบดมินตันหญิง')).toBeDisabled()
    expect(approveIn('บาสเกตบอลสัมพันธ์')).toBeEnabled()
    expect(within(rowOf('บาสเกตบอลสัมพันธ์')).queryByText('Above your scope')).not.toBeInTheDocument()
  })

  it('explains it in the language of this page instead of echoing the backend string', () => {
    failWith('ELIGIBILITY_OUT_OF_SCOPE', 'ทัวร์นาเมนต์นี้เปิดรับนอกคณะของคุณ')
    renderPage()
    fireEvent.click(approveIn('แบดมินตันหญิง'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))

    expect(screen.getByText(/a university admin has to\s+approve it/i)).toBeInTheDocument()
    expect(screen.queryByText(/ทัวร์นาเมนต์นี้เปิดรับนอกคณะของคุณ/)).not.toBeInTheDocument()
    expect(screen.queryByText(/The decision did not go through/)).not.toBeInTheDocument()
  })

  /* C03 reject ไม่ได้เช็ค adminCoversEligibility — ปฏิเสธได้จริงทั้งที่อนุมัติไม่ได้
     จึงไม่ปิดปุ่ม แต่ต้องเตือน (ดู BACKEND-GAPS `FE-reject-skips-eligibility-scope`) */
  it('leaves Decline alone, because the server really does allow it', () => {
    failWith('ELIGIBILITY_OUT_OF_SCOPE', 'ทัวร์นาเมนต์นี้เปิดรับนอกคณะของคุณ')
    renderPage()
    fireEvent.click(approveIn('แบดมินตันหญิง'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))

    expect(within(rowOf('แบดมินตันหญิง')).getByRole('button', { name: 'Decline' })).toBeEnabled()
    expect(screen.getByText(/Declining it is still permitted/)).toBeInTheDocument()
  })

  it('still shows other refusals in the banner, readably', () => {
    failWith('INVALID_STATUS_TRANSITION', 'ทัวร์นาเมนต์นี้ไม่ได้อยู่ในสถานะรออนุมัติ')
    const view = renderPage()
    fireEvent.click(approveIn('แบดมินตันหญิง'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))
    view.rerender(ui())

    expect(screen.getByText(/The decision did not go through/)).toBeInTheDocument()
    expect(screen.getByText(/Somebody already decided this one/)).toBeInTheDocument()
    expect(approveIn('แบดมินตันหญิง')).toBeEnabled()
  })
})

it('does not submit an approval when the confirmation is cancelled', () => {
  renderPage()
  fireEvent.click(approveIn('แบดมินตันหญิง'))
  expect(reviewMutate).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  expect(reviewMutate).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('warns before self-approval and sends an amendment only after confirmation', () => {
  amendmentQueue.data.items = [{ id: 7, tournamentId: 22, tournamentName: 'Self request', requestedBy: { id: 9001, fullName: 'Admin' }, selfRequested: true, requestedChanges: { maxTeams: 8 }, status: 'pending', requestedAt: '2026-10-07T03:00:00Z' }]
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Hard-filter changes' }))
  expect(screen.getByText('You submitted this request')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Approve the change' }))
  expect(screen.getByText(/Approving it yourself will be recorded/)).toBeInTheDocument()
  expect(amendmentMutate).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  expect(amendmentMutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Approve the change' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm amendment approval' }))
  expect(amendmentMutate).toHaveBeenCalledWith(7, expect.any(Object))
})
