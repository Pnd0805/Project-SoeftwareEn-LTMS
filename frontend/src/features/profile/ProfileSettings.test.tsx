import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MeDto } from '../../types/dto'
const state = vi.hoisted(() => ({ profile: vi.fn(), prefs: vi.fn(), locked: false, criticalLocked: true }))
vi.mock('../../hooks/useAuth', () => ({ useUpdateMe: () => ({ mutate: state.profile }) }))
vi.mock('../../hooks/useQaFeatures', () => ({ useNotificationPreferences: () => ({
  query: { data: { categories: [{ key: 'critical', enabled: true, locked: state.criticalLocked }, { key: 'community', enabled: true, locked: state.locked }, { key: 'tournament', enabled: true, locked: false }] } }, save: { mutate: state.prefs },
}) }))
import { NotificationSettings, ProfileSettings } from './ProfileSettings'
beforeEach(() => { vi.clearAllMocks(); state.locked = false; state.criticalLocked = true })
it('cannot disable critical warnings even without a server lock and can mute tournament closures', () => {
  state.criticalLocked = false
  render(<NotificationSettings />)
  expect(screen.getByLabelText('Critical notifications')).toBeDisabled()
  fireEvent.click(screen.getByLabelText('Critical notifications'))
  expect(state.prefs).not.toHaveBeenCalled()
  fireEvent.click(screen.getByLabelText('Tournament notifications'))
  expect(state.prefs).toHaveBeenCalledWith({ key: 'tournament', enabled: false })
})
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
it('clears blank contact and address with null rather than storing a second empty representation', () => {
  render(<ProfileSettings user={{ id: 9, contactInfo: 'Contact', address: 'Dorm' } as MeDto} />)
  fireEvent.change(screen.getByLabelText('Contact information'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }))
  expect(state.profile).toHaveBeenCalledWith({ contactInfo: null, address: null, showProfileStats: true })
})
it('does not submit legacy profile data beyond the new server limits', () => {
  render(<ProfileSettings user={{ id: 9, contactInfo: 'x'.repeat(256), address: null } as MeDto} />)
  expect(screen.getByRole('button', { name: 'Save profile settings' })).toBeDisabled()
  fireEvent.submit(screen.getByRole('button', { name: 'Save profile settings' }).closest('form')!)
  expect(state.profile).not.toHaveBeenCalled()
})
