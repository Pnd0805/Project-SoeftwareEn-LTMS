import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tournament } from '../../../shared/types'

const { mutate, reset, detail } = vi.hoisted(() => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  detail: { current: {} as Record<string, unknown> },
}))

vi.mock('../../../hooks/useTournament', () => ({
  useTournament: () => ({ data: detail.current }),
  useEligibilityRules: () => ({ data: { items: [] }, isError: false }),
  useRequestFilterChange: () => ({ mutate, reset, isPending: false, isError: false }),
}))
vi.mock('../../../hooks/useReference', () => ({
  useFaculties: () => ({ data: { items: [{ id: 1, name: 'Engineering' }] } }),
}))

import { EntryRulesPanel } from './EntryRulesPanel'

const tournament = { id: '2', name: 'Campus Cup' } as Tournament

describe('EntryRulesPanel amendment schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    detail.current = {
      registrationOpen: false,
      registrationEnd: '2026-10-05T17:00:00+07:00',
      eventStartDate: '2026-10-05',
      organizingFacultyId: 1,
      genderRequirement: 'any', minAge: null, maxAge: null,
    }
  })

  it('requires an explicit schedule correction and sends it with the hard-filter amendment', () => {
    render(<EntryRulesPanel t={tournament} />)
    fireEvent.click(screen.getByRole('button', { name: 'Request a change' }))

    expect(screen.getByText('The saved schedule prevents every amendment.')).toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'Send to an admin' })
    expect(send).toBeDisabled()

    /* เหตุผลเป็นช่องบังคับของ amendmentRequestSchema (migration 020) — กรอกให้ครบ
       ก่อน ไม่งั้นปุ่มยังปิดอยู่ด้วยเหตุผลคนละข้อกับที่เทสต์นี้ตั้งใจวัด */
    fireEvent.change(screen.getByLabelText(/Why the change is needed/), { target: { value: 'ปีนี้จัดร่วมสองคณะ' } })
    fireEvent.change(screen.getByLabelText('Correct first match date'), { target: { value: '2026-10-06' } })
    expect(send).toBeEnabled()
    fireEvent.click(send)

    expect(mutate).toHaveBeenCalledOnce()
    expect(mutate.mock.calls[0][0].changes).toMatchObject({
      eventStartDate: '2026-10-06',
      eligibilityRules: [],
      genderRequirement: 'any',
    })
  })

  it('does not add a schedule change when the stored schedule is already valid', () => {
    detail.current = { ...detail.current, eventStartDate: '2026-10-06' }
    render(<EntryRulesPanel t={tournament} />)
    fireEvent.click(screen.getByRole('button', { name: 'Request a change' }))
    fireEvent.change(screen.getByLabelText(/Why the change is needed/), { target: { value: 'ปีนี้จัดร่วมสองคณะ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to an admin' }))

    expect(mutate).toHaveBeenCalledOnce()
    expect(mutate.mock.calls[0][0].changes).not.toHaveProperty('eventStartDate')
    /* เหตุผลต้องไปกับคำขอด้วย ไม่ใช่แค่ปลดล็อกปุ่มแล้วหายไป */
    expect(mutate.mock.calls[0][0].reason).toBe('ปีนี้จัดร่วมสองคณะ')
  })
})
