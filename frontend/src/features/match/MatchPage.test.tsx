vi.mock('./RefereeMatchRequest', () => ({ RefereeMatchRequest: () => null }))
/**
 * สิ่งที่คนคนหนึ่งทำกับผลแมตช์ได้ — และสิ่งที่หน้าจอต้องพูดเมื่อทำไม่ได้
 *
 * สามอาการที่ผู้ใช้แจ้งเข้ามา 21 ก.ย. อยู่ในไฟล์นี้ทั้งหมด
 *   R15  กดยืนยันผลแล้วไม่มีอะไรเกิดขึ้น — คำขอเด้งแต่ไม่มีที่แสดง error
 *   R16  ผู้จัดกด "ยกผลทิ้ง" แล้วแมตช์ตัน ไม่มีใครส่งผลใหม่ได้
 *        และก่อนหน้านั้น ปุ่มตัดสินทั้งสามถูก disable เงียบๆ เพราะยังไม่ได้กรอกเหตุผล
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
const finishState = { ...idle, mutate: vi.fn() }
const startState = { ...idle, mutate: vi.fn() }
const submitResult = vi.fn()
const overrideResult = vi.fn()

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
  useOverrideResult: () => ({ ...idle, mutate: overrideResult, mutateAsync: overrideResult }),
  useDisputeResult: () => disputeState,
  useResolveDispute: () => resolveState,
  useSubmitResult: () => ({ ...idle, mutate: submitResult, mutateAsync: submitResult }),
  useSetLivestream: () => ({ ...idle, mutate: vi.fn() }),
  useOpenMatchCheckin: () => ({ ...idle, mutate: vi.fn() }),
  useCloseMatchCheckin: () => ({ ...idle, mutate: vi.fn() }),
  useStartMatch: () => startState,
  useFinishMatch: () => finishState,
  useForfeitMatch: () => ({ ...idle, mutate: vi.fn() }),
  useMatchStats: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useSaveMatchStats: () => ({ ...idle, mutate: vi.fn() }),
  useStatDefinitions: () => ({ data: { items: [] } }),
}))

vi.mock('./MatchWorkflowPanel', () => ({ MatchWorkflowPanel: () => null }))
const meState = vi.hoisted(() => ({ current: { data: undefined as unknown } }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => meState.current }))
const disputeRead = vi.hoisted(() => vi.fn())
vi.mock('../../api/matchWorkflow', () => ({ getMatchDispute: disputeRead }))
vi.mock('../mvp/MvpPage', () => ({ MatchMvpVoting: ({ matchId }: { matchId: number }) => <div>MVP for match {matchId}</div> }))
import { MatchPage } from './MatchPage'

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/m/9']}>
      <Routes><Route path="/m/:id" element={<MatchPage />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>,
)

beforeEach(() => {
  vi.clearAllMocks()
  meState.current = { data: undefined }
  Object.assign(startState, idle)
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

/* R19 — เปิดเช็คอินก่อนจัดนัดครบไม่ได้: พอเปิดแล้วแก้นัดไม่ได้อีก และกรรมการก็ขอไม่ได้ */
describe('opening check-in', () => {
  const asOrganizerOfScheduledMatch = (over: Partial<MatchDto> = {}) => {
    match = baseMatch()
    match.status = 'scheduled'
    match.resultStatus = null
    match.viewer.roles = ['organizer']
    match.viewer.can.openCheckin = true
    Object.assign(match, over)
    result = undefined
  }

  it('will not open check-in while the fixture is incomplete, and names what is missing', () => {
    asOrganizerOfScheduledMatch({ scheduledEndTime: null, venue: null })
    renderPage()

    expect(screen.getByRole('button', { name: 'Open check-in' })).toBeDisabled()
    expect(screen.getByText(/Finish the fixture first/)).toBeInTheDocument()
    expect(screen.getByText(/an end time, a venue/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set the fixture' })).toBeInTheDocument()
  })

  it('opens check-in once kick-off, end time and venue are all set', () => {
    asOrganizerOfScheduledMatch()
    renderPage()

    expect(screen.getByRole('button', { name: 'Open check-in' })).toBeEnabled()
    expect(screen.queryByText(/Finish the fixture first/)).not.toBeInTheDocument()
  })

  /* R20 — ปุ่มอ่านจาก can.openCheckin ที่เดียว วันที่ backend เปิดให้กรรมการกดได้
     จะแก้ที่ mapper บรรทัดเดียว ไม่ต้องตามแก้หน้าจอ */
  it('hides the action from anyone the server would refuse', () => {
    asOrganizerOfScheduledMatch()
    match.viewer.can.openCheckin = false
    match.viewer.roles = ['referee']
    renderPage()

    expect(screen.queryByRole('button', { name: 'Open check-in' })).not.toBeInTheDocument()
  })
})

describe('signing a result off', () => {
  it('shows why a confirmation was refused instead of doing nothing', () => {
    match.status = 'in_progress'
    match.resultStatus = 'submitted'
    match.viewer.can.verifyResult = true
    /* OD-55 — ปุ่มยืนยันดูบทบาทจริงของผู้ดู (หัวหน้าทีมที่ชนะ) ไม่ใช่แค่ธง can */
    match.viewer.roles = ['player']
    match.viewer.isTeamLeader = true
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

/**
 * OD-26 — "จบการแข่งขัน" เป็นขั้นบังคับก่อนส่งผล (รายงาน 29 ก.ย.: สมหญิงกรอกสกอร์แมตช์ 13
 * แล้วได้ "Could not save the result. ต้องกดจบการแข่งขันก่อน" โดยไม่มีปุ่มจบให้กดที่ไหนเลย)
 */
describe('starting a match with possible no-shows', () => {
  beforeEach(() => {
    match.status = 'checkin_open'
    match.resultStatus = null
    result = undefined
  })

  it('warns about immediate walkover and allows cancellation without starting', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Start the match' }))
    expect(startState.mutate).not.toHaveBeenCalled()
    expect(screen.getByText(/Starting can decide a walkover immediately/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(startState.mutate).not.toHaveBeenCalled()
    expect(screen.queryByText(/Starting can decide a walkover immediately/)).not.toBeInTheDocument()
  })

  it('sends the start request only after confirmation', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Start the match' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes — start and check attendance' }))
    expect(startState.mutate).toHaveBeenCalledTimes(1)
  })

  it('explains that both squads being short blocks start and offers recovery', () => {
    startState.isError = true
    startState.error = new ApiError(409, {
      code: 'INSUFFICIENT_CHECKINS', message: 'ทั้งสองทีมมีผู้เล่นเช็คอินไม่ถึงขั้นต่ำ',
    }) as unknown as null
    renderPage()
    expect(screen.getByText(/Both squads are below the minimum/)).toBeInTheDocument()
    expect(screen.getByText(/ask the organizer to reschedule/)).toBeInTheDocument()
  })
})

describe('finishing a match', () => {
  const asRefereeOf = (status: 'in_progress' | 'finished') => {
    match = baseMatch()
    match.status = status
    match.resultStatus = null
    match.viewer.roles = ['referee']
    match.viewer.can.finishMatch = status === 'in_progress'
    match.viewer.can.submitResult = status === 'finished'
    result = undefined
  }

  it('does not hand the referee a result form while the match is still being played', () => {
    asRefereeOf('in_progress')
    renderPage()
    expect(screen.queryByText(/enter the result/)).not.toBeInTheDocument()
    expect(screen.getByText(/result form opens once the match is finished/)).toBeInTheDocument()
  })

  it('finishes only after the referee confirms play has ended', () => {
    asRefereeOf('in_progress')
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Finish the match' }))
    expect(finishState.mutate).not.toHaveBeenCalled()
    expect(screen.getByText(/Finishing cannot be undone/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Yes — the match is over' }))
    expect(finishState.mutate).toHaveBeenCalledTimes(1)
  })

  it('opens the result form once the match is finished', () => {
    asRefereeOf('finished')
    renderPage()
    expect(screen.getByText(/enter the result/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish the match' })).not.toBeInTheDocument()
  })

  it('says the match is being played to someone who cannot finish it', () => {
    asRefereeOf('in_progress')
    match.viewer.roles = ['player']
    match.viewer.can.finishMatch = false
    renderPage()
    expect(screen.queryByRole('button', { name: 'Finish the match' })).not.toBeInTheDocument()
    expect(screen.getByText(/recorded after the referee finishes the match/)).toBeInTheDocument()
  })
})

it('opens MVP directly for the current match without a tournament match selector', () => {
  render(<MemoryRouter initialEntries={['/m/9/mvp']}><Routes><Route path="/m/:id/:tab" element={<MatchPage />} /></Routes></MemoryRouter>)
  expect(screen.getByText('MVP for match 9')).toBeInTheDocument()
  expect(screen.getByText('Vote MVP')).toBeInTheDocument()
  expect(screen.queryByLabelText('MVP match')).not.toBeInTheDocument()
})

/* OD-55 — ผลโหมด online: ใครเขียน อีกฝ่ายรับรอง · กรรมการแก้ผลได้ (S02b) ตอนยังรอยืนยัน */
describe('online results after OD-55', () => {
  beforeEach(() => {
    match.mode = 'online'
    match.status = 'finished'
    match.resultStatus = 'submitted'
  })

  it('gives either team leader - even the losing one - the confirm on a result the referee wrote', () => {
    match.viewer.roles = ['player']
    match.viewer.isTeamLeader = true
    match.viewer.myTeamId = 9028
    result = baseResult({ status: 'submitted', submittedRole: 'referee', winnerTeamId: 9027 })
    renderPage()
    expect(screen.getByRole('button', { name: 'Confirm result' })).toBeInTheDocument()
    expect(screen.getByText(/Either team leader can accept it/)).toBeInTheDocument()
  })

  it('does not offer the referee a confirm on their own result, and says who signs instead', () => {
    result = baseResult({ status: 'submitted', submittedRole: 'referee' })
    renderPage()
    expect(screen.queryByRole('button', { name: 'Confirm result' })).not.toBeInTheDocument()
    expect(screen.getByText(/Waiting on either team leader to confirm/)).toBeInTheDocument()
  })

  it('lets the referee correct a team-submitted score with a reason both teams will read', async () => {
    overrideResult.mockResolvedValue({ id: 5, matchId: 9, status: 'submitted' })
    result = baseResult({ status: 'submitted', submittedRole: 'team_leader' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Correct the result' }))
    fireEvent.change(screen.getByLabelText('Science'), { target: { value: '4' } })
    const save = screen.getByRole('button', { name: 'Save the correction' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/both teams will read this/), { target: { value: 'Real score was 3-4' } })
    fireEvent.click(save)
    await waitFor(() => expect(overrideResult).toHaveBeenCalledWith({
      winnerTeamId: 9028, scoreData: { a: 3, b: 4 }, reason: 'Real score was 3-4',
    }))
    expect(await screen.findByText(/it is not final yet/)).toBeInTheDocument()
  })

  it('does not offer a correction on an on-site match', () => {
    match.mode = 'onsite'
    result = baseResult({ status: 'submitted', submittedRole: 'referee' })
    renderPage()
    expect(screen.queryByRole('button', { name: 'Correct the result' })).not.toBeInTheDocument()
  })
})

/* OD-58 — แอดมินทั้งมหาวิทยาลัยตัดสินได้หลัง 48 ชม. · เปิดแผงเมื่ออ่าน S03b สำเร็จเท่านั้น */
describe('a university-wide admin and a dispute', () => {
  beforeEach(() => {
    match.status = 'disputed'
    match.resultStatus = 'disputed'
    match.viewer.roles = []
    match.viewer.can.resolveDispute = false
    result = baseResult({ status: 'disputed', disputeReason: 'Score was wrong' })
    meState.current = { data: { id: 9001, adminScope: { id: 1, scopeType: 'university_wide', facultyId: null } } }
  })

  it('opens the ruling panel once the dispute can be read', async () => {
    disputeRead.mockResolvedValue({ reason: 'Score was wrong', evidence: [] })
    renderPage()
    expect(await screen.findByRole('button', { name: 'Keep the recorded score' })).toBeInTheDocument()
  })

  it('keeps the panel closed inside the 48 hours, and says when it opens', async () => {
    disputeRead.mockRejectedValue(new ApiError(403, { code: 'NOT_DISPUTE_RESOLVER', message: '' }))
    renderPage()
    expect(await screen.findByText(/can rule on it 48 hours after it was raised/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keep the recorded score' })).not.toBeInTheDocument()
  })
})
