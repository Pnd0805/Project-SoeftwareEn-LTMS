import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Match, Tournament } from '../../shared/types'

const tournament = { id: 't-public', name: 'Public Cup', champion: 'team-a' } as Tournament

vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(), USE_MOCK: true,
}))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: undefined }) }))
vi.mock('../../hooks/useLiveEngagement', () => ({ useMvpLive: () => ({ query: {}, vote: {} }) }))
vi.mock('../../shared/store', () => ({
  useLtms: () => ({ session: 'guest', tournaments: [tournament] }),
}))
vi.mock('../../mocks/routeIds', () => ({ routeTour: () => tournament }))
vi.mock('../../shared/selectors', () => ({
  me: () => null,
  matchesOf: () => [],
  team: () => ({ id: 'team-a', name: 'Champions', members: [] }),
  user: () => undefined,
  isOrg: () => false,
  officiates: () => false,
  tour: () => tournament,
}))
vi.mock('../../hooks/useUser', () => ({
  useMvpVotes: () => ({ data: { items: [], mine: null }, cast: { mutate: vi.fn(), isPending: false } }),
  usePicks: () => ({ data: { items: [], mine: null }, place: { mutate: vi.fn(), isPending: false } }),
  useComments: () => ({
    data: { items: [] },
    post: { mutate: vi.fn(), isPending: false }, remove: { mutate: vi.fn(), isPending: false },
  }),
}))

import { MvpPage } from '../mvp/MvpPage'
import { SocialBar } from '../match/SocialBar'

describe('guest voting permissions', () => {
  it('can read the MVP page but cannot vote', () => {
    render(
      <MemoryRouter initialEntries={['/mvp/t-public']}>
        <Routes><Route path="/mvp/:id" element={<MvpPage />} /></Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Tournament MVP')).toBeInTheDocument()
    expect(screen.getByText(/Sign in to vote/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
  })

  it('can read a match community summary but cannot place a Pick’em', () => {
    const match = {
      id: 'm-1', tour: 't-public', a: 'team-a', b: 'team-b', status: 'scheduled', stage: 'Round 1',
    } as Match
    render(<SocialBar m={match} />)
    expect(screen.getByText('Sign in to call this one.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Call it' })).not.toBeInTheDocument()
  })
})
