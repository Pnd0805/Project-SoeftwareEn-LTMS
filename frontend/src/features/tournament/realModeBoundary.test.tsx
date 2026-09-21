import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tournament } from '../../shared/types'

const { query, storeRead, notifications } = vi.hoisted(() => ({
  query: vi.fn(),
  storeRead: vi.fn(() => { throw new Error('Real mode read the prototype store') }),
  notifications: vi.fn(() => ({ isLoading: false })),
}))
vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(), USE_MOCK: false,
}))
vi.mock('../../shared/store', () => ({ useLtms: storeRead, getState: storeRead }))
vi.mock('../../hooks/useMatch', () => ({ useTournamentMatches: query }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 7 }, isLoading: false }) }))
vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: notifications,
  useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../inbox/BackendInbox', () => ({ BackendInbox: () => <div>Backend action inbox</div> }))

import { BracketTab } from './BracketTab'
import { MvpPage } from '../mvp/MvpPage'
import { WatchPage } from '../watch/WatchPage'
import { InboxPage } from '../inbox/InboxPage'

const tournament = { id: '2', drawn: false } as Tournament

describe('real tournament view boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('ltms.v1', JSON.stringify({ tournaments: [{ id: '2', champion: 'seed-team' }] }))
    query.mockReturnValue({ data: { items: [] }, isPending: false, isError: false })
  })

  it('keeps an empty API bracket empty despite persisted prototype data', () => {
    render(<BracketTab t={tournament} />)
    expect(screen.getByText('No matches yet')).toBeInTheDocument()
    expect(screen.queryByText(/squads approved/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go to manage' })).not.toBeInTheDocument()
    expect(storeRead).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'Sign in to view the bracket'],
    [403, 'You do not have access to this bracket'],
    [500, 'Could not load the bracket'],
  ])('keeps HTTP %s separate from an empty result and permits retry', (status, title) => {
    const refetch = vi.fn()
    query.mockReturnValue({ isPending: false, isError: true, error: { status }, refetch })
    render(<BracketTab t={tournament} />)
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(screen.queryByText('No matches yet')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledOnce()
    expect(storeRead).not.toHaveBeenCalled()
  })

  it('shows loading without reading the store', () => {
    query.mockReturnValue({ isPending: true })
    render(<BracketTab t={tournament} />)
    expect(screen.getByText('Loading the bracket…')).toBeInTheDocument()
    expect(storeRead).not.toHaveBeenCalled()
  })

  it('rejects prototype IDs without enabling a match query', () => {
    render(<BracketTab t={{ ...tournament, id: 't-fb' }} />)
    expect(screen.getByText('Invalid tournament ID')).toBeInTheDocument()
    expect(query).toHaveBeenCalledWith(undefined)
    expect(storeRead).not.toHaveBeenCalled()
  })

  it.each([
    [MvpPage, 'MVP voting is unavailable'],
    [WatchPage, 'Watch is unavailable'],
  ])('guards unsupported direct routes before mounting prototype hooks', (Page, title) => {
    render(<Page />)
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(storeRead).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it('does not enable the unsupported notification query in real mode', () => {
    render(<MemoryRouter><InboxPage /></MemoryRouter>)
    expect(screen.getByText('Backend action inbox')).toBeInTheDocument()
    expect(notifications).toHaveBeenCalledWith(7, false)
    expect(storeRead).not.toHaveBeenCalled()
  })
})
