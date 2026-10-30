vi.mock('../../hooks/useReference', () => ({ useSportTypes: () => ({ data: { items: [{ id: 1, name: 'Unknown sport', supportsBestOf: true }] }, isPending: false, isError: false }) }))
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchDto } from '../../types/match.dto'
import { ApiError } from '../../api/client'

vi.mock('../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))

const updateAsync = vi.fn()
const bulkAssignAsync = vi.fn()
const requestReferee = vi.fn()
let updateError: unknown = null
const updateReset = vi.fn(() => { updateError = null })
const match = {
  id: 23, tournamentId: 5, bracketNodeId: 1, nextMatchId: null, loserNextMatchId: null,
  roundNumber: 2, teamA: null, teamB: null,
  scheduledTime: '2026-10-01T03:00:00.000Z', scheduledEndTime: '2026-10-01T04:00:00.000Z',
  venue: 'Court 1', checkinOpenAt: null, status: 'scheduled', mode: 'onsite',
  createdAt: '2026-09-21T00:00:00.000Z', updatedAt: null,
  tournament: { id: 5, name: 'Campus Cup', championTeamId: null, sportTypeId: 1, sportName: 'Volleyball' },
  stage: 'Semi-final', tag: 'SF1', referees: [], availableReferees: [], roomCode: null,
  checkinToken: null, replayUrl: null, checkedIn: 0, lineupSize: 0, resultStatus: null,
  viewer: {
    roles: ['organizer'], myUserId: 9, myTeamId: null, isTeamLeader: false,
    can: {
      submitResult: false, verifyResult: false, disputeResult: false, resolveDispute: true,
      editFixture: true, recordStats: false, manageCheckin: true, verifyCheckin: false,
      openCheckin: true,
      finishMatch: false,
    },
  },
} as MatchDto

const idleMutation = { isPending: false, isError: false, isSuccess: false, error: null, mutate: vi.fn(), reset: vi.fn() }

vi.mock('../../hooks/useMatch', () => ({
  useMatch: () => ({ data: match, isPending: false, isError: false }),
  useUpdateMatch: () => ({
    ...idleMutation, reset: updateReset, mutateAsync: updateAsync, isError: updateError !== null, error: updateError,
  }),
  useAssignReferees: () => ({ ...idleMutation, mutateAsync: bulkAssignAsync }),
  useMatchReferees: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useUnassignMatchReferee: () => idleMutation,
  useSetMatchFormat: () => ({ ...idleMutation, mutateAsync: vi.fn() }),
  useTournamentMatches: () => ({ data: { items: [] }, isPending: false, isError: false }),
}))

vi.mock('../../hooks/useAdmin', () => ({
  useRefereeCoverage: () => ({ data: { crossTournamentConflicts: [] }, isError: false }),
  useTournamentReferees: () => ({
    data: { items: [{ id: 17, user: { id: 70, fullName: 'Ref One', avatarUrl: null }, isActive: true }] },
    isPending: false, isError: false,
  }),
  useTournamentRefereeRequests: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useRequestMatchReferee: () => ({ ...idleMutation, mutate: requestReferee }),
  useCancelTournamentRefereeRequest: () => idleMutation,
}))

vi.mock('../../hooks/useTournament', () => ({
  useTournament: () => ({
    data: { id: 5, name: 'Campus Cup', eventStartDate: '2026-09-01', eventEndDate: '2026-10-15' },
    isPending: false,
    isError: false,
  }),
}))

import { FixturePage } from './FixturePage'

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/m/23/fixture']}>
    <Routes><Route path="/m/:id/fixture" element={<FixturePage />} /></Routes>
  </MemoryRouter></QueryClientProvider>,
)

beforeEach(() => {
  updateAsync.mockReset().mockResolvedValue(match)
  bulkAssignAsync.mockReset().mockResolvedValue(match)
  requestReferee.mockReset()
  updateError = null
  updateReset.mockClear()
  match.tournament.status = 'public'
  match.tournament.sportName = 'Volleyball'
})

/**
 * 31 ต.ค. 2569 — ขอบวันตามเวลาไทย (ผู้ใช้: "วันที่ 31 ต้อง 7 โมงขึ้นไปถึงนับเป็นวัน 31" — kickoff)
 *   ทัวร์ 2026-09-01 ถึง 2026-10-15 · ค่าที่ใส่เป็นเวลาไทยแบบ ISO (+07:00) ⇒ ผลไม่ขึ้นกับโซนของเครื่องที่รันเทส
 */
describe('fixture dates use Thai calendar days', () => {
  const thai = (iso: string) => new Date(iso).toISOString()
  const setTimes = (kickoffIso: string, endIso: string) => {
    // datetime-local ของเครื่องนี้ — แปลงจากจุดเวลาไทยเป็นเวลาท้องถิ่นของเครื่องที่รันเทส
    const local = (iso: string) => {
      const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    fireEvent.change(screen.getByLabelText('Kick-off'), { target: { value: local(kickoffIso) } })
    fireEvent.change(screen.getByLabelText('End'), { target: { value: local(endIso) } })
    fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }))
  }

  it('accepts a kick-off before 07:00 Thai time on the first tournament day', async () => {
    renderPage()
    setTimes('2026-09-01T06:00:00+07:00', '2026-09-01T06:45:00+07:00')
    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith(expect.objectContaining({ scheduledTime: thai('2026-09-01T06:00:00+07:00') })))
    expect(screen.queryByText(/ขอบเขตการจัดแข่ง/)).not.toBeInTheDocument()
  })

  it('accepts an evening match on the last tournament day', async () => {
    renderPage()
    setTimes('2026-10-15T18:00:00+07:00', '2026-10-15T20:00:00+07:00')
    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith(expect.objectContaining({ scheduledEndTime: thai('2026-10-15T20:00:00+07:00') })))
  })

  it.each([
    ['the night before the first day', '2026-08-31T23:30:00+07:00', '2026-09-01T00:30:00+07:00', /ก่อนวันเริ่มทัวร์นาเมนต์/],
    ['just after midnight following the last day', '2026-10-16T00:10:00+07:00', '2026-10-16T01:00:00+07:00', /เวลาเริ่มต้องไม่อยู่หลังวันสิ้นสุด/],
    ['an end time that runs past the last day', '2026-10-15T23:00:00+07:00', '2026-10-16T00:30:00+07:00', /เวลาจบต้องไม่อยู่หลังวันสิ้นสุด/],
  ])('rejects %s', (_label, kickoff, end, message) => {
    renderPage()
    setTimes(kickoff, end)
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(updateAsync).not.toHaveBeenCalled()
  })
})

describe('real-mode fixture referee consent flow', () => {
  it('keeps a cancelled fixture readable without schedule or assignment writes', () => {
    match.tournament.status = 'cancelled'
    renderPage()
    expect(screen.getByText('Tournament cancelled.')).toBeInTheDocument()
    expect(screen.getByText('Kick-off')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save schedule' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Send request|Assign/ })).not.toBeInTheDocument()
  })
  it('marks only missing request fields from 400 and clears stale errors when the draft changes', () => {
    updateError = new ApiError(400, { code: 'SCHEDULE_INCOMPLETE', message: 'Unrelated text', missing: ['venue', 'venue', 'unknown'] })
    renderPage()
    const venue = screen.getByRole('textbox', { name: 'Venue' })
    expect(venue).toHaveAttribute('aria-invalid', 'true')
    expect(venue).toHaveAccessibleDescription('Venue is required in this schedule request.')
    expect(screen.getByLabelText('Kick-off')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('End')).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText(/The organizer must complete/)).not.toBeInTheDocument()
    fireEvent.change(venue, { target: { value: 'Court 2' } })
    expect(updateReset).toHaveBeenCalledTimes(1)
    expect(venue).not.toHaveAttribute('aria-invalid')
  })

  it.each(['MATCH_NOT_SCHEDULED', 'SCHEDULE_INCOMPLETE'])('never treats a 409 %s as a missing field in the current request', code => {
    updateError = new ApiError(409, { code, message: 'Stored match not ready', missing: ['venue'] })
    renderPage()
    expect(screen.getByRole('textbox', { name: 'Venue' })).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText(/Venue is required in this schedule request/)).not.toBeInTheDocument()
  })

  it('keeps generic form recovery when the 400 response has no missing array', () => {
    updateError = new ApiError(400, { code: 'SCHEDULE_INCOMPLETE', message: 'Unrelated text' })
    renderPage()
    expect(screen.getByText(/Complete the required fields in this schedule form/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save schedule' })).toBeEnabled()
  })

  it('requests one tournament referee without calling the removed bulk assignment route', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Request this match' }))
    expect(requestReferee).toHaveBeenCalledWith({ tournamentRefereeId: 17, matchId: 23 })
    expect(bulkAssignAsync).not.toHaveBeenCalled()
  })

  it('saves start, end and venue independently from referee requests', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }))
    await waitFor(() => expect(updateAsync).toHaveBeenCalledWith(expect.objectContaining({
      scheduledTime: expect.any(String), scheduledEndTime: expect.any(String), venue: 'Court 1',
    })))
    expect(bulkAssignAsync).not.toHaveBeenCalled()
  })

  it('shows the backend scheduling reason and conflicting match instead of a generic failure', () => {
    updateError = new ApiError(409, {
      code: 'SCHEDULE_CONFLICT', message: 'schedule conflict', details: { conflictingMatchId: 91 },
    })

    renderPage()

    expect(screen.getByText(/overlapping fixture \(match #91\)/)).toBeInTheDocument()
  })

  /* R12 — หน้านี้ต้องแก้เวลาและกรรมการได้ตราบที่ M06/FR02 ยังยอม ซึ่งคือแมตช์ที่ยัง
     `scheduled` · เดิมใช้ "ยังไม่มีใครเช็คอิน" ซึ่งเปิดฟอร์มให้แมตช์ที่ปิดไปแล้วด้วย */
  it('locks the form on a match the server will no longer change, and says which state it is in', () => {
    match.status = 'checkin_open'
    try {
      renderPage()
      expect(screen.queryByRole('button', { name: 'Save schedule' })).not.toBeInTheDocument()
      expect(screen.getByText(/only lets the kick-off, venue and match/)).toBeInTheDocument()
      expect(screen.getByText(/Locked — Check-in open/)).toBeInTheDocument()
    } finally {
      match.status = 'scheduled'
    }
  })

  it('does not stop the organizer adding a referee beyond the BR-10 minimum', () => {
    renderPage()
    /* `needed` เป็นขั้นต่ำ ไม่ใช่เพดาน — ปุ่มต้องกดได้เสมอเมื่อแมตช์มีเวลาแล้ว */
    expect(screen.getByRole('button', { name: 'Request this match' })).toBeEnabled()
  })

  it('does not display format selection for non-BO sports like Volleyball', () => {
    match.tournament.sportName = 'Volleyball'
    renderPage()
    expect(screen.queryByLabelText(/Format/)).not.toBeInTheDocument()
  })

  it('saves BO through the server without locking it in localStorage', async () => {
    match.tournament.sportName = 'VALORANT'
    localStorage.clear()
    renderPage()
    const formatSelect = screen.getByLabelText('BO format')
    expect(formatSelect).toBeEnabled()
    for (const n of [1, 3, 5, 7]) expect(screen.getByRole('option', { name: `BO${n}` })).toBeInTheDocument()
    fireEvent.change(formatSelect, { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set for this match' }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(localStorage.getItem(`match_format_${match.id}`)).toBeNull()
    expect(formatSelect).toBeEnabled()
  })
})
