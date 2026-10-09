vi.mock('../../hooks/useReference', () => ({ useSportTypes: () => ({ data: { items: [] } }) }))
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchDto } from '../../types/match.dto'
import type { PredictionSummary } from '../../types/liveEngagement.dto'

const live = vi.hoisted(() => ({ place: vi.fn(), cancel: vi.fn(), data: null as unknown }))

vi.mock('../../hooks/useLiveEngagement', () => ({
  usePredictionLive: () => ({
    query: { data: live.data, isPending: false, isError: false, error: null },
    place: { mutate: live.place, isPending: false, error: null },
    cancel: { mutate: live.cancel, isPending: false, error: null },
  }),
}))

import { LivePickem } from './LivePickem'

const match = { id: 2, tournament: { sportTypeId: 1 }, teamA: { id: 3, name: 'Home' }, teamB: { id: 4, name: 'Away' } } as unknown as MatchDto
const summary = (mine: PredictionSummary['mine'] = null): PredictionSummary => ({
  matchId: 2, isOpen: true, closedReason: null, closesAt: '2026-10-09T08:00:00Z', total: 2,
  teams: [{ teamId: 3, picks: 1, percent: 50 }, { teamId: 4, picks: 1, percent: 50 }], mine, canPredict: true,
})

describe('LivePickem', () => {
  beforeEach(() => { vi.resetAllMocks(); live.data = summary() })

  it('sends the predicted score keyed by team id, not a team pick', async () => {
    const user = userEvent.setup()
    render(<LivePickem match={match} />)
    await user.type(screen.getByLabelText('Home'), '2')
    await user.type(screen.getByLabelText('Away'), '1')
    expect(screen.getByText(/to win 2–1/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Predict score' }))
    expect(live.place).toHaveBeenCalledWith({ '3': 2, '4': 1 }, expect.anything())
  })

  it('refuses a draw and an unfinished score without calling the backend', async () => {
    const user = userEvent.setup()
    render(<LivePickem match={match} />)
    const submit = screen.getByRole('button', { name: 'Predict score' })
    await user.type(screen.getByLabelText('Home'), '1')
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Away'), '1')
    expect(screen.getByRole('alert')).toHaveTextContent('A draw cannot be predicted')
    expect(submit).toBeDisabled()
    expect(live.place).not.toHaveBeenCalled()
  })

  it('prefills the saved score and only allows an update once it changes', async () => {
    live.data = summary({ teamId: 4, scoreData: { '3': 0, '4': 2 }, pointsEarned: null, status: 'pending' })
    const user = userEvent.setup()
    render(<LivePickem match={match} />)
    expect(screen.getByText(/Home 0 – 2 Away/)).toBeInTheDocument()
    expect(screen.getByLabelText('Away')).toHaveValue(2)
    const update = screen.getByRole('button', { name: 'Update prediction' })
    expect(update).toBeDisabled()
    await user.clear(screen.getByLabelText('Home'))
    await user.type(screen.getByLabelText('Home'), '1')
    expect(update).toBeEnabled()
  })

  it('hides the form from viewers who cannot predict', () => {
    live.data = { ...summary(), canPredict: false }
    render(<LivePickem match={match} />)
    expect(screen.queryByRole('button', { name: 'Predict score' })).not.toBeInTheDocument()
    expect(screen.getByText(/eligible spectator/)).toBeInTheDocument()
  })

  it('requires a complete best-of score and sends team-id keys', async () => {
    const user = userEvent.setup()
    render(<LivePickem match={{ ...match, bestOf: 3, possibleScores: [[2, 0], [2, 1]] }} />)
    await user.type(screen.getByLabelText('Home'), '1')
    await user.type(screen.getByLabelText('Away'), '0')
    expect(screen.getByRole('button', { name: 'Predict score' })).toBeDisabled()
    await user.clear(screen.getByLabelText('Home'))
    await user.type(screen.getByLabelText('Home'), '2')
    await user.click(screen.getByRole('button', { name: 'Predict score' }))
    expect(live.place).toHaveBeenCalledWith({ '3': 2, '4': 0 }, expect.anything())
  })

  it('shows the server-awarded points without assuming a fixed reward', () => {
    live.data = { ...summary({ teamId: 3, scoreData: { '3': 2, '4': 0 }, pointsEarned: 17, status: 'won' }), canPredict: false, isOpen: false }
    render(<LivePickem match={match} />)
    expect(screen.getByText(/Prediction settled · \+17 points/)).toBeInTheDocument()
    expect(screen.queryByText(/\+10 points/)).not.toBeInTheDocument()
  })
})
