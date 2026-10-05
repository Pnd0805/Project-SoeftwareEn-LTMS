import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { HomeWorkspace } from './HomeWorkspace'

const data = { items: [{
  id: 42, status: 'scheduled' as const, scheduledTime: '2099-10-06T10:00:00+07:00', venue: 'Court 1',
  teamA: { name: 'Northside FC' }, teamB: { name: 'Southside FC' }, tournament: { name: 'Campus Cup' },
}] }

describe('Home workspace', () => {
  it('shows tasks and match preparation together without losing task destinations', () => {
    render(<MemoryRouter><HomeWorkspace feeds={[{ source: 'team', label: 'Team invitations', state: 'ready', retry: vi.fn(),
      tasks: [{ key: 'invite:9', source: 'team', label: 'Review invitation', context: 'Northside FC', urgency: 'waiting', href: '/team/9' }],
    }]} matches={{ data, isPending: false, isError: false, refetch: vi.fn() }} /></MemoryRouter>)
    expect(screen.getByRole('region', { name: 'Needs you' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Next match' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review invitation/ })).toHaveAttribute('href', '/team/9')
    expect(screen.getByRole('link', { name: 'View match' })).toHaveAttribute('href', '/m/42')
  })

  it.each([401, 403])('hides the cached match after a %s access failure', status => {
    render(<MemoryRouter><HomeWorkspace feeds={[]} matches={{ data, isPending: false, isError: true,
      error: { status }, refetch: vi.fn(),
    }} /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load matches')
    expect(screen.queryByText('Campus Cup')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View match' })).not.toBeInTheDocument()
  })
})
