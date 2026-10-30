import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Tournament } from '../../../shared/types'
const { remove, unpublish, applications } = vi.hoisted(() => ({ remove: vi.fn(), unpublish: vi.fn(), applications: vi.fn() }))
vi.mock('../../../api/client', async original => ({ ...await original<typeof import('../../../api/client')>(), USE_MOCK: false }))
vi.mock('../../../api/tournament', async original => ({ ...await original<typeof import('../../../api/tournament')>(),
  deleteTournament: remove, unpublishTournament: unpublish, getTournamentApplications: applications }))
import { DeleteTournamentPanel } from './DeleteTournamentPanel'
const t = { id: '42', name: 'Campus Cup', status: 'public', champion: null, registrationOpen: false, drawn: false } as Tournament
function show(tournament = t) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <MemoryRouter><DeleteTournamentPanel t={tournament} /></MemoryRouter>
  </QueryClientProvider>)
}
beforeEach(() => {
  remove.mockReset().mockResolvedValue(undefined)
  unpublish.mockReset().mockResolvedValue({ id: 42, status: 'private' })
  applications.mockReset().mockResolvedValue({ items: [] })
})
it('takes a public tournament down first, because the server refuses to delete it otherwise', async () => {
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Review deletion' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }))
  await waitFor(() => expect(remove).toHaveBeenCalled())
  expect(remove.mock.calls[0]![0]).toBe(42)
  expect(unpublish.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]!)
})
it('deletes a private tournament without unpublishing', async () => {
  show({ ...t, status: 'private' })
  fireEvent.click(await screen.findByRole('button', { name: 'Review deletion' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }))
  await waitFor(() => expect(remove).toHaveBeenCalled())
  expect(unpublish).not.toHaveBeenCalled()
})
it('keeps a request awaiting approval deletable without reading its organizer-only applications', async () => {
  show({ ...t, status: 'pending' })
  expect(await screen.findByRole('button', { name: 'Review deletion' })).toBeInTheDocument()
  expect(applications).not.toHaveBeenCalled()
})
it.each([
  ['registration is open', { registrationOpen: true }],
  ['the tournament is cancelled', { status: 'cancelled' }],
] as const)('is not offered when %s', async (_label, over) => {
  show({ ...t, ...over } as Tournament)
  await new Promise(resolve => setTimeout(resolve))
  expect(screen.queryByRole('button', { name: 'Review deletion' })).not.toBeInTheDocument()
})
it('is not offered once a squad has applied, or while that is unknown', async () => {
  applications.mockReturnValue(new Promise(() => {}))
  show()
  await waitFor(() => expect(applications).toHaveBeenCalled())
  expect(screen.queryByRole('button', { name: 'Review deletion' })).not.toBeInTheDocument()
})
