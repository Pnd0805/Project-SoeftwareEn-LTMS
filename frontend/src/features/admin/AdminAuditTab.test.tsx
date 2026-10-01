import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
vi.mock('../../hooks/useAdmin', () => ({ useAuditLogs: () => ({ isSuccess: true, data: { items: [
  { id: 1, actionType: 'comment_removed', entityType: 'comment', entityId: 42, user: { id: 7, fullName: 'Organizer', avatarUrl: null }, createdAt: '2026-10-01T00:00:00Z', details: { reason: 'Spam', previous: { content: 'Old comment' } } },
  { id: 2, actionType: 'user_suspended', entityType: 'user', entityId: 8, user: { id: 9, fullName: 'Admin', avatarUrl: null }, createdAt: '2026-10-01T01:00:00Z', details: null },
] } }) }))
import { AdminAuditTab } from './AdminGovernanceTab'
it('shows structured records and filters by entity and actor without losing detail values', () => {
  render(<AdminAuditTab />)
  expect(screen.getAllByRole('article')).toHaveLength(2)
  const card = screen.getAllByRole('article')[0]
  expect(within(card).getByText('Comment Removed')).toBeInTheDocument()
  fireEvent.click(within(card).getByText('View details (2)'))
  expect(within(card).getByText('Spam')).toBeInTheDocument()
  expect(card).toHaveTextContent('Old comment')
  fireEvent.change(screen.getByLabelText('Entity type'), { target: { value: 'user' } })
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(screen.queryByText('Organizer')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search audit logs'), { target: { value: 'Nobody' } })
  expect(screen.getByText('No records match these filters.')).toBeInTheDocument()
})
