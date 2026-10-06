import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MeDto } from '../../types/dto'
const state = vi.hoisted(() => ({ profile: vi.fn(), prefs: vi.fn(), locked: false }))
vi.mock('../../hooks/useAuth', () => ({ useUpdateMe: () => ({ mutate: state.profile }) }))
vi.mock('../../hooks/useQaFeatures', () => ({ useNotificationPreferences: () => ({
  query: { data: { categories: [{ key: 'critical', enabled: true, locked: true }, { key: 'community', enabled: true, locked: state.locked }] } }, save: { mutate: state.prefs },
}) }))
import { NotificationSettings, ProfileSettings } from './ProfileSettings'
beforeEach(() => { vi.clearAllMocks(); state.locked = false })
it('saves contact and address while respecting an existing hidden-statistics preference', () => {
  render(<ProfileSettings user={{ id: 9, contactInfo: 'Contact', address: 'Dorm', showProfileStats: false } as MeDto} />)
  const checkbox = screen.getByRole('checkbox')
  expect(checkbox).not.toBeChecked()
  fireEvent.change(screen.getByLabelText('Contact information'), { target: { value: 'New contact' } })
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'New address' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }))
  expect(state.profile).toHaveBeenCalledWith({ contactInfo: 'New contact', address: 'New address', showProfileStats: false })
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
