/**
 * R10 — จัดกรรมการได้จากหน้าจับสาย รวมถึงนัดรอบหลังที่ยังไม่รู้ว่าใครแข่ง
 *
 * สองข้อที่ต้องไม่หลุด: คำขอที่ยังไม่ตอบต้องไม่ถูกเขียนว่า "คุมนัดนี้แล้ว" และช่องรอบ
 * ถัดไปที่ยังว่างต้องเลือกกรรมการได้ ตราบที่มันมีเวลาเริ่ม/จบแล้ว (FR02)
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  USE_MOCK: false,
}))

const idle = { isPending: false, isError: false, isSuccess: false, error: null, mutate: vi.fn() }
const requestReferee = vi.fn()
const cancelRequest = vi.fn()

const scheduledSlot = {
  id: 31, roundNumber: 2, teamA: null, teamB: null,
  scheduledTime: '2026-11-20T06:00:00.000Z', scheduledEndTime: '2026-11-20T08:00:00.000Z',
  status: 'scheduled',
}
const unscheduledSlot = {
  id: 32, roundNumber: 2, teamA: null, teamB: null,
  scheduledTime: null, scheduledEndTime: null, status: 'scheduled',
}
const firstRound = {
  id: 30, roundNumber: 1,
  teamA: { id: 1, name: 'Engineering' }, teamB: { id: 2, name: 'Science' },
  scheduledTime: '2026-11-20T03:00:00.000Z', scheduledEndTime: '2026-11-20T05:00:00.000Z',
  status: 'scheduled',
}

let matches = [firstRound, scheduledSlot, unscheduledSlot]
let openRequests: unknown[] = []

vi.mock('../../../hooks/useMatch', () => ({
  useTournamentMatches: () => ({ data: { items: matches }, isPending: false, isError: false }),
  useMatchReferees: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useUnassignMatchReferee: () => idle,
}))

vi.mock('../../../hooks/useAdmin', () => ({
  useTournamentReferees: () => ({
    data: {
      items: [
        { id: 34, user: { id: 9002, fullName: 'Somying', avatarUrl: null }, isActive: true },
        { id: 35, user: { id: 9003, fullName: 'Mana', avatarUrl: null }, isActive: true },
      ],
    },
    isPending: false, isError: false,
  }),
  useTournamentRefereeRequests: () => ({ data: { items: openRequests }, isPending: false, isError: false }),
  useRequestMatchReferee: () => ({ ...idle, mutate: requestReferee }),
  useCancelTournamentRefereeRequest: () => ({ ...idle, mutate: cancelRequest }),
}))

import { MatchRefereePlanner } from './MatchRefereePlanner'

beforeEach(() => {
  vi.clearAllMocks()
  matches = [firstRound, scheduledSlot, unscheduledSlot]
  openRequests = []
})

describe('planning referees from the draw', () => {
  it('offers a referee picker for a future slot whose teams are not known yet', () => {
    render(<MatchRefereePlanner tournamentId={23} />)

    const row = screen.getByText('Match 31').closest('tr')!
    expect(within(row).getByText(/both places still to be filled/)).toBeInTheDocument()

    const picker = within(row).getByLabelText('Ask a referee to take match 31')
    fireEvent.change(picker, { target: { value: '35' } })
    expect(requestReferee).toHaveBeenCalledWith({ tournamentRefereeId: 35, matchId: 31 })
  })

  it('sends people to set a time before staffing a slot that has none', () => {
    render(<MatchRefereePlanner tournamentId={23} />)

    const row = screen.getByText('Match 32').closest('tr')!
    expect(within(row).queryByLabelText('Ask a referee to take match 32')).not.toBeInTheDocument()
    expect(within(row).getByText(/Set a kick-off and end time/)).toBeInTheDocument()
  })

  it('never presents an unanswered request as a confirmed assignment', () => {
    openRequests = [{
      id: 91, tournamentId: 23, type: 'org_add_match', requestedBy: 9201,
      refereeA: { tournamentRefereeId: 34, user: { id: 9002, fullName: 'Somying', avatarUrl: null }, status: 'pending' },
      refereeB: null,
      matchA: { id: 30, roundNumber: 1, scheduledTime: null, scheduledEndTime: null },
      matchB: null, status: 'open', createdAt: '2026-09-21T00:00:00.000Z', resolvedAt: null,
    }]
    render(<MatchRefereePlanner tournamentId={23} />)

    const row = screen.getByText('Match 30').closest('tr')!
    expect(within(row).getByText('Waiting for their answer')).toBeInTheDocument()
    expect(within(row).queryByText('Accepted')).not.toBeInTheDocument()

    fireEvent.click(within(row).getByRole('button', { name: 'Cancel' }))
    expect(cancelRequest).toHaveBeenCalledWith(91)
  })

  it('says to draw the bracket first when there are no matches', () => {
    matches = []
    render(<MatchRefereePlanner tournamentId={23} />)
    expect(screen.getByText(/Draw the bracket first/)).toBeInTheDocument()
  })

  /* R17 — คำขอที่ถูกปฏิเสธเคยหายไปทั้งแถว ผู้จัดจึงไม่รู้ว่าใครไม่รับนัดไหน */
  it('keeps a declined request visible against the match it was for', () => {
    openRequests = [
      {
        id: 91, tournamentId: 23, type: 'org_add_match', requestedBy: 9201,
        refereeA: { tournamentRefereeId: 34, user: { id: 9002, fullName: 'Somying', avatarUrl: null }, status: 'declined' },
        refereeB: null,
        matchA: { id: 30, roundNumber: 1, scheduledTime: null, scheduledEndTime: null },
        matchB: null, status: 'declined',
        createdAt: '2026-09-22T00:00:00.000Z', resolvedAt: '2026-09-22T02:00:00.000Z',
      },
      /* คนละนัด — ต้องไม่ไปโผล่ในแถวของ match 30 */
      {
        id: 92, tournamentId: 23, type: 'org_add_match', requestedBy: 9201,
        refereeA: { tournamentRefereeId: 35, user: { id: 9003, fullName: 'Mana', avatarUrl: null }, status: 'declined' },
        refereeB: null,
        matchA: { id: 31, roundNumber: 2, scheduledTime: null, scheduledEndTime: null },
        matchB: null, status: 'declined',
        createdAt: '2026-09-22T00:00:00.000Z', resolvedAt: '2026-09-22T03:00:00.000Z',
      },
    ]
    render(<MatchRefereePlanner tournamentId={23} />)

    /* ช่องกลางคือสถานะ — ช่องขวาเป็น <select> ซึ่งมีชื่อทุกคนอยู่แล้วโดยตั้งใจ
       (ปฏิเสธแล้วยังขอใหม่ได้) จึงต้องเจาะไปที่ช่องสถานะ ไม่ใช่ทั้งแถว */
    const stateCell = (matchId: number) =>
      within(screen.getByText(`Match ${matchId}`).closest('tr')!.querySelectorAll('td')[1] as HTMLElement)

    expect(stateCell(30).getByText('Declined')).toBeInTheDocument()
    expect(stateCell(30).getByText('Somying')).toBeInTheDocument()
    expect(stateCell(30).queryByText('Mana')).not.toBeInTheDocument()
    expect(stateCell(31).getByText('Mana')).toBeInTheDocument()
  })

  it('still lets the organizer ask a referee who declined once', () => {
    openRequests = [{
      id: 91, tournamentId: 23, type: 'org_add_match', requestedBy: 9201,
      refereeA: { tournamentRefereeId: 34, user: { id: 9002, fullName: 'Somying', avatarUrl: null }, status: 'declined' },
      refereeB: null,
      matchA: { id: 31, roundNumber: 2, scheduledTime: null, scheduledEndTime: null },
      matchB: null, status: 'declined',
      createdAt: '2026-09-22T00:00:00.000Z', resolvedAt: '2026-09-22T02:00:00.000Z',
    }]
    render(<MatchRefereePlanner tournamentId={23} />)

    const row = screen.getByText('Match 31').closest('tr')!
    fireEvent.change(within(row).getByLabelText('Ask a referee to take match 31'), { target: { value: '34' } })
    expect(requestReferee).toHaveBeenCalledWith({ tournamentRefereeId: 34, matchId: 31 })
  })
})
