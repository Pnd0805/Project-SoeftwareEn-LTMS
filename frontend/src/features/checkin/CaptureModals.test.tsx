import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const decoder = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn() }))
vi.mock('@zxing/browser', () => ({ BrowserQRCodeReader: class { decodeFromVideoElement = decoder.decode } }))
vi.mock('./scanQrPhoto', () => ({ scanQrPhoto: vi.fn() }))
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
  expect(screen.queryByText('Starting camera…')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Playback unavailable')
})

it('announces camera denial once and allows a new camera attempt with the manual draft retained', async () => {
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new Error('Permission denied'))
  render(<QrScanModal open expectedToken={null} onScanned={vi.fn()} pending={false} onClose={() => {}} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied')
  expect(screen.queryByText('Starting camera…')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Referee’s code'), { target: { value: 'My.MixedCase.Code' } })
  fireEvent.click(screen.getByRole('button', { name: 'Retry camera' }))
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1))
  expect(screen.getByLabelText('Referee’s code')).toHaveValue('My.MixedCase.Code')
})

const denial = () => Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })

it('asks for the camera again on retry and explains the way back when the browser stays blocked', async () => {
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(denial()).mockRejectedValueOnce(denial())
  render(<QrScanModal open expectedToken={null} onScanned={vi.fn()} pending={false} onClose={() => {}} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('site settings')
  fireEvent.click(screen.getByRole('button', { name: 'Retry camera' }))
  await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole('alert')).toHaveTextContent('Camera access is blocked')
})

it('restarts by itself once the user allows the camera in site settings', async () => {
  const permission = Object.assign(new EventTarget(), { state: 'denied' })
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: navigator.mediaDevices,
    permissions: { query: vi.fn().mockResolvedValue(permission) } })
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(denial())
  render(<QrScanModal open expectedToken={null} onScanned={vi.fn()} pending={false} onClose={() => {}} />)
  await screen.findByRole('alert')
  await waitFor(() => expect(navigator.permissions.query).toHaveBeenCalled())
  await act(async () => { await Promise.resolve() })
  act(() => { permission.state = 'granted'; permission.dispatchEvent(new Event('change')) })
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1))
})

it('recovers through the browser-drawn control where the browser has one', async () => {
  const setConstraints = vi.fn()
  vi.stubGlobal('HTMLUserMediaElement', class {})
  Object.defineProperty(HTMLElement.prototype, 'setConstraints', { configurable: true, value: setConstraints })
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(denial())
  try {
    render(<QrScanModal open expectedToken={null} onScanned={vi.fn()} pending={false} onClose={() => {}} />)
    await screen.findByRole('alert')
    const control = await waitFor(() => {
      const found = document.querySelector('usermedia')
      expect(found).not.toBeNull()
      return found as HTMLElement & { stream: unknown }
    })
    await waitFor(() => expect(setConstraints).toHaveBeenCalledOnce())
    control.stream = { getTracks: () => [{ stop: stopTrack }] }
    act(() => { control.dispatchEvent(new Event('stream')) })
    await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1))
    expect(document.querySelector('usermedia')).toBeNull()
  } finally {
    delete (HTMLElement.prototype as unknown as { setConstraints?: unknown }).setConstraints
  }
})

it('reads a photo of the QR when the live camera is blocked', async () => {
  const { scanQrPhoto } = await import('./scanQrPhoto')
  vi.mocked(scanQrPhoto).mockResolvedValue('Signed.Photo.QR')
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(denial())
  const scanned = vi.fn()
  render(<QrScanModal open expectedToken={null} onScanned={scanned} pending={false} onClose={() => {}} />)
  await screen.findByRole('button', { name: 'Use a photo of the QR' })
  fireEvent.change(screen.getByLabelText('QR photo'), { target: { files: [new File(['x'], 'qr.png', { type: 'image/png' })] } })
  await waitFor(() => expect(scanned).toHaveBeenCalledExactlyOnceWith('Signed.Photo.QR'))
})

it('announces invalid manual input without stale detected/scanning status and keeps it editable', async () => {
  const scanned = vi.fn()
  render(<QrScanModal open expectedToken="valid" onScanned={scanned} pending={false} onClose={() => {}} />)
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Referee’s code'), { target: { value: 'wrong' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Code does not match')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Referee’s code')).toHaveValue('wrong')
  expect(scanned).not.toHaveBeenCalled()
})

it('keeps the server rejection visible inside the open scan dialog', async () => {
  render(<QrScanModal open expectedToken={null} onScanned={vi.fn()} pending={false}
    onClose={() => {}} submissionError="That QR is invalid, expired, or belongs to another match." />)
  expect(screen.getByRole('dialog')).toHaveTextContent('That QR is invalid, expired, or belongs to another match.')
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(1))
})
