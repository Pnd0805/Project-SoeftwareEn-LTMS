import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'
const { flow, useFlow, viewer } = vi.hoisted(() => ({ flow: { abandon: vi.fn().mockResolvedValue({}), organizer: vi.fn().mockResolvedValue({}), challenge: vi.fn().mockResolvedValue({}), file: vi.fn().mockResolvedValue({}), statement: vi.fn().mockResolvedValue({}), decision: vi.fn().mockResolvedValue({}) }, useFlow: vi.fn(), viewer: { scope: null as null | string } }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 7, adminScope: viewer.scope ? { scopeType: viewer.scope } : null } }) }))
vi.mock('../../hooks/useMatchWorkflow', () => ({ useMatchWorkflow: useFlow }))
import { MatchWorkflowPanel, ResultChallengeForm } from './MatchWorkflowPanel'
const match = (over = {}) => ({ id: 13, status: 'in_progress', mode: 'onsite', actualEndTime: '2020-01-01T00:00:00Z', teamA: { id: 101, name: 'A' }, teamB: { id: 102, name: 'B' }, viewer: { roles: ['referee'], isTeamLeader: false }, ...over }) as MatchDto
const result = { status: 'verified' } as MatchResultDto
beforeEach(() => {
  vi.clearAllMocks(); viewer.scope = null
  useFlow.mockImplementation(() => ({ ...Object.fromEntries(Object.entries(flow).map(([key, fn]) => [key, { mutateAsync: fn, isPending: false, isError: false, error: null }])), complaints: { isPending: false, isError: false, data: { complaints: [] } }, dispute: { isPending: false, isError: false } }))
})
describe('OD-26 frontend permission and payload gates', () => {
  it('abandons only after reason and explicit confirmation', async () => {
    render(<MatchWorkflowPanel m={match()} />)
    expect(screen.getByRole('button', { name: 'Review abandonment' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Abandon reason'), { target: { value: 'Rain' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review abandonment' })); expect(flow.abandon).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm abandonment' })); await waitFor(() => expect(flow.abandon).toHaveBeenCalledWith('Rain'))
  })
  it('does not expose lifecycle or evidence controls to an unrelated user', () => {
    render(<MatchWorkflowPanel m={match({ viewer: { roles: [], isTeamLeader: false } })} result={result} />)
    expect(screen.queryByText('Abandon and reschedule')).not.toBeInTheDocument(); expect(screen.queryByText('File result complaint')).not.toBeInTheDocument()
    expect(useFlow).toHaveBeenCalledWith(13, false, false)
  })
  it('shows organizer escalation after the deadline and disallows onsite double forfeit', () => {
    render(<MatchWorkflowPanel m={match({ status: 'finished', viewer: { roles: ['organizer'], isTeamLeader: false } })} />)
    expect(screen.getByText('Organizer decision: no result submitted')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Both teams forfeit' })).not.toBeInTheDocument()
  })
  it('does not open organizer escalation before the deadline', () => {
    render(<MatchWorkflowPanel m={match({ status: 'finished', actualEndTime: '2099-01-01T00:00:00Z', viewer: { roles: ['organizer'], isTeamLeader: false } })} />)
    expect(screen.queryByText('Organizer decision: no result submitted')).not.toBeInTheDocument(); expect(screen.getByText(/Organizer result decisions become available/)).toBeInTheDocument()
  })
  it('posts a proposed score as team IDs, never a/b keys', async () => {
    render(<ResultChallengeForm m={match()} title="Dispute" pending={false} error={null} submit={flow.challenge} />)
    fireEvent.change(screen.getByLabelText('Dispute reason'), { target: { value: 'Wrong score' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Propose a corrected score' }))
    fireEvent.change(screen.getByLabelText('Score for A'), { target: { value: '3' } }); fireEvent.change(screen.getByLabelText('Score for B'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Dispute' }))
    await waitFor(() => expect(flow.challenge).toHaveBeenCalledWith({ reason: 'Wrong score', claimedWinnerTeamId: 101, claimedScoreData: { '101': 3, '102': 1 } }))
  })
})

it('does not invent a deadline when the backend supplies no actual end time', () => {
  render(<MatchWorkflowPanel m={match({ status: 'finished', actualEndTime: null, viewer: { roles: ['organizer'], isTeamLeader: false } })} />)
  expect(screen.queryByText('Organizer decision: no result submitted')).not.toBeInTheDocument()
  expect(screen.getByText(/backend has not supplied the actual end time/)).toBeInTheDocument()
  expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
  expect(flow.organizer).not.toHaveBeenCalled()
})
it('renders a completed legacy match whose actual end time is null', () => {
  render(<MatchWorkflowPanel m={match({ status: 'completed', actualEndTime: null, viewer: { roles: [], isTeamLeader: false } })} result={result} />)
  expect(screen.queryByText('Organizer decision: no result submitted')).not.toBeInTheDocument()
  expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
  expect(flow.organizer).not.toHaveBeenCalled()
})
it('does not offer a referee a dispute of their own submitted result', () => {
  render(<MatchWorkflowPanel m={match({ status: 'finished' })} result={{ status: 'submitted', submittedBy: { id: 7 } } as MatchResultDto} />)
  expect(screen.queryByText('Dispute this result')).not.toBeInTheDocument()
  expect(screen.getByText(/You recorded this result and cannot dispute it/)).toBeInTheDocument()
  expect(flow.challenge).not.toHaveBeenCalled()
})
it('retains the dispute form for another assigned referee', () => {
  render(<MatchWorkflowPanel m={match({ status: 'finished' })} result={{ status: 'submitted', submittedBy: { id: 8 } } as MatchResultDto} />)
  expect(screen.getByRole('heading', { name: 'Dispute this result' })).toBeInTheDocument()
})
