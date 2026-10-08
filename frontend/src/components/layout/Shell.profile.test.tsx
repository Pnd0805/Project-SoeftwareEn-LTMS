import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { currentUser, logout } = vi.hoisted(() => ({
  logout: vi.fn(async () => undefined),
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
  useLogout: () => ({ mutateAsync: logout }),
}))
vi.mock('../../hooks/useAdmin', () => ({ useAdminAccess: () => ({ data: false }) }))
vi.mock('../../hooks/useNotifications', () => ({ useNotifications: () => ({ data: { items: [], unreadCount: 0 } }) }))
vi.mock('../../features/checkin/GlobalScanDialog', () => ({
  GlobalScanDialog: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Scan check-in QR"><button onClick={onClose}>Close Scan</button></div>,
  GlobalScanPhoto: () => null,
}))

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

function compactViewport() {
  let listener: ((event: { matches: boolean }) => void) | undefined
  const media = { matches: true, addEventListener: (_type: string, next: typeof listener) => { listener = next }, removeEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', () => media)
  return { resize: (matches: boolean) => { media.matches = matches; listener?.({ matches }) } }
}

afterEach(() => vi.unstubAllGlobals())

describe('Shell profile shortcut', () => {
  beforeEach(() => {
    currentUser.value = { id: 9, fullName: 'Narin', avatarUrl: 'https://example.test/avatar.png' }
    document.documentElement.dataset.theme = 'dark'
    localStorage.removeItem('ltms-theme')
    logout.mockClear()
  })

  it('navigates independently between Home and Tournaments', () => {
    showShell()
    const home = screen.getByRole('link', { name: 'Home' })
    const tournaments = screen.getByRole('link', { name: 'Tournaments' })
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
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('search', { name: 'Global search' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('ltms-theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'Campus Cup' } })
    fireEvent.submit(screen.getByRole('textbox', { name: 'Search' }).closest('form')!)
    expect(screen.getByText('Other screen')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }))
    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveAttribute('aria-current', 'page')
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
    expect(screen.queryByRole('button', { name: 'Scan' })).not.toBeInTheDocument()
  })

  it('puts Scan in the signed-in top bar', () => {
    showShell()
    expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument()
  })

  it('keeps mobile navigation behind a named menu with current section and Escape focus return', async () => {
    compactViewport()
    const user = userEvent.setup()
    showShell('/team/7')
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
    const menu = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    await user.click(menu)
    const dialog = screen.getByRole('dialog', { name: 'LTMS menu' })
    expect(within(dialog).getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page')
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(menu).toHaveFocus()
  })

  it('closes the mobile menu on Profile navigation and keeps account logout available inside it', async () => {
    compactViewport()
    const user = userEvent.setup()
    showShell()
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    await user.click(within(screen.getByRole('dialog', { name: 'LTMS menu' })).getByRole('link', { name: 'Profile' }))
    expect(screen.getByText('My profile screen')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    await user.click(within(screen.getByRole('dialog', { name: 'LTMS menu' })).getByRole('button', { name: 'Log out' }))
    expect(logout).toHaveBeenCalledOnce()
    expect(screen.getByText('Other screen')).toBeInTheDocument()
  })

  it('preserves the search draft when the viewport changes between mobile and desktop', () => {
    const viewport = compactViewport()
    showShell()
    const input = screen.getByRole('textbox', { name: 'Search' })
    fireEvent.change(input, { target: { value: 'Campus Cup' } })
    act(() => viewport.resize(false))
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('Campus Cup')
    act(() => viewport.resize(true))
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('Campus Cup')
  })

  it('opens the secure Scan flow directly from mobile without opening navigation', () => {
    compactViewport()
    vi.stubGlobal('isSecureContext', true)
    showShell()
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    expect(screen.getByRole('dialog', { name: 'Scan check-in QR' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'LTMS menu' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close Scan' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each(['desktop', 'mobile'])('opens the device camera picker on insecure HTTP from %s', viewport => {
    if (viewport === 'mobile') compactViewport()
    vi.stubGlobal('isSecureContext', false)
    try {
      showShell()
      const input = document.querySelector<HTMLInputElement>('input[type="file"][capture="environment"]')!
      const openCamera = vi.spyOn(input, 'click').mockImplementation(() => {})
      fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
      expect(openCamera).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each([
    ['/team/7', 'Teams'],
    ['/m/9', 'Matches'],
    ['/checkin/9', 'Matches'],
    ['/t/2', 'Tournaments'],
  ])('marks the %s parent section active', (path, label) => {
    showShell(path)
    expect(screen.getByRole('link', { name: label })).toHaveClass('on')
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps the skip control, navigation, search, notifications, and profile in keyboard order', async () => {
    const user = userEvent.setup()
    showShell()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Skip to the main content' })).toHaveFocus()

    const navButtons = within(screen.getByRole('navigation')).getAllByRole('link')
    await user.tab()
    expect(navButtons[0]).toHaveFocus()
    for (let index = 1; index < navButtons.length; index += 1) await user.tab()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus()

    await user.tab()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: /Notifications/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Open my profile' })).toHaveFocus()
  })
})
