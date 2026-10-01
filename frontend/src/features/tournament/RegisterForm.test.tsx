import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { Tournament } from '../../shared/types'
const state = vi.hoisted(() => ({ apply: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../shared/store', async original => ({ ...await original<typeof import('../../shared/store')>(), useLtms: () => ({ tournaments: [] }) }))
vi.mock('../../hooks/useTournament', () => ({ useApplyToTournament: () => ({ mutateAsync: state.apply, isPending: false }) }))
vi.mock('../../hooks/useReference', () => ({ useSportTypes: () => ({ data: { items: [{ id: 1, name: 'Football', minMembers: 1, maxMembers: 2 }] } }) }))
vi.mock('../../hooks/useTeam', () => ({
 useBackendMyTeams: () => ({ data: { items: [] } }),
 useBackendTeamMembers: () => ({ data: { items: [
   { userId: 1, fullName: 'Alice', joinedAt: '2026-09-18T00:00:00Z' },
   { userId: 2, fullName: 'Bob', joinedAt: '2026-09-18T00:00:00Z' },
 ] }, isPending: false, isError: false }),
}))
import { RegisterForm } from './RegisterForm'
const tournament = { id: '10', name: 'Cup', sport: 'Football', channel: 'onsite', date: '2099-01-01', rules: {} } as Tournament
const renderForm = () => render(<RegisterForm backendTeam={{ id: 9, name: 'Squad' }}
 options={[tournament, { ...tournament, id: '11', name: 'Other cup' }]} tournament={tournament}
 sportTypeId={1} open onClose={vi.fn()} />)
beforeEach(() => { state.apply.mockReset() })

it('marks an unchecked team member whose referee role blocks registration', async () => {
 state.apply.mockRejectedValue(new ApiError(409, { code: 'TEAM_CONFLICT_OF_INTEREST', message: 'Role conflict', conflicts: [{ userId: 1, role: 'referee' }] }))
 renderForm()
 fireEvent.click(screen.getByRole('checkbox', { name: 'Enter Bob' }))
 fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }))
 await screen.findByText('Registration could not be submitted.')
 const row = screen.getByText('Alice').closest('tr')!
 expect(within(row).getByRole('checkbox')).not.toBeChecked()
 expect(within(row).getByText(/กรรมการ/)).toBeInTheDocument()
 expect(screen.getByText(/Deselecting the player does not resolve it/)).toBeInTheDocument()
 expect(state.apply.mock.calls[0][0]).toMatchObject({ teamId: 9, playerIds: [2] })
 fireEvent.change(screen.getByLabelText('Tournament'), { target: { value: '11' } })
 await waitFor(() => expect(screen.queryByText('Registration could not be submitted.')).not.toBeInTheDocument())
 expect(within(row).queryByText(/กรรมการ/)).not.toBeInTheDocument()
})
it('shows hard-filter failure beside the named selected player without blaming others', async () => {
 state.apply.mockRejectedValue(new ApiError(422, { code: 'HARD_FILTER_FAILED', message: 'Rule failure', details: [{ userId: 2, fullName: 'Bob', reason: 'faculty' }] }))
 renderForm()
 fireEvent.click(screen.getByRole('checkbox', { name: 'Enter Bob' }))
 fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }))
 await screen.findByText('Registration could not be submitted.')
 const row = screen.getByText('Bob').closest('tr')!
 expect(within(row).getByText('ไม่ผ่านเงื่อนไขคณะ')).toBeInTheDocument()
 expect(within(screen.getByText('Alice').closest('tr')!).queryByText('ไม่ผ่านเงื่อนไขคณะ')).not.toBeInTheDocument()
 expect(screen.getByText(/1 player blocked this submission/)).toBeInTheDocument()
})