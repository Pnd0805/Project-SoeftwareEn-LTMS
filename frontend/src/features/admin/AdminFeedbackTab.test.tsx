import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
const state = vi.hoisted(() => ({ scope: 'university_wide', tournaments: vi.fn(), comments: vi.fn(), reviews: vi.fn(), remove: vi.fn(), restore: vi.fn(), dismiss: vi.fn(), removed: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { adminScope: { scopeType: state.scope } } }) }))
vi.mock('../../api/tournament', () => ({ getTournaments: state.tournaments }))
vi.mock('../../api/liveEngagement', () => ({ getComments: state.comments, getReviews: state.reviews, removeFeedbackByAdmin: state.remove, restoreFeedbackByAdmin: state.restore, dismissCommentReport: state.dismiss, getRemovedFeedback: state.removed }))
import { AdminFeedbackTab } from './AdminFeedbackTab'
const page = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><AdminFeedbackTab /></MemoryRouter></QueryClientProvider>)
const removedRow = { id: 8, tournamentId: 23, tournamentName: 'Campus cup', feedbackType: 'comment', content: 'Removed comment content', author: { id: 7, fullName: 'Player' }, rating: null, removedAt: '2026-10-07T03:00:00Z', removedBy: { id: 9, fullName: 'Admin' }, removedByRole: 'admin', removalReason: 'Spam history', canRestore: true }
const removedPage = (canRestore = true) => ({ items: [{ ...removedRow, canRestore }], pagination: { totalPages: 2, totalItems: 21, page: 1, pageSize: 20 } })
beforeEach(() => {
  vi.clearAllMocks(); state.scope = 'university_wide'
  state.tournaments.mockResolvedValue({ items: [{ id: 23, name: 'Campus cup' }] })
  state.comments.mockResolvedValue({ items: [{ id: 7, author: { fullName: 'Player' }, content: 'Reported comment' }], canModerate: true, pagination: { totalPages: 1 } })
  state.reviews.mockResolvedValue({ items: [{ id: 8, rating: 1, content: 'Reported review', isReported: true }] })
  state.remove.mockResolvedValue(undefined)
  state.removed.mockResolvedValue(removedPage())
})
it('does not query or offer review actions to Root', () => {
  state.scope = 'root'; page()
  expect(screen.getByText(/requires University Admin rights/)).toBeInTheDocument()
  expect(state.tournaments).not.toHaveBeenCalled()
  expect(state.comments).not.toHaveBeenCalled()
  expect(state.removed).not.toHaveBeenCalled()
})
it('shows reported content before moderation and requires confirmation to remove it', async () => {
  page()
  await screen.findByRole('option', { name: 'Campus cup' })
  fireEvent.change(screen.getByLabelText('Tournament'), { target: { value: '23' } })
  await screen.findByText('Reported comment')
  await screen.findByText('Reported review')
  expect(state.comments).toHaveBeenCalledWith(23, 1, true)
  fireEvent.click(screen.getAllByRole('button', { name: 'Review removal' })[0])
  expect(state.remove).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  expect(state.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getAllByRole('button', { name: 'Review removal' })[0])
  fireEvent.change(screen.getByLabelText('Moderation reason (optional)'), { target: { value: 'Spam' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm moderation' }))
  await waitFor(() => expect(state.remove).toHaveBeenCalledWith(7, 'Spam'))
  expect(state.dismiss).not.toHaveBeenCalled()
})

it('restores from the delivered history with content and reason, only after confirmation', async () => {
 state.restore.mockResolvedValue({ restored: true })
 page()
 await screen.findByText('Removed comment content')
 expect(screen.getByText('Reason: Spam history')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button', { name: 'Review restoration' }))
 expect(state.restore).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: 'Confirm restoration' }))
 await waitFor(() => expect(state.restore).toHaveBeenCalledWith(8))
 expect(state.remove).not.toHaveBeenCalled()
})

it('lets Faculty read paginated history without offering restoration or querying moderation', async () => {
 state.scope = 'faculty'; state.removed.mockResolvedValue(removedPage(false)); page()
 await screen.findByText('Removed comment content')
 expect(screen.queryByRole('button', { name: 'Review restoration' })).not.toBeInTheDocument()
 expect(state.tournaments).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: 'Next removed feedback' }))
 await waitFor(() => expect(state.removed).toHaveBeenCalledWith(2))
 expect(state.restore).not.toHaveBeenCalled()
})
it('uses canRestore even when the viewer is a University Admin', async () => {
 state.removed.mockResolvedValue(removedPage(false)); page()
 await screen.findByText('Removed comment content')
 expect(screen.queryByRole('button', { name: 'Review restoration' })).not.toBeInTheDocument()
 expect(screen.queryByLabelText('Removed feedback ID')).not.toBeInTheDocument()
})
it('shows denied history as an error with retry, without claiming an empty list', async () => {
 state.removed.mockRejectedValue(new ApiError(403, { code: 'INSUFFICIENT_ADMIN_SCOPE', message: 'Forbidden' })); page()
 await screen.findByText(/Could not load removed feedback/)
 expect(screen.queryByText('No removed feedback on this page.')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button', { name: 'Retry removed feedback' }))
 await waitFor(() => expect(state.removed).toHaveBeenCalledTimes(2))
})
