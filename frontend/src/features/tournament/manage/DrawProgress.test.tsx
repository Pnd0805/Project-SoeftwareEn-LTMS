import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tournament } from '../../../shared/types'

const { closeRegistration, drawState, matchState, mutate, openRegistration, teamState } = vi.hoisted(() => ({
  closeRegistration: vi.fn(),
  drawState: { current: {} as Record<string, unknown> },
  matchState: { current: {} as Record<string, unknown> },
  mutate: vi.fn(),
  openRegistration: vi.fn(),
  teamState: { current: { items: [{ id: 11, name: 'Alpha' }, { id: 12, name: 'Beta' }] } },
}))

vi.mock('../../../shared/store', () => ({ useLtms: () => ({}) }))
vi.mock('../../../hooks/useAdmin', () => ({
  useTournamentReferees: () => ({ data: { acceptedCount: 2 }, isError: false }),
}))
vi.mock('../../../hooks/useMatch', () => ({
  useTournamentMatches: () => matchState.current,
}))
vi.mock('../../../hooks/useTournament', () => ({
  useCompleteTournament: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useCloseTournamentRegistration: () => ({ mutate: closeRegistration, isPending: false, isError: false }),
  useDrawTournament: () => drawState.current,
  useOpenTournamentRegistration: () => ({ mutate: openRegistration, isPending: false, isError: false }),
  usePublishTournament: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useTournamentApplications: () => ({ data: { items: [] } }),
  useTournamentTeams: () => ({
    data: teamState.current,
    isPending: false,
  }),
}))

import { DrawPanel } from './DrawPanel'
import { SetupTrail } from './SetupTrail'

const tournament: Tournament = {
  id: '4', name: 'QA Age Cup', sport: 'Basketball', format: 'single', channel: 'onsite',
  status: 'public', date: '2026-10-01', venue: 'Main court', pin: null, cap: 8,
  registrationOpen: false,
  organizer: '9001', referees: [],
  rules: { gender: 'any', ageMin: 'any', ageMax: 'any', faculty: 'any', major: 'any', year: 'any' },
  drawn: false, rounds: 1, champion: null,
}

describe('draw progress in real mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    drawState.current = { mutate, isPending: false, isError: false }
    matchState.current = { data: { items: [] }, isPending: false, isError: false }
    teamState.current = { items: [{ id: 11, name: 'Alpha' }, { id: 12, name: 'Beta' }] }
  })

  it('does not advance to squad approval until the organizer opens registration', () => {
    teamState.current = { items: [] }
    render(<MemoryRouter><SetupTrail t={{ ...tournament, registrationOpen: false }} onAppoint={vi.fn()} /></MemoryRouter>)

    expect(screen.getByText('Step 3 of 9')).toBeInTheDocument()
    expect(screen.getByText(/Publishing makes the tournament visible/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open registration' }))
    expect(openRegistration).toHaveBeenCalledTimes(1)
  })

  it('requires registration to close after squads are approved and before drawing', () => {
    render(<MemoryRouter><SetupTrail t={{ ...tournament, registrationOpen: true }} onAppoint={vi.fn()} /></MemoryRouter>)

    expect(screen.getByText('Step 5 of 9')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close registration' }))
    expect(closeRegistration).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Generate bracket/ })).not.toBeInTheDocument()
  })

  it('advances from draw to fixture setup from API matches, not the legacy drawn flag', () => {
    const view = render(<MemoryRouter><SetupTrail t={tournament} onAppoint={vi.fn()} /></MemoryRouter>)
    expect(screen.getByText('Step 6 of 9')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate bracket/ })).toBeInTheDocument()

    matchState.current = {
      data: { items: [{ id: 71, roundNumber: 1, teamA: { id: 11 }, teamB: { id: 12 }, status: 'scheduled' }] },
      isPending: false,
      isError: false,
    }
    view.rerender(<MemoryRouter><SetupTrail t={tournament} onAppoint={vi.fn()} /></MemoryRouter>)

    expect(screen.getByText('Step 7 of 9')).toBeInTheDocument()
    expect(screen.getByText(/saved matches confirm that the bracket is drawn/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generate bracket/ })).not.toBeInTheDocument()
  })

  it('shows persistent pending feedback while the draw and match refresh are running', () => {
    drawState.current = { mutate, isPending: true, isError: false }
    render(<MemoryRouter><SetupTrail t={tournament} onAppoint={vi.fn()} /></MemoryRouter>)

    expect(screen.getByRole('button', { name: 'Drawing…' })).toBeDisabled()
    expect(screen.getByText(/Refreshing the saved matches before progress advances/)).toBeInTheDocument()
  })

  it('offers an atomic redraw while every existing match is still scheduled', () => {
    matchState.current = {
      data: { items: [{ id: 71, roundNumber: 1, teamA: { id: 11 }, teamB: { id: 12 }, status: 'scheduled' }] },
      isPending: false,
      isError: false,
    }
    render(<DrawPanel t={tournament} />)

    expect(screen.getByText('Open until the first match starts')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Random redraw bracket' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redraw bracket' })).toBeInTheDocument()
    expect(screen.queryByText('BRACKET_ALREADY_EXISTS')).not.toBeInTheDocument()
  })

  it('confirms a random redraw and sends replace=true with every approved team', () => {
    matchState.current = {
      data: { items: [{ id: 71, roundNumber: 1, teamA: { id: 11 }, teamB: { id: 12 }, status: 'scheduled' }] },
      isPending: false, isError: false,
    }
    render(<DrawPanel t={tournament} />)

    fireEvent.click(screen.getByRole('button', { name: 'Random redraw bracket' }))
    expect(screen.getByText(/randomized order previewed/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Random redraw now' }))

    expect(mutate).toHaveBeenCalledWith({ teamIds: expect.arrayContaining([11, 12]), replace: true })
  })

  it('makes manual-draw pending state visible in both the action and status banner', () => {
    drawState.current = { mutate, isPending: true, isError: false }
    render(<DrawPanel t={tournament} />)

    expect(screen.getByRole('button', { name: 'Drawing…' })).toBeDisabled()
    expect(screen.getByText(/Waiting for the saved matches to refresh/)).toBeInTheDocument()
  })
})
