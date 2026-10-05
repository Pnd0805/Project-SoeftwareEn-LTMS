import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { getStats } = vi.hoisted(() => ({ getStats: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/user', async original => ({ ...await original<typeof import('../../api/user')>(),
  getPublicUser: async () => ({ id: 7, fullName: 'Lee Northside', facultyId: 1, departmentId: 1, teams: [{ id: 41, name: 'Northside FC' }] }),
  getUserStats: getStats, getUserCareer: async () => ({ items: [] }),
}))
vi.mock('../../api/reference', () => ({
  getFaculties: async () => ({ items: [] }), getDepartments: async () => ({ items: [] }), getSportTypes: async () => ({ items: [] }),
}))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: undefined }) }))
import { BackendPlayerProfile } from './BackendPlayerProfile'

let client: QueryClient
afterEach(() => { client?.clear(); vi.clearAllMocks() })
describe('Public player source states', () => {
  it('keeps public identity and teams visible when stats fail, then retries only stats', async () => {
    getStats.mockRejectedValueOnce(new Error('Stats offline')).mockResolvedValue({ overall: { matchesPlayed: 8, wins: 4, losses: 4, winRate: .5, championCount: 0 }, bySport: [] })
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><BackendPlayerProfile userId={7} /></MemoryRouter></QueryClientProvider>)
    expect(await screen.findByRole('heading', { level: 1, name: 'Lee Northside' })).toBeInTheDocument()
    expect(await screen.findByText('Stats offline')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Northside FC/ })).toBeEnabled()
    expect(screen.queryByText(/Nothing recorded yet/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Year|Age|Date of birth|Email/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry stats' }))
    expect(await screen.findByText('50%')).toBeInTheDocument()
    expect(getStats).toHaveBeenCalledTimes(2)
  })
})
