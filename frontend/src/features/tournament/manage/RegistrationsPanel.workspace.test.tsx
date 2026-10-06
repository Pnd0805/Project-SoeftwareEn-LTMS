import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { Tournament } from '../../../shared/types'

const { applications, detail, approve, reject } = vi.hoisted(() => ({
  applications: vi.fn(), detail: vi.fn(), approve: vi.fn(), reject: vi.fn(),
}))
vi.mock('../../../api/client', async original => ({ ...await original<typeof import('../../../api/client')>(), USE_MOCK: false }))
vi.mock('../../../api/tournament', async original => ({
  ...await original<typeof import('../../../api/tournament')>(),
  getTournamentApplications: applications, getApplicationDetail: detail,
  approveApplication: approve, rejectApplication: reject,
}))
import { RegistrationsPanel } from './RegistrationsPanel'

const t = { id: '42', name: 'Campus Cup', entryNotes: 'Bring a student ID' } as Tournament
const row = (id: number, name: string, status: string) => ({
  id, team: { id: id + 100, name }, status, hardFilterPassed: true, appliedAt: null,
})
function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  render(<QueryClientProvider client={client}><MemoryRouter><RegistrationsPanel t={t} /></MemoryRouter></QueryClientProvider>)
  return client
}
beforeEach(() => {
  applications.mockReset().mockResolvedValue({ items: [
    row(1, 'Northside FC', 'pending'), row(2, 'Southside FC', 'approved'),
    row(3, 'Northside Juniors', 'withdrawn'), row(4, 'Westside FC', 'rejected'),
    row(5, 'Eastside FC', 'cancelled'),
  ] })
  detail.mockReset().mockResolvedValue({ id: 1, players: [{ userId: 7, fullName: 'Alex North', avatarUrl: null }] })
  approve.mockReset().mockResolvedValue({})
  reject.mockReset().mockRejectedValue(new ApiError(409, { code: 'CONFLICT', message: 'Decision could not be saved' }))
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
