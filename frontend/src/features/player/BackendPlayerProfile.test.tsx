/**
 * OD-46 / OD-60 / OD-61 — หน้าผู้เล่นกับสถิติที่เจ้าของซ่อน · MVP · โลโก้ทีม
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../rewards/RewardsPage', () => ({ PublicRewards: () => null }))

const state = vi.hoisted(() => ({
  profile: {} as Record<string, unknown>,
  stats: {} as Record<string, unknown>,
  career: {} as Record<string, unknown>,
}))

vi.mock('../../hooks/useUser', () => ({
  usePublicUser: () => ({ isPending: false, isError: false, data: state.profile }),
  useUserStats: () => ({ isPending: false, isSuccess: true, data: state.stats }),
  useUserCareer: () => ({ isPending: false, isSuccess: true, error: null, data: state.career, refetch: vi.fn() }),
  useFollow: () => ({ isFollowing: false, isLoading: false, error: null, toggle: { mutate: vi.fn(), isPending: false, error: null } }),
}))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: undefined }) }))
vi.mock('../../hooks/useReference', () => ({
  useFaculties: () => ({ data: { items: [] } }),
  useDepartments: () => ({ data: { items: [] } }),
  useSportTypes: () => ({ data: { items: [{ id: 2, name: 'Basketball' }] } }),
}))

import { BackendPlayerProfile } from './BackendPlayerProfile'

const renderPage = () => render(<MemoryRouter><BackendPlayerProfile userId={9002} /></MemoryRouter>)

beforeEach(() => {
  state.profile = { id: 9002, fullName: 'Somying', avatarUrl: null, facultyId: 1, departmentId: 1, teams: [] }
  state.stats = {
    userId: 9002, overall: { matchesPlayed: 5, wins: 3, losses: 2, winRate: 0.6, championCount: 0 },
    bySport: [], mvpVotes: 8, mvpTimes: 2,
  }
  state.career = { items: [] }
})

describe('a player who hides their profile stats', () => {
  it('says the stats are private instead of crashing on null', () => {
    state.profile = { ...state.profile, statsHidden: true }
    state.stats = { userId: 9002, statsHidden: true, overall: null, bySport: null, mvpVotes: null, mvpTimes: null }
    state.career = { items: null, statsHidden: true }
    renderPage()
    expect(screen.getByText(/keeps their profile stats private/)).toBeInTheDocument()
    expect(screen.getByText(/keeps their tournament history private/)).toBeInTheDocument()
    expect(screen.queryByText('Nothing recorded yet', { exact: false })).not.toBeInTheDocument()
    expect(screen.queryByText('No tournament history yet.')).not.toBeInTheDocument()
  })
})

describe('MVP figures', () => {
  it('leads with how many times they were MVP, and never labels the vote count as MVP', () => {
    renderPage()
    expect(screen.getByText('MVP')).toBeInTheDocument()
    expect(screen.getByText('2×')).toBeInTheDocument()
    expect(screen.getByText('MVP votes received')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })
})

describe('squads on the profile', () => {
  it('shows a team logo when there is one and still lists a team without one', () => {
    state.profile = {
      ...state.profile,
      teams: [{ id: 1, name: 'With logo', logoUrl: 'http://x/logo.png' }, { id: 2, name: 'No logo', logoUrl: null }],
    }
    const { container } = renderPage()
    expect(screen.getByText(/With logo/)).toBeInTheDocument()
    expect(screen.getByText(/No logo/)).toBeInTheDocument()
    expect(container.querySelectorAll('img[src="http://x/logo.png"]')).toHaveLength(1)
  })
})

describe('career rows', () => {
  it('marks a tournament the team withdrew from once the backend flags it', () => {
    state.career = { items: [{
      tournament: { id: 13, name: 'QA Cup', sportTypeId: 2, status: 'public' },
      team: { id: 9008, name: 'QA A' }, played: 2, wins: 2, losses: 0, champion: false, withdrawn: true,
    }] }
    renderPage()
    expect(screen.getByText('Team withdrew')).toBeInTheDocument()
  })
})
