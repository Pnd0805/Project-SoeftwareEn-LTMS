import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MatchDto } from '../../types/match.dto'
const submit = vi.fn()
const stats = vi.fn()
const idle = { isPending: false, isError: false, error: null }
vi.mock('../../hooks/useMatch', () => ({
  useSubmitResult: () => ({ ...idle, mutateAsync: submit }),
  useSaveMatchStats: () => ({ ...idle, mutateAsync: stats }),
  useStatDefinitions: () => ({ data: { items: [{ statKey: 'points', statLabelTh: 'Points' }] } }),
}))
import { ResultForm } from './ResultForm'
const m = {
  id: 9, tournamentId: 1, mode: 'onsite',
  tournament: { sportName: 'Basketball' }, viewer: { can: { recordStats: true, submitResult: true } },
  teamA: { id: 101, name: 'Engineering', players: [{ id: 1, fullName: 'Player One' }] },
  teamB: { id: 102, name: 'Science', players: [] },
} as unknown as MatchDto
beforeEach(() => { submit.mockReset().mockResolvedValue({}); stats.mockReset().mockResolvedValue({}) })
function mount() { render(<MemoryRouter><ResultForm m={m} /></MemoryRouter>) }
it('reviews team-associated scores before sending the unchanged result payload', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('Engineering'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Points for Player One'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review result' }))
  const dialog = screen.getByRole('dialog', { name: 'Review result' })
  expect(within(dialog).getByText('Engineering')).toBeInTheDocument()
  expect(within(dialog).getByText('Science')).toBeInTheDocument()
  expect(submit).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Submit result' }))
  await waitFor(() => expect(submit).toHaveBeenCalledWith({ winnerTeamId: 101, scoreData: { a: 3, b: 0 } }))
})
it('shows partial success in the dialog and keeps the draft when statistics fail', async () => {
  stats.mockRejectedValue(new Error('Stats service unavailable'))
  mount()
  fireEvent.change(screen.getByLabelText('Engineering'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Points for Player One'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review result' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit result' }))
  await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(/Score saved.*statistics/i))
  expect(screen.getByLabelText('Engineering')).toHaveValue(3)
  expect(screen.getByLabelText('Points for Player One')).toHaveValue(3)
  expect(stats).toHaveBeenCalledWith({ entries: [{ userId: 1, teamId: 101, values: { points: 3 } }] })
})
it('explains blocked scores with a link that focuses the score field', () => {
  mount()
  fireEvent.click(screen.getByRole('link', { name: /Enter a winning score/ }))
  expect(screen.getByLabelText('Engineering')).toHaveFocus()
  expect(submit).not.toHaveBeenCalled()
})

it('links inconsistent player totals to the corresponding statistic input', () => {
  mount()
  fireEvent.change(screen.getByLabelText('Engineering'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('link', { name: 'Check Engineering statistics' }))
  expect(screen.getByLabelText('Points for Player One')).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Review result' })).toBeDisabled()
})
