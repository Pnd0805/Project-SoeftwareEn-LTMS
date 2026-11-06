import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

describe('API avatars', () => {
  it('renders a public URL and recovers after failure and a later URL change', () => {
    const { rerender } = render(<Avatar name="Narin" avatarUrl="https://storage.test/avatar.png" alt="Narin" />)
    fireEvent.error(screen.getByRole('img', { name: 'Narin' }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('N')).toBeInTheDocument()
    rerender(<Avatar name="Narin" avatarUrl="https://storage.test/replacement.png" alt="Narin" />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://storage.test/replacement.png')
  })
  it.each([null, 'avatar/9/key.png', 'javascript:alert(1)'])('uses initials instead of an unusable URL %s', avatarUrl => {
    render(<Avatar name="Narin" avatarUrl={avatarUrl} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('N')).toBeInTheDocument()
  })
})
