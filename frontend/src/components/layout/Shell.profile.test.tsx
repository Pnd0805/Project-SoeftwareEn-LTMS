import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: { id: 9, fullName: 'Narin', avatarUrl: 'https://example.test/avatar.png' } as {
    id: number; fullName: string; avatarUrl: string | null
  } | undefined },
}))

vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(), USE_MOCK: false,
}))
vi.mock('../../shared/store', () => ({ useLtms: () => ({}), signout: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({
  useMe: () => ({ data: currentUser.value }),
  useLogout: () => ({ mutateAsync: vi.fn(async () => undefined) }),
}))
vi.mock('../../hooks/useAdmin', () => ({ useAdminAccess: () => ({ data: false }) }))
vi.mock('../../hooks/useNotifications', () => ({ useNotifications: () => ({ data: { items: [], unreadCount: 0 } }) }))

import { Shell } from './Shell'

function showShell(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><Shell>
    <Routes>
      <Route path="/" element={<div>Home screen</div>} />
      <Route path="/me" element={<div>My profile screen</div>} />
      <Route path="*" element={<div>Other screen</div>} />
    </Routes>
  </Shell></MemoryRouter>)
}

describe('Shell profile shortcut', () => {
  beforeEach(() => {
    currentUser.value = { id: 9, fullName: 'Narin', avatarUrl: 'https://example.test/avatar.png' }
    document.documentElement.dataset.theme = 'dark'
    localStorage.removeItem('ltms-theme')
  })

  it('navigates independently between Home and Tournaments', () => {
    showShell()
    const home = screen.getByRole('button', { name: 'Home' })
    const tournaments = screen.getByRole('button', { name: 'Tournaments' })
    expect(home).toHaveAttribute('aria-current', 'page')
    expect(tournaments).not.toHaveAttribute('aria-current')
    fireEvent.click(tournaments)
    expect(screen.getByText('Other screen')).toBeInTheDocument()
    expect(tournaments).toHaveAttribute('aria-current', 'page')
    expect(home).not.toHaveAttribute('aria-current')
    fireEvent.click(home)
    expect(screen.getByText('Home screen')).toBeInTheDocument()
    expect(home).toHaveAttribute('aria-current', 'page')
  })

  it('persists a theme change and keeps global search and Inbox navigation', () => {
    showShell()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('ltms-theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'Campus Cup' } })
    fireEvent.submit(screen.getByRole('textbox', { name: 'Search' }).closest('form')!)
    expect(screen.getByText('Other screen')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }))
    expect(screen.getByRole('button', { name: 'Inbox' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens /me from the signed-in avatar and falls back to the initial if the image fails', () => {
    showShell()
    const link = screen.getByRole('link', { name: 'Open my profile' })
    const image = link.querySelector('img')!
    expect(image).toHaveAttribute('src', 'https://example.test/avatar.png')
    fireEvent.error(image)
    expect(link).toHaveTextContent('N')
    fireEvent.click(link)
    expect(screen.getByText('My profile screen')).toBeInTheDocument()
  })

  it('uses an initial when /me returns a storage key instead of a public URL', () => {
    currentUser.value = { id: 9, fullName: 'Narin', avatarUrl: 'avatars/narin.png' }
    showShell()
    const link = screen.getByRole('link', { name: 'Open my profile' })
    expect(link.querySelector('img')).toBeNull()
    expect(link).toHaveTextContent('N')
  })

  it('does not show a profile shortcut to a guest', () => {
    currentUser.value = undefined
    showShell()
    expect(screen.queryByRole('link', { name: 'Open my profile' })).not.toBeInTheDocument()
  })

  it.each([
    ['/team/7', 'Teams'],
    ['/m/9', 'Matches'],
    ['/checkin/9', 'Matches'],
    ['/t/2', 'Tournaments'],
  ])('marks the %s parent section active', (path, label) => {
    showShell(path)
    expect(screen.getByRole('button', { name: label })).toHaveClass('on')
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps the skip control, navigation, search, notifications, and profile in keyboard order', async () => {
    const user = userEvent.setup()
    showShell()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Skip to the main content' })).toHaveFocus()

    const navButtons = within(screen.getByRole('navigation')).getAllByRole('button')
    await user.tab()
    expect(navButtons[0]).toHaveFocus()
    for (let index = 1; index < navButtons.length; index += 1) await user.tab()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus()

    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: /Notifications/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Open my profile' })).toHaveFocus()
  })
})
