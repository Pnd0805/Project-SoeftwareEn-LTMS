import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextMatchPanel, type UpcomingMatch } from './NextMatchPanel'

const next: UpcomingMatch = {
  id: 42, status: 'scheduled', scheduledTime: '2026-10-06T10:00:00+07:00', venue: 'Court 1',
  teamA: { name: 'Northside FC' }, teamB: { name: 'Southside FC' }, tournament: { name: 'Campus Cup' },
}
function show(matches: UpcomingMatch[] = [next], extra = {}) {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-05T00:00:00+07:00'))
  return render(<MemoryRouter><Routes>
    <Route path="/" element={<NextMatchPanel matches={matches} pending={false} failed={false} onRetry={vi.fn()} {...extra} />} />
    <Route path="/m/:id" element={<h1>Match details</h1>} />
  </Routes></MemoryRouter>)
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('Next match', () => {
  it('shows the nearest confirmed upcoming pair and opens its match', () => {
    show([{ ...next, id: 60, scheduledTime: '2026-10-09T10:00:00+07:00' }, next])
    expect(screen.getByRole('region', { name: 'Next match' })).toBeInTheDocument()
    expect(screen.getByText('Northside FC')).toBeInTheDocument()
    expect(screen.getByText('Southside FC')).toBeInTheDocument()
    expect(screen.getByText('Campus Cup')).toBeInTheDocument()
    expect(screen.getByText('Court 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View match' })).toHaveAttribute('href', '/m/42')
    fireEvent.click(screen.getByRole('link', { name: 'View match' }))
    expect(screen.getByRole('heading', { name: 'Match details' })).toBeInTheDocument()
  })
  it('moves to the following match once the displayed kickoff has passed', () => {
    vi.useFakeTimers()
    show([next, { ...next, id: 60, scheduledTime: '2026-10-07T10:00:00+07:00' }])
    expect(screen.getByRole('link', { name: 'View match' })).toHaveAttribute('href', '/m/42')
    vi.mocked(Date.now).mockReturnValue(Date.parse('2026-10-06T10:01:00+07:00'))
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(screen.getByRole('link', { name: 'View match' })).toHaveAttribute('href', '/m/60')
  })

  it('never promotes past, completed, unpaired or undated matches as next', () => {
    show([
      { ...next, scheduledTime: '2026-10-04T10:00:00+07:00' },
      { ...next, status: 'completed' },
      { ...next, teamB: null },
      { ...next, scheduledTime: null },
      { ...next, scheduledTime: 'invalid' },
    ])
    expect(screen.getByRole('status')).toHaveTextContent('No scheduled match')
    expect(screen.queryByRole('link', { name: 'View match' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View matches' })).toHaveAttribute('href', '/matches')
  })

  it('distinguishes loading and failure from an empty schedule and offers retry', () => {
    const retry = vi.fn()
    const view = show([], { pending: true, onRetry: retry })
    expect(screen.getByRole('status')).toHaveTextContent('Loading next match…')
    expect(screen.queryByText('No scheduled match')).not.toBeInTheDocument()
    view.rerender(<MemoryRouter><NextMatchPanel matches={[]} pending={false} failed onRetry={retry} /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load matches')
    expect(screen.queryByText('No scheduled match')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry matches' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('keeps a known match visible after a failed refresh and labels an unknown venue', () => {
    show([{ ...next, status: 'checkin_open', venue: null }], { failed: true })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Venue not set')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View match' })).toHaveAttribute('href', '/m/42')
  })
})
