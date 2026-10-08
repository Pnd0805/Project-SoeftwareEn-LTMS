import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendTeamDto } from '../../types/team.dto'

const { uploadMock, update, disband } = vi.hoisted(() => ({ uploadMock: vi.fn(), update: vi.fn(), disband: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/upload', async original => ({ ...await original<typeof import('../../api/upload')>(), uploadImage: uploadMock }))
vi.mock('../../shared/store', () => ({ useLtms: () => ({}) }))
vi.mock('../../hooks/useTeam', () => ({
  useUpdateTeam: () => ({ mutateAsync: update, isPending: false, isError: false }),
  useDisbandTeam: () => ({ isPending: false, isError: false, reset: vi.fn(), mutate: disband }),
  useRequestOfficialStatus: () => ({ isPending: false, isError: false }),
}))
import { TeamManage } from './TeamManage'
const team: BackendTeamDto = {
  id: 7, name: 'QA Team', sportTypeId: 2, readinessStatus: 'Ready', officialStatus: 'Official',
  visibility: 'public', leader: { id: 9, fullName: 'Leader', avatarUrl: null }, memberCount: 5, maxMembers: 12,
  createdAt: '2026-10-01T00:00:00Z', logoUrl: 'https://storage.test/logo.png',
}
beforeEach(() => { disband.mockReset(); update.mockReset().mockResolvedValue(undefined); uploadMock.mockReset().mockResolvedValue('team_logo/7/new-key.png') })
const show = () => render(<MemoryRouter><TeamManage data={team} /></MemoryRouter>)
const pick = () => fireEvent.change(screen.getByLabelText('Choose team logo'), {
  target: { files: [new File(['png'], 'logo.png', { type: 'image/png' })] },
})
describe('team logo controls', () => {
  it('separates routine settings from disbanding and retains the confirmation boundary', () => {
    show()
    const routine = within(screen.getByRole('region', { name: 'Team settings' }))
    const danger = within(screen.getByRole('region', { name: 'Disband team' }))
    expect(routine.getByRole('button', { name: 'Rename' })).toBeEnabled()
    expect(routine.getByRole('button', { name: 'Change logo' })).toBeEnabled()
    expect(routine.getByText('Official — exempt from automatic disabling')).toBeInTheDocument()
    expect(routine.queryByRole('button', { name: 'Disband' })).not.toBeInTheDocument()
    expect(danger.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
    fireEvent.click(danger.getByRole('button', { name: 'Disband' }))
    expect(disband).not.toHaveBeenCalled()
    const confirm = within(screen.getByRole('dialog', { name: 'Disband QA Team?' }))
    expect(confirm.getByText(/Every member loses the squad/)).toBeInTheDocument()
    fireEvent.click(confirm.getByRole('button', { name: 'Disband' }))
    expect(disband).toHaveBeenCalledWith(undefined, expect.any(Object))
  })
  it('uploads for this team and saves logoKey', async () => {
    show(); pick()
    await waitFor(() => expect(update).toHaveBeenCalledWith({ logoKey: 'team_logo/7/new-key.png' }))
    expect(uploadMock).toHaveBeenCalledWith(expect.any(File), 'team_logo', { teamId: 7 })
    expect(screen.getByLabelText('Choose team logo')).toHaveAttribute('accept', 'image/png,image/jpeg')
  })
  it('explains a permission refusal without updating the team', async () => {
    uploadMock.mockRejectedValue({ code: 'NOT_TEAM_LEADER' })
    show(); pick()
    expect(await screen.findByRole('alert')).toHaveTextContent('เฉพาะหัวหน้าทีม')
    expect(update).not.toHaveBeenCalled()
  })
  it('removes a logo with null', async () => {
    show(); fireEvent.click(screen.getByRole('button', { name: 'Remove logo' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith({ logoKey: null }))
    expect(uploadMock).not.toHaveBeenCalled()
  })
})
