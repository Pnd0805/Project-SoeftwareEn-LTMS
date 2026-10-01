import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const { moderate, dismiss, report, state } = vi.hoisted(() => ({ moderate: vi.fn().mockResolvedValue(undefined), dismiss: vi.fn().mockResolvedValue(undefined), report: vi.fn().mockResolvedValue(undefined), state: { canModerate: true, cleared: false } }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 7 } }) }))
vi.mock('../../hooks/useLiveEngagement', () => ({
  useReviews: () => ({ query: { data: { summary: { average: null, count: 0, distribution: {} }, status: 'open', mine: null, canSubmit: false }, isPending: false, isError: false }, submit: { isPending: false } }),
  usePickemLeaderboard: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useCommentsLive: () => ({
    query: { data: { items: [
      { id: 41, tournamentId: 23, author: { id: 7, fullName: 'Me' }, content: 'Mine', createdAt: '2026-09-23T00:00:00Z', isMine: true },
      { id: 42, tournamentId: 23, author: { id: 8, fullName: 'Other' }, content: 'Off topic', createdAt: '2026-09-23T00:00:00Z', isMine: false, isReported: !state.cleared, reportCleared: state.cleared },
    ], mine: { id: 41, tournamentId: 23, author: { id: 7, fullName: 'Me' }, content: 'Mine', createdAt: '2026-09-23T00:00:00Z', isMine: true },
      canComment: true, canModerate: state.canModerate, pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } }, isPending: false, isError: false },
    post: { isPending: false }, removeMine: { isPending: false }, moderate: { isPending: false, mutateAsync: moderate }, report: { isPending: false, mutateAsync: report }, dismiss: { isPending: false, mutateAsync: dismiss },
  }),
}))
import { LiveCommunityTab } from './LiveCommunityTab'

describe('C7 tournament comments', () => {
  it('pins mine only once and requires a reason for organizer removal', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><LiveCommunityTab tournamentId={23} organizer /></MemoryRouter></QueryClientProvider>)
    expect(screen.getAllByText('Mine')).toHaveLength(1)
    expect(screen.getByText('Reported')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('dialog')).toHaveTextContent("Remove Other's comment")
    const confirm = screen.getByRole('button', { name: 'Remove comment' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Reason (required, 1–255 characters)'), { target: { value: 'Off topic' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(moderate).toHaveBeenCalledWith({ commentId: 42, reason: 'Off topic' })
  })
})

function renderComments() {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><LiveCommunityTab tournamentId={23} organizer={state.canModerate} /></MemoryRouter></QueryClientProvider>)
}
it('marks the comment content, hides Report for moderators and dismisses without deleting', async () => {
  state.canModerate = true; state.cleared = false
  renderComments()
  expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument()
  expect(screen.getByText('Reported').parentElement?.parentElement).toHaveTextContent('Off topic')
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss report' }))
  await waitFor(() => expect(dismiss).toHaveBeenCalledWith(42))
  expect(screen.getByText('Off topic')).toBeInTheDocument()
})
it('does not send Report until confirmed and cancellation sends nothing', async () => {
  state.canModerate = false; report.mockClear()
  renderComments()
  fireEvent.click(screen.getByRole('button', { name: 'Report' }))
  expect(report).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(report).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Report' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Report' }))
  await waitFor(() => expect(report).toHaveBeenCalledWith(42))
  expect(screen.queryByRole('button', { name: 'Dismiss report' })).not.toBeInTheDocument()
})
it('shows the delivered cleared status without re-marking the comment', () => {
  state.canModerate = true; state.cleared = true
  renderComments()
  expect(screen.getByText(/Reviewed and dismissed/)).toBeInTheDocument()
  expect(screen.queryByText('Reported')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Dismiss report' })).not.toBeInTheDocument()
})
