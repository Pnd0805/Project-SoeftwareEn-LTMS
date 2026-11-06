import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MatchDto } from '../../types/match.dto'
const submit = vi.fn()
const stats = vi.fn()
const finish = vi.fn()
const idle = { isPending: false, isError: false, error: null }
vi.mock('../../hooks/useMatch', () => ({
  useFinishMatch: () => ({ mutateAsync: finish, isPending: false }),
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
beforeEach(() => { submit.mockReset().mockResolvedValue({}); stats.mockReset().mockResolvedValue({}); finish.mockReset().mockResolvedValue({}) })
function mount(match = m) { render(<MemoryRouter><ResultForm m={match} /></MemoryRouter>) }

it('finishes before submitting and retries the retained result without finishing twice', async () => {
  submit.mockRejectedValueOnce(new Error('Result temporarily unavailable')).mockResolvedValue({})
  mount({ ...m, status: 'in_progress', viewer: { ...m.viewer, can: { ...m.viewer.can, finishMatch: true } } })
  fireEvent.change(screen.getByLabelText('Engineering'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Points for Player One'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review result' }))
  const send = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit result' }))
  send()
  await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('The match has ended. Result not saved.'))
  expect(finish.mock.invocationCallOrder[0]).toBeLessThan(submit.mock.invocationCallOrder[0])
  expect(screen.getByLabelText('Engineering')).toHaveValue(3)
  send()
  await screen.findByText('Result saved.')
  expect(finish).toHaveBeenCalledOnce()
  expect(submit).toHaveBeenCalledTimes(2)
})
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

const largeMatch = {
  ...m,
  teamA: { ...m.teamA!, players: Array.from({ length: 24 }, (_, i) => ({ id: i + 1, fullName: `Engineering Player ${i + 1}` })) },
  teamB: { ...m.teamB!, players: Array.from({ length: 24 }, (_, i) => ({ id: i + 101, fullName: `Science Player ${i + 1}` })) },
} as MatchDto

it('retains hidden drafts and submits statistics from both teams after filtering 48 players', async () => {
  mount(largeMatch)
  fireEvent.change(screen.getByLabelText('Engineering'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Points for Engineering Player 1'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Science'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Points for Science Player 1'), { target: { value: '1' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Statistics team' }), { target: { value: '102' } })
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find player' }), { target: { value: 'Science Player 24' } })
  expect(screen.getByText('1 of 48 players')).toBeInTheDocument()
  expect(screen.queryByLabelText('Points for Engineering Player 1')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear player filters' }))
  expect(screen.getByLabelText('Points for Engineering Player 1')).toHaveValue(3)
  expect(screen.getByLabelText('Points for Science Player 1')).toHaveValue(1)
  fireEvent.change(screen.getByRole('combobox', { name: 'Statistics team' }), { target: { value: '102' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review result' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit result' }))
  await waitFor(() => expect(stats).toHaveBeenCalledWith({ entries: [
    { userId: 1, teamId: 101, values: { points: 3 } },
    { userId: 101, teamId: 102, values: { points: 1 } },
  ] }))
  expect(submit).toHaveBeenCalledWith({ winnerTeamId: 101, scoreData: { a: 3, b: 1 } })
})

it('reveals and focuses an invalid statistic even when both player filters hide its row', async () => {
  mount(largeMatch)
  fireEvent.change(screen.getByLabelText('Engineering'), { target: { value: '3' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Statistics team' }), { target: { value: '102' } })
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find player' }), { target: { value: 'Nobody' } })
  expect(screen.queryByLabelText('Points for Engineering Player 1')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Check Engineering statistics' }))
  await waitFor(() => expect(screen.getByLabelText('Points for Engineering Player 1')).toHaveFocus())
  expect(screen.getByRole('combobox', { name: 'Statistics team' })).toHaveValue('')
  expect(screen.getByRole('searchbox', { name: 'Find player' })).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Review result' })).toBeDisabled()
})
