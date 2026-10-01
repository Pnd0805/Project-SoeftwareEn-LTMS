import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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

  /* Notice C keeps private-tournament access for pending invitees. */
  it('lets a pending invitee read the private tournament before accepting', () => {
    notificationQuery.mockReturnValue({ isLoading: false, isError: false, data: {
      items: [{ id: 16, type: 'referee_invited', title: 'คุณได้รับเชิญเป็นกรรมการ',
        message: 'คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ "sun"',
        relatedEntityType: 'tournament', relatedEntityId: 28, isRead: false, createdAt: '2026-09-23T00:00:00Z' }],
      unreadCount: 1, pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    } })
    render(<MemoryRouter initialEntries={['/inbox']}><Routes>
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/t/28" element={<div>Private tournament eligibility</div>} />
    </Routes></MemoryRouter>)

    expect(screen.getByText('คุณได้รับเชิญเป็นกรรมการ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
    /* รับ/ปฏิเสธอยู่ในแผง Action requests ของหน้าเดียวกัน */
    expect(screen.getByText('Action requests')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(markRead).toHaveBeenCalledWith(16)
    expect(screen.getByText('Private tournament eligibility')).toBeInTheDocument()
  })
})

it('opens tournament announcements from Inbox and marks the delivered notification read', () => {
  notificationQuery.mockReturnValue({ isLoading: false, isError: false, data: {
    items: [{ id: 99, type: 'tournament_announcement', title: 'Court changed', message: 'Court B', relatedEntityType: 'tournament', relatedEntityId: 23, isRead: false, createdAt: '2026-10-01T00:00:00Z' }],
    unreadCount: 1, pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  } })
  render(<MemoryRouter initialEntries={['/inbox']}><Routes><Route path="/inbox" element={<InboxPage />} /><Route path="/t/23/announcements" element={<div>Court B announcement</div>} /></Routes></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Open' })); expect(markRead).toHaveBeenCalledWith(99); expect(screen.getByText('Court B announcement')).toBeInTheDocument()
})

it('opens rewritten comments in Community without assuming every rewrite is reported', () => {
  markRead.mockClear()
  notificationQuery.mockReturnValue({ isLoading: false, isError: false, data: {
    items: [{ id: 100, type: 'comment_rewritten_after_removal', title: 'Removed comment rewritten', message: 'Review the new content; an earlier report may remain.', relatedEntityType: 'tournament', relatedEntityId: 19, isRead: false, createdAt: '2026-10-01T00:00:00Z' }], unreadCount: 1,
  } })
  function Destination() { const location = useLocation(); return <div>Destination: {location.pathname}{location.search}</div> }
  render(<MemoryRouter initialEntries={['/inbox']}><Routes><Route path="/inbox" element={<InboxPage />} /><Route path="/t/19/community" element={<Destination />} /></Routes></MemoryRouter>)
  expect(screen.getByText('Removed comment rewritten')).toBeInTheDocument()
  expect(screen.getByText(/an earlier report may remain/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  expect(markRead).toHaveBeenCalledWith(100)
  expect(screen.getByText('Destination: /t/19/community')).toBeInTheDocument()
})

it.each([null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('does not create an invitation link for invalid tournament ID %s', id => {
  notificationQuery.mockReturnValue({ isLoading: false, isError: false, data: {
    items: [{ id: 101, type: 'referee_invited', title: 'Invitation', message: 'Read the invitation.', relatedEntityType: 'tournament', relatedEntityId: id, isRead: false, createdAt: '2026-10-01T00:00:00Z' }], unreadCount: 1,
  } })
  render(<MemoryRouter><InboxPage /></MemoryRouter>)
  expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument()
  expect(screen.getByText('Action requests')).toBeInTheDocument()
})
