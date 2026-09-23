/**
 * ขอจัดทัวร์นาเมนต์ — สองเรื่องที่ผู้ใช้แจ้งเข้ามา 23 ก.ย.
 *
 *   "หลังกดสร้างทัวร์นาเมนต์แล้วแอดมินไม่ต้องกดอนุมัติแล้วเหรอ"
 *     ตั้งใจ: `autoApproveIfOwnScope` (มติ 18 ก.ย. ข้อ 8) ให้แอดมินที่จัดในขอบเขต
 *     ตัวเองข้ามคิวไปเลย แต่หน้ายืนยันเขียน "อยู่กับแอดมินแล้ว" ให้ทุกคน คนที่ผ่าน
 *     ไปแล้วจึงนั่งรอตัวเอง
 *
 *   "ระดับการแข่งขันกับคณะ/ภาควิชา ควบรวมกันได้ไหม"
 *     ได้ และต้องรวม: ensureCreateReferences บังคับให้ทั้งสองช่องมีคำตอบที่ถูกอยู่
 *     ชุดเดียว ถามแยกได้แต่กรอกให้ขัดกันเองแล้ว backend ตอบ 400
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(),
  USE_MOCK: false,
}))

const createMutate = vi.fn()

vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 9001 } }) }))
vi.mock('../../hooks/useReference', () => ({
  useSportTypes: () => ({ data: { items: [{ id: 1, name: 'ฟุตบอล' }] } }),
  useFaculties: () => ({ data: { items: [{ id: 1, name: 'วิศวกรรมศาสตร์' }, { id: 2, name: 'วิทยาศาสตร์' }] } }),
  useDepartments: (facultyId?: number) => ({
    data: { items: facultyId === 1 ? [{ id: 2, name: 'วิศวกรรมไฟฟ้า' }] : [] },
  }),
}))
vi.mock('../../hooks/useTournament', () => ({
  useCreateTournament: () => ({ mutateAsync: createMutate, isPending: false, isError: false, error: null }),
}))

import { RequestPage } from './RequestPage'

const renderPage = () => render(<MemoryRouter><RequestPage /></MemoryRouter>)

const fillTheRest = () => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'QA Cup' } })
  fireEvent.change(screen.getByLabelText('Default venue'), { target: { value: 'คอร์ต 1' } })
}

const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send the request' }))

beforeEach(() => {
  vi.clearAllMocks()
  createMutate.mockResolvedValue({ id: 30, name: 'QA Cup', status: 'pending_approval', autoApproved: false })
})

describe('organising faculty and department are one question', () => {
  it('asks for the level nowhere — a blank department means the whole faculty', async () => {
    renderPage()
    expect(screen.queryByLabelText('Scope')).not.toBeInTheDocument()

    fillTheRest()
    fireEvent.change(screen.getByLabelText(/Organising faculty/), { target: { value: '1' } })
    send()

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0]![0]).toMatchObject({
      scopeType: 'faculty', organizingFacultyId: 1, organizingDepartmentId: null,
    })
  })

  it('reads a chosen department as a department-level tournament', async () => {
    renderPage()
    fillTheRest()
    fireEvent.change(screen.getByLabelText(/Organising faculty/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Organising department/), { target: { value: '2' } })
    send()

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0]![0]).toMatchObject({
      scopeType: 'department', organizingFacultyId: 1, organizingDepartmentId: 2,
    })
  })

  /**
   * ช่องคณะไม่ได้ผ่าน register แล้ว (คุมค่าเอง) — `setValue` เปล่าๆ ไม่ตรวจซ้ำให้
   * คำเตือนจึงค้างอยู่หน้าช่องที่เพิ่งเลือกไปแล้ว และอ่านเหมือนสร้างทัวร์ไม่ได้อีกเลย
   */
  it('clears the missing-faculty warning as soon as a faculty is chosen', async () => {
    renderPage()
    fillTheRest()
    send()

    expect(await screen.findByText('กรุณาเลือกคณะที่จัดการแข่งขัน')).toBeInTheDocument()
    expect(createMutate).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/Organising faculty/), { target: { value: '1' } })
    await waitFor(() =>
      expect(screen.queryByText('กรุณาเลือกคณะที่จัดการแข่งขัน')).not.toBeInTheDocument())

    send()
    await waitFor(() => expect(createMutate).toHaveBeenCalled())
  })

  it('says the faculty is required before anyone presses send', () => {
    renderPage()
    expect(screen.getByText(/cannot be left blank/)).toBeInTheDocument()
    /* ช่องภาควิชารับค่าว่างได้จริง จึงต้องไม่ถูกเตือนแบบเดียวกัน */
    expect(screen.getByLabelText(/Organising department/)).toBeDisabled()
  })

  /* เปลี่ยนคณะแล้วภาควิชาเดิมอยู่คนละคณะ — ensureCreateReferences ตอบ 400 */
  it('drops a department that no longer belongs to the chosen faculty', async () => {
    renderPage()
    fillTheRest()
    fireEvent.change(screen.getByLabelText(/Organising faculty/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Organising department/), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/Organising faculty/), { target: { value: '2' } })
    send()

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0]![0]).toMatchObject({
      scopeType: 'faculty', organizingFacultyId: 2, organizingDepartmentId: null,
    })
  })
})

/**
 * "faculty admin เหมือนจะไม่ autoApproved" — กฎทำงานถูก ค่าตั้งต้นต่างหากที่พาไปเข้าคิว
 * `adminCoversEligibility` ต้องมีกฎคณะอย่างน้อยหนึ่งข้อและทุกข้อเป็นคณะของแอดมินคนนั้น
 * ค่าตั้งต้น "ทุกคณะ" ไม่ส่งกฎคณะเลย แอดมินคณะจึงเข้าคิวทุกครั้งที่กรอกตามค่าตั้งต้น
 * เราอ่านขอบเขตแอดมินของคนกรอกไม่ได้ (`FE-viewer-admin-scope-unknown`) จึงบอกเป็นเงื่อนไข
 */
describe('who decides this request', () => {
  const chooseFaculty = () =>
    fireEvent.change(screen.getByLabelText(/Organising faculty/), { target: { value: '1' } })

  it('warns that the default entry setting queues a faculty admin too', () => {
    renderPage()
    chooseFaculty()

    expect(screen.getByText(/a faculty admin sending this one still waits in the queue/))
      .toBeInTheDocument()
  })

  it('says the own-faculty setting is the one that skips the queue', () => {
    renderPage()
    chooseFaculty()
    fireEvent.click(screen.getByRole('radio', { name: 'Only the faculty running it' }))

    expect(screen.getByText(/If that admin is you, it skips the queue/)).toBeInTheDocument()
    expect(screen.queryByText(/still waits in the queue/)).not.toBeInTheDocument()
  })

  it('sends the own-faculty rule that makes auto-approval possible', async () => {
    renderPage()
    fillTheRest()
    chooseFaculty()
    fireEvent.click(screen.getByRole('radio', { name: 'Only the faculty running it' }))
    send()

    await waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0]![0].eligibilityRules).toEqual([{ type: 'faculty', value: 1 }])
  })
})

describe('what the confirmation says', () => {
  const sendOne = async () => {
    renderPage()
    fillTheRest()
    fireEvent.change(screen.getByLabelText(/Organising faculty/), { target: { value: '1' } })
    send()
    await waitFor(() => expect(createMutate).toHaveBeenCalled())
  }

  it('does not tell an admin to wait for an admin', async () => {
    createMutate.mockResolvedValue({ id: 30, name: 'QA Cup', status: 'private', autoApproved: true })
    await sendOne()

    expect(await screen.findByText(/is yours to run/)).toBeInTheDocument()
    expect(screen.queryByText(/is with an admin/)).not.toBeInTheDocument()
    expect(screen.getByText(/skipped the approval queue/)).toBeInTheDocument()
  })

  it('still says an admin has it when the request really did queue', async () => {
    await sendOne()

    expect(await screen.findByText(/is with an admin/)).toBeInTheDocument()
    expect(screen.queryByText(/yours to run/)).not.toBeInTheDocument()
  })

  /* ผู้ยื่นคำขออ่านทัวร์ของตัวเองได้ทุกสถานะแล้ว (FE-c17b 20 ก.ย.) — ข้อความเดิม
     บอกว่า "ปิดอยู่ แม้แต่กับคุณ" ซึ่งไม่จริงมาตั้งแต่นั้น */
  it('offers the tournament page either way', async () => {
    await sendOne()
    expect(await screen.findByRole('button', { name: 'Open the tournament' })).toBeInTheDocument()
  })
})
