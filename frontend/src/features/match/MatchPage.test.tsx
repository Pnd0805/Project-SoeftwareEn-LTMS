/**
 * สิ่งที่คนคนหนึ่งทำกับผลแมตช์ได้ — และสิ่งที่หน้าจอต้องพูดเมื่อทำไม่ได้
 *
 * สามอาการที่ผู้ใช้แจ้งเข้ามา 21 ก.ย. อยู่ในไฟล์นี้ทั้งหมด
 *   R15  กดยืนยันผลแล้วไม่มีอะไรเกิดขึ้น — คำขอเด้งแต่ไม่มีที่แสดง error
 *   R16  ผู้จัดกด "ยกผลทิ้ง" แล้วแมตช์ตัน ไม่มีใครส่งผลใหม่ได้
 *        และก่อนหน้านั้น ปุ่มตัดสินทั้งสามถูก disable เงียบๆ เพราะยังไม่ได้กรอกเหตุผล
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { MatchDto, MatchResultDto } from '../../types/match.dto'

vi.mock('../../api/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))

const idle = { isPending: false, isError: false, isSuccess: false, data: undefined, error: null }
const verifyState = { ...idle, mutate: vi.fn() }
const disputeState = { ...idle, mutate: vi.fn() }
const resolveState = { ...idle, mutate: vi.fn() }
const submitResult = vi.fn()

let match: MatchDto
let result: MatchResultDto | undefined

const team = (id: number, name: string) =>
  ({ id, name, code: name.slice(0, 3), color: null, logoUrl: null, players: [] })

const baseMatch = (): MatchDto => ({
  id: 9, tournamentId: 20, bracketNodeId: null, nextMatchId: null, loserNextMatchId: null,
  roundNumber: 1, teamA: team(9027, 'Engineering'), teamB: team(9028, 'Science'),
  scheduledTime: '2026-10-25T08:00:00.000Z', scheduledEndTime: '2026-10-25T10:00:00.000Z',
  venue: 'Gym 2', checkinOpenAt: null, status: 'result_rejected', mode: 'onsite',
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: null, livestreamUrl: null,
  tournament: { id: 20, name: 'Special Cup', championTeamId: null, sportTypeId: 2, sportName: 'Basketball' },
  stage: 'Round 1', tag: 'R1', referees: [], availableReferees: [], roomCode: null,
  checkinToken: null, replayUrl: null, checkedIn: 0, lineupSize: 0, resultStatus: 'rejected',
  score: null, outcome: null,
  viewer: {
    roles: ['referee'], myUserId: 9002, myTeamId: null, isTeamLeader: false,
    can: {
      submitResult: true, verifyResult: false, disputeResult: false, resolveDispute: true,
      editFixture: false, recordStats: true, manageCheckin: true, verifyCheckin: true,
    },
  },
}) as unknown as MatchDto

const baseResult = (over: Partial<MatchResultDto> = {}): MatchResultDto => ({
  id: 5, matchId: 9, winnerTeamId: 9027, scoreData: { a: 3, b: 2, '9027': 3, '9028': 2 },
  submittedBy: { id: 9002, fullName: 'Referee One', avatarUrl: null }, submittedRole: 'referee',
  status: 'rejected', disputeReason: null, disputeRaisedBy: null, disputeRaisedAt: null,
  disputeResolvedBy: null, disputeResolution: 'Score sheet did not match', disputeResolvedAt: null,
  verifiedBy: null, verifiedAt: null, amendedBy: null, amendReason: null, amendedAt: null,
  createdAt: '2026-09-21T00:00:00.000Z',
  ...over,
}) as unknown as MatchResultDto

vi.mock('../../hooks/useMatch', () => ({
  useMatch: () => ({ data: match, isPending: false, isError: false }),
  useResult: () => ({ data: result }),
  useVerifyResult: () => verifyState,
  useDisputeResult: () => disputeState,
  useResolveDispute: () => resolveState,
  useSubmitResult: () => ({ ...idle, mutate: submitResult, mutateAsync: submitResult }),
  useSetLivestream: () => ({ ...idle, mutate: vi.fn() }),
  useOpenMatchCheckin: () => ({ ...idle, mutate: vi.fn() }),
  useCloseMatchCheckin: () => ({ ...idle, mutate: vi.fn() }),
  useStartMatch: () => ({ ...idle, mutate: vi.fn() }),
  useForfeitMatch: () => ({ ...idle, mutate: vi.fn() }),
  useMatchStats: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useSaveMatchStats: () => ({ ...idle, mutate: vi.fn() }),
  useStatDefinitions: () => ({ data: { items: [] } }),
}))

import { MatchPage } from './MatchPage'

const renderPage = () => render(
  <MemoryRouter initialEntries={['/m/9']}>
    <Routes><Route path="/m/:id" element={<MatchPage />} /></Routes>
  </MemoryRouter>,
)

beforeEach(() => {
  vi.clearAllMocks()
  match = baseMatch()
  result = baseResult()
})

describe('a result the organizer threw out', () => {
  it('says what happened instead of claiming nothing was ever recorded', () => {
    renderPage()
    expect(screen.getByText(/The organizer threw this result out/)).toBeInTheDocument()
    expect(screen.getByText('Result thrown out')).toBeInTheDocument()
    expect(screen.queryByText(/No result recorded yet/)).not.toBeInTheDocument()
  })

  it('leaves the match open for a fresh result rather than dead-ending', () => {
    renderPage()
    /* ResultForm ของโหมดจริงมีช่องกรอกสกอร์ของสองทีม — มีแปลว่ายังส่งผลใหม่ได้ */
    expect(screen.getByText(/Record the match again/)).toBeInTheDocument()
  })

  it('stops showing the thrown-out score as if it were the match score', () => {
    renderPage()
    expect(screen.queryByText('3')).not.toBeInTheDocument()
  })

  it('tells a viewer who cannot record it who they are waiting on', () => {
    match.viewer.can.submitResult = false
    renderPage()
    expect(screen.getByText(/Waiting on the referee to record it again/)).toBeInTheDocument()
  })
})

describe('signing a result off', () => {
  it('shows why a confirmation was refused instead of doing nothing', () => {
    match.status = 'in_progress'
    match.resultStatus = 'submitted'
    match.viewer.can.verifyResult = true
    match.viewer.myTeamId = 9027
    result = baseResult({ status: 'submitted' })
    verifyState.isError = true
    verifyState.error = new ApiError(403, {
      code: 'SAME_PERSON_CANNOT_VERIFY', message: 'ผู้ยืนยันต้องไม่ใช่คนเดียวกับผู้ส่งผล',
    }) as unknown as null
    try {
      renderPage()
      expect(screen.getByText(/That confirmation did not go through/)).toBeInTheDocument()
      expect(screen.getByText(/cannot both record and confirm/)).toBeInTheDocument()
    } finally {
      verifyState.isError = false
      verifyState.error = null
    }
  })
})

describe('resolving a dispute', () => {
  beforeEach(() => {
    match.status = 'disputed'
    match.resultStatus = 'disputed'
    result = baseResult({ status: 'disputed', disputeReason: 'Score was wrong' })
  })

  it('says the reason is what is holding the three decisions closed', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Keep the recorded score' })).toBeDisabled()
    expect(screen.getByText(/Write the reason first/)).toBeInTheDocument()
  })

  it('opens every decision once a reason is written', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/Why — both squads see this/), {
      target: { value: 'Checked the score sheet' },
    })
    expect(screen.getByRole('button', { name: 'Keep the recorded score' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Throw the result out' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Record this score as final' })).toBeEnabled()
    expect(screen.queryByText(/Write the reason first/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Throw the result out' }))
    expect(resolveState.mutate).toHaveBeenCalledWith({
      decision: 'reject', resolution: 'Checked the score sheet',
    })
  })
})
