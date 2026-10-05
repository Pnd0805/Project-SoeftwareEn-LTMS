/**
 * ผู้จัดเชิญตัวเองเป็นกรรมการไม่ได้
 *
 * `docs/spec/02-roles-permissions.md` §7 และมติ 18 ก.ย. ที่ F01 บังคับด้วย
 * `invitee ≠ inviter` → `409 ORGANIZER_CANNOT_BE_REFEREE` · รายชื่อค้นหาเคยคืนตัวผู้จัด
 * เองมาด้วย กดเชิญได้แล้วได้ 409 ดิบ — ปุ่มที่รู้อยู่แล้วว่าพังต้องไม่ถูกแสดง
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { Tournament } from '../../../shared/types'

vi.mock('../../../api/client', async original => ({
  ...await original<typeof import('../../../api/client')>(),
  USE_MOCK: false,
}))
vi.mock('../../../shared/store', async original => ({
  ...await original<typeof import('../../../shared/store')>(),
  useLtms: () => ({ users: [] }),
}))

const ME = 9201
let appointState: { isPending: boolean; isError: boolean; error: unknown; mutate: ReturnType<typeof vi.fn> }

vi.mock('../../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: ME } }) }))
vi.mock('../../../hooks/useUser', () => ({
  useSearchUsers: () => ({
    data: { items: [
      { id: ME, fullName: 'ปกรณ์ ใจดี', avatarUrl: null },
      { id: 9003, fullName: 'มานะ ไร้ทีม', avatarUrl: null },
    ] },
    isFetching: false, isError: false, error: null,
  }),
  usePublicUser: (id?: number) => ({
    data: id === 9003 ? { id: 9003, facultyId: 1, departmentId: 1 } : null,
    isPending: false,
    isError: false,
  }),
}))
vi.mock('../../../hooks/useAdmin', () => ({
  useTournamentReferees: () => ({ data: { items: [] } }),
  useAppointReferee: () => appointState,
  useRemoveReferee: () => ({ isPending: false, isError: false, error: null, mutate: vi.fn() }),
}))

import { RefereeFinder } from './RefereePanel'

const tournament = { id: 23, name: 'QA Cup', channel: 'onsite' } as unknown as Tournament
const renderFinder = () => render(<RefereeFinder t={tournament} open onClose={() => {}} />)

beforeEach(() => {
  appointState = { isPending: false, isError: false, error: null, mutate: vi.fn() }
})

describe('the organizer looking for referees', () => {
  it('is not offered their own account', () => {
    renderFinder()
    expect(screen.queryByText('ปกรณ์ ใจดี')).not.toBeInTheDocument()
    expect(screen.getByText('มานะ ไร้ทีม')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Invite to officiate' })).toHaveLength(1)
  })

  it('reads the refusal in plain words if it still happens', () => {
    appointState.isError = true
    appointState.error = new ApiError(409, {
      code: 'ORGANIZER_CANNOT_BE_REFEREE', message: 'ผู้จัดการแข่งขันเป็นกรรมการของทัวร์นาเมนต์ตัวเองไม่ได้',
    })
    renderFinder()
    expect(screen.getByText(/You organize this tournament, so you cannot also officiate it/)).toBeInTheDocument()
  })

  it('automatically detects internal or external referee designation without manual toggle', () => {
    renderFinder()
    expect(screen.queryByLabelText(/เชิญเป็นกรรมการภายนอก/)).not.toBeInTheDocument()
    expect(screen.getByText(/ระบบจะตรวจจับสถานะกรรมการ \(ภายใน\/ภายนอก\) ให้อัตโนมัติ/)).toBeInTheDocument()
    expect(screen.getByText('Internal')).toBeInTheDocument()
  })
})

