import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateProfile, uploadMock, profileState } = vi.hoisted(() => ({
  updateProfile: vi.fn(), uploadMock: vi.fn(), profileState: { avatarUrl: null as string | null },
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
})
