import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ scope: 'root', reports: vi.fn(), stalled: vi.fn(), decide: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 9, adminScope: { scopeType: state.scope } } }) }))
vi.mock('../../hooks/useQaFeatures', () => ({
  useUserReports: (page: number, enabled: boolean) => { state.reports(page, enabled); return { query: { isSuccess: true, data: { items: [], pagination: { totalPages: 1 } } }, decide: { mutate: state.decide } } },
  useStalledWork: (enabled: boolean) => { state.stalled(enabled); return { data: enabled ? { thresholdHours: 48, disputesPastDeadline: { count: 1, matchIds: [13] }, complaintsAwaitingAdmin: { count: 0, complaintIds: [] }, universityAdmins: { active: 0, total: 1 }, needsAttention: true } : undefined, refetch: vi.fn() } },
}))
import { UserReportsTab } from './UserReportsTab'
import { StalledWorkTab } from './StalledWorkTab'
beforeEach(() => { vi.clearAllMocks(); state.scope = 'root' })
it('lets Root see stalled counts while keeping complaint review disabled', () => {
  render(<><UserReportsTab /><StalledWorkTab /></>)
  expect(state.reports).toHaveBeenCalledWith(1, false)
  expect(state.stalled).toHaveBeenCalledWith(true)
  expect(screen.getByText(/Match IDs: 13/)).toBeInTheDocument()
  expect(screen.getByText(/Root needs to appoint an admin/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Confirm decision' })).not.toBeInTheDocument()
})
it('gates oversight for Faculty Admin while enabling its report queue', () => {
  state.scope = 'faculty'
  render(<><UserReportsTab /><StalledWorkTab /></>)
  expect(state.reports).toHaveBeenCalledWith(1, true)
  expect(state.stalled).toHaveBeenCalledWith(false)
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
  expect(state.decide).not.toHaveBeenCalled()
})
