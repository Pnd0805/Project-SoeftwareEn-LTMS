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
 useBackendMyTeams: () => ({ data: { items: [
   { id: 9, name: 'Squad', sportTypeId: 1, readinessStatus: 'Ready', role: 'leader', memberCount: 2 },
   { id: 10, name: 'Other squad', sportTypeId: 1, readinessStatus: 'Ready', role: 'leader', memberCount: 2 },
 ] } }),
 useBackendTeamMembers: () => ({ data: { items: [
   { userId: 1, fullName: 'Alice', joinedAt: '2026-09-18T00:00:00Z' },
   { userId: 2, fullName: 'Bob', joinedAt: '2026-09-18T00:00:00Z' },
 ] }, isPending: false, isError: false }),
}))
import { RegisterForm } from './RegisterForm'
const tournament = { id: '10', name: 'Cup', sport: 'Football', channel: 'onsite', date: '2099-01-01', rules: {} } as Tournament
const renderForm = (onClose = vi.fn()) => render(<RegisterForm backendTeam={{ id: 9, name: 'Squad' }}
 options={[tournament, { ...tournament, id: '11', name: 'Other cup' }]} tournament={tournament}
 sportTypeId={1} open onClose={onClose} />)
beforeEach(() => { state.apply.mockReset() })

it('explains ALREADY_APPLIED as an active team application rather than blaming individual players', async () => {
 state.apply.mockRejectedValue(new ApiError(409, { code: 'ALREADY_APPLIED', message: 'Active application exists' }))
 renderForm(); fireEvent.click(screen.getByRole('checkbox', { name: 'Enter Bob' }))
 fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }))
 await screen.findByText(/This team already has a pending or approved application/)
 expect(screen.queryByText(/สมัครทัวร์นี้กับทีมอื่นแล้ว/)).not.toBeInTheDocument()
})

it('marks an unchecked team member whose referee role blocks registration', async () => {
 state.apply.mockRejectedValue(new ApiError(409, { code: 'TEAM_CONFLICT_OF_INTEREST', message: 'Role conflict', conflicts: [{ userId: 1, role: 'referee' }] }))
 renderForm()
 fireEvent.click(screen.getByRole('checkbox', { name: 'Enter Bob' }))
 fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }))
 await screen.findByText('Registration could not be submitted.')
 expect(screen.getByRole('alert')).toHaveTextContent('Role conflict')
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
 expect(screen.getByRole('alert')).toHaveTextContent('Rule failure')
 const row = screen.getByText('Bob').closest('tr')!
 expect(within(row).getByText('ไม่ผ่านเงื่อนไขคณะ')).toBeInTheDocument()
 expect(within(screen.getByText('Alice').closest('tr')!).queryByText('ไม่ผ่านเงื่อนไขคณะ')).not.toBeInTheDocument()
 expect(screen.getByText(/1 player blocked this submission/)).toBeInTheDocument()
})

it('keeps the selected count and sport range visible when the selection is valid', () => {
 renderForm()
 expect(screen.getByRole('status', { name: 'Selected players' })).toHaveTextContent('0 selected · 1–2 players')
 expect(screen.getByRole('button', { name: 'Submit registration' })).toBeDisabled()
 fireEvent.click(screen.getByRole('checkbox', { name: 'Enter Bob' }))
 expect(screen.getByRole('status', { name: 'Selected players' })).toHaveTextContent('1 selected · 1–2 players')
 expect(screen.getByRole('button', { name: 'Submit registration' })).toBeEnabled()
 fireEvent.click(screen.getByRole('checkbox', { name: 'Enter Alice' }))
 expect(screen.getByRole('status', { name: 'Selected players' })).toHaveTextContent('2 selected · 1–2 players')
})

it.each([new TypeError('Connection lost'), 'Unexpected response'])('announces an unconfirmed outcome without replaying or clearing choices (%s)', async failure => {
 state.apply.mockRejectedValue(failure)
 const onClose = vi.fn()
 renderForm(onClose)
 fireEvent.click(screen.getByRole('checkbox', { name: 'Enter Bob' }))
 fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }))
 const alert = await screen.findByRole('alert')
 expect(alert).toHaveTextContent('Could not confirm registration. Check your entries before retrying.')
 expect(alert).not.toHaveTextContent('Registration could not be submitted.')
 expect(screen.getByRole('checkbox', { name: 'Enter Bob' })).toBeChecked()
 expect(screen.getByRole('checkbox', { name: 'Enter Alice' })).not.toBeChecked()
 expect(screen.getByRole('status', { name: 'Selected players' })).toHaveTextContent('1 selected · 1–2 players')
 expect(screen.getByLabelText('Tournament')).toHaveValue('10')
 expect(state.apply).toHaveBeenCalledExactlyOnceWith({ teamId: 9, playerIds: [2] })
 expect(onClose).not.toHaveBeenCalled()
 fireEvent.change(screen.getByLabelText('Tournament'), { target: { value: '11' } })
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
 expect(screen.getByRole('checkbox', { name: 'Enter Bob' })).toBeChecked()
 expect(state.apply).toHaveBeenCalledOnce()
})

it('presents real checks as unverified guidance rather than a successful validation', () => {
 renderForm()
 const guidance = screen.getByText(/Entry rules: open to everybody/)
 expect(guidance).toHaveTextContent('The server checks the 0 players')
 expect(guidance.closest('.banner.ok')).toBeNull()
})

it('does not reuse another team selection or error when switching teams', async () => {
 state.apply.mockRejectedValueOnce(new TypeError('Connection lost')).mockResolvedValueOnce({})
 const onClose = vi.fn()
 render(<RegisterForm options={[tournament]} tournament={tournament} sportTypeId={1} open onClose={onClose} />)
 await waitFor(() => expect(screen.getByLabelText('Team')).toHaveValue('9'))
 fireEvent.click(screen.getByRole('checkbox', { name: 'Enter Bob' }))
 fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }))
 await screen.findByRole('alert')
 fireEvent.change(screen.getByLabelText('Team'), { target: { value: '10' } })
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
 expect(screen.getByRole('checkbox', { name: 'Enter Bob' })).not.toBeChecked()
 expect(screen.getByRole('status', { name: 'Selected players' })).toHaveTextContent('0 selected · 1–2 players')
 expect(screen.getByRole('button', { name: 'Submit registration' })).toBeDisabled()
 fireEvent.click(screen.getByRole('checkbox', { name: 'Enter Alice' }))
 fireEvent.click(screen.getByRole('button', { name: 'Submit registration' }))
 await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
 expect(state.apply).toHaveBeenNthCalledWith(1, { teamId: 9, playerIds: [2] })
 expect(state.apply).toHaveBeenNthCalledWith(2, { teamId: 10, playerIds: [1] })
})
