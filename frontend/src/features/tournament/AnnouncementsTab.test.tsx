import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Tournament } from '../../shared/types'
const state = vi.hoisted(() => ({ edit: vi.fn(), remove: vi.fn(), publish: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../hooks/useTournament', () => ({
  useTournamentAnnouncements: () => ({ data: { items: [{ id: 1, title: 'Schedule', body: 'Old message', type: 'general', createdAt: '2026-10-01' }] } }),
  useCreateTournamentAnnouncement: () => ({ mutateAsync: state.publish, reset: vi.fn() }),
  useEditAnnouncement: () => ({ mutateAsync: state.edit, reset: vi.fn() }),
  useDeleteAnnouncement: () => ({ mutate: state.remove, reset: vi.fn() }),
}))
import { AnnouncementsTab } from './AnnouncementsTab'
const page = (org = true) => render(<AnnouncementsTab t={{ id: '23', name: 'QA cup' } as Tournament} org={org} />)
beforeEach(() => { vi.clearAllMocks(); state.edit.mockResolvedValue({}); state.publish.mockResolvedValue({}) })
it('keeps editing controls exclusive to the organizer', () => {
  page(false)
  expect(screen.queryByRole('button', { name: 'Edit announcement' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete announcement' })).not.toBeInTheDocument()
})
it('loads existing content for editing and submits trimmed text with the selected type', async () => {
  page()
  fireEvent.click(screen.getByRole('button', { name: 'Edit announcement' }))
  expect(screen.getByLabelText('Headline')).toHaveValue('Schedule')
  fireEvent.change(screen.getByLabelText('Headline'), { target: { value: '  New schedule  ' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: '  Updated kick-offs  ' } })
  fireEvent.change(screen.getByLabelText('Announcement type'), { target: { value: 'schedule_change' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save announcement' }))
  await waitFor(() => expect(state.edit).toHaveBeenCalledWith({ id: 1, input: { title: 'New schedule', body: 'Updated kick-offs', type: 'schedule_change' } }))
  expect(state.publish).not.toHaveBeenCalled()
})
it('does not publish a blank announcement and associates errors with inputs', async () => {
  page()
  fireEvent.click(screen.getByRole('button', { name: 'Post an announcement' }))
  fireEvent.change(screen.getByLabelText('Headline'), { target: { value: '   ' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Post' }))
  await screen.findByText('กรุณาระบุหัวข้อประกาศ')
  expect(screen.getByLabelText('Headline')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('Headline')).toHaveAccessibleDescription('กรุณาระบุหัวข้อประกาศ')
  expect(state.publish).not.toHaveBeenCalled()
})
it('requires confirmation before deleting and cancelling preserves the announcement', () => {
  page()
  fireEvent.click(screen.getByRole('button', { name: 'Delete announcement' }))
  expect(state.remove).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  expect(state.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete announcement' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }))
  expect(state.remove).toHaveBeenCalledWith(1, expect.anything())
})
