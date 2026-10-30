import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
const { open } = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('../../api/match', async original => ({ ...await original<typeof import('../../api/match')>(), openMatchCheckin: open }))
import { MatchNextStep } from './MatchNextStep'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'

function Destination() {
  const location = useLocation()
  return <section className="match-section" aria-label={location.pathname.endsWith('/progress') ? 'History' : 'Overview'} tabIndex={0}>{location.pathname}</section>
}

function show(over: Partial<MatchDto>, can: Partial<MatchDto['viewer']['can']> = {}, result?: Partial<MatchResultDto>) {
  const m = { id: 9, status: 'scheduled', mode: 'onsite', teamA: { id: 1 }, teamB: { id: 2 },
    ...over, viewer: { roles: ['player', 'referee', 'organizer'], myTeamId: 1, can } } as MatchDto
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={['/m/9/overview']}><MatchNextStep m={m} result={result as MatchResultDto} /><Destination /></MemoryRouter>
  </QueryClientProvider>)
}

const ready = { status: 'scheduled', scheduledTime: '2026-11-01T02:00:00Z', scheduledEndTime: '2026-11-01T03:00:00Z', venue: 'Court 1' } as Partial<MatchDto>
beforeEach(() => { open.mockReset().mockResolvedValue({}) })

it.each(['verified', 'walkover'] as const)('opens and focuses History for a settled %s result', async status => {
  show({}, {}, { status })
  fireEvent.click(screen.getByRole('button', { name: 'View history' }))
  await waitFor(() => expect(screen.getByRole('region', { name: 'History' })).toHaveFocus())
  expect(screen.getByRole('region', { name: 'History' })).toHaveTextContent('/m/9/progress')
})

it.each([
  ['Review dispute', { status: 'disputed' }, { resolveDispute: true }, '/m/9/overview'],
  ['Record result', { status: 'finished' }, { submitResult: true }, '/m/9/overview'],
  ['Manage check-in', { status: 'checkin_open' }, { manageCheckin: true }, '/checkin/9'],
  ['Edit fixture', { status: 'scheduled' }, { editFixture: true }, '/m/9/fixture'],
] as const)('links %s to its supported task', (label, match, can, path) => {
  show(match, can)
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(screen.getByRole('region')).toHaveTextContent(path)
})

it('opens check-in with one press, without detouring to a second button', async () => {
  show(ready, { openCheckin: true })
  fireEvent.click(screen.getByRole('button', { name: 'Open check-in' }))
  await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
  expect(open).toHaveBeenCalledWith(9)
  expect(screen.getByRole('region')).toHaveTextContent('/m/9/overview')
})

it('shows a refused check-in beside the button that was pressed', async () => {
  open.mockRejectedValue(new Error('Check-in window has passed'))
  show(ready, { openCheckin: true })
  fireEvent.click(screen.getByRole('button', { name: 'Open check-in' }))
  expect(await screen.findByText('That did not go through.')).toBeInTheDocument()
  expect(screen.getByText(/Check-in window has passed/)).toBeInTheDocument()
})

it('sends an unfinished fixture to the fixture page instead of a check-in that must fail', () => {
  show({ status: 'scheduled' }, { openCheckin: true })
  expect(screen.queryByRole('button', { name: 'Open check-in' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Edit fixture' }))
  expect(open).not.toHaveBeenCalled()
  expect(screen.getByRole('region')).toHaveTextContent('/m/9/fixture')
})

it('does not offer a privileged action from role names alone', () => {
  show({ status: 'disputed' }, {})
  expect(screen.queryByRole('button', { name: /Review dispute|Record result|Manage check-in|Edit fixture/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Open overview' })).toBeInTheDocument()
})

it('keeps losing onsite team leaders out of result confirmation', () => {
  show({}, { verifyResult: true }, { status: 'submitted', winnerTeamId: 2 })
  expect(screen.queryByRole('button', { name: 'Confirm result' })).not.toBeInTheDocument()
})
