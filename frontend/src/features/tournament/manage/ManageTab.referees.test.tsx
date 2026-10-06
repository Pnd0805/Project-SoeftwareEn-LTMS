import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Tournament } from '../../../shared/types'
vi.mock('../../match/RefereeWithdrawal', () => ({ OrganizerWithdrawals: () => <div>Withdrawal queue</div> }))
vi.mock('../../../api/client', async original => ({ ...await original<typeof import('../../../api/client')>(), USE_MOCK: false }))
vi.mock('../../../shared/store', () => ({ useLtms: () => ({}) }))
vi.mock('../CommunityTab', () => ({ feedbackOf: vi.fn() }))
vi.mock('./DeleteTournamentPanel', () => ({ DeleteTournamentPanel: () => null }))
vi.mock('./DrawPanel', () => ({ DrawPanel: () => <div>Draw controls</div> }))
vi.mock('./EntryFilterPanel', () => ({ EntryFilterPanel: () => null }))
vi.mock('./RegistrationsPanel', () => ({ RegistrationsPanel: () => null }))
vi.mock('./SetupTrail', () => ({ SetupTrail: () => null }))
vi.mock('./LiveFeedbackPanel', () => ({ LiveFeedbackPanel: () => null }))
vi.mock('./RefereePanel', () => ({ RefereePanel: () => <div>Tournament pool</div>, RefereeFinder: () => null }))
vi.mock('./MatchRefereePlanner', () => ({ MatchRefereePlanner: ({ tournamentId }: { tournamentId: number }) => <div>Match planner for {tournamentId}</div> }))
import { ManageTab } from './ManageTab'
describe('round robin match referee access', () => {
  it('places the per-match planner in Referees when Draw does not exist', () => {
    render(<MemoryRouter><ManageTab t={{ id: '23', format: 'roundrobin' } as Tournament} sub="referees" /></MemoryRouter>)
    expect(screen.getByText('Tournament pool')).toBeInTheDocument(); expect(screen.getByText('Match planner for 23')).toBeInTheDocument()
    expect(screen.queryByText('Draw controls')).not.toBeInTheDocument()
  })
  it('keeps the planner in Draw for elimination tournaments', () => {
    render(<MemoryRouter><ManageTab t={{ id: '23', format: 'single' } as Tournament} sub="draw" /></MemoryRouter>)
    expect(screen.getByText('Draw controls')).toBeInTheDocument(); expect(screen.getByText('Match planner for 23')).toBeInTheDocument()
  })
})
