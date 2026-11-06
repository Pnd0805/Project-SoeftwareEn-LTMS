import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { HomeTaskFeed } from './homeTasks'
import { HomeTaskPanel } from './HomeTaskPanel'

function CurrentPath() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}

describe('HomeTaskPanel', () => {
  it('heads the task list Needs you and follows a task to its direct destination', () => {
    const feed: HomeTaskFeed = {
      source: 'mock',
      label: 'Your tasks',
      state: 'ready',
      retry: vi.fn(),
      tasks: [{
        key: 'match:12',
        source: 'mock',
        label: 'Record result',
        context: 'Campus Cup',
        detail: 'Semi-final 1 · Law vs Science',
        urgency: 'waiting',
        href: '/m/12',
      }],
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <HomeTaskPanel feeds={[feed]} />
        <CurrentPath />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Record result/ }))
    expect(screen.getByTestId('current-path')).toHaveTextContent('/m/12')
  })

  it('keeps every task in a named keyboard-focusable area with an accurate total and urgent work first', () => {
    const tasks: HomeTaskFeed['tasks'] = Array.from({ length: 12 }, (_, index) => ({
      key: `team:${index}`, source: 'team', label: `Review invitation ${index + 1}`,
      context: 'Campus Cup', urgency: index === 11 ? 'urgent' : 'ready', href: `/team/${index + 1}`,
    }))
    const view = render(<MemoryRouter><HomeTaskPanel feeds={[{
      source: 'team', label: 'Team invitations', state: 'ready', retry: vi.fn(), tasks: [...tasks, tasks[0]],
    }]} /></MemoryRouter>)
    expect(screen.getByText('12 tasks')).toBeInTheDocument()
    const area = screen.getByRole('group', { name: 'Your tasks' })
    area.focus()
    expect(area).toHaveFocus()
    const links = within(area).getAllByRole('link')
    expect(links).toHaveLength(12)
    expect(links[0]).toHaveTextContent('Review invitation 12')
    expect(links[0]).toHaveAttribute('href', '/team/12')
    view.rerender(<MemoryRouter><HomeTaskPanel feeds={[{
      source: 'team', label: 'Team invitations', state: 'ready', retry: vi.fn(), tasks: [tasks[0]],
    }]} /></MemoryRouter>)
    expect(screen.getByText('1 task')).toBeInTheDocument()
  })

  it('announces while any task feed is loading', () => {
    const feed: HomeTaskFeed = {
      source: 'team',
      label: 'Team invitations',
      state: 'loading',
      retry: vi.fn(),
      tasks: [],
    }

    render(<MemoryRouter><HomeTaskPanel feeds={[feed]} /></MemoryRouter>)

    expect(screen.getByRole('status')).toHaveTextContent('Loading work…')
    expect(screen.getByRole('region', { name: 'Needs you' })).toHaveAttribute('aria-busy', 'true')
  })

  it('offers tournament discovery when every feed is ready and empty', () => {
    const feed: HomeTaskFeed = {
      source: 'team',
      label: 'Team invitations',
      state: 'ready',
      retry: vi.fn(),
      tasks: [],
    }

    render(<MemoryRouter><HomeTaskPanel feeds={[feed]} /></MemoryRouter>)

    expect(screen.getByText('No tasks right now')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse tournaments' })).toHaveAttribute('href', '#tournaments')
  })

  it('keeps ready tasks visible and retries only failed feeds', () => {
    const failedRetry = vi.fn()
    const readyRetry = vi.fn()
    const failedFeed: HomeTaskFeed = {
      source: 'team',
      label: 'Team invitations',
      state: 'failed',
      retry: failedRetry,
      tasks: [],
    }
    const readyFeed: HomeTaskFeed = {
      source: 'match',
      label: 'Matches',
      state: 'ready',
      retry: readyRetry,
      tasks: [{
        key: 'match:12',
        source: 'match',
        label: 'Record result',
        context: 'Campus Cup',
        urgency: 'waiting',
        href: '/m/12',
      }],
    }

    render(<MemoryRouter><HomeTaskPanel feeds={[failedFeed, readyFeed]} /></MemoryRouter>)

    expect(screen.getByText('Some work could not load')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Record result/ })).toHaveAttribute('href', '/m/12')
    fireEvent.click(screen.getByRole('button', { name: 'Retry Team invitations' }))
    expect(failedRetry).toHaveBeenCalledOnce()
    expect(readyRetry).not.toHaveBeenCalled()
  })

  it('names each retry action after its feed', () => {
    const feeds: HomeTaskFeed[] = ['team', 'match'].map(source => ({
      source: source as 'team' | 'match',
      label: source === 'team' ? 'Team invitations' : 'Matches',
      state: 'failed',
      retry: vi.fn(),
      tasks: [],
    }))

    render(<MemoryRouter><HomeTaskPanel feeds={feeds} /></MemoryRouter>)

    expect(screen.getByRole('button', { name: 'Retry Team invitations' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry Matches' })).toBeInTheDocument()
  })


  it.each([
    ['team', 'Team invitations', 'Team readiness'],
    ['referee', 'Referee invitations', 'Referee requests'],
  ] as const)('distinguishes simultaneous %s failures and isolates each retry', (source, firstLabel, secondLabel) => {
    const firstRetry = vi.fn()
    const secondRetry = vi.fn()
    const feeds: HomeTaskFeed[] = [
      { source, label: firstLabel, state: 'failed', tasks: [], retry: firstRetry },
      { source, label: secondLabel, state: 'failed', tasks: [], retry: secondRetry },
    ]

    render(<MemoryRouter><HomeTaskPanel feeds={feeds} /></MemoryRouter>)

    expect(screen.getByText(firstLabel)).toBeVisible()
    expect(screen.getByText(secondLabel)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: `Retry ${firstLabel}` }))
    expect(firstRetry).toHaveBeenCalledOnce()
    expect(secondRetry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: `Retry ${secondLabel}` }))
    expect(firstRetry).toHaveBeenCalledOnce()
    expect(secondRetry).toHaveBeenCalledOnce()
  })

  it('does not present an all-failed result as an empty task list', () => {
    const feed: HomeTaskFeed = {
      source: 'team',
      label: 'Team invitations',
      state: 'failed',
      retry: vi.fn(),
      tasks: [],
    }

    render(<MemoryRouter><HomeTaskPanel feeds={[feed]} /></MemoryRouter>)

    expect(screen.getByText('Some work could not load')).toBeInTheDocument()
    expect(screen.queryByText('No tasks right now')).not.toBeInTheDocument()
  })
})
