import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ scope: 'university_wide', tournaments: vi.fn(), comments: vi.fn(), reviews: vi.fn(), remove: vi.fn(), restore: vi.fn(), dismiss: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { adminScope: { scopeType: state.scope } } }) }))
vi.mock('../../api/tournament', () => ({ getTournaments: state.tournaments }))
vi.mock('../../api/liveEngagement', () => ({ getComments: state.comments, getReviews: state.reviews, removeFeedbackByAdmin: state.remove, restoreFeedbackByAdmin: state.restore, dismissCommentReport: state.dismiss }))
import { AdminFeedbackTab } from './AdminFeedbackTab'
const page = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><AdminFeedbackTab /></MemoryRouter></QueryClientProvider>)
beforeEach(() => {
  vi.clearAllMocks(); state.scope = 'university_wide'
  state.tournaments.mockResolvedValue({ items: [{ id: 23, name: 'Campus cup' }] })
  state.comments.mockResolvedValue({ items: [{ id: 7, author: { fullName: 'Player' }, content: 'Reported comment' }], canModerate: true, pagination: { totalPages: 1 } })
  state.reviews.mockResolvedValue({ items: [{ id: 8, rating: 1, content: 'Reported review', isReported: true }] })
  state.remove.mockResolvedValue(undefined)
})
it('does not query or offer review actions to Root', () => {
  state.scope = 'root'; page()
  expect(screen.getByText(/requires University Admin rights/)).toBeInTheDocument()
  expect(state.tournaments).not.toHaveBeenCalled()
  expect(state.comments).not.toHaveBeenCalled()
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

it('retains restoration as a secondary confirmed action for known deleted feedback IDs', async () => {
 state.restore.mockResolvedValue({ restored: true })
 page()
 fireEvent.change(screen.getByLabelText('Removed feedback ID'), { target: { value: '8' } })
 fireEvent.click(screen.getByRole('button', { name: 'Review restoration' }))
 expect(state.restore).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button', { name: 'Confirm moderation' }))
 await waitFor(() => expect(state.restore).toHaveBeenCalledWith(8))
 expect(state.remove).not.toHaveBeenCalled()
})
