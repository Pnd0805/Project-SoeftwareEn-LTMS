import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const decoder = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn() }))
vi.mock('@zxing/browser', () => ({ BrowserQRCodeReader: class { decodeFromVideoElement = decoder.decode } }))
vi.mock('../../api/client', async original => ({
  ...(await original<typeof import('../../api/client')>()), USE_MOCK: false,
}))
import { QrScanModal } from './CaptureModals'

const stopTrack = vi.fn()
beforeEach(() => {
  decoder.decode.mockReset().mockResolvedValue({ stop: decoder.stop })
  decoder.stop.mockReset(); stopTrack.mockReset()
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('decodes the camera payload once, allows another scan, and releases resources on close', async () => {
  const scanned = vi.fn()
  const view = render(<QrScanModal open expectedToken={null} onScanned={scanned} pending={false} onClose={() => {}} />)
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1))
  const callback = decoder.decode.mock.calls[0][1]
  act(() => {
    callback({ getText: () => 'Signed.MixedCase.QR' }, undefined, { stop: decoder.stop })
    callback({ getText: () => 'Signed.MixedCase.QR' }, undefined, { stop: decoder.stop })
  })
  expect(scanned).toHaveBeenCalledExactlyOnceWith('Signed.MixedCase.QR')
  expect(screen.queryByText('Demo scan')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Scan again' }))
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(2))
  view.unmount()
  expect(decoder.stop).toHaveBeenCalled()
  expect(stopTrack).toHaveBeenCalledOnce()
})

it('reports a fatal frame error instead of leaving a stopped decoder silent', async () => {
  render(<QrScanModal open expectedToken={null} onScanned={vi.fn()} pending={false} onClose={() => {}} />)
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1))
  act(() => decoder.decode.mock.calls[0][1](undefined, new Error('Canvas failed'), { stop: decoder.stop }))
  expect(screen.getByText(/Scanner stopped/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Scan again' }))
  expect(screen.queryByText(/Scanner stopped/)).not.toBeInTheDocument()
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(2))
})

it('keeps scanning ordinary unreadable frames using stable ZXing error kinds', async () => {
  const scanned = vi.fn()
  render(<QrScanModal open expectedToken={null} onScanned={scanned} pending={false} onClose={() => {}} />)
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1))
  act(() => decoder.decode.mock.calls[0][1](undefined,
    { name: 'minifiedName', getKind: () => 'NotFoundException' }, { stop: decoder.stop }))
  expect(screen.getByRole('status')).toHaveTextContent('Scanning QR')
  expect(screen.queryByText(/Scanner stopped/)).not.toBeInTheDocument()
  expect(scanned).not.toHaveBeenCalled()
})

it('does not report a camera as ready after video playback fails', async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new Error('Playback unavailable'))
  render(<QrScanModal open expectedToken={null} onScanned={vi.fn()} pending={false} onClose={() => {}} />)
  await screen.findByText(/Playback unavailable/)
  expect(decoder.decode).not.toHaveBeenCalled()
})

it('keeps the server rejection visible inside the open scan dialog', async () => {
  render(<QrScanModal open expectedToken={null} onScanned={vi.fn()} pending={false}
    onClose={() => {}} submissionError="That QR is invalid, expired, or belongs to another match." />)
  expect(screen.getByRole('dialog')).toHaveTextContent('That QR is invalid, expired, or belongs to another match.')
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1))
})
