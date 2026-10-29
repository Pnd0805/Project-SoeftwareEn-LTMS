import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const { accept, decline, state } = vi.hoisted(() => ({ accept: vi.fn(), decline: vi.fn(), state: { result: 'applied' } }))
vi.mock('../../hooks/useAdmin', () => ({
  useTournamentRefereeRequests: () => ({ isSuccess: true, data: { items: [{ id: 42, type: 'ref_withdraw', tournamentId: 14, withdrawScope: 'tournament', matchA: null,
    reason: 'Unable to attend the tournament', refereeA: { user: { fullName: 'External Ref' } }, status: 'open', createdAt: '2026-10-06T00:00:00Z' }] } }),
  useAcceptRefereeRequest: () => ({ mutate: accept, reset: vi.fn(), isPending: false, isError: false }),
  useDeclineRefereeRequest: () => ({ mutate: decline, reset: vi.fn(), isPending: false, isError: false }),
}))
import { OrganizerWithdrawals } from './RefereeWithdrawal'
beforeEach(() => {
  vi.clearAllMocks(); state.result = 'applied'
  accept.mockImplementation((id, callbacks) => callbacks.onSuccess({ id, status: state.result }))
})
it('shows the withdrawal reason and requires organizer confirmation before applying', () => {
  render(<OrganizerWithdrawals tournamentId={14} />)
  expect(screen.getByText('เหตุผล: Unable to attend the tournament')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Approve withdrawal' }))
  expect(accept).not.toHaveBeenCalled()
  expect(screen.getByText(/ตรวจแมตช์ที่ขาดกรรมการและจัดคนแทน/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }))
  expect(accept).toHaveBeenCalledWith(42, expect.any(Object))
  expect(screen.getByText('คำขอ #42: อนุมัติการถอนตัวแล้ว')).toBeInTheDocument()
})
it('does not report withdrawal approved when the backend instead cancels a stale request', () => {
  state.result = 'cancelled'; render(<OrganizerWithdrawals tournamentId={14} />)
  fireEvent.click(screen.getByRole('button', { name: 'Approve withdrawal' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }))
  expect(screen.queryByText('คำขอ #42: อนุมัติการถอนตัวแล้ว')).not.toBeInTheDocument()
  expect(screen.getByText(/สถานะ cancelled กรุณาตรวจข้อมูลล่าสุด/)).toBeInTheDocument()
})
