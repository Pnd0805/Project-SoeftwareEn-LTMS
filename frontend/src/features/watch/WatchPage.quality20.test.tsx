import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { State } from '../../shared/types'

const state = vi.hoisted(() => ({ mock: true, fixture: null as State | null }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), get USE_MOCK() { return state.mock } }))
vi.mock('../../shared/store', async original => ({ ...await original<typeof import('../../shared/store')>(), useLtms: () => state.fixture }))
import { SEED } from '../../shared/seed'
import { WatchPage } from './WatchPage'

beforeEach(() => { state.mock = true; state.fixture = SEED() })
function show(id = 't-vlr') {
  render(<MemoryRouter initialEntries={[`/watch/${id}`]}><Routes>
    <Route path="/watch/:id" element={<WatchPage />} />
    <Route path="/t/:id/bracket" element={<h1>Bracket destination</h1>} />
    <Route path="/m/:id" element={<h1>Match destination</h1>} />
  </Routes></MemoryRouter>)
}

it('offers a working bracket route when no match is available', () => {
  state.fixture!.matches = []
  show()
  expect(screen.getByText('Nothing to watch yet')).toBeInTheDocument()
  const link = screen.getByRole('link', { name: 'View bracket' })
  expect(link).toHaveAttribute('href', '/t/t-vlr/bracket')
  fireEvent.click(link)
  expect(screen.getByRole('heading', { name: 'Bracket destination' })).toBeInTheDocument()
})

it('offers a working bracket route in real-mode unavailable state', () => {
  state.mock = false
  show('23')
  expect(screen.getByText('Watch is unavailable')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /replay/i })).not.toBeInTheDocument()
  const link = screen.getByRole('link', { name: 'View bracket' })
  expect(link).toHaveAttribute('href', '/t/23/bracket')
  fireEvent.click(link)
  expect(screen.getByRole('heading', { name: 'Bracket destination' })).toBeInTheDocument()
})

it('links to the featured match when video is absent and calls the list recorded matches', () => {
  show()
  expect(screen.getByText('No video available')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Recorded matches' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /replay/i })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Open match' }))
  expect(screen.getByRole('heading', { name: 'Match destination' })).toBeInTheDocument()
})

it('only offers a replay when the match contains a real replay URL', () => {
  const matches = state.fixture!.matches.filter(m => m.tour === 't-vlr' && m.a && m.b && m.note !== 'bye')
  matches[matches.length - 1].replay = 'https://example.test/recorded-match'
  show()
  expect(screen.getByRole('link', { name: 'Watch replay' })).toHaveAttribute('href', 'https://example.test/recorded-match')
})

it('does not turn an invalid real tournament ID into a bracket link', () => {
  state.mock = false; show('invalid')
  expect(screen.getByText('Watch is unavailable')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'View bracket' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Find a tournament' })).toHaveAttribute('href', '/home/all')
})
