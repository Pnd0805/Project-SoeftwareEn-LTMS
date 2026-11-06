import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ data: { items: [] as unknown[] | null, statsHidden: false }, isSuccess: true, isError: false, refetch: vi.fn() }))
vi.mock('../../hooks/useUser', () => ({ useUserMatchHistory: () => state }))
import { BackendMatchHistoryPanel } from './BackendMatchHistoryPanel'
beforeEach(() => { state.data = { items: [], statsHidden: false }; state.isSuccess = true; state.isError = false; state.refetch.mockReset() })
const show = () => render(<MemoryRouter><BackendMatchHistoryPanel userId={9} /></MemoryRouter>)
it('keeps the original win and score when a team has withdrawn', () => {
  state.data.items = [{ matchId: 8, tournament: { id: 1, name: 'Cup' }, team: { id: 3, name: 'A' }, opponent: { id: 4, name: 'B' }, scoreData: { '3': 2, '4': 1 }, result: 'win', withdrawn: true, playedAt: null }];
  show(); expect(screen.getByText('Team withdrew')).toBeInTheDocument(); expect(screen.getByText('Win')).toBeInTheDocument(); expect(screen.getByText('2 – 1')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open match #8' })).toHaveAttribute('href', '/m/8');
});
it('distinguishes private history from empty history', () => {
  state.data = { items: null, statsHidden: true }; show();
  expect(screen.getByText(/keeps their match history private/)).toBeInTheDocument(); expect(screen.queryByText('No match history yet.')).not.toBeInTheDocument();
});
it('offers retry when history fails', () => {
  state.isError = true; state.isSuccess = false; show(); fireEvent.click(screen.getByRole('button', { name: 'Retry' })); expect(state.refetch).toHaveBeenCalledOnce();
});
