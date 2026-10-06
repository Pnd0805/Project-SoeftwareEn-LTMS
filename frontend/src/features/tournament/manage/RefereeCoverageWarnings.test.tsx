import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ coverage: {} as Record<string, unknown>, pool: {} as Record<string, unknown>, matches: {} as Record<string, unknown>, retry: vi.fn() }))
vi.mock('../../../hooks/useAdmin', () => ({
  useRefereeCoverage: () => state.coverage,
  useTournamentReferees: () => state.pool,
}))
vi.mock('../../../hooks/useMatch', () => ({ useTournamentMatches: () => state.matches }))
import { RefereeCoverageWarnings } from './RefereeCoverageWarnings'

const show = (matchId?: number) => render(<MemoryRouter><RefereeCoverageWarnings tournamentId={5} matchId={matchId} /></MemoryRouter>)
beforeEach(() => {
  state.retry.mockReset()
  state.coverage = { data: { crossTournamentConflicts: [
    { userId: 70, matchId: 41, conflictCount: 2 }, { userId: 70, matchId: 42, conflictCount: 1 },
  ] }, isError: false, refetch: state.retry }
  state.pool = { data: { items: [{ user: { id: 70, fullName: 'Ref One' } }] }, isError: false, refetch: state.retry }
  state.matches = { data: { items: [{ id: 41, roundNumber: 2, scheduledTime: '2026-10-07T03:00:00Z', scheduledEndTime: '2026-10-07T04:30:00Z' }] }, isError: false, refetch: state.retry }
})
it('shows each local match separately with a name, count, Bangkok time and actionable links', () => {
  show()
  expect(screen.getAllByText('Ref One')).toHaveLength(2)
  expect(screen.getByText(/ทับอยู่ 2 แมตช์/)).toBeInTheDocument()
  expect(screen.getByText(/รอบ 2.*10:00.*11:30/)).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'เลื่อนเวลาแมตช์' }).map(a => a.getAttribute('href'))).toEqual(['/m/41/fixture', '/m/42/fixture'])
  expect(screen.getAllByRole('link', { name: 'เปลี่ยนกรรมการ' })[0]).toHaveAttribute('href', '/m/41/fixture#referee-assignments')
  expect(screen.getByText(/ไม่บล็อกการจัดตาราง/)).toBeInTheDocument()
})
it('limits the fixture warning to that match', () => {
  show(42)
  expect(screen.queryByText(/แมตช์ #41/)).not.toBeInTheDocument()
  expect(screen.getByText(/แมตช์ #42/)).toBeInTheDocument()
})
it('removes warnings when a refreshed response has no conflict', () => {
  const view = show()
  state.coverage = { data: { crossTournamentConflicts: [] }, isError: false }
  view.rerender(<MemoryRouter><RefereeCoverageWarnings tournamentId={5} /></MemoryRouter>)
  expect(screen.queryByText('กรรมการมีงานนอกทัวร์นี้ทับเวลา')).not.toBeInTheDocument()
})
it('keeps warnings visible by ID when enrichment fails and offers retry', () => {
  state.pool = { isError: true, refetch: state.retry }
  state.matches = { isError: true, refetch: state.retry }
  show()
  expect(screen.getAllByText('กรรมการ #70')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Retry details' }))
  expect(state.retry).toHaveBeenCalledTimes(2)
})
it('shows a required-read error and retries instead of implying no conflicts', () => {
  state.coverage = { isError: true, error: new Error('Forbidden'), refetch: state.retry }
  show()
  expect(screen.getByText('ตรวจตารางกรรมการไม่สำเร็จ')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(state.retry).toHaveBeenCalledOnce()
})
it('shows the pending read explicitly', () => {
  state.coverage = { isError: false }
  show()
  expect(screen.getByText('กำลังตรวจตารางกรรมการ…')).toBeInTheDocument()
})
