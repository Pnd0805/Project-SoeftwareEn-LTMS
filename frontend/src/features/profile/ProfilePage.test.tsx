import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { State } from '../../shared/types'

const { updateProfile, uploadMock, profileState } = vi.hoisted(() => ({
  updateProfile: vi.fn(), uploadMock: vi.fn(), profileState: { avatarUrl: null as string | null, refetch: vi.fn(), fetching: false, mock: false, fixture: null as State | null },
}))
vi.mock('../../api/upload', async original => ({
  ...await original<typeof import('../../api/upload')>(), uploadImage: uploadMock,
}))

vi.mock('../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  get USE_MOCK() { return profileState.mock },
}))

vi.mock('../../shared/store', () => ({ useLtms: () => profileState.fixture ?? ({ users: [], teams: [], tournaments: [], votes: [] }) }))

vi.mock('../../hooks/useAuth', () => ({
  useMe: () => ({
    data: {
      id: 9, fullName: 'Backend Profile', email: 'profile@example.test', userType: 'student',
      gender: 'male', birthDate: '2004-01-01', facultyId: 2, departmentId: 8,
      year: 3, totalPoints: 17, avatarUrl: profileState.avatarUrl,
    },
    isPending: false,
    isError: false,
  }),
  useUpdateMe: () => ({ mutate: vi.fn(), mutateAsync: updateProfile, isPending: false, isError: false }),
}))

vi.mock('../../hooks/useUser', () => ({
  useUserStats: () => ({ data: profileState.mock ? { overall: { matchesPlayed: 0, wins: 0, championCount: 0 } } : undefined, isPending: false, isError: !profileState.mock, refetch: profileState.refetch, isFetching: profileState.fetching }),
  useFollows: () => ({ data: undefined }),
  useUserCareer: () => ({ data: undefined, isPending: false }),
}))

vi.mock('../../hooks/useTeam', () => ({
  useBackendMyTeams: () => ({ data: { items: [] }, isPending: false, isError: false }),
}))

vi.mock('../../hooks/useReference', () => ({
  useFaculties: () => ({ data: { items: [{ id: 2, name: 'Engineering' }] } }),
  useDepartments: () => ({ data: { items: [{ id: 8, name: 'Software Engineering' }] } }),
  useSportTypes: () => ({ data: { items: [] } }),
}))
vi.mock('../../hooks/useLiveEngagement', () => ({
  usePickemHistory: () => ({ data: { totalPoints: 0, correct: 0, settled: 0, items: [] }, isPending: false, isError: false }),
}))

vi.mock('../player/PlayerPage', () => ({ CareerPanel: () => null }))

import { ProfilePage } from './ProfilePage'
import { SEED } from '../../shared/seed'

beforeEach(() => { profileState.mock = false; profileState.fixture = null })

describe('Profile mock career facts', () => {
  const show = (finishKnown = true, empty = false) => {
    profileState.mock = true
    const fixture = SEED()
    const player = fixture.users.find(user => user.id === 'u-play')!
    player.email = 'profile@example.test'
    const tournament = fixture.tournaments.find(t => t.id === 't-fb')!
    tournament.format = 'roundrobin'
    tournament.champion = finishKnown ? 't-eng' : null
    fixture.matches = empty ? [] : fixture.matches.filter(m => m.tour === tournament.id && m.a && m.b).slice(0, 3)
    fixture.matches.forEach((match, i) => {
      match.a = 't-eng'; match.b = 't-sci'; match.status = 'confirmed'; match.note = ''
      match.sa = i === 2 ? 0 : 2; match.sb = 1
      match.lineup = { 't-eng': { starters: ['u-play'], subs: [] } }
    })
    if (!finishKnown) fixture.registrations = []
    profileState.fixture = fixture
    return render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  }
  it('agrees with the confirmed tournament record instead of zero mock API totals', () => {
    const view = show()
    const stats = view.container.querySelector<HTMLElement>('.statline')!
    expect(within(stats).getByText('Matches played').parentElement).toHaveTextContent('3')
    expect(within(stats).getByText('Won').parentElement).toHaveTextContent('2')
    expect(within(stats).getByText('Titles').parentElement).toHaveTextContent('1')
    const record = screen.getByRole('region', { name: 'My tournament record' })
    expect(within(record).getByText('3')).toBeInTheDocument()
    expect(within(record).getByText('Champion')).toBeInTheDocument()
  })
  it('does not fabricate a title fact with no confirmed career rows', () => {
    const view = show(false, true)
    const stats = view.container.querySelector<HTMLElement>('.statline')!
    expect(within(stats).getByText('Matches played').parentElement).toHaveTextContent('0')
    expect(within(stats).getByText('Titles').parentElement).toHaveTextContent('Unavailable')
  })
})

describe('ProfilePage real-mode boundary', () => {
  it('retries failed stats without replacing loaded account details', () => {
    const view = render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Retry stats' }))
    expect(profileState.refetch).toHaveBeenCalledOnce()
    profileState.fetching = true
    view.rerender(<MemoryRouter><ProfilePage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Retrying stats…' })).toBeDisabled()
    expect(screen.getByText('Backend Profile')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    profileState.fetching = false
  })
  it('keeps /me identity visible without a legacy user when stats fail', () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)

    expect(screen.getByText('Backend Profile')).toBeInTheDocument()
    expect(screen.getByText('profile@example.test')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('Statistics are unavailable')).toBeInTheDocument()
    expect(screen.getByText('Pick\'em history')).toBeInTheDocument()
  })
})

describe('Profile avatar controls', () => {
  beforeEach(() => {
    profileState.avatarUrl = null
    updateProfile.mockReset().mockResolvedValue(undefined)
    uploadMock.mockReset().mockResolvedValue('avatar/9/new-key.png')
  })
  const show = () => render(<MemoryRouter><ProfilePage /></MemoryRouter>)
  const pick = () => fireEvent.change(screen.getByLabelText('Choose profile photo'), {
    target: { files: [new File(['png'], 'photo.png', { type: 'image/png' })] },
  })

  it('saves the object key, never the download URL', async () => {
    show()
    expect(screen.getByLabelText('Choose profile photo')).toHaveAttribute('accept', 'image/png,image/jpeg')
    pick()
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ avatarUrl: 'avatar/9/new-key.png' }))
  })
  it('does not PATCH a key when upload fails', async () => {
    uploadMock.mockRejectedValue({ code: 'UPLOAD_FAILED' })
    show(); pick()
    expect(await screen.findByRole('alert')).toHaveTextContent('อัปโหลดรูปไม่สำเร็จ')
    expect(updateProfile).not.toHaveBeenCalled()
  })
  it('makes a missing storage object actionable', async () => {
    updateProfile.mockRejectedValue({ code: 'AVATAR_KEY_NOT_FOUND' })
    show(); pick()
    expect(await screen.findByRole('alert')).toHaveTextContent('อัปโหลดใหม่')
  })
  it('prevents a second upload while the first is pending', async () => {
    let finish!: (key: string) => void
    uploadMock.mockReturnValue(new Promise<string>(resolve => { finish = resolve }))
    show(); pick()
    expect(screen.getByLabelText('Choose profile photo')).toBeDisabled()
    expect(screen.getByRole('button', { name: /Uploading/ })).toBeDisabled()
    pick()
    expect(uploadMock).toHaveBeenCalledTimes(1)
    finish('avatar/9/new-key.png')
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1))
  })
  it('removes the saved image with null', async () => {
    profileState.avatarUrl = 'https://storage.test/profile.png'
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ avatarUrl: null }))
    expect(uploadMock).not.toHaveBeenCalled()
  })
  it('announces a successful save and clears the receipt when a retry fails', async () => {
    show(); pick()
    expect(await screen.findByRole('status')).toHaveTextContent('Photo saved.')
    updateProfile.mockRejectedValueOnce({ code: 'AVATAR_KEY_NOT_FOUND' })
    pick()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Photo saved.')).not.toBeInTheDocument()
    updateProfile.mockResolvedValueOnce(undefined)
    pick()
    expect(await screen.findByRole('status')).toHaveTextContent('Photo saved.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('shows removal progress, prevents duplicate actions and announces completion', async () => {
    profileState.avatarUrl = 'https://storage.test/profile.png'
    let finish!: () => void
    updateProfile.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve }))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }))
    expect(screen.getByRole('button', { name: 'Removing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Photo' })).toBeDisabled()
    finish()
    expect(await screen.findByRole('status')).toHaveTextContent('Photo removed.')
    expect(updateProfile).toHaveBeenCalledTimes(1)
  })
})
