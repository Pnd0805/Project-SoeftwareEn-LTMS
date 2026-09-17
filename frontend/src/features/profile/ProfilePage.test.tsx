import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))

vi.mock('../../shared/store', () => ({ useLtms: () => ({ users: [], teams: [], tournaments: [], votes: [] }) }))

vi.mock('../../hooks/useAuth', () => ({
  useMe: () => ({
    data: {
      id: 9, fullName: 'Backend Profile', email: 'profile@example.test', userType: 'student',
      gender: 'male', birthDate: '2004-01-01', facultyId: 2, departmentId: 8,
      year: 3, totalPoints: 17,
    },
    isPending: false,
    isError: false,
  }),
}))

vi.mock('../../hooks/useUser', () => ({
  useUserStats: () => ({ data: undefined, isPending: false, isError: true }),
  useFollows: () => ({ data: undefined }),
}))

vi.mock('../../hooks/useTeam', () => ({
  useBackendMyTeams: () => ({ data: { items: [] }, isPending: false, isError: false }),
}))

vi.mock('../../hooks/useReference', () => ({
  useFaculties: () => ({ data: { items: [{ id: 2, name: 'Engineering' }] } }),
  useDepartments: () => ({ data: { items: [{ id: 8, name: 'Software Engineering' }] } }),
  useSportTypes: () => ({ data: { items: [] } }),
}))

vi.mock('../player/PlayerPage', () => ({ CareerPanel: () => null }))

import { ProfilePage } from './ProfilePage'

describe('ProfilePage real-mode boundary', () => {
  it('keeps /me identity visible without a legacy user when stats fail', () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)

    expect(screen.getByText('Backend Profile')).toBeInTheDocument()
    expect(screen.getByText('profile@example.test')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('Statistics are unavailable')).toBeInTheDocument()
    expect(screen.getByText('Career, Pick\'em and MVP')).toBeInTheDocument()
  })
})
