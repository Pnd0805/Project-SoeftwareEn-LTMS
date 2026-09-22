import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refetch = vi.fn()
let query = {
  data: undefined as undefined | { rows: never[] },
  isPending: false,
  isError: false,
  error: null as Error | null,
}

vi.mock('../../hooks/useMatch', () => ({
  useStandings: () => ({ ...query, refetch }),
}))

import { LeaderboardTab } from './LeaderboardTab'

beforeEach(() => {
  refetch.mockReset()
  query = { data: undefined, isPending: false, isError: false, error: null }
})

describe('LeaderboardTab failure states', () => {
  it('does not report a backend failure as an empty table and lets the user retry', () => {
    query = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Standings are unavailable'),
    }

    render(<LeaderboardTab tournamentId={17} />)

    expect(screen.getByText("Couldn't load the leaderboard.")).toBeInTheDocument()
    expect(screen.queryByText('No table yet')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('keeps the genuine empty state when standings loaded with no rows', () => {
    query = { data: { rows: [] }, isPending: false, isError: false, error: null }

    render(<LeaderboardTab tournamentId={17} />)

    expect(screen.getByText('No table yet')).toBeInTheDocument()
  })
})
