import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { notifications, markRead } = vi.hoisted(() => ({ notifications: vi.fn(), markRead: vi.fn() }))

vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(), USE_MOCK: true,
}))
vi.mock('../../hooks/useAuth', () => ({
  useMe: () => ({ data: { id: 7 }, isLoading: false }),
}))
vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: notifications,
  useMarkNotificationRead: () => ({ mutate: markRead, isPending: false }),
  useMarkNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { InboxPage } from './InboxPage'

const draw = () => render(<MemoryRouter><InboxPage /></MemoryRouter>)

describe('InboxPage response states', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the empty state only for a successful empty list', () => {
    notifications.mockReturnValue({ data: { items: [] }, isLoading: false, isError: false })
    draw()
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.queryByText('Unable to load inbox')).not.toBeInTheDocument()
  })

  it.each([401, 403, 404, 501, 0])('keeps error %s separate from empty', status => {
    notifications.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { status } })
    draw()
    expect(screen.getByText('Unable to load inbox')).toBeInTheDocument()
    expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument()
  })

  it('treats a malformed successful response as an error, not empty', () => {
    notifications.mockReturnValue({ data: { unexpected: [] }, isLoading: false, isError: false })
    draw()
    expect(screen.getByText('Unable to load inbox')).toBeInTheDocument()
    expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument()
  })

  it('uses the message to name a mock action when no notification title exists', () => {
    notifications.mockReturnValue({ data: { items: [{ id: 31, message: 'Your team invitation has expired.',
      href: '/team/t-9', read: false, createdAt: '2026-10-01T00:00:00Z' }] }, isLoading: false, isError: false })
    markRead.mockImplementation((_id, options) => options.onSuccess())
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Mark read: Your team invitation has expired.' }))
    expect(markRead).toHaveBeenCalledWith(31, expect.any(Object))
    expect(screen.getByRole('status')).toHaveTextContent('Marked read: Your team invitation has expired.')
    expect(screen.queryByRole('heading', { name: 'Action requests' })).not.toBeInTheDocument()
  })
})
