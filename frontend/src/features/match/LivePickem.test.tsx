/**
 * OD-56 / OD-63 — Pick'em ทายเป็นสกอร์ · กฎแต้มอ่านจาก /sport-types · แต้ม 10/7/4/0
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchDto } from '../../types/match.dto'

const state = vi.hoisted(() => ({ summary: {} as Record<string, unknown>, place: vi.fn() }))
vi.mock('../../hooks/useLiveEngagement', () => ({
  usePredictionLive: () => ({
    query: { isPending: false, isError: false, data: state.summary },
    place: { mutate: state.place, isPending: false, error: null },
    cancel: { mutate: vi.fn(), isPending: false, error: null },
  }),
}))
vi.mock('../../hooks/useReference', () => ({
  useSportTypes: () => ({ data: { items: [
    { id: 2, name: 'Basketball', pickemTolerance: { spotOn: 5, close: 10 }, pickemPoints: { spotOn: 10, close: 7, sideOnly: 4 } },
    { id: 3, name: 'Badminton', pickemTolerance: { spotOn: 0, close: 0 }, pickemPoints: { spotOn: 10, close: 7, sideOnly: 4 } },
  ] } }),
}))
import { LivePickem } from './LivePickem'

const match = (sportTypeId = 2) => ({
  id: 13, teamA: { id: 9024, name: 'Science' }, teamB: { id: 9023, name: 'Engineering' },
  tournament: { sportTypeId },
}) as unknown as MatchDto

beforeEach(() => {
  state.place.mockReset()
  state.summary = { matchId: 13, isOpen: true, closedReason: null, closesAt: null, total: 0, teams: [], mine: null, canPredict: true }
})

describe('predicting a score', () => {
  it('sends the score keyed by team id, never a teamId', () => {
    render(<LivePickem match={match()} />)
    fireEvent.change(screen.getByLabelText('Science'), { target: { value: '52' } })
    fireEvent.change(screen.getByLabelText('Engineering'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Predict this score' }))
    expect(state.place).toHaveBeenCalledWith({ '9024': 52, '9023': 45 })
  })

  it('will not send a draw, because no winner can be inferred from it', () => {
    render(<LivePickem match={match()} />)
    expect(screen.getByRole('button', { name: 'Predict this score' })).toBeDisabled()
    expect(screen.getByText(/Draws can't be predicted/)).toBeInTheDocument()
  })
})

describe('the rules come from the sport, not from the code', () => {
  it('states per-side tolerances and points for basketball', () => {
    render(<LivePickem match={match(2)} />)
    expect(screen.getByText('Right winner, score off by at most 5 per side → 10 points')).toBeInTheDocument()
    expect(screen.getByText('Right winner, score off by at most 10 per side → 7 points')).toBeInTheDocument()
    expect(screen.getByText('Right winner only → 4 points')).toBeInTheDocument()
  })

  it('hides the middle tier when it cannot happen (spotOn === close)', () => {
    render(<LivePickem match={match(3)} />)
    expect(screen.getByText('Right winner, score exactly right → 10 points')).toBeInTheDocument()
    expect(screen.queryByText(/→ 7 points/)).not.toBeInTheDocument()
  })
})

describe('the result of a settled prediction', () => {
  it('shows the points actually earned, not a fixed +10', () => {
    state.summary = { ...state.summary, isOpen: false, canPredict: false,
      mine: { teamId: 9024, scoreData: { '9024': 50, '9023': 39 }, pointsEarned: 7, status: 'won' } }
    render(<LivePickem match={match()} />)
    expect(screen.getByText('Close · +7 points')).toBeInTheDocument()
    expect(screen.getByText('Your prediction: Science 50 – 39 Engineering')).toBeInTheDocument()
  })
})
