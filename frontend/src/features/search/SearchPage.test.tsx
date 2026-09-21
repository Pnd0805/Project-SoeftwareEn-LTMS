import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))

vi.mock('../../shared/store', () => ({
  useLtms: () => ({
    tournaments: [{ id: 't-vlr', name: 'VALORANT Campus League 2025' }],
    teams: [{ id: 'tm-seed', name: 'Campus Seed Squad' }],
  }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useMe: () => ({ data: { id: 7, fullName: 'API User' } }),
}))

vi.mock('../../hooks/useUser', () => ({
  useSearchUsers: () => ({ data: { items: [] }, isPending: false, isError: false, error: null }),
}))

/* ชื่อกีฬามาจาก GET /sport-types — id 3 คือแบดมินตันหลัง backend renumber (migration 010) */
vi.mock('../../hooks/useReference', () => ({
  useSportTypes: () => ({
    data: { items: [{ id: 3, name: 'Badminton', minMembers: 2, maxMembers: 4, defaultMode: 'onsite' }] },
  }),
}))

vi.mock('../../hooks/useTournament', () => ({
  useTournaments: () => ({
    data: { items: [{
      id: 42, name: 'Campus Cup from API', sportTypeId: 3, bracketFormat: 'single_elimination',
      scopeType: 'university', organizingFacultyId: null, organizingDepartmentId: null,
      requestedByUserId: 7, status: 'public', registrationOpen: true,
      registrationStart: null, registrationEnd: null, eventStartDate: '2026-10-01',
      eventEndDate: null, maxTeams: 16, minTeams: 2, venue: 'Main Hall',
      disputeWindowHours: 24, genderRequirement: 'any', minAge: null, maxAge: null,
      rejectionReason: null, approvedBy: 1, approvedAt: '2026-09-01', createdAt: '2026-09-01', deletedAt: null,
    }] },
    isPending: false,
    isError: false,
  }),
}))
vi.mock('../../hooks/useTeam', () => ({
  useSearchTeams: () => ({
    data: { items: [{ id: 77, name: 'Campus API Squad', sportTypeId: 3, readinessStatus: 'Ready', memberCount: 4 }] },
    isPending: false,
    isError: false,
  }),
}))

import { SearchPage } from './SearchPage'

describe('SearchPage real-mode boundary', () => {
  it('renders the backend collection and never leaks seed tournaments or teams', () => {
    render(
      <MemoryRouter initialEntries={['/search/Campus']}>
        <Routes><Route path="/search/:q" element={<SearchPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Campus Cup from API')).toBeInTheDocument()
    expect(screen.queryByText('VALORANT Campus League 2025')).not.toBeInTheDocument()
    expect(screen.queryByText('Campus Seed Squad')).not.toBeInTheDocument()
    expect(screen.getByText('Campus API Squad')).toBeInTheDocument()
  })
})
