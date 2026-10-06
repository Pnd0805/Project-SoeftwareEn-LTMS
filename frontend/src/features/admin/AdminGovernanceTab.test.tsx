import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ targetScope: '', suspended: false, scope: 'root', grant: vi.fn(), audit: vi.fn(), suspend: vi.fn(), profile: { teams: [{ id: 1 }, { id: 2 }, { id: 1 }] }, loading: false, profileError: false, refetch: vi.fn() }))
vi.mock('../../api/client', () => ({ USE_MOCK: false }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 9, email: 'admin@test', adminScope: { scopeType: state.scope, facultyId: 1 } } }) }))
vi.mock('../../hooks/useReference', () => ({ useFaculties: () => ({ data: { items: [{ id: 1, name: 'Engineering' }] } }) }))
vi.mock('../../hooks/useUser', () => ({ useSearchUsers: () => ({ data: { items: [] } }), usePublicUser: () => ({
 data: state.profile, isPending: state.loading, isError: state.profileError, refetch: state.refetch,
}) }))
vi.mock('../../hooks/useAdmin', () => ({
 useAdminScopes: () => ({ isSuccess: true, data: { items: [] } }),
 useAuditLogs: (query: unknown, enabled: boolean) => { state.audit(query, enabled); return { isSuccess: true, data: { items: [] } } },
 useGrantAdminScope: () => ({ mutate: state.grant, reset: vi.fn() }),
 useRevokeAdminScope: () => ({ mutate: vi.fn(), reset: vi.fn() }),
 useSuspendUser: () => ({ mutate: state.suspend, reset: vi.fn() }),
 useUsersForAdmin: () => ({ isSuccess: true, data: { items: [{ user: { id: 7, fullName: 'Player' }, email: 'player@test', userType: 'student', facultyName: 'Engineering', facultyId: 1, teamCount: null, adminScopes: state.targetScope ? [{ scopeType: state.targetScope }] : [], isSuspended: state.suspended }] } }),
}))
import { AdminScopesTab, AdminAuditTab } from './AdminGovernanceTab'
import { AdminUsersTab } from './AdminUsersTab'
beforeEach(() => { state.scope = 'root'; state.targetScope = ''; state.suspended = false; state.grant.mockReset(); state.suspend.mockReset(); state.loading = false; state.profileError = false; state.refetch.mockReset(); state.profile = { teams: [{ id: 1 }, { id: 2 }, { id: 1 }] } })
it('does not fetch or expose audit records to Faculty Admin', () => {
 state.scope = 'faculty'; state.audit.mockClear(); render(<AdminAuditTab />)
 expect(state.audit).toHaveBeenCalledWith({ page: 1 }, false)
 expect(screen.getByText('Audit logs are available to Root and University Admin only.')).toBeInTheDocument()
 expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
})
for (const scope of ['root', 'university_wide']) it(`enables paginated audit reads for ${scope}`, () => {
 state.scope = scope; state.audit.mockClear(); render(<AdminAuditTab />)
 expect(state.audit).toHaveBeenCalledWith({ page: 1 }, true)
 expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
})
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

it('allows permanent suspension without requiring days', () => {
 state.scope = 'university_wide'; render(<AdminUsersTab />)
 fireEvent.click(screen.getByRole('button', { name: 'Suspend' }))
 fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Severe cheating' } })
 fireEvent.change(screen.getByLabelText(/ประเภทการระงับ/), { target: { value: 'permanent' } })
 expect(screen.queryByLabelText(/Days/)).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button', { name: 'Suspend account' }))
 expect(state.suspend).toHaveBeenCalledWith({ userId: 7, input: { suspend: true, reason: 'Severe cheating', category: 'other', days: undefined } }, expect.anything())
})

it('shows the actual unique squad count and distinguishes a verified empty list', () => {
 const view = render(<AdminUsersTab />)
 expect(screen.getByTitle('Current squads')).toHaveTextContent('2')
 state.profile = { teams: [] }; view.rerender(<AdminUsersTab />)
 expect(screen.getByTitle('Current squads')).toHaveTextContent('0')
})
it('shows squad loading without claiming zero teams', () => {
 state.loading = true; render(<AdminUsersTab />)
 expect(screen.getByText('Loading...')).toBeInTheDocument()
 expect(screen.queryByTitle('Current squads')).not.toBeInTheDocument()
})
it('lets an admin retry a failed squad read without showing a fake zero', () => {
 state.profileError = true; render(<AdminUsersTab />)
 expect(screen.queryByTitle('Current squads')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button', { name: 'Retry squads for Player' }))
 expect(state.refetch).toHaveBeenCalledOnce()
})

for (const target of ['root', 'university_wide']) it(`blocks suspension of ${target} with an explicit explanation`, () => {
 state.scope = 'university_wide'; state.targetScope = target
 render(<AdminUsersTab />)
 expect(screen.getByRole('button', { name: 'Suspend' })).toBeDisabled()
 expect(screen.getByText(target === 'root' ? 'Root accounts cannot be suspended.' : 'Root must revoke University Admin rights before this account can be suspended.')).toBeInTheDocument()
 expect(state.suspend).not.toHaveBeenCalled()
})
it('does not apply protected suspension rules to reinstatement', () => {
 state.scope = 'university_wide'; state.targetScope = 'university_wide'; state.suspended = true
 render(<AdminUsersTab />)
 expect(screen.getByRole('button', { name: 'Reinstate' })).toBeEnabled()
})
