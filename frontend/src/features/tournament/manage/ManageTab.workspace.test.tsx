vi.mock('../../match/RefereeWithdrawal', () => ({ OrganizerWithdrawals: () => null }))
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import type { Tournament } from '../../../shared/types'

vi.mock('../../../api/client', async original => ({ ...await original<typeof import('../../../api/client')>(), USE_MOCK: false }))
vi.mock('../../../shared/store', () => ({ getState: () => ({}), useLtms: () => ({}) }))
vi.mock('../CommunityTab', () => ({ feedbackOf: vi.fn() }))
vi.mock('./SetupTrail', () => ({ SetupTrail: () => <div>Progress content</div> }))
vi.mock('./DeleteTournamentPanel', () => ({ DeleteTournamentPanel: () => null }))
vi.mock('./RegistrationsPanel', () => ({ RegistrationsPanel: () => null }))
vi.mock('./DrawPanel', () => ({ DrawPanel: () => null }))
vi.mock('./RefereePanel', () => ({ RefereePanel: () => null, RefereeFinder: () => null }))
vi.mock('./MatchRefereePlanner', () => ({ MatchRefereePlanner: () => null }))
vi.mock('./LiveFeedbackPanel', () => ({ LiveFeedbackPanel: () => null }))
vi.mock('../../../hooks/useTournament', () => ({
  useSaveEntryNotes: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
  useTournament: () => ({ data: { status: 'published', registrationOpen: false, registrationEnd: '2099-01-01', eventStartDate: '2099-02-01' } }),
  useEligibilityRules: () => ({ data: { items: [] }, isError: false }),
  useRequestFilterChange: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
  useSetEligibilityRules: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
  usePreviewAmendment: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useTournamentAmendmentRequests: () => ({ data: { items: [] }, isPending: false, isError: false }),
}))
vi.mock('../../../hooks/useReference', () => ({ useFaculties: () => ({ data: { items: [] } }) }))
import { ManageTab } from './ManageTab'
const t = { id: '42', name: 'Campus Cup', format: 'single', entryNotes: 'Bring an ID' } as Tournament
function Workspace() {
  const { sub } = useParams()
  return <ManageTab t={t} sub={sub} />
}
it('retains an entry-notes draft through route tab changes and hides the inactive section', async () => {
  const router = createMemoryRouter([{ path: '/t/42/manage/:sub', element: <Workspace /> }], { initialEntries: ['/t/42/manage/entry'] })
  render(<RouterProvider router={router} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit entry notes' }))
  fireEvent.change(screen.getByLabelText(/Entry notes \(up to/), { target: { value: 'Bring a student card and consent form' } })
  await act(async () => { await router.navigate('/t/42/manage/progress') })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Edit entry notes' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Entry & filter' }))
  expect(screen.getByLabelText(/Entry notes \(up to/)).toHaveValue('Bring a student card and consent form')
})
