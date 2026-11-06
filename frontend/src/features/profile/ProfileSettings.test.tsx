import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MeDto } from '../../types/dto'
const state = vi.hoisted(() => ({ profile: vi.fn(), prefs: vi.fn(), locked: false, criticalLocked: true, pending: false, error: null as Error | null }))
vi.mock('../../hooks/useAuth', () => ({ useUpdateMe: () => ({ mutate: state.profile, isPending: state.pending, isError: !!state.error, error: state.error }) }))
vi.mock('../../hooks/useQaFeatures', () => ({ useNotificationPreferences: () => ({
  query: { data: { categories: [{ key: 'critical', enabled: true, locked: state.criticalLocked }, { key: 'community', enabled: true, locked: state.locked }, { key: 'tournament', enabled: true, locked: false }] } }, save: { mutate: state.prefs },
}) }))
import { NotificationSettings, ProfileSettings } from './ProfileSettings'
beforeEach(() => { vi.clearAllMocks(); state.profile.mockReset(); state.locked = false; state.criticalLocked = true; state.pending = false; state.error = null })
async function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  await screen.findByRole('dialog', { name: 'Edit profile settings' })
}
it('cannot disable critical warnings even without a server lock and can mute tournament closures', () => {
  state.criticalLocked = false
  render(<NotificationSettings />)
  expect(screen.getByLabelText('Critical notifications')).toBeDisabled()
  fireEvent.click(screen.getByLabelText('Critical notifications'))
  expect(state.prefs).not.toHaveBeenCalled()
  fireEvent.click(screen.getByLabelText('Tournament notifications'))
  expect(state.prefs).toHaveBeenCalledWith({ key: 'tournament', enabled: false })
})
it('saves contact and address while respecting an existing hidden-statistics preference', async () => {
  render(<ProfileSettings user={{ id: 9, contactInfo: 'Contact', address: 'Dorm', showProfileStats: false } as MeDto} />)
  await openSettings()
  const checkbox = screen.getByRole('checkbox')
  expect(checkbox).not.toBeChecked()
  fireEvent.change(screen.getByLabelText('Contact information'), { target: { value: 'New contact' } })
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'New address' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }))
  expect(state.profile).toHaveBeenCalledWith({ contactInfo: 'New contact', address: 'New address', showProfileStats: false }, expect.objectContaining({ onSuccess: expect.any(Function) }))
})
it('keeps critical updates enabled and changes only the selected category', () => {
  render(<NotificationSettings />)
  expect(screen.getByLabelText('Critical notifications')).toBeChecked()
  expect(screen.getByLabelText('Critical notifications')).toBeDisabled()
  fireEvent.click(screen.getByLabelText('Community notifications'))
  expect(state.prefs).toHaveBeenCalledWith({ key: 'community', enabled: false })
})
it('honors server locks on other categories too', () => {
  state.locked = true
  render(<NotificationSettings />)
  expect(screen.getByLabelText('Community notifications')).toBeDisabled()
})
it('clears blank contact and address with null rather than storing a second empty representation', async () => {
  render(<ProfileSettings user={{ id: 9, contactInfo: 'Contact', address: 'Dorm' } as MeDto} />)
  await openSettings()
  fireEvent.change(screen.getByLabelText('Contact information'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }))
  expect(state.profile).toHaveBeenCalledWith({ contactInfo: null, address: null, showProfileStats: true }, expect.objectContaining({ onSuccess: expect.any(Function) }))
})
it('does not submit legacy profile data beyond the new server limits', async () => {
  render(<ProfileSettings user={{ id: 9, contactInfo: 'x'.repeat(256), address: null } as MeDto} />)
  await openSettings()
  expect(screen.getByRole('button', { name: 'Save profile settings' })).toBeDisabled()
  fireEvent.submit(screen.getByRole('button', { name: 'Save profile settings' }).closest('form')!)
  expect(state.profile).not.toHaveBeenCalled()
})

it('shows saved values without input fields until Settings is opened', () => {
  render(<ProfileSettings user={{ id: 9, contactInfo: 'Contact', address: 'Dorm', showProfileStats: false } as MeDto} />)
  expect(screen.getByText('Contact')).toBeInTheDocument()
  expect(screen.getByText('Dorm')).toBeInTheDocument()
  expect(screen.getByText('Hidden')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

it('discards unsaved changes on Cancel and opens with the latest profile values', async () => {
  const view = render(<ProfileSettings user={{ id: 9, contactInfo: 'Contact', address: 'Dorm' } as MeDto} />)
  await openSettings()
  fireEvent.change(screen.getByLabelText('Contact information'), { target: { value: 'Unsaved' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(state.profile).not.toHaveBeenCalled()
  view.rerender(<ProfileSettings user={{ id: 9, contactInfo: 'Latest contact', address: 'Latest address', showProfileStats: false } as MeDto} />)
  expect(screen.getByText('Latest contact')).toBeInTheDocument()
  await openSettings()
  expect(screen.getByLabelText('Contact information')).toHaveValue('Latest contact')
  expect(screen.getByLabelText('Address')).toHaveValue('Latest address')
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})

it('closes only after a successful save and shows confirmation outside the dialog', async () => {
  state.profile.mockImplementation((_input, options) => options.onSuccess())
  render(<ProfileSettings user={{ id: 9 } as MeDto} />)
  await openSettings()
  fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('status')).toHaveTextContent('Profile saved.')
})

it('keeps failed drafts and blocks cancellation while a save is pending', async () => {
  state.error = new Error('Could not save settings')
  const view = render(<ProfileSettings user={{ id: 9 } as MeDto} />)
  await openSettings()
  fireEvent.change(screen.getByLabelText('Contact information'), { target: { value: 'Retry contact' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save settings')
  expect(screen.getByLabelText('Contact information')).toHaveValue('Retry contact')
  state.pending = true
  view.rerender(<ProfileSettings user={{ id: 9 } as MeDto} />)
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
})
