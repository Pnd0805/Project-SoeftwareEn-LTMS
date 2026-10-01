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
  expect(screen.queryByText('จำลองว่าสแกนติด')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'สแกนอีกครั้ง' }))
  await waitFor(() => expect(decoder.decode).toHaveBeenCalledTimes(2))
  view.unmount()
  expect(decoder.stop).toHaveBeenCalled()
  expect(stopTrack).toHaveBeenCalledOnce()
})
