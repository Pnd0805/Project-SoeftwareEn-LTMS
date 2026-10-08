import { beforeEach, expect, it, vi } from 'vitest'

const { decode } = vi.hoisted(() => ({ decode: vi.fn() }))
vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class { decodeFromImageUrl = decode },
}))

import { scanQrPhoto } from './scanQrPhoto'

beforeEach(() => {
  decode.mockReset()
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test-qr'),
    revokeObjectURL: vi.fn(),
  })
})

it('reads the captured QR and releases its image URL', async () => {
  decode.mockResolvedValue({ getText: () => 'signed.checkin.token' })
  expect(await scanQrPhoto(new File(['image'], 'qr.jpg', { type: 'image/jpeg' }))).toBe('signed.checkin.token')
  expect(decode).toHaveBeenCalledWith('blob:test-qr')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-qr')
  vi.unstubAllGlobals()
})

it('releases the image URL when no QR can be read', async () => {
  decode.mockRejectedValue(new Error('No code'))
  await expect(scanQrPhoto(new File(['image'], 'blank.jpg', { type: 'image/jpeg' }))).rejects.toThrow('No code')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-qr')
  vi.unstubAllGlobals()
})
