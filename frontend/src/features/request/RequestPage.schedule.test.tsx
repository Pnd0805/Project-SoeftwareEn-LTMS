import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('../../hooks/useTournament', () => ({ useCreateTournament: () => ({ mutateAsync: send, isPending: false, isError: false }) }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 7, fullName: 'Organizer', facultyId: 1, userType: 'student' } }) }))
vi.mock('../../hooks/useReference', () => ({
  useSportTypes: () => ({ data: { items: [{ id: 1, name: 'Football' }] } }),
  useFaculties: () => ({ data: { items: [{ id: 1, name: 'Engineering' }] } }),
  useDepartments: () => ({ data: { items: [] } }),
}))
import { RequestPage } from './RequestPage'
beforeEach(() => { send.mockReset().mockResolvedValue({ id: 99, name: 'Campus Cup', status: 'pending_approval', autoApproved: false }) })
const show = () => render(<MemoryRouter><RequestPage /></MemoryRouter>)
const fill = () => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Campus Cup' } })
  fireEvent.change(screen.getByLabelText(/^Organising faculty/), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Default venue'), { target: { value: 'Main Hall' } })
  fireEvent.change(screen.getByLabelText('Entry opens'), { target: { value: '31 Oct 2099, 02:28 (UTC+7)' } })
  fireEvent.change(screen.getByLabelText('Entry closes'), { target: { value: '31 Oct 2099, 14:28 (UTC+7)' } })
  fireEvent.change(screen.getByLabelText('First match date'), { target: { value: '1 Nov 2099' } })
  fireEvent.change(screen.getByLabelText('Last match date'), { target: { value: '2 Nov 2099' } })
}

it('keeps all four formatted fields consistent with the summary and submits the original date/ISO contract', async () => {
  show(); fill()
  expect(screen.getByLabelText('Entry opens')).toHaveValue('31 Oct 2099, 02:28 (UTC+7)')
  const summary = within(screen.getByRole('complementary', { name: 'Request review summary' }))
  expect(summary.getByText('31 Oct 2099, 02:28 (UTC+7) to 31 Oct 2099, 14:28 (UTC+7)')).toBeInTheDocument()
  expect(summary.getByText('1 Nov 2099 to 2 Nov 2099')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Send the request' }))
  await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ registrationStart: '2099-10-31T02:28:00+07:00', registrationEnd: '2099-10-31T14:28:00+07:00', eventStartDate: '2099-11-01', eventEndDate: '2099-11-02' })))
})

it('blocks impossible calendar dates rather than submitting a previous or silently shifted day', async () => {
  show(); fill()
  fireEvent.change(screen.getByLabelText('First match date'), { target: { value: '2099-02-31' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send the request' }))
  await waitFor(() => expect(screen.getByLabelText('First match date')).toHaveAttribute('aria-invalid', 'true'))
  expect(send).not.toHaveBeenCalled()
})
