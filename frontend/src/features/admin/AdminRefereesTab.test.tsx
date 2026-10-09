import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  USE_MOCK: false,
}))

import { AdminRefereesTab } from './AdminRefereesTab'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
const pending = { items: [{
  userId: 42, user: { id: 42, fullName: 'External Ref', avatarUrl: null }, docs: ['referee_identity/42/doc.png'], docsSubmitted: true,
  tournaments: [{ id: 5, name: 'Spring Cup' }, { id: 6, name: 'Summer Cup' }],
  submittedAt: '2026-10-06T00:00:00.000Z',
}] }

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('external referee decision with the real API adapter', () => {
  it('keeps people without documents visible, disables Approve and retains Request documents/Reject', async () => {
    const queue = { items: pending.items.map(row => ({ ...row, docs: [], docsSubmitted: false })) }
    const fetchMock = vi.fn<typeof fetch>(async () => json(queue))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><AdminRefereesTab /></MemoryRouter></QueryClientProvider>)
    const buttons = await screen.findAllByRole('button', { name: 'Approve' })
    expect(screen.getAllByText('รอเอกสารจากผู้สมัคร')).toHaveLength(2)
    for (const button of buttons) { expect(button).toBeDisabled(); fireEvent.click(button) }
    for (const button of screen.getAllByRole('button', { name: 'Reject' })) expect(button).toBeEnabled()
    for (const button of screen.getAllByRole('button', { name: 'Request documents' })) expect(button).toBeEnabled()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    client.clear()
  })

  it('does not infer submission from document keys when the new flag is absent', async () => {
    const queue = { items: pending.items.map(row => ({ ...row, docsSubmitted: undefined })) }
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json(queue)))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><AdminRefereesTab /></MemoryRouter></QueryClientProvider>)
    for (const button of await screen.findAllByRole('button', { name: 'Approve' })) expect(button).toBeDisabled()
    expect(screen.getAllByText('ตรวจสถานะเอกสารไม่ได้')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    client.clear()
  })

  it('explains DOCS_NOT_SUBMITTED and refreshes stale submitted flags after 409', async () => {
    let attempted = false
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith('/approve') && init?.method === 'POST') {
        attempted = true
        return json({ error: { code: 'DOCS_NOT_SUBMITTED', message: 'No docs' } }, 409)
      }
      return json(attempted ? { items: pending.items.map(row => ({ ...row, docs: [], docsSubmitted: false })) } : pending)
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><AdminRefereesTab /></MemoryRouter></QueryClientProvider>)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Approve' }))[0])
    expect(await screen.findByText(/ผู้ใช้นี้ยังไม่ได้ส่งเอกสารยืนยันตัวตน อนุมัติไม่ได้/)).toBeInTheDocument()
    await waitFor(() => { for (const button of screen.getAllByRole('button', { name: 'Approve' })) expect(button).toBeDisabled() })
    expect(screen.getAllByText('รอเอกสารจากผู้สมัคร')).toHaveLength(2)
    client.clear()
  })

  it('requests additional documents with a reason and leaves approval pending', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const path = new URL(String(url), 'http://localhost').pathname
      if (path.endsWith('/42/request-docs') && init?.method === 'POST') return json({ userId: 42, identityStatus: 'needs_docs', tournamentsUpdated: 2 })
      if (path.endsWith('/admin/referee-requests')) return json({ items: pending.items.map(row => ({ ...row, docs: [], docsSubmitted: false })) })
      throw new Error(`Unexpected request: ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><AdminRefereesTab /></MemoryRouter></QueryClientProvider>)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Request documents' }))[0])
    expect(screen.getByRole('button', { name: 'Send document request' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Reason — sent to the referee and the organizer'), { target: { value: 'Please send a clearer image' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send document request' }))
    await screen.findByText('ขอเอกสารเพิ่มแล้ว กรรมการยังรอการตรวจและยังไม่ได้รับอนุมัติ')
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ reason: 'Please send a clearer image' })
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/approve'))).toBe(false)
    client.clear()
  })
  it.each(['approve', 'reject'] as const)('%s shows success and refreshes all pending tournaments', async decision => {
    let decided = false
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const path = new URL(String(url), 'http://localhost').pathname
      if (path.endsWith(`/42/${decision}`) && init?.method === 'POST') {
        decided = true
        return json({ userId: 42, identityStatus: decision === 'approve' ? 'approved' : 'rejected', tournamentsUpdated: 2 })
      }
      if (path.endsWith('/admin/referee-requests')) return json(decided ? { items: [] } : decision === 'reject' ? { items: pending.items.map(row => ({ ...row, docs: [], docsSubmitted: false })) } : pending)
      throw new Error(`Unexpected request: ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    for (const key of [['referees', 5], ['referees', 6], ['match', 9], ['matches'], ['notifications']]) client.setQueryData(key, {})
    render(<QueryClientProvider client={client}><MemoryRouter><AdminRefereesTab /></MemoryRouter></QueryClientProvider>)
    const buttons = await screen.findAllByRole('button', { name: decision === 'approve' ? 'Approve' : 'Reject' })
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[0])
    if (decision === 'reject') {
      fireEvent.change(screen.getByLabelText('Reason — sent to the referee and the organizer'), { target: { value: 'Documents do not match' } })
      fireEvent.click(screen.getByRole('button', { name: 'Do not approve' }))
    }
    expect(await screen.findByText(decision === 'approve'
      ? 'External Ref can now officiate Spring Cup.'
      : 'External Ref was not approved for Spring Cup — the reason goes to them and the organizer.')).toBeInTheDocument()
    await screen.findByText('Nothing waiting.')
    expect(screen.queryByText('The decision did not go through.')).not.toBeInTheDocument()
    await waitFor(() => {
      for (const key of [['referees', 5], ['referees', 6], ['match', 9], ['matches'], ['notifications']]) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
    })
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    client.clear()
  })
})
