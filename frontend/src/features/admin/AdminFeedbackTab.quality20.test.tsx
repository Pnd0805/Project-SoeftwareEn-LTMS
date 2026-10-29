import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

const { remove, restore, state } = vi.hoisted(() => ({ remove: vi.fn(), restore: vi.fn(), state: { canModerate: true, reviews: false } }))
vi.mock('../../api/liveEngagement', () => ({ removeFeedbackByAdmin: remove, restoreFeedbackByAdmin: restore }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 7, userType: 'staff' } }) }))
vi.mock('../../hooks/useLiveEngagement', () => ({
  useReviews: () => ({ query: { data: { summary: { average: 2, count: 1, distribution: {} }, status: 'open', canSubmit: false, mine: null,
    items: state.canModerate && state.reviews ? [{ id: 55, rating: 2, content: 'Review to inspect', author: { fullName: 'Review author' } }] : null }, isPending: false, isError: false }, submit: { isPending: false } }),
  usePickemLeaderboard: () => ({ data: { items: [] } }),
  useCommentsLive: () => ({ query: { data: { items: state.reviews ? [] : [{ id: 42, tournamentId: 23, author: { id: 8, fullName: 'Other author' }, content: 'Comment to inspect', createdAt: '2026-10-01T00:00:00Z', isMine: false }], mine: null,
    canModerate: state.canModerate, canComment: false, pagination: { totalItems: 1, totalPages: 1 } }, isPending: false, isError: false },
    post: { isPending: false }, removeMine: { isPending: false }, moderate: { isPending: false }, report: { isPending: false }, dismiss: { isPending: false } }),
}))
import { AdminFeedbackTab } from './AdminFeedbackTab'
import { LiveCommunityTab } from '../tournament/LiveCommunityTab'

beforeEach(() => { vi.clearAllMocks(); remove.mockResolvedValue(undefined); restore.mockResolvedValue(undefined); state.canModerate = true; state.reviews = false })
function show(community = false) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><MemoryRouter>
    {community ? <LiveCommunityTab tournamentId={23} organizer={false} /> : <AdminFeedbackTab />}
  </MemoryRouter></QueryClientProvider>)
}

it('blocks raw-ID moderation when target context is unavailable', () => {
  show()
  const idInput = screen.queryByLabelText('Feedback ID')
  if (idInput) fireEvent.change(idInput, { target: { value: '999' } })
  for (const action of ['Remove', 'Restore']) {
    const button = screen.queryByRole('button', { name: action })
    if (button) expect(button).toBeDisabled()
  }
  expect(screen.getByText('Feedback moderation requires University Admin rights.')).toBeInTheDocument()
  expect(remove).not.toHaveBeenCalled(); expect(restore).not.toHaveBeenCalled()
})

it.each(['comment', 'review'])('identifies the selected %s before removal and retains that context for restore', async kind => {
  state.reviews = kind === 'review'
  show(true)
  const id = kind === 'review' ? 55 : 42
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  expect(remove).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent(`#${id}`)
  expect(dialog).toHaveTextContent(kind === 'review' ? 'Review author' : 'Other author')
  expect(dialog).toHaveTextContent(kind === 'review' ? 'Review to inspect' : 'Comment to inspect')
  expect(within(dialog).getByRole('link', { name: 'Tournament #23' })).toHaveAttribute('href', '/t/23/community')
  fireEvent.change(within(dialog).getByLabelText('Reason (optional)'), { target: { value: ' Reviewed target ' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm removal' }))
  await waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith(id, 'Reviewed target'))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: `Restore removed item #${id}` }))
  expect(restore).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toHaveTextContent(kind === 'review' ? 'Review to inspect' : 'Comment to inspect')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm restore' }))
  await waitFor(() => expect(restore).toHaveBeenCalledExactlyOnceWith(id))
  expect(await screen.findByText(`Feedback #${id} restored.`)).toHaveAttribute('role', 'status')
})

it('does not remove on cancel and retains the target and reason on failed mutation', async () => {
  show(true)
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  remove.mockRejectedValueOnce(new Error('Permission denied by server'))
  fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'Retained reason' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied by server')
  expect(screen.getByRole('dialog')).toHaveTextContent('Comment to inspect')
  expect(screen.getByLabelText('Reason (optional)')).toHaveValue('Retained reason')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(remove).toHaveBeenCalledTimes(2)
})

it('does not expose admin moderation when the existing source denies it', () => {
  state.canModerate = false
  show(true)
  expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Restore/ })).not.toBeInTheDocument()
})
