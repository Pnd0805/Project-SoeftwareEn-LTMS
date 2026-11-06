import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { Tournament } from '../../../shared/types'

const { applications, detail, approve, reject, closeReg, openReg } = vi.hoisted(() => ({
  applications: vi.fn(), detail: vi.fn(), approve: vi.fn(), reject: vi.fn(),
  closeReg: vi.fn(), openReg: vi.fn(),
}))
vi.mock('../../../api/client', async original => ({ ...await original<typeof import('../../../api/client')>(), USE_MOCK: false }))
vi.mock('../../../api/tournament', async original => ({
  ...await original<typeof import('../../../api/tournament')>(),
  getTournamentApplications: applications, getApplicationDetail: detail,
  approveApplication: approve, rejectApplication: reject,
  closeRegistration: closeReg, openRegistration: openReg,
}))
import { RegistrationsPanel } from './RegistrationsPanel'

const t = { id: '42', name: 'Campus Cup', entryNotes: 'Bring a student ID' } as Tournament
const row = (id: number, name: string, status: string) => ({
  id, team: { id: id + 100, name }, status, hardFilterPassed: true, appliedAt: null,
})
function renderPanel(tournament = t) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  render(<QueryClientProvider client={client}><MemoryRouter><RegistrationsPanel t={tournament} /></MemoryRouter></QueryClientProvider>)
  return client
}
beforeEach(() => {
  applications.mockReset().mockResolvedValue({ items: [
    row(1, 'Northside FC', 'pending'), row(2, 'Southside FC', 'approved'),
    row(3, 'Northside Juniors', 'withdrawn'), row(4, 'Westside FC', 'rejected'),
    row(5, 'Eastside FC', 'cancelled'),
  ] })
  detail.mockReset().mockResolvedValue({ id: 1, players: [{ userId: 7, fullName: 'Alex North', avatarUrl: null }], hardFilterDetails: [{ userId: 7, fullName: 'Alex North', passed: true }] })
  approve.mockReset().mockResolvedValue({})
  reject.mockReset().mockRejectedValue(new ApiError(409, { code: 'CONFLICT', message: 'Decision could not be saved' }))
})
it.each(['completed', 'cancelled'])('keeps %s entries readable without decision buttons', async status => {
  renderPanel({ ...t, status: status === 'cancelled' ? 'cancelled' : 'public', champion: status === 'completed' ? 'finished' : null })
  await screen.findByText('Northside FC')
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument()
  expect(approve).not.toHaveBeenCalled()
  expect(reject).not.toHaveBeenCalled()
})
it('intersects team search and status locally, includes withdrawn/cancelled entries and clears no results', async () => {
  renderPanel()
  await screen.findByText('Northside FC')
  expect(screen.getByText('Eastside FC')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search teams' }), { target: { value: 'Northside' } })
  fireEvent.change(screen.getByLabelText('Registration status'), { target: { value: 'withdrawn' } })
  expect(screen.getByText('Northside Juniors')).toBeInTheDocument()
  expect(screen.queryByText('Northside FC')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Registration status'), { target: { value: 'approved' } })
  expect(screen.getByText('No matching registrations')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.getByRole('searchbox', { name: 'Search teams' })).toHaveValue('')
  expect(screen.getByText('Northside FC')).toBeInTheDocument()
  expect(applications).toHaveBeenCalledExactlyOnceWith(42)
})
it('retains review and rejection draft on retryable list refresh, reports decision failure and hides denied data', async () => {
  const client = renderPanel()
  await screen.findByText('Northside FC')
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  const dialog = await screen.findByRole('dialog', { name: 'Northside FC' })
  await within(dialog).findByText('Alex North')
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Missing required document' } })
  applications.mockRejectedValue(new ApiError(500, { code: 'SERVER_ERROR', message: 'Temporary outage' }))
  await act(async () => { await client.invalidateQueries({ queryKey: ['tournament', 42, 'applications'] }) })
  await screen.findByText(/Showing saved registrations/)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText('Reason')).toHaveValue('Missing required document')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))
  await within(dialog).findByText(/Decision could not be saved/)
  expect(reject).toHaveBeenCalledWith(42, 1, 'Missing required document')
  applications.mockRejectedValue(new ApiError(403, { code: 'FORBIDDEN', message: 'Access denied' }))
  await act(async () => { await client.invalidateQueries({ queryKey: ['tournament', 42, 'applications'] }) })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.queryByText('Northside FC')).not.toBeInTheDocument()
})
it('opens review at its readable details instead of jumping to the rejection input', async () => {
  renderPanel()
  await screen.findByText('Northside FC')
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  await waitFor(() => expect(screen.getByRole('region', { name: 'Entry review details' })).toHaveFocus())
})

it('shows each submitted player’s server Hard filter result by user ID with its failure reason', async () => {
  detail.mockResolvedValue({ id: 1,
    players: [{ userId: 7, fullName: 'Alex North', avatarUrl: null }, { userId: 8, fullName: 'Sam South', avatarUrl: null }],
    hardFilterDetails: [{ userId: 8, fullName: 'Sam South', passed: false, reason: 'age' }, { userId: 7, fullName: 'Alex North', passed: true }],
  })
  renderPanel(); await screen.findByText('Northside FC')
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  const dialog = await screen.findByRole('dialog', { name: 'Northside FC' })
  await within(dialog).findByText('Sam South')
  expect(within(dialog).getByRole('columnheader', { name: 'Hard filter' })).toBeInTheDocument()
  expect(within(within(dialog).getByRole('row', { name: /Alex North/ })).getByText('Passed')).toBeInTheDocument()
  const failed = within(dialog).getByRole('row', { name: /Sam South/ })
  expect(within(failed).getByText('Failed')).toBeInTheDocument()
  expect(within(failed).getByText('Failed: Age')).toBeInTheDocument()
})

it('does not infer a player passed from the team badge when their result is absent or malformed', async () => {
  detail.mockResolvedValue({ id: 1,
    players: [{ userId: 7, fullName: 'Alex North', avatarUrl: null }, { userId: 8, fullName: 'Sam South', avatarUrl: null }],
    hardFilterDetails: [null, { userId: 7, passed: 'true' }, { userId: 999, passed: true }],
  })
  renderPanel(); await screen.findByText('Northside FC'); fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  const dialog = await screen.findByRole('dialog', { name: 'Northside FC' }); await within(dialog).findByText('Sam South')
  expect(within(dialog).getByText('Hard filter passed')).toBeInTheDocument()
  expect(within(dialog).getAllByText('Not reported')).toHaveLength(2)
  expect(within(dialog).queryByText('Passed')).not.toBeInTheDocument()
})

it('keeps a failed player visible when the backend supplies no failure reason', async () => {
  detail.mockResolvedValue({ id: 1, players: [{ userId: 7, fullName: 'Alex North', avatarUrl: null }], hardFilterDetails: [{ userId: 7, passed: false }] })
  renderPanel(); await screen.findByText('Northside FC'); fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  const dialog = await screen.findByRole('dialog', { name: 'Northside FC' })
  expect(await within(dialog).findByText('Failure reason not provided.')).toBeInTheDocument()
  expect(within(dialog).getByText('Failed')).toBeInTheDocument()
})

it('allows closing registration when tournament is public and open', async () => {
  closeReg.mockReset().mockResolvedValue({ id: 42, registrationOpen: false })
  renderPanel({ ...t, status: 'public', registrationOpen: true })
  await screen.findByText('Northside FC')
  expect(screen.getByText('Registration open')).toBeInTheDocument()
  const btn = screen.getByRole('button', { name: 'Close registration' })
  fireEvent.click(btn)
  await waitFor(() => expect(closeReg).toHaveBeenCalledWith(42))
})

it('allows opening registration when tournament is public and closed', async () => {
  openReg.mockReset().mockResolvedValue({ id: 42, registrationOpen: true })
  renderPanel({ ...t, status: 'public', registrationOpen: false })
  await screen.findByText('Northside FC')
  expect(screen.getByText('Registration closed')).toBeInTheDocument()
  const btn = screen.getByRole('button', { name: 'Open registration' })
  fireEvent.click(btn)
  await waitFor(() => expect(openReg).toHaveBeenCalledWith(42))
})
