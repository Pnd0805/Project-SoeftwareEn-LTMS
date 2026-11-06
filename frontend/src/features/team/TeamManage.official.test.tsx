import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendTeamDto } from '../../types/team.dto'

/**
 * 30 ต.ค. 2569 — เอกสารคำขอทีม Official เปลี่ยนจาก "พิมพ์ข้อความ" เป็น "อัปโหลดไฟล์"
 * เดิมคิวแอดมินเซ็นทุกบรรทัดเป็นลิงก์ไฟล์ ⇒ แอดมินเปิดเอกสารไม่ได้ทุกใบ
 */
const { uploadDoc, request } = vi.hoisted(() => ({ uploadDoc: vi.fn(), request: vi.fn() }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/upload', async original => ({ ...await original<typeof import('../../api/upload')>(), uploadTeamOfficialDocument: uploadDoc }))
vi.mock('../../shared/store', () => ({ useLtms: () => ({}) }))
vi.mock('../../hooks/useTeam', () => ({
  useUpdateTeam: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, reset: vi.fn() }),
  useDisbandTeam: () => ({ isPending: false, isError: false, reset: vi.fn(), mutate: vi.fn() }),
  useRequestOfficialStatus: () => ({ mutateAsync: request, isPending: false, isError: false, reset: vi.fn() }),
}))
import { TeamManage } from './TeamManage'

const team: BackendTeamDto = {
  id: 7, name: 'QA Team', sportTypeId: 2, readinessStatus: 'Ready', officialStatus: 'Unofficial',
  visibility: 'public', leader: { id: 9, fullName: 'Leader', avatarUrl: null }, memberCount: 5, maxMembers: 12,
  createdAt: '2026-10-01T00:00:00Z', logoUrl: null,
}
const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf' })

beforeEach(() => {
  uploadDoc.mockReset().mockImplementation(async (file: File) => `team_official_document/7/${file.name}`)
  request.mockReset().mockResolvedValue({ id: 1 })
})

const open = () => {
  render(<MemoryRouter><TeamManage data={team} /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Request Official status' }))
  return within(screen.getByRole('dialog'))
}
const choose = (dialog: ReturnType<typeof open>, files: File[]) =>
  fireEvent.change(dialog.getByLabelText(/Supporting documents/), { target: { files } })

describe('Official request — upload documents', () => {
  it('รับ PDF / PNG / JPEG · ยังไม่เลือกไฟล์ส่งไม่ได้', () => {
    const dialog = open()
    expect(dialog.getByLabelText(/Supporting documents/)).toHaveAttribute('accept', 'application/pdf,image/png,image/jpeg')
    expect(dialog.getByRole('button', { name: 'Send request' })).toBeDisabled()
  })

  it('อัปโหลดทุกไฟล์ของทีมนี้ก่อน แล้วยื่นคำขอด้วย key ที่ได้', async () => {
    const dialog = open()
    choose(dialog, [pdf('club-letter.pdf'), pdf('roster.pdf')])
    expect(dialog.getByRole('list', { name: 'Chosen documents' })).toHaveTextContent('club-letter.pdf')

    fireEvent.click(dialog.getByRole('button', { name: 'Send request' }))

    await waitFor(() => expect(request).toHaveBeenCalledWith({
      supportingDocs: ['team_official_document/7/club-letter.pdf', 'team_official_document/7/roster.pdf'],
    }))
    expect(uploadDoc).toHaveBeenCalledWith(expect.any(File), 7)
    expect(await screen.findByText('Official status requested. Awaiting admin review.')).toBeInTheDocument()
  })

  it('เอาไฟล์ออกก่อนส่งได้', async () => {
    const dialog = open()
    choose(dialog, [pdf('a.pdf'), pdf('b.pdf')])
    fireEvent.click(dialog.getByRole('button', { name: 'Remove a.pdf' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith({ supportingDocs: ['team_official_document/7/b.pdf'] }))
  })

  it('อัปโหลดไม่สำเร็จ → บอกเหตุ · ไม่ยื่นคำขอ', async () => {
    uploadDoc.mockRejectedValueOnce({ code: 'UPLOAD_FAILED' })
    const dialog = open()
    choose(dialog, [pdf('a.pdf')])
    fireEvent.click(dialog.getByRole('button', { name: 'Send request' }))
    expect(await dialog.findByText(/อัปโหลด.*ไม่สำเร็จ/)).toBeInTheDocument()
    expect(request).not.toHaveBeenCalled()
  })

  it('backend ปฏิเสธไฟล์ → แสดงข้อความของ code นั้น', async () => {
    request.mockRejectedValueOnce({ code: 'TEAM_OFFICIAL_DOC_NOT_FOUND' })
    const dialog = open()
    choose(dialog, [pdf('a.pdf')])
    fireEvent.click(dialog.getByRole('button', { name: 'Send request' }))
    expect(await dialog.findByText(/ไม่พบไฟล์เอกสาร/)).toBeInTheDocument()
  })

  it('เลือกเกิน 10 ไฟล์ → เก็บแค่ 10 และบอกเพดาน', () => {
    const dialog = open()
    choose(dialog, Array.from({ length: 12 }, (_, i) => pdf(`d${i}.pdf`)))
    expect(within(dialog.getByRole('list', { name: 'Chosen documents' })).getAllByRole('listitem')).toHaveLength(10)
    expect(dialog.getByText('แนบเอกสารได้ไม่เกิน 10 ไฟล์')).toBeInTheDocument()
  })
})
