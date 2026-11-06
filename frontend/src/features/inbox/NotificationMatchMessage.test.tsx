import { screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { render } from '../../test/renderWithQueryClient'
import { NotificationMatchMessage } from './NotificationMatchMessage'

const { getMatch, getTournament } = vi.hoisted(() => ({ getMatch: vi.fn(), getTournament: vi.fn() }))
vi.mock('../../api/notification', () => ({ getNotificationMatch: getMatch }))
vi.mock('../../api/tournament', () => ({ getTournament }))

beforeEach(() => {
  getMatch.mockReset().mockResolvedValue({ id: 5, tournamentId: 11, teamA: 'วิศวะ A', teamB: 'วิทยา B', round: 2 })
  getTournament.mockReset().mockResolvedValue({ name: 'KU Cup' })
})

it('names historical result/check-in notices and shares reads for the same match', async () => {
  render(<>
    <NotificationMatchMessage userId={7} matchId={5} message="ผลการแข่งขันแมตช์ #5 ถูกส่งแล้ว รอการยืนยัน" />
    <NotificationMatchMessage userId={7} matchId={5} message="แมตช์ #5 เปิดเช็คอินแล้ว" />
    <NotificationMatchMessage userId={7} matchId={5} message="แมตช์ #5 จบการแข่งขันแล้ว" />
  </>)
  expect(await screen.findByText('ผลการแข่งขันแมตช์ “วิศวะ A vs วิทยา B · KU Cup · รอบ 2” ถูกส่งแล้ว รอการยืนยัน')).toBeInTheDocument()
  expect(screen.getByText('แมตช์ “วิศวะ A vs วิทยา B · KU Cup · รอบ 2” เปิดเช็คอินแล้ว')).toBeInTheDocument()
  expect(getMatch).toHaveBeenCalledTimes(1)
  expect(getMatch).toHaveBeenCalledWith(5)
  expect(getTournament).toHaveBeenCalledTimes(1)
  expect(getTournament).toHaveBeenCalledWith(11)
})

it.each([403, 404, 500])('keeps the notice readable when match context fails with %s', async status => {
  getMatch.mockRejectedValue({ status })
  render(<NotificationMatchMessage userId={7} matchId={5} message="แมตช์ #5 จบการแข่งขันแล้ว" />)
  await waitFor(() => expect(getMatch).toHaveBeenCalledTimes(1))
  expect(screen.getByText('แมตช์ #5 จบการแข่งขันแล้ว')).toBeInTheDocument()
  expect(getTournament).not.toHaveBeenCalled()
})

it('retains team names if tournament access fails', async () => {
  getTournament.mockRejectedValue({ status: 403 })
  render(<NotificationMatchMessage userId={7} matchId={5} message="Match #5 has finished" />)
  expect(await screen.findByText('Match “วิศวะ A vs วิทยา B · รอบ 2” has finished')).toBeInTheDocument()
})

it('does not replace a different match ID or mistake #50 for #5', async () => {
  render(<NotificationMatchMessage userId={7} matchId={5} message="แมตช์ #50 และแมตช์ #4" />)
  expect(await screen.findByText('วิศวะ A vs วิทยา B · KU Cup · รอบ 2')).toBeInTheDocument()
  expect(screen.getByText('แมตช์ #50 และแมตช์ #4')).toBeInTheDocument()
})

it('labels an unknown opponent without inventing a team', async () => {
  getMatch.mockResolvedValue({ id: 5, tournamentId: 11, teamA: 'วิศวะ A', teamB: null, round: null })
  render(<NotificationMatchMessage userId={7} matchId={5} message="แมตช์ #5 เปิดเช็คอินแล้ว" />)
  expect(await screen.findByText('แมตช์ “วิศวะ A vs รอระบุทีม · KU Cup” เปิดเช็คอินแล้ว')).toBeInTheDocument()
})
