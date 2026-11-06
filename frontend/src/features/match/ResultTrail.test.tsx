/**
 * R13 — แมตช์ที่จบด้วยการแพ้บาย/แพ้ทั้งคู่ไม่มีใครต้องเซ็นอะไรอีก
 *
 * รางนี้เคยนับเฉพาะ `verified` ว่า "จบแล้ว" แมตช์ที่ผู้จัดตัดสินว่าไม่มาตามนัด (M17)
 * จึงค้างอยู่ที่ขั้น "รอหัวหน้าทีมที่ชนะยืนยัน" ตลอดไป และขั้น "Bracket updated" ไม่เคย
 * ติ๊ก ทั้งที่ backend เดินสายให้เรียบร้อยตั้งแต่ตอนเขียนใบผลแล้ว
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'
import { ResultTrail } from './ResultTrail'

const match = {
  id: 9, nextMatchId: 12, mode: 'onsite', lineupSize: 10, checkedIn: 2,
} as unknown as MatchDto

const walkover = (winnerTeamId: number | null) => ({
  id: 3, matchId: 9, winnerTeamId, scoreData: {},
  submittedBy: { id: 9001, fullName: 'Organizer', avatarUrl: null }, submittedRole: 'organizer',
  status: 'walkover', disputeReason: null, disputeRaisedBy: null, disputeRaisedAt: null,
  disputeResolvedBy: null, disputeResolution: null, disputeResolvedAt: null,
  verifiedBy: null, verifiedAt: '2026-09-21T10:00:00.000Z',
  amendedBy: null, amendReason: null, amendedAt: null,
  createdAt: '2026-09-21T10:00:00.000Z',
}) as unknown as MatchResultDto

describe('ResultTrail for a match settled without play', () => {
  it('does not park a double forfeit at "waiting on the winning team leader"', () => {
    render(<ResultTrail m={match} result={walkover(null)} />)

    expect(screen.queryByText(/Waiting on the winning team's leader/)).not.toBeInTheDocument()
    expect(screen.getByText('No confirmation needed')).toBeInTheDocument()
    expect(screen.getByText(/Neither squad fielded enough players/)).toBeInTheDocument()
  })

  it('marks the bracket step done and says nobody advances', () => {
    render(<ResultTrail m={match} result={walkover(null)} />)

    expect(screen.getByText('Bracket updated')).toBeInTheDocument()
    expect(screen.getByText(/Nobody advances/)).toBeInTheDocument()
    expect(screen.queryByText(/Runs automatically once both signatures/)).not.toBeInTheDocument()
  })

  it('reads a one-sided walkover as a walkover, not as a played result', () => {
    render(<ResultTrail m={match} result={walkover(9027)} />)

    expect(screen.getByText('Settled without play')).toBeInTheDocument()
    expect(screen.getByText(/the other won by walkover/)).toBeInTheDocument()
    expect(screen.getByText(/The winner moves on to the next match/)).toBeInTheDocument()
  })
})
