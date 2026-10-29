import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getMyTeams, getInvitations, getApplications, getSports } = vi.hoisted(() => ({
  getMyTeams: vi.fn(), getInvitations: vi.fn(), getApplications: vi.fn(), getSports: vi.fn(),
}))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/team', async original => ({ ...await original<typeof import('../../api/team')>(), getBackendMyTeams: getMyTeams, getBackendMyInvitations: getInvitations }))
vi.mock('../../api/tournament', async original => ({ ...await original<typeof import('../../api/tournament')>(), getMyApplications: getApplications }))
vi.mock('../../api/reference', () => ({ getSportTypes: getSports }))

import { TeamsPage } from './TeamsPage'

let client: QueryClient
beforeEach(() => {
  vi.clearAllMocks()
  getMyTeams.mockResolvedValue({ items: [
    { id: 41, name: 'Northside FC', sportTypeId: 1, role: 'leader', readinessStatus: 'Forming', officialStatus: 'Unofficial', memberCount: 2 },
    { id: 42, name: 'Northside Hoops', sportTypeId: 2, role: 'member', readinessStatus: 'Forming', officialStatus: 'Unofficial', memberCount: 3 },
    { id: 43, name: 'Southside FC', sportTypeId: 1, role: 'member', readinessStatus: 'Forming', officialStatus: 'Unofficial', memberCount: 2 },
  ] })
  getSports.mockResolvedValue({ items: [{ id: 1, name: 'Football' }, { id: 2, name: 'Basketball' }] })
  getInvitations.mockResolvedValue({ items: [{ id: 5, team: { id: 50, name: 'Eastside Club' }, invitedBy: { fullName: 'Lee' }, expiresAt: '2026-12-01' }] })
  getApplications.mockResolvedValue({ items: [] })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => client.clear())
function show() {
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/teams']}><Routes>
    <Route path="/teams" element={<TeamsPage />} />
    <Route path="/team/:id" element={<h1>Team detail</h1>} />
    <Route path="/t/:id" element={<h1>Tournament detail</h1>} />
  </Routes></MemoryRouter></QueryClientProvider>)
}

describe('Teams discovery', () => {
  it('intersects name, sport and role locally, keeps invitations available, and clears an empty result', async () => {
    show()
    await screen.findByText('Northside FC')
    const teams = screen.getByRole('region', { name: 'Your teams' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search teams' }), { target: { value: ' northSIDE ' } })
    fireEvent.change(screen.getByLabelText('Sport filter'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Role filter'), { target: { value: 'leader' } })
    expect(within(teams).getByText('Northside FC')).toBeInTheDocument()
    expect(within(teams).queryByText('Northside Hoops')).not.toBeInTheDocument()
    expect(within(teams).queryByText('Southside FC')).not.toBeInTheDocument()
    expect(screen.getByText('Eastside Club')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Role filter'), { target: { value: 'member' } })
    expect(within(teams).getByText('No matching teams')).toBeInTheDocument()
    expect(screen.queryByText("You're not in a squad yet")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(within(teams).getByText('Northside Hoops')).toBeInTheDocument()
    expect(within(teams).getByText('Southside FC')).toBeInTheDocument()
    expect(getMyTeams).toHaveBeenCalledTimes(1)
  })

  it('opens the existing tournament entry even when team loading fails', async () => {
    getMyTeams.mockRejectedValue(new Error('Teams unavailable'))
    getApplications.mockResolvedValue({ items: [{ id: 9, team: { id: 41, name: 'Northside FC' }, tournament: { id: 12, name: 'Campus Cup' }, status: 'approved' }] })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'View entry for Northside FC in Campus Cup' }))
    expect(screen.getByRole('heading', { name: 'Tournament detail' })).toBeInTheDocument()
  })
})
