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
let accessQuery: Record<string, unknown>
let requestQuery: Record<string, unknown>
let amendmentQuery: Record<string, unknown>
const accessRefetch = vi.fn()
const approveAmendment = vi.fn()

const request = (id: number, name: string) => ({
  id, name, sportTypeId: 1,
  requestedBy: { id: 9213, fullName: 'กันตพงศ์ อินทรีย์', avatarUrl: null },
  eventStartDate: '2026-12-01', createdAt: '2026-09-18T15:11:00.000Z',
})

vi.mock('../../hooks/useAdmin', () => ({
  useAdminAccess: () => accessQuery,
  usePendingTournamentRequests: () => requestQuery,
  useReviewTournamentRequest: () => reviewState,
  useTeamRequests: () => emptyList,
  useApproveTeamRequest: () => idle,
  useRejectTeamRequest: () => idle,
  useExternalRefereeRequests: () => emptyList,
  useAmendmentRequests: () => amendmentQuery,
  useApproveAmendment: () => ({ ...idle, mutate: approveAmendment }),
  useRejectAmendment: () => idle,
}))
vi.mock('../../hooks/useTournament', () => ({ useTournaments: () => emptyList }))
vi.mock('../../hooks/useReference', () => ({ useSportTypes: () => ({ data: { items: [{ id: 1, name: 'ฟุตบอล' }] } }) }))
vi.mock('./AdminRefereesTab', () => ({ AdminRefereesTab: () => null }))
vi.mock('./AdminUsersTab', () => ({ AdminUsersTab: () => null }))
vi.mock('./AdminFeedbackTab', () => ({ AdminFeedbackTab: () => null }))

import { AdminPage } from './AdminPage'

/* mutation state ของ mock เป็น object ธรรมดา ไม่ได้บอก React ว่าเปลี่ยน — กรณีที่
   หน้าจอไม่ได้ตั้ง state ของตัวเองจึงต้องสั่ง render ซ้ำเองเพื่ออ่านผลหลังคำขอเด้ง
   และต้องสร้าง element ใหม่ทุกครั้ง ไม่งั้น React ข้ามการ render เพราะเป็นตัวเดิม */
const ui = () => (
  <MemoryRouter initialEntries={['/admin/requests']}>
    <Routes><Route path="/admin/:tab" element={<AdminPage />} /></Routes>
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
  accessQuery = { data: true, isPending: false, isError: false, isSuccess: true, error: null, refetch: accessRefetch }
  requestQuery = { ...emptyList, data: { items: [request(24, 'บาสเกตบอลสัมพันธ์'), request(25, 'แบดมินตันหญิง')] } }
  amendmentQuery = emptyList
  reviewState.isError = false
  reviewState.error = null
  reviewMutate.mockImplementation(() => {})
})

it('keeps grouped Admin destinations as current-route links without reviewing a request', () => {
  renderPage()
  const nav = within(screen.getByRole('navigation', { name: 'Admin sections' }))
  const reviews = within(nav.getByRole('group', { name: 'Reviews' }))
  expect(reviews.getByRole('link', { name: 'Tournament requests' })).toHaveAttribute('aria-current', 'page')
  expect(nav.getByRole('group', { name: 'Directory' })).toBeInTheDocument()
  expect(nav.getByRole('group', { name: 'Governance' })).toBeInTheDocument()
  fireEvent.click(reviews.getByRole('link', { name: 'Rule changes' }))
  expect(reviews.getByRole('link', { name: 'Rule changes' })).toHaveAttribute('aria-current', 'page')
  expect(reviews.getByRole('link', { name: 'Tournament requests' })).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('heading', { name: /Rule changes/ })).toBeInTheDocument()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(reviewMutate).not.toHaveBeenCalled()
})

it('explains approval once outside the queue while retaining individual request context and actions', () => {
  renderPage()
  const consequence = screen.getByText(/Approval creates a private tournament/)
  const queue = screen.getByRole('region', { name: 'Tournament request queue' })
  expect(queue).not.toContainElement(consequence)
  const rows = within(queue).getAllByRole('article')
  expect(rows).toHaveLength(2)
  for (const row of rows) {
    expect(within(row).getByText(/Requested by/)).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Approve' })).toBeEnabled()
    expect(within(row).getByRole('button', { name: 'Decline' })).toBeEnabled()
  }
})

it('keeps a named approval receipt after the request leaves the queue', () => {
  reviewMutate.mockImplementation((_vars, opts) => {
    requestQuery = { ...emptyList, data: { items: [] } }
    opts.onSuccess?.()
  })
  renderPage()
  fireEvent.click(approveIn('แบดมินตันหญิง'))
  expect(screen.getByRole('status')).toHaveTextContent('Approved แบดมินตันหญิง')
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
})

it('keeps a named change receipt after an amendment leaves the queue', () => {
  amendmentQuery = { ...emptyList, data: { items: [{ id: 31, status: 'pending', tournamentName: 'Campus Cup', requestedAt: '2026-10-01', requestedBy: { fullName: 'Organizer' }, requestedChanges: { maxTeams: 16 } }] } }
  approveAmendment.mockImplementation((_id, opts) => { amendmentQuery = emptyList; opts.onSuccess?.() })
  render(<MemoryRouter initialEntries={['/admin/filters']}><Routes><Route path="/admin/:tab" element={<AdminPage />} /></Routes></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Approve the change' }))
  expect(screen.getByRole('status')).toHaveTextContent('Approved changes for Campus Cup')
})
it('shows the actual proposed condition values in readable change details', () => {
  amendmentQuery = { ...emptyList, data: { items: [{ id: 31, status: 'pending', tournamentName: 'Campus Cup', requestedAt: '2026-10-01', requestedBy: { fullName: 'Organizer' }, requestedChanges: { eligibilityRules: [{ faculty: 'Engineering', minAge: 18 }] } }] } }
  render(<MemoryRouter initialEntries={['/admin/filters']}><Routes><Route path="/admin/:tab" element={<AdminPage />} /></Routes></MemoryRouter>)
  expect(screen.getByRole('cell', { name: 'Faculty: Engineering · Min age: 18' })).toBeInTheDocument()
})

it('hides cached requests and their open dialog after the source denies access', () => {
  const view = renderPage()
  fireEvent.click(within(rowOf('แบดมินตันหญิง')).getByRole('button', { name: 'Decline' }))
  requestQuery = { ...requestQuery, isError: true, isSuccess: false, error: new ApiError(403, { code: 'DENIED', message: 'Access denied' }) }
  view.rerender(ui())
  expect(screen.queryByText('แบดมินตันหญิง')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('retains the decline reason through a recoverable queue refresh failure', () => {
  const view = renderPage()
  fireEvent.click(within(rowOf('แบดมินตันหญิง')).getByRole('button', { name: 'Decline' }))
  fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Needs venue confirmation' } })
  requestQuery = { ...requestQuery, isError: true, isSuccess: false, error: new Error('Temporary failure') }
  view.rerender(ui())
  expect(screen.getByLabelText(/Reason/)).toHaveValue('Needs venue confirmation')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('offers retry after an access probe failure instead of claiming the account lacks admin rights', () => {
  accessQuery = { ...accessQuery, isSuccess: false, isError: true, error: new ApiError(503, { code: 'UNAVAILABLE', message: 'Temporary failure' }) }
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(accessRefetch).toHaveBeenCalledOnce()
  expect(screen.queryByText('403 — admin only')).not.toBeInTheDocument()
  expect(screen.queryByText('แบดมินตันหญิง')).not.toBeInTheDocument()
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

    expect(within(rowOf('แบดมินตันหญิง')).getByText('Above your scope')).toBeInTheDocument()
    expect(approveIn('แบดมินตันหญิง')).toBeDisabled()
    expect(approveIn('บาสเกตบอลสัมพันธ์')).toBeEnabled()
    expect(within(rowOf('บาสเกตบอลสัมพันธ์')).queryByText('Above your scope')).not.toBeInTheDocument()
  })

  it('explains it in the language of this page instead of echoing the backend string', () => {
    failWith('ELIGIBILITY_OUT_OF_SCOPE', 'ทัวร์นาเมนต์นี้เปิดรับนอกคณะของคุณ')
    renderPage()
    fireEvent.click(approveIn('แบดมินตันหญิง'))

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

    expect(within(rowOf('แบดมินตันหญิง')).getByRole('button', { name: 'Decline' })).toBeEnabled()
    expect(screen.getByText(/Declining it is still permitted/)).toBeInTheDocument()
  })

  it('still shows other refusals in the banner, readably', () => {
    failWith('INVALID_STATUS_TRANSITION', 'ทัวร์นาเมนต์นี้ไม่ได้อยู่ในสถานะรออนุมัติ')
    const view = renderPage()
    fireEvent.click(approveIn('แบดมินตันหญิง'))
    view.rerender(ui())

    expect(screen.getByText(/The decision did not go through/)).toBeInTheDocument()
    expect(screen.getByText(/Somebody already decided this one/)).toBeInTheDocument()
    expect(approveIn('แบดมินตันหญิง')).toBeEnabled()
  })
})
