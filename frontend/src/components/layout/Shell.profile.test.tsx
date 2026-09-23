import { fireEvent, render, screen } from '@testing-library/react'
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

function showShell() {
  return render(<MemoryRouter initialEntries={['/']}><Shell>
    <Routes>
      <Route path="/" element={<div>Home screen</div>} />
      <Route path="/me" element={<div>My profile screen</div>} />
    </Routes>
  </Shell></MemoryRouter>)
}

describe('Shell profile shortcut', () => {
  beforeEach(() => {
    currentUser.value = { id: 9, fullName: 'Narin', avatarUrl: 'https://example.test/avatar.png' }
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
})
