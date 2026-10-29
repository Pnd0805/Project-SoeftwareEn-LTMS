import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tournament } from '../../../shared/types'

const { mutate, reset, setRules, detail, preview } = vi.hoisted(() => ({
  preview: vi.fn(),
  mutate: vi.fn(),
  reset: vi.fn(),
  setRules: vi.fn(),
  detail: { current: {} as Record<string, unknown> },
}))

vi.mock('../../../hooks/useTournament', () => ({
  useSaveEntryNotes: () => ({ mutate: setRules, reset, isPending: false, isError: false }),
  useTournament: () => ({ data: detail.current }),
  useEligibilityRules: () => ({ data: { items: [] }, isError: false }),
  useRequestFilterChange: () => ({ mutate, reset, isPending: false, isError: false }),
  usePreviewAmendment: () => useMutation({ mutationFn: preview }),
  useSetEligibilityRules: () => ({ mutate: setRules, reset, isPending: false, isError: false }),
  useTournamentAmendmentRequests: () => ({ data: { items: [] }, isPending: false, isError: false }),
}))
vi.mock('../../../hooks/useReference', () => ({
  useFaculties: () => ({ data: { items: [{ id: 1, name: 'Engineering' }] } }),
}))

import { EntryRulesPanel } from './EntryRulesPanel'

const tournament = { id: '2', name: 'Campus Cup' } as Tournament
const renderPanel = (t = tournament) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><EntryRulesPanel t={t} /></QueryClientProvider>)
const checkPreview = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Preview impact' }))
  await screen.findByText('No blocking impact found. The server will check again when you send this request.')
}

describe('EntryRulesPanel amendment schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preview.mockResolvedValue({ canSubmit: true, blockers: [], pendingAmendmentId: null })
    detail.current = {
      registrationOpen: false,
      registrationEnd: '2026-10-05T17:00:00+07:00',
      eventStartDate: '2026-10-05',
      organizingFacultyId: 1,
      genderRequirement: 'any', minAge: null, maxAge: null,
    }
  })

  it('requires an explicit schedule correction and previews the same hard-filter amendment before sending', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Request a change' }))

    expect(screen.getByText('The saved schedule prevents every amendment.')).toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'Send to an admin' })
    expect(send).toBeDisabled()

    /* เหตุผลเป็นช่องบังคับของ amendmentRequestSchema (migration 020) — กรอกให้ครบ
       ก่อน ไม่งั้นปุ่มยังปิดอยู่ด้วยเหตุผลคนละข้อกับที่เทสต์นี้ตั้งใจวัด */
    fireEvent.change(screen.getByLabelText(/Why the change is needed/), { target: { value: 'ปีนี้จัดร่วมสองคณะ' } })
    fireEvent.change(screen.getByLabelText('Correct first match date'), { target: { value: '2026-10-06' } })
    expect(send).toBeDisabled()
    await checkPreview()
    expect(send).toBeEnabled()
    fireEvent.click(send)

    expect(mutate).toHaveBeenCalledOnce()
    expect(mutate.mock.calls[0][0].changes).toMatchObject({
      eventStartDate: '2026-10-06',
      eligibilityRules: [],
      genderRequirement: 'any',
    })
  })

  it('does not add a schedule change when the stored schedule is already valid', async () => {
    detail.current = { ...detail.current, eventStartDate: '2026-10-06' }
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Request a change' }))
    fireEvent.change(screen.getByLabelText(/Why the change is needed/), { target: { value: 'ปีนี้จัดร่วมสองคณะ' } })
    await checkPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Send to an admin' }))

    expect(mutate).toHaveBeenCalledOnce()
    expect(mutate.mock.calls[0][0].changes).not.toHaveProperty('eventStartDate')
    /* เหตุผลต้องไปกับคำขอด้วย ไม่ใช่แค่ปลดล็อกปุ่มแล้วหายไป */
    expect(mutate.mock.calls[0][0].reason).toBe('ปีนี้จัดร่วมสองคณะ')
  })

  it('saves faculty/year conditions directly while the tournament is pending approval', () => {
    detail.current = { ...detail.current, status: 'pending_approval' }
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Correct conditions' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Engineering' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save conditions' }))

    expect(setRules).toHaveBeenCalledWith([{ type: 'faculty', value: 1 }], expect.any(Object))
    expect(mutate).not.toHaveBeenCalled()
    expect(preview).not.toHaveBeenCalled()
  })

  it('invalidates a successful preview when the draft changes and never writes during preview', async () => {
    detail.current = { ...detail.current, eventStartDate: '2026-10-06' }
    renderPanel(); fireEvent.click(screen.getByRole('button', { name: 'Request a change' }))
    fireEvent.change(screen.getByLabelText(/Why the change is needed/), { target: { value: 'First draft' } })
    await checkPreview()
    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send to an admin' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Minimum age'), { target: { value: '18' } })
    expect(screen.getByRole('button', { name: 'Send to an admin' })).toBeDisabled()
    await checkPreview()
    expect(preview.mock.calls[1][0].changes.minAge).toBe(18)
    fireEvent.click(screen.getByRole('button', { name: 'Send to an admin' }))
    expect(mutate.mock.calls[0][0].changes).toEqual(preview.mock.calls[1][0].changes)
  })

  it('shows every blocker and the separate pending request, and blocks submission', async () => {
    detail.current = { ...detail.current, eventStartDate: '2026-10-06' }
    preview.mockResolvedValue({ canSubmit: false, pendingAmendmentId: 73, blockers: [
      { code: 'AMENDMENT_BREAKS_APPROVED_TEAMS', message: 'Players would be excluded', details: { affectedTeamCount: 1, affectedTeams: [{ teamId: 3, teamName: 'Alpha', players: [{ userId: 9, fullName: 'Alice', reason: 'age' }] }] } },
      { code: 'ANOTHER_BLOCKER', message: 'Another reason', details: null },
    ] })
    renderPanel(); fireEvent.click(screen.getByRole('button', { name: 'Request a change' }))
    fireEvent.change(screen.getByLabelText(/Why the change is needed/), { target: { value: 'Change rules' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview impact' }))
    await screen.findByText('Affected approved teams: 1')
    expect(screen.getByText('Alice · age')).toBeInTheDocument()
    expect(screen.getByText('Another reason')).toBeInTheDocument()
    expect(screen.getByText(/Amendment #73 is still pending/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send to an admin' })).toBeDisabled()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('does not permit submission when preview cannot be read', async () => {
    detail.current = { ...detail.current, eventStartDate: '2026-10-06' }
    preview.mockRejectedValue(new Error('Preview unavailable'))
    renderPanel(); fireEvent.click(screen.getByRole('button', { name: 'Request a change' }))
    fireEvent.change(screen.getByLabelText(/Why the change is needed/), { target: { value: 'Change rules' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview impact' }))
    await screen.findByText(/Could not check impact/)
    expect(screen.getByRole('button', { name: 'Send to an admin' })).toBeDisabled()
    expect(mutate).not.toHaveBeenCalled()
  })
})

 it('publishes soft notes without sending a hard-filter amendment', () => {
   vi.clearAllMocks()
   renderPanel({ ...tournament, entryNotes: 'Bring an ID' })
   expect(screen.getByText('Bring an ID')).toBeInTheDocument()
   fireEvent.click(screen.getByRole('button', { name: 'Edit entry notes' }))
   const input = screen.getByLabelText(/Entry notes \(up to/)
   expect(input).toHaveAttribute('maxlength', '2000')
   fireEvent.change(input, { target: { value: 'Bring a student ID' } })
   fireEvent.click(screen.getByRole('button', { name: 'Save entry notes' }))
   expect(setRules).toHaveBeenCalledWith('Bring a student ID', expect.any(Object))
   expect(mutate).not.toHaveBeenCalled()
 })
