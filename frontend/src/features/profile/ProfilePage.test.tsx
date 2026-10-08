vi.mock('../../hooks/useQaFeatures', () => ({ useNotificationPreferences: () => ({ query: { data: { categories: [] }, isPending: false, isError: false }, save: { isPending: false, isError: false } }) }))
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateProfile, uploadMock, profileState, mockUserState, identityState } = vi.hoisted(() => ({
  identityState: { status: 'approved' },
  updateProfile: vi.fn(),
  uploadMock: vi.fn(),
  profileState: { avatarUrl: null as string | null },
  mockUserState: {
    id: 9,
    fullName: 'Backend Profile',
    email: 'profile@example.test',
    userType: 'student' as 'student' | 'staff' | 'external',
    gender: 'male' as const,
    birthDate: '2004-01-01',
    facultyId: 2 as number | null,
    departmentId: 8 as number | null,
    year: 3 as number | null,
    totalPoints: 17,
  },
}))
vi.mock('../../hooks/useAdmin', () => ({
  useRefereeIdentity: () => ({ data: { status: identityState.status, tournaments: [], docsRequired: false }, isPending: false, isError: false }),
  useSubmitRefereeIdentityDocs: () => ({ isPending: false }),
}))
vi.mock('../../api/upload', async original => ({
  ...await original<typeof import('../../api/upload')>(), uploadImage: uploadMock,
}))

vi.mock('../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))

vi.mock('../../shared/store', () => ({ useLtms: () => ({ users: [], teams: [], tournaments: [], votes: [] }) }))

vi.mock('../../hooks/useAuth', () => ({
  useMe: () => ({
    data: {
      ...mockUserState,
      avatarUrl: profileState.avatarUrl,
    },
    isPending: false,
    isError: false,
  }),
  useUpdateMe: () => ({ mutate: vi.fn(), mutateAsync: updateProfile, isPending: false, isError: false }),
}))

vi.mock('../../hooks/useUser', () => ({
  useUserMatchHistory: () => ({ data: { items: [], statsHidden: false }, isSuccess: true }),
  useUserStats: () => ({ data: undefined, isPending: false, isError: true }),
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

describe('ProfilePage real-mode boundary', () => {
  beforeEach(() => { mockUserState.userType = 'student'; identityState.status = 'approved'; mockUserState.facultyId = 2; mockUserState.departmentId = 8; mockUserState.year = 3 })
  it('shows no invented student data for an external account with null academic fields', () => {
    mockUserState.userType = 'external'; mockUserState.facultyId = null; mockUserState.departmentId = null; mockUserState.year = null
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    expect(screen.getAllByText('Not applicable')).toHaveLength(3)
    expect(screen.queryByText(/#null/)).not.toBeInTheDocument()
    mockUserState.facultyId = 2; mockUserState.departmentId = 8; mockUserState.year = 3
  })
  it('keeps /me identity visible without a legacy user when stats fail', () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)

    expect(screen.getByText('Backend Profile')).toBeInTheDocument()
    expect(screen.getByText('profile@example.test')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('Statistics are unavailable')).toBeInTheDocument()
    expect(screen.getByText('Pick\'em history')).toBeInTheDocument()
  })

  it('displays External (Approve) only after the identity API confirms approval', () => {
    mockUserState.userType = 'external'
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)

    expect(screen.getByText('Backend Profile')).toBeInTheDocument()
    expect(screen.getByText('External (Approve)')).toBeInTheDocument()
    mockUserState.userType = 'student'
  })
  it.each(['none', 'pending', 'needs_docs', 'rejected'])('does not claim approval for identity status %s', status => {
    mockUserState.userType = 'external'; identityState.status = status
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    expect(screen.queryByText('External (Approve)')).not.toBeInTheDocument()
    mockUserState.userType = 'student'
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
})
