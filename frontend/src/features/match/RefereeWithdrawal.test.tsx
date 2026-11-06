import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { mutate, reset } = vi.hoisted(() => ({ mutate: vi.fn(), reset: vi.fn() }))
vi.mock('../../hooks/useAdmin', () => ({ useRequestRefereeWithdrawal: () => ({ mutate, reset, isPending: false, isError: false }) }))
import { RefereeWithdrawal } from './RefereeWithdrawal'
beforeEach(() => { vi.clearAllMocks() })
describe('referee withdrawal scope and consent', () => {
  it('requires a reason and sends only the match scope payload', () => {
    render(<RefereeWithdrawal tournamentId={14} matchId={23} />)
    fireEvent.click(screen.getByRole('button', { name: 'Request withdrawal' }))
    expect(screen.getByRole('button', { name: 'Send withdrawal request' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('เหตุผล (5–500 ตัวอักษร)'), { target: { value: 'Cannot attend this match' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send withdrawal request' }))
    expect(mutate).toHaveBeenCalledWith({ scope: 'match', matchId: 23, reason: 'Cannot attend this match' }, expect.any(Object))
    expect(screen.getByText(/การส่งคำขอยังไม่ถอนคุณออกทันที/)).toBeInTheDocument()
  })
  it('supports a pool referee with no match and sends only tournamentId', () => {
    render(<RefereeWithdrawal tournamentId={14} />)
    fireEvent.click(screen.getByRole('button', { name: 'Request withdrawal' }))
    expect(screen.queryByRole('option', { name: /เฉพาะแมตช์/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('เหตุผล (5–500 ตัวอักษร)'), { target: { value: 'Unable to attend the tournament' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send withdrawal request' }))
    expect(mutate).toHaveBeenCalledWith({ scope: 'tournament', tournamentId: 14, reason: 'Unable to attend the tournament' }, expect.any(Object))
  })
})
