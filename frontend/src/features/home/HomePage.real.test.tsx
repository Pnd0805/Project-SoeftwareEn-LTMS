import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, hooks } = vi.hoisted(() => ({
  auth: { data: undefined as { id: number } | undefined },
  hooks: {
    tournaments: vi.fn(() => ({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() })),
    myTournaments: vi.fn(() => ({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() })),
    myApplications: vi.fn(() => ({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() })),
    invitations: vi.fn(() => ({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() })),
    teams: vi.fn(() => ({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() })),
    refereeInvitations: vi.fn(() => ({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() })),
    refereeRequests: vi.fn(() => ({ data: { incoming: [] }, isPending: false, isError: false, refetch: vi.fn() })),
    matches: vi.fn(() => ({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() })),
    adminAccess: vi.fn(() => ({ data: false, isPending: false, isError: false, refetch: vi.fn() })),
    adminRequests: vi.fn(() => ({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() })),
  },
}))

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../shared/store', () => ({ useLtms: () => ({}) }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => auth }))
vi.mock('../../hooks/useReference', () => ({ useSportTypes: () => ({ data: { items: [] } }) }))
vi.mock('../../hooks/useTeam', () => ({
  useBackendMyInvitations: hooks.invitations,
  useBackendMyTeams: hooks.teams,
}))
vi.mock('../../hooks/useAdmin', () => ({
  useAdminAccess: hooks.adminAccess,
  useMyRefereeInvitations: hooks.refereeInvitations,
  useMyRefereeRequests: hooks.refereeRequests,
  usePendingTournamentRequests: hooks.adminRequests,
}))
vi.mock('../../hooks/useMatch', () => ({ useMyMatches: hooks.matches }))
vi.mock('../../hooks/useTournament', () => ({
  useTournaments: hooks.tournaments,
  useMyTournaments: hooks.myTournaments,
  useMyTournamentApplications: hooks.myApplications,
}))

import { HomePage } from './HomePage'

function renderHome(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><HomePage /></MemoryRouter>)
}

describe('real Home audience branches', () => {
  beforeEach(() => {
    auth.data = undefined
    Object.values(hooks).forEach(hook => hook.mockClear())
    hooks.tournaments.mockReturnValue({ data: { items: [] }, isPending: false, isError: false, refetch: vi.fn() })
  })

  it('shows Tournament discovery first for guests without mounting personal task hooks', () => {
    renderHome()

    const discovery = screen.getByRole('heading', { name: 'Tournaments' }).closest('#tournaments')!
    expect(discovery).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Needs you' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request tournament' })).not.toBeInTheDocument()
    expect(hooks.invitations).not.toHaveBeenCalled()
    expect(hooks.teams).not.toHaveBeenCalled()
    expect(hooks.refereeInvitations).not.toHaveBeenCalled()
    expect(hooks.refereeRequests).not.toHaveBeenCalled()
    expect(hooks.matches).not.toHaveBeenCalled()
    expect(hooks.adminAccess).not.toHaveBeenCalled()
    expect(hooks.adminRequests).not.toHaveBeenCalled()
    expect(hooks.myTournaments).toHaveBeenCalledOnce()
    expect(hooks.myTournaments).toHaveBeenCalledWith(false)
    expect(hooks.myApplications).toHaveBeenCalledOnce()
    expect(hooks.myApplications).toHaveBeenCalledWith(false)
  })

  it('places the signed-in task panel before Tournament discovery', () => {
    auth.data = { id: 7 }
    renderHome()

    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request tournament' })).toBeInTheDocument()
    const panel = screen.getByRole('heading', { name: 'Needs you' }).closest('section')!
    const discovery = screen.getByRole('heading', { name: 'Tournaments' }).closest('#tournaments')!
    expect(screen.getByRole('heading', { level: 2, name: 'Tournaments' })).toBeInTheDocument()
    expect(panel.compareDocumentPosition(discovery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Browse tournaments' })).toHaveAttribute('href', '#tournaments')
  })

  it('keeps signed-in Tournament discovery separate from personal tasks', () => {
    auth.data = { id: 7 }
    renderHome('/home/all')
    expect(screen.getByRole('heading', { level: 1, name: 'Tournaments' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Needs you' })).not.toBeInTheDocument()
    expect(hooks.teams).not.toHaveBeenCalled()
  })

  it('offers a tournament retry without replacing the personal task area', () => {
    const retry = vi.fn()
    hooks.tournaments.mockReturnValue({ data: { items: [] }, isPending: false, isError: true, refetch: retry })
    auth.data = { id: 7 }
    renderHome()
    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load tournaments')
    fireEvent.click(screen.getByRole('button', { name: 'Retry tournaments' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
