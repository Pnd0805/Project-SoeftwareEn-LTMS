import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchListItemDto } from '../../types/match.dto'

const state = vi.hoisted(() => ({ rows: [] as MatchListItemDto[] }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../hooks/useMatch', () => ({ useMyMatches: () => ({ data: { items: state.rows }, isPending: false, isError: false }) }))
vi.mock('../../hooks/useAdmin', () => ({ useMyRefereeInvitations: () => ({ data: { items: [] }, isPending: false, isError: false }) }))
import { MatchesPage } from './MatchesPage'
const match = (id: number, role: 'player' | 'referee', ids: number[], time: string | null = '2026-10-10T03:00:00Z') => ({
  id, tournament: { id, name: `Tour ${id}` }, teamA: null, teamB: null,
  scheduledTime: time, scheduledEndTime: time ? '2026-10-10T04:00:00Z' : null,
  status: 'scheduled', mode: 'onsite', score: null, resultStatus: null,
  viewer: { roles: [role] }, conflictingMatchIds: ids,
}) as MatchListItemDto
const show = () => render(<MemoryRouter><MatchesPage /></MemoryRouter>)
beforeEach(() => { state.rows = [] })
describe('personal time conflicts', () => {
  it('links both roles and explains different recovery actions', () => {
    state.rows = [match(1, 'player', [2]), match(2, 'referee', [1])]; show();
    expect(screen.getByText('Time conflict — Tour 1')).toBeInTheDocument();
    const panel = screen.getByText('Time conflict — Tour 1').closest('.panel')! as HTMLElement;
    expect(within(panel).getByRole('link', { name: /Tour 2 · Match #2/ })).toHaveAttribute('href', '/m/2');
    expect(within(panel).getByText(/Players: contact your team captain/)).toBeInTheDocument();
    expect(within(panel).getByText(/organizer must approve/)).toBeInTheDocument();
  });
  it('does not treat missing times as a confirmed conflict-free schedule', () => {
    state.rows = [match(1, 'player', [], null)]; show();
    expect(screen.getByText(/Time conflicts cannot be checked/)).toBeInTheDocument();
    expect(screen.queryByText(/Time conflict —/)).not.toBeInTheDocument();
  });
  it('shows no warning for a complete schedule with empty server conflict IDs', () => {
    state.rows = [match(1, 'player', [])]; show();
    expect(screen.queryByText(/Time conflict —/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Time conflicts cannot be checked/)).not.toBeInTheDocument();
  });
});
