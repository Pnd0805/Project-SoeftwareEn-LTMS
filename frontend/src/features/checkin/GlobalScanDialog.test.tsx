import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

const { mutation, matches, scanPhoto } = vi.hoisted(() => ({
  mutation: { isPending: false, error: null as Error | null, mutate: vi.fn() },
  matches: { data: { items: [] as Array<{ id: number; checkinToken: string | null }> } },
  scanPhoto: vi.fn(),
}))

vi.mock('../../hooks/useMatch', () => ({
  useMyMatches: () => matches,
  useCheckinFromQr: () => mutation,
}))
vi.mock('./CaptureModals', () => ({
  QrScanModal: ({ onScanned, submissionError }: { onScanned: (token: string) => void; submissionError?: string | null }) => (
    <div role="dialog">
      <button onClick={() => onScanned('header.' + btoa(JSON.stringify({ type: 'checkin_qr', matchId: 42 })) + '.signature')}>Read Match QR</button>
      <button onClick={() => onScanned('wrong code')}>Read wrong QR</button>
      {submissionError ? <p role="alert">{submissionError}</p> : null}
    </div>
  ),
}))
vi.mock('./scanQrPhoto', () => ({ scanQrPhoto: scanPhoto }))

import { GlobalScanDialog, GlobalScanPhoto } from './GlobalScanDialog'

beforeEach(() => {
  mutation.mutate.mockReset()
  mutation.error = null
  matches.data.items = []
  scanPhoto.mockReset()
})

it('opens the camera flow and checks in against the Match encoded by the QR', () => {
  mutation.mutate.mockImplementation((_input, options) => options.onSuccess())
  render(<MemoryRouter initialEntries={['/']}>
    <GlobalScanDialog onClose={() => {}} />
    <Routes>
      <Route path="/" element={<p>Home</p>} />
      <Route path="/checkin/42" element={<p>Match 42 Check-in</p>} />
    </Routes>
  </MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Read Match QR' }))
  expect(mutation.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ matchId: 42, qrToken: expect.stringContaining('.signature') }),
    expect.any(Object),
  )
  expect(screen.getByText('Match 42 Check-in')).toBeInTheDocument()
})

it('does not send an unrelated QR to the Check-in API', () => {
  render(<MemoryRouter><GlobalScanDialog onClose={() => {}} /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Read wrong QR' }))
  expect(mutation.mutate).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('LTMS Check-in QR')
})

it('finishes reading a captured photo under React StrictMode', async () => {
  const token = 'header.' + btoa(JSON.stringify({ type: 'checkin_qr', matchId: 42 })) + '.signature'
  scanPhoto.mockResolvedValue(token)
  render(<StrictMode><MemoryRouter>
    <GlobalScanPhoto file={new File(['image'], 'qr.jpg', { type: 'image/jpeg' })}
      onClose={() => {}} onRetry={() => {}} />
  </MemoryRouter></StrictMode>)
  await waitFor(() => expect(mutation.mutate).toHaveBeenCalledWith(
    { matchId: 42, qrToken: token }, expect.any(Object),
  ))
  expect(scanPhoto).toHaveBeenCalledTimes(1)
})

it('announces a failed photo once and exposes another capture without stale reading status', async () => {
  scanPhoto.mockRejectedValue(new Error('unreadable'))
  const retry = vi.fn()
  render(<MemoryRouter><GlobalScanPhoto file={new File(['image'], 'qr.jpg', { type: 'image/jpeg' })}
    onClose={() => {}} onRetry={retry} /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('No QR found')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Take another photo' }))
  expect(retry).toHaveBeenCalledOnce()
})
