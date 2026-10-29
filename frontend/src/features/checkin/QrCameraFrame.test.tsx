import { render, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { afterEach, expect, it, vi } from 'vitest'
import { QrScanModal } from './CaptureModals'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('decodes a dense rendered QR inside a video frame through the real ZXing camera path', async () => {
  // Supply deterministic camera pixels, while retaining the actual browser
  // reader, canvas luminance conversion, QR detection and payload decoding.
  const payload = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiY2hlY2tpbl9xciIsIm1hdGNoSWQiOjEyLCJpYXQiOjE3OTAxMzYwMDAsImV4cCI6MTc5MDEzNzIwMH0.MixedCaseSyntheticSignature123456789'
  const svg = renderToStaticMarkup(<QRCodeSVG value={payload} marginSize={4} level="M" />)
  const modules = Number(svg.match(/viewBox="0 0 (\d+)/)![1])
  const path = svg.match(/fill="#000000" d="([^"]+)"/)![1]
  const width = 1280, height = 720, scale = 7
  const left = Math.floor((width - modules * scale) / 2)
  const top = Math.floor((height - modules * scale) / 2)
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255)
  for (const rect of path.matchAll(/M(\d+)[, ](\d+)\s*h(\d+)v1H\d+z/g)) {
    const x = Number(rect[1]), y = Number(rect[2]), length = Number(rect[3])
    for (let row = top + y * scale; row < top + (y + 1) * scale; row++) {
      for (let col = left + x * scale; col < left + (x + length) * scale; col++) {
        const index = (row * width + col) * 4
        pixels[index] = pixels[index + 1] = pixels[index + 2] = 0
      }
    }
  }
  const stop = vi.fn()
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(height)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(), getImageData: () => ({ data: pixels, width, height }),
  } as unknown as CanvasRenderingContext2D)
  const scanned = vi.fn()
  const view = render(<QrScanModal open expectedToken={null} onScanned={scanned} pending={false} onClose={() => {}} />)
  await waitFor(() => expect(scanned).toHaveBeenCalledExactlyOnceWith(payload))
  expect(getUserMedia).toHaveBeenCalledWith({ video: {
    facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 },
  } })
  view.unmount()
  expect(stop).toHaveBeenCalledOnce()
})
