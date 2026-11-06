import { setAccessToken } from '../../api/client'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  list: vi.fn(), mine: vi.fn(), applications: vi.fn(), detail: vi.fn(), me: vi.fn(), sports: vi.fn(),
}))

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/tournament', async original => ({
  ...await original<typeof import('../../api/tournament')>(),
  getTournaments: api.list, getMyTournaments: api.mine,
  getMyApplications: api.applications, getTournament: api.detail,
}))
vi.mock('../../api/user', async original => ({ ...await original<typeof import('../../api/user')>(), getMe: api.me }))
vi.mock('../../api/reference', async original => ({ ...await original<typeof import('../../api/reference')>(), getSportTypes: api.sports }))

import { HomePage } from './HomePage'

const cup = { id: 71, name: 'Campus Cup', sportTypeId: 1, venue: 'Main court', eventStartDate: '2027-01-10', registrationOpen: true, status: 'public', registrationStart: '2026-01-01', registrationEnd: '2027-01-01' }

function renderHome(path = '/home/all?source=inbox') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([
    { path: '/home/:tab', element: <HomePage /> },
    { path: '/t/:id/*', element: <h1>Full tournament</h1> },
  ], { initialEntries: [path] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return { client, router, user: userEvent.setup() }
}

describe('Tournament preview from discovery', () => {
  beforeEach(() => {
  setAccessToken("test-token")
    vi.resetAllMocks()
    api.list.mockResolvedValue({ items: [cup] })
    api.mine.mockResolvedValue({ items: [] })
    api.applications.mockResolvedValue({ items: [] })
    api.me.mockResolvedValue(null)
    api.sports.mockResolvedValue({ items: [{ id: 1, name: 'Football', defaultMode: 'onsite' }] })
  })

  it('opens a named preview with the existing full-page destination and preserves other parameters', async () => {
    const { user, router } = renderHome()
    await user.click(await screen.findByRole('button', { name: /Campus Cup/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Campus Cup' })
    expect(within(dialog).getByText('Main court')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Open tournament' })).toHaveAttribute('href', '/t/71')
    expect(new URLSearchParams(router.state.location.search).get('source')).toBe('inbox')
    expect(new URLSearchParams(router.state.location.search).get('preview')).toBe('71')
    await user.click(within(dialog).getByRole('link', { name: 'Open tournament' }))
    expect(await screen.findByRole('heading', { name: 'Full tournament' })).toBeInTheDocument()
  })

  it.each(['Close', 'Escape', 'Back'])('returns focus and keeps discovery filters after %s', async close => {
    const { user, router } = renderHome()
    await screen.findByRole('button', { name: /Campus Cup/ })
    await user.click(await screen.findByRole('button', { name: 'Football' }))
    await user.click(screen.getByRole('tab', { name: 'Open for entry' }))
    const card = screen.getByRole('button', { name: /Campus Cup/ })
    await user.click(card)
    const dialog = await screen.findByRole('dialog', { name: 'Campus Cup' })
    if (close === 'Close') await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    else if (close === 'Escape') await user.keyboard('{Escape}')
    else await act(() => router.navigate(-1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(card).toHaveFocus())
    expect(screen.getByRole('textbox', { name: /Find one/ })).toHaveValue('Football')
    expect(screen.getByRole('button', { name: 'Football' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('tab', { name: 'Open for entry' })).toHaveAttribute('aria-selected', 'true')
    expect(router.state.location.search).toBe('?source=inbox')
  })

  it('does not replace missing real facts with view defaults or inferred lifecycle', async () => {
    api.list.mockResolvedValue({ items: [{ id: 71, name: 'Campus Cup', sportTypeId: 99 }] })
    const { user } = renderHome()
    await user.click(await screen.findByRole('button', { name: /Campus Cup/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Campus Cup' })
    expect(within(dialog).getByText('Sport not available')).toBeInTheDocument()
    for (const label of ['Venue', 'Starts', 'Capacity', 'Visibility', 'Phase', 'Entry']) {
      expect(within(dialog).queryByText(label, { selector: 'dt' })).not.toBeInTheDocument()
    }
    expect(within(dialog).getByText('Details unavailable.')).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent('Public')
    expect(dialog).not.toHaveTextContent('Registration open')
    expect(dialog).not.toHaveTextContent('Finished')
  })

  it('clears an unknown identifier while preserving unrelated parameters without requesting details', async () => {
    const { router } = renderHome('/home/all?source=inbox&preview=999')
    await screen.findByRole('button', { name: /Campus Cup/ })
    await waitFor(() => expect(router.state.location.search).toBe('?source=inbox'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.detail).not.toHaveBeenCalled()
  })

  it('retains a deep-linked selection during initial loading and opens it when its source resolves', async () => {
    let resolveList!: (value: { items: typeof cup[] }) => void
    api.list.mockReturnValue(new Promise(resolve => { resolveList = resolve }))
    const { router } = renderHome('/home/all?source=inbox&preview=71')
    expect(await screen.findByRole('status')).toHaveTextContent('Loading tournaments')
    expect(router.state.location.search).toContain('preview=71')
    await act(async () => { resolveList({ items: [cup] }) })
    expect(await screen.findByRole('dialog', { name: 'Campus Cup' })).toBeInTheDocument()
    expect(api.detail).not.toHaveBeenCalled()
  })

  it('keeps the manager destination and waits for the personal list before resolving a private selection', async () => {
    api.me.mockResolvedValue({ id: 7 })
    api.list.mockResolvedValue({ items: [] })
    let resolveMine!: (value: { items: typeof cup[] }) => void
    api.mine.mockReturnValue(new Promise(resolve => { resolveMine = resolve }))
    const { router } = renderHome('/home/mine?source=inbox&preview=71')
    await waitFor(() => expect(api.mine).toHaveBeenCalled())
    expect(router.state.location.search).toContain('preview=71')
    await act(async () => { resolveMine({ items: [cup] }) })
    const dialog = await screen.findByRole('dialog', { name: 'Campus Cup' })
    expect(within(dialog).getByRole('link', { name: 'Open tournament' })).toHaveAttribute('href', '/t/71/manage')
  })

  it('closes a preview once a refreshed list confirms the selected record was removed', async () => {
    const { client, router, user } = renderHome()
    await user.click(await screen.findByRole('button', { name: /Campus Cup/ }))
    await screen.findByRole('dialog', { name: 'Campus Cup' })
    api.list.mockResolvedValue({ items: [] })
    await act(() => client.invalidateQueries({ queryKey: ['tournaments'] }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.search).toBe('?source=inbox')
    expect(screen.getByText('No tournaments yet')).toBeInTheDocument()
  })

  it.each([401, 403])('closes and removes cached private content after a %s access denial', async status => {
    api.me.mockResolvedValue({ id: 7 })
    api.list.mockResolvedValue({ items: [] })
    api.mine.mockResolvedValue({ items: [cup] })
    const { client, router } = renderHome('/home/mine?source=inbox&preview=71')
    await screen.findByRole('dialog', { name: 'Campus Cup' })
    api.mine.mockRejectedValue(Object.assign(new Error('Access denied'), { status }))
    await act(() => client.invalidateQueries({ queryKey: ['me', 'tournaments'] }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.search).toBe('?source=inbox')
    expect(screen.queryByRole('button', { name: /Campus Cup/ })).not.toBeInTheDocument()
  })

  it('shows supplied facts and keeps manager navigation when the tournament is also public', async () => {
    const knownCup = { ...cup, maxTeams: 16, status: 'public', registrationOpen: false }
    api.me.mockResolvedValue({ id: 7 })
    api.list.mockResolvedValue({ items: [knownCup] })
    api.mine.mockResolvedValue({ items: [knownCup] })
    const { user } = renderHome()
    await user.click(await screen.findByRole('button', { name: /Campus Cup.*You run this/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Campus Cup' })
    expect(within(dialog).getByText('16 teams')).toBeInTheDocument()
    expect(within(dialog).getByText('10 Jan 2027')).toBeInTheDocument()
    expect(within(dialog).getByText('Public')).toBeInTheDocument()
    expect(within(dialog).getByText('Visibility', { selector: 'dt' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Phase', { selector: 'dt' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Closed')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Open tournament' })).toHaveAttribute('href', '/t/71/manage')
  })

  it('keeps browsing category and search context when opening and closing a preview', async () => {
    api.list.mockResolvedValue({ items: [
      { ...cup, registrationOpen: true },
      { ...cup, id: 72, name: 'Other Cup', registrationOpen: false },
    ] })
    const { user, router } = renderHome()
    await user.click(await screen.findByRole('button', { name: 'Open for entry · 1' }))
    expect(router.state.location.pathname).toBe('/home/open')
    expect(router.state.location.search).toBe('?source=inbox')
    await user.type(screen.getByRole('textbox', { name: /Find one/ }), 'Campus')
    const card = screen.getByRole('button', { name: /Campus Cup/ })
    expect(screen.queryByRole('button', { name: /Other Cup/ })).not.toBeInTheDocument()
    await user.click(card)
    await screen.findByRole('dialog', { name: 'Campus Cup' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(card).toHaveFocus())
    expect(router.state.location.pathname).toBe('/home/open')
    expect(screen.getByRole('textbox', { name: /Find one/ })).toHaveValue('Campus')
  })

  it('closes cached public content after access is denied', async () => {
    const { client, user, router } = renderHome()
    await user.click(await screen.findByRole('button', { name: /Campus Cup/ }))
    await screen.findByRole('dialog', { name: 'Campus Cup' })
    api.list.mockRejectedValue(Object.assign(new Error('Access denied'), { status: 403 }))
    await act(() => client.invalidateQueries({ queryKey: ['tournaments'] }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.search).toBe('?source=inbox')
    expect(screen.queryByRole('button', { name: /Campus Cup/ })).not.toBeInTheDocument()
  })

  it('retains the selection through a temporary list failure instead of treating it as removal', async () => {
    const { client, user, router } = renderHome()
    await user.click(await screen.findByRole('button', { name: /Campus Cup/ }))
    await screen.findByRole('dialog', { name: 'Campus Cup' })
    api.list.mockRejectedValue(Object.assign(new Error('Unavailable'), { status: 503 }))
    await act(() => client.invalidateQueries({ queryKey: ['tournaments'] }))
    expect(screen.getByRole('dialog', { name: 'Campus Cup' })).toBeInTheDocument()
    expect(router.state.location.search).toContain('preview=71')
  })
})
