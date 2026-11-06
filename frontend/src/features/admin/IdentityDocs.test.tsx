/**
 * AR01 presigned URL (BE_KN 462fdb1) — "เปิดไม่ได้" ต้องไม่กลายเป็น "ไม่มีเอกสาร"
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DOC_LINK_TTL_MS, IdentityDocs } from './IdentityDocs'

const signed = 'http://localhost:9000/ltms-uploads/referee_identity/9053/00000000-0000-4000-8000-000000009053.jpg?X-Amz-Expires=1200&X-Amz-Signature=abc'
// Generic document-renderer coverage; PDF is not a Round 6 identity-upload fixture.
const pdf = 'http://localhost:9000/ltms-uploads/documents/manual.pdf?X-Amz-Signature=def'
const props = { docsSubmitted: true, fetchedAt: 1_000, now: 1_000, refreshing: false }

describe('identity documents in the admin queue', () => {
  it('preserves the 9054 signed PNG URL without rewriting its opaque object key', () => {
    const url = 'http://localhost:9000/ltms-uploads/referee_identity/9054/00000000-0000-4000-8000-000000009054.png?X-Amz-Expires=1200&X-Amz-Signature=abc'
    render(<IdentityDocs {...props} docs={[url]} onRefresh={vi.fn()} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', url)
    expect(screen.getByRole('img')).toHaveAttribute('src', url)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('links each signed URL under its file name, without the signature', () => {
    render(<IdentityDocs {...props} docs={[signed, pdf]} onRefresh={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'เอกสาร 1 · 00000000-0000-4000-8000-000000009053.jpg' })).toHaveAttribute('href', signed)
    expect(screen.getByRole('link', { name: 'เอกสาร 2 · manual.pdf' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('img', { name: 'เอกสาร 1 · 00000000-0000-4000-8000-000000009053.jpg' })).toHaveAttribute('src', signed)
  })

  it('says the file could not be opened — not that there is none — when the preview fails', () => {
    const onRefresh = vi.fn()
    render(<IdentityDocs {...props} docs={[signed]} onRefresh={onRefresh} />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('alert')).toHaveTextContent('เปิดเอกสารไม่ได้')
    expect(screen.queryByText('ยังไม่มีเอกสาร')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh queue' }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('warns that links have expired once the queue is older than their lifetime', () => {
    render(<IdentityDocs {...props} docs={[pdf]} now={props.fetchedAt + DOC_LINK_TTL_MS + 1} onRefresh={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('ลิงก์เอกสารมีอายุ 20 นาที')
  })

  it('separates "submitted but no link came back" from "nothing submitted"', () => {
    const view = render(<IdentityDocs {...props} docs={[]} onRefresh={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('ส่งเอกสารแล้วแต่ไม่ได้รับลิงก์')
    view.rerender(<IdentityDocs {...props} docs={[]} docsSubmitted={false} onRefresh={vi.fn()} />)
    expect(screen.getByText('ยังไม่มีเอกสาร')).toBeInTheDocument()
  })

  it('never turns a non-http value into a link', () => {
    render(<IdentityDocs {...props} docs={['javascript:alert(1)', 'referee_identity/42/doc.png']} onRefresh={vi.fn()} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('เอกสาร 2 · doc.png')).toBeInTheDocument()
  })
})
