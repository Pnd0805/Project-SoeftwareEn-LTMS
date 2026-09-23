import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const { markRead, notificationQuery } = vi.hoisted(() => ({ markRead: vi.fn(), notificationQuery: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 7 }, isLoading: false }) }))
vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: notificationQuery,
  useMarkNotificationRead: () => ({ mutate: markRead, isPending: false }),
  useMarkNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('./BackendInbox', () => ({ BackendInbox: () => <div>Action requests</div> }))
import { InboxPage } from './InboxPage'

describe('real C1 Inbox', () => {
  it('uses server unreadCount and opens reported comments from a new notice', () => {
    notificationQuery.mockReturnValue({ isLoading: false, isError: false, data: {
      items: [{ id: 31, type: 'comment_reported', title: 'Comment reported', message: 'Please review',
        relatedEntityType: 'tournament', relatedEntityId: 23, isRead: false, createdAt: '2026-09-23T00:00:00Z' }],
      unreadCount: 9, pagination: { page: 1, pageSize: 20, totalItems: 31, totalPages: 2 },
    } })
    render(<MemoryRouter initialEntries={['/inbox']}><Routes>
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/t/:id/community" element={<div>Reported comments</div>} />
    </Routes></MemoryRouter>)
    expect(screen.getByText('Inbox · 9 unread')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(markRead).toHaveBeenCalledWith(31)
    expect(screen.getByText('Reported comments')).toBeInTheDocument()
  })
})
