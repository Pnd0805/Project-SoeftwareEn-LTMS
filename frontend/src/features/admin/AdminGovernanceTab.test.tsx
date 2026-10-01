import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ scope: 'root', grant: vi.fn(), suspend: vi.fn() }))
vi.mock('../../api/client', () => ({ USE_MOCK: false }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 9, email: 'admin@test', adminScope: { scopeType: state.scope, facultyId: 1 } } }) }))
vi.mock('../../hooks/useReference', () => ({ useFaculties: () => ({ data: { items: [{ id: 1, name: 'Engineering' }] } }) }))
vi.mock('../../hooks/useAdmin', () => ({
 useAdminScopes: () => ({ isSuccess: true, data: { items: [] } }),
 useAuditLogs: () => ({ isSuccess: true, data: { items: [] } }),
 useGrantAdminScope: () => ({ mutate: state.grant, reset: vi.fn() }),
 useRevokeAdminScope: () => ({ mutate: vi.fn(), reset: vi.fn() }),
 useSuspendUser: () => ({ mutate: state.suspend, reset: vi.fn() }),
 useUsersForAdmin: () => ({ isSuccess: true, data: { items: [{ user: { id: 7, fullName: 'Player' }, email: 'player@test', userType: 'student', facultyName: 'Engineering', facultyId: 1, teamCount: null, adminScopes: [], isSuspended: false }] } }),
}))
import { AdminScopesTab } from './AdminGovernanceTab'
import { AdminUsersTab } from './AdminUsersTab'
beforeEach(() => { state.scope = 'root'; state.grant.mockReset(); state.suspend.mockReset() })
it('Root reviews a university grant before sending it', () => {
 render(<AdminScopesTab />)
 fireEvent.change(screen.getByLabelText('User ID'), { target: { value: '42' } })
 fireEvent.click(screen.getByRole('button', { name: 'Review grant' }))
 expect(state.grant).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: 'Confirm grant' }))
 expect(state.grant).toHaveBeenCalledWith({ userId: 42, scopeType: 'university_wide' }, expect.anything())
})
it('University Admin grants faculty rights and Faculty Admin cannot grant', () => {
 state.scope = 'university_wide'; const view = render(<AdminScopesTab />)
 fireEvent.change(screen.getByLabelText('User ID'), { target: { value: '42' } })
 expect(screen.getByRole('button', { name: 'Review grant' })).toBeDisabled()
 fireEvent.change(screen.getByLabelText('Faculty'), { target: { value: '1' } })
 fireEvent.click(screen.getByRole('button', { name: 'Review grant' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm grant' }))
 expect(state.grant).toHaveBeenCalledWith({ userId: 42, scopeType: 'faculty', facultyId: 1 }, expect.anything())
 view.unmount(); state.scope = 'faculty'; render(<AdminScopesTab />)
 expect(screen.queryByRole('button', { name: 'Review grant' })).not.toBeInTheDocument()
})
it('suspension includes category and checks the 90-day ceiling', () => {
 state.scope = 'university_wide'; render(<AdminUsersTab />)
 fireEvent.click(screen.getByRole('button', { name: 'Suspend' }))
 fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Repeated spam' } })
 fireEvent.change(screen.getByLabelText(/Category shown/), { target: { value: 'spam' } })
 fireEvent.change(screen.getByLabelText(/Days/), { target: { value: '91' } })
 expect(screen.getByRole('button', { name: 'Suspend account' })).toBeDisabled()
 fireEvent.change(screen.getByLabelText(/Days/), { target: { value: '7' } })
 fireEvent.click(screen.getByRole('button', { name: 'Suspend account' }))
 expect(state.suspend).toHaveBeenCalledWith({ userId: 7, input: { suspend: true, reason: 'Repeated spam', category: 'spam', days: 7 } }, expect.anything())
})
