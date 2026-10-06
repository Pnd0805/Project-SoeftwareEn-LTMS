import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchDto } from '../../types/match.dto'
const state = vi.hoisted(() => ({ matches: [] as Array<{ status: string; startedAt?: string | null }>, single: vi.fn(), all: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/tournament', () => ({ setTournamentFormat: state.all }))
vi.mock('../../hooks/useMatch', () => ({
  useTournamentMatches: () => ({ data: { items: state.matches }, isPending: false, isError: false }),
  useSetMatchFormat: () => ({ mutateAsync: state.single, isPending: false, error: null, reset: vi.fn() }),
}))
import { MatchFormatPanel } from './MatchFormatPanel'
const match = { id: 13, tournamentId: 5, status: 'scheduled', bestOf: 3 } as MatchDto
const page = () => render(<QueryClientProvider client={new QueryClient()}><MatchFormatPanel match={match} /></QueryClientProvider>)
beforeEach(() => { state.matches = []; state.single.mockReset().mockResolvedValue({ bestOf: 5 }); state.all.mockReset().mockResolvedValue({ bestOf: 5 }) })
describe('tournament-wide BO contract', () => {
  it('locks a future final as soon as any other match has started', () => {
    state.matches = [{ status: 'in_progress' }]
    page()
    expect(screen.getByLabelText('BO format')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Set for whole tournament' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Set for this match' })).toBeDisabled()
  })
  it('requires confirmation before overwriting every match, and preserves the chosen body', async () => {
    page()
    fireEvent.change(screen.getByLabelText('BO format'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set for whole tournament' }))
    expect(state.all).not.toHaveBeenCalled()
    expect(screen.getByText(/รวมแมตช์ที่เคยตั้งรูปแบบแยกไว้ด้วย/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm tournament format' }))
    await waitFor(() => expect(state.all).toHaveBeenCalledWith(5, 5))
    expect(state.single).not.toHaveBeenCalled()
  })
})
