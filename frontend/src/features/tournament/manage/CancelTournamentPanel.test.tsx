import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Tournament } from '../../../shared/types'
const { cancel } = vi.hoisted(() => ({ cancel: vi.fn() }))
vi.mock('../../../api/client', async original => ({ ...await original<typeof import('../../../api/client')>(), USE_MOCK: false }))
vi.mock('../../../api/tournament', async original => ({ ...await original<typeof import('../../../api/tournament')>(), cancelTournament: cancel }))
import { CancelTournamentPanel } from './CancelTournamentPanel'
const t = { id: '42', name: 'Campus Cup', status: 'public', champion: null } as Tournament
function show(tournament = t) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><CancelTournamentPanel t={tournament} /></QueryClientProvider>)
}
beforeEach(() => { cancel.mockReset().mockResolvedValue({ id: 42, status: 'cancelled' }) })
it('requires a nonblank reason and an exact name before sending the trimmed reason', async () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel tournament' }))
  expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument()
  const confirm = screen.getByRole('button', { name: 'Cancel tournament permanently' })
  expect(confirm).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: '   ' } })
  fireEvent.change(screen.getByLabelText('Type the tournament name: Campus Cup'), { target: { value: t.name } })
  fireEvent.submit(confirm.closest('form')!)
  expect(cancel).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: '  Venue unavailable  ' } })
  fireEvent.change(screen.getByLabelText('Type the tournament name: Campus Cup'), { target: { value: 'campus cup' } })
  expect(confirm).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Type the tournament name: Campus Cup'), { target: { value: t.name } })
  fireEvent.click(confirm)
  await waitFor(() => expect(cancel).toHaveBeenCalledWith(42, 'Venue unavailable'))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
it('retains the reason on failure and prevents duplicate requests while pending', async () => {
  let fail!: (error: Error) => void
  cancel.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject }))
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel tournament' }))
  fireEvent.change(screen.getByLabelText('Cancellation reason'), { target: { value: 'Venue unavailable' } })
  fireEvent.change(screen.getByLabelText('Type the tournament name: Campus Cup'), { target: { value: t.name } })
  const form = screen.getByRole('button', { name: 'Cancel tournament permanently' }).closest('form')!
  fireEvent.submit(form); fireEvent.submit(form)
  await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
  fail(new Error('Please retry'))
  await screen.findByText('Please retry')
  expect(screen.getByLabelText('Cancellation reason')).toHaveValue('Venue unavailable')
  expect(screen.getByRole('button', { name: 'Cancel tournament permanently' })).toBeEnabled()
})
it.each(['cancelled', 'pending'] as const)('does not offer cancellation in %s', status => {
  show({ ...t, status })
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
it('does not offer cancellation after completion', () => {
  show({ ...t, champion: 'finished' })
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
