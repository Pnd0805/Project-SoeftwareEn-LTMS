import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { upload, submit, state } = vi.hoisted(() => ({ upload: vi.fn(), submit: vi.fn(), state: { status: 'pending', docsRequired: true } }))
vi.mock('../../hooks/useAdmin', () => ({
  useRefereeIdentity: () => ({ data: { ...state, tournaments: [{ id: 14, tournamentRefereeId: 8, name: 'Cup', externalApprovalStatus: 'pending' }], adminMessage: 'Please provide a clearer image' }, isPending: false, isError: false }),
  useSubmitRefereeIdentityDocs: () => ({ mutateAsync: submit, isPending: false }),
}))
vi.mock('../../api/upload', async original => ({ ...await original<typeof import('../../api/upload')>(), uploadImage: upload }))
import { ExternalIdentityPanel } from './ExternalIdentityPanel'
beforeEach(() => { vi.clearAllMocks(); state.status = 'pending'; state.docsRequired = true; upload.mockResolvedValue('referee_identity/9/test.png'); submit.mockResolvedValue({ status: 'pending' }) })
const show = () => render(<MemoryRouter><ExternalIdentityPanel /></MemoryRouter>)
const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('เอกสารยืนยันตัวตน (JPEG/PNG 1–5 ไฟล์)'), { target: { files } })
describe('External identity document flow', () => {
  it('uploads private identity files and submits object keys, then shows awaiting review', async () => {
    show(); pick([new File(['png'], 'id.png', { type: 'image/png' })]); fireEvent.click(screen.getByRole('button', { name: 'ส่งเอกสารให้ผู้ดูแล' }))
    await screen.findByText('ส่งเอกสารแล้ว รอผู้ดูแลระบบตรวจสอบ')
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'referee_identity')
    expect(submit).toHaveBeenCalledWith(['referee_identity/9/test.png'])
  })
  it('does not submit document keys if an upload fails', async () => {
    upload.mockRejectedValueOnce(new Error('Storage unavailable'))
    show(); pick([new File(['png'], 'id.png', { type: 'image/png' })]); fireEvent.click(screen.getByRole('button', { name: 'ส่งเอกสารให้ผู้ดูแล' }))
    await screen.findByText('Storage unavailable'); expect(submit).not.toHaveBeenCalled()
  })
  it('blocks more than five files and rejects unsupported formats before upload', async () => {
    show(); pick(Array.from({ length: 6 }, (_, i) => new File(['png'], `${i}.png`, { type: 'image/png' })))
    expect(screen.getByRole('button', { name: 'ส่งเอกสารให้ผู้ดูแล' })).toBeDisabled()
    pick([new File(['pdf'], 'id.pdf', { type: 'application/pdf' })]); fireEvent.click(screen.getByRole('button', { name: 'ส่งเอกสารให้ผู้ดูแล' }))
    await waitFor(() => expect(upload).not.toHaveBeenCalled()); await screen.findByText('เลือกไฟล์ JPEG หรือ PNG เท่านั้น')
    expect(submit).not.toHaveBeenCalled()
  })
})
