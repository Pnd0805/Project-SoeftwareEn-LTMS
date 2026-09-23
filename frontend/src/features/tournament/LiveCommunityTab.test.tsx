import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const { moderate } = vi.hoisted(() => ({ moderate: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 7 } }) }))
vi.mock('../../hooks/useLiveEngagement', () => ({
  useReviews: () => ({ query: { data: { summary: { average: null, count: 0, distribution: {} }, status: 'open', mine: null, canSubmit: false }, isPending: false, isError: false }, submit: { isPending: false } }),
  usePickemLeaderboard: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useCommentsLive: () => ({
    query: { data: { items: [
      { id: 41, tournamentId: 23, author: { id: 7, fullName: 'Me' }, content: 'Mine', createdAt: '2026-09-23T00:00:00Z', isMine: true },
      { id: 42, tournamentId: 23, author: { id: 8, fullName: 'Other' }, content: 'Off topic', createdAt: '2026-09-23T00:00:00Z', isMine: false, isReported: true },
    ], mine: { id: 41, tournamentId: 23, author: { id: 7, fullName: 'Me' }, content: 'Mine', createdAt: '2026-09-23T00:00:00Z', isMine: true },
      canComment: true, canModerate: true, pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } }, isPending: false, isError: false },
    post: { isPending: false }, removeMine: { isPending: false }, moderate: { isPending: false, mutateAsync: moderate }, report: { isPending: false },
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
    const confirm = screen.getByRole('button', { name: 'Remove comment' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Reason (required, 1–255 characters)'), { target: { value: 'Off topic' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(moderate).toHaveBeenCalledWith({ commentId: 42, reason: 'Off topic' })
  })
})
