import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import { ApiError, setAccessToken } from './client'
import { imageUploadErrorMessage, uploadImage } from './upload'

const fetchMock = vi.fn()
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status })
const png = () => new File(['png'], 'photo.png', { type: 'image/png' })
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); setAccessToken('backend-test-token') })
afterEach(() => { setAccessToken(null); vi.unstubAllGlobals() })

describe('real image uploads', () => {
  it.each(['image/png', 'image/jpeg'])('keeps %s MIME and returns the key only after PUT succeeds', async contentType => {
    const file = new File(['image'], 'photo', { type: contentType })
    fetchMock.mockResolvedValueOnce(json({ uploadUrl: 'https://storage.test/upload', objectKey: 'avatar/9/key.png' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    expect(await uploadImage(file, 'avatar')).toBe('avatar/9/key.png')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ purpose: 'avatar', contentType })
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer backend-test-token')
    expect(fetchMock.mock.calls[1]).toEqual(['https://storage.test/upload', {
      method: 'PUT', body: file, headers: { 'Content-Type': contentType },
    }])
  })

  it.each(['image/gif', 'image/webp', 'text/plain', ''])('rejects %s before contacting storage', async type => {
    await expect(uploadImage(new File(['x'], 'file', { type }), 'avatar')).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('includes the team ID when presigning a logo', async () => {
    fetchMock.mockResolvedValueOnce(json({ uploadUrl: 'https://storage.test/logo', objectKey: 'team_logo/7/key.png' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    expect(await uploadImage(png(), 'team_logo', { teamId: 7 })).toBe('team_logo/7/key.png')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ purpose: 'team_logo', contentType: 'image/png', teamId: 7 })
  })

  it('requires a valid team ID before sending a logo', async () => {
    await expect(uploadImage(png(), 'team_logo')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not PUT when the backend refuses presign', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'NOT_TEAM_LEADER', message: 'Denied' } }, 403))
    await expect(uploadImage(png(), 'team_logo', { teamId: 7 })).rejects.toMatchObject({ code: 'NOT_TEAM_LEADER' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not return a key after storage refuses PUT', async () => {
    fetchMock.mockResolvedValueOnce(json({ uploadUrl: 'https://storage.test/upload', objectKey: 'avatar/9/key.png' }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
    await expect(uploadImage(png(), 'avatar')).rejects.toMatchObject({ code: 'UPLOAD_FAILED', status: 403 })
  })

  it('makes a failed storage connection retryable in the UI', async () => {
    fetchMock.mockResolvedValueOnce(json({ uploadUrl: 'https://storage.test/upload', objectKey: 'avatar/9/key.png' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(uploadImage(png(), 'avatar')).rejects.toMatchObject({ code: 'UPLOAD_FAILED' })
  })
})

describe('image upload errors', () => {
  it.each(['AVATAR_KEY_NOT_FOUND', 'TEAM_LOGO_KEY_NOT_FOUND'])('tells the user to upload again for %s', code => {
    expect(imageUploadErrorMessage(new ApiError(422, { code, message: 'Invalid' }))).toContain('อัปโหลดใหม่')
  })
  it.each(['AVATAR_KEY_INVALID', 'TEAM_LOGO_KEY_INVALID', 'NOT_TEAM_LEADER', 'UNSUPPORTED_FILE_TYPE', 'STORAGE_UNAVAILABLE'])('explains %s even for an error from another client module instance', code => {
      expect(imageUploadErrorMessage({ code, message: 'Raw server text' })).not.toBe('Raw server text')
      expect(imageUploadErrorMessage({ code })).not.toContain('ไม่ทราบ')
    })
})

it('presigns dispute evidence for the match and uploads without backend Authorization', async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ uploadUrl: 'https://storage.test/put', objectKey: 'dispute_evidence/13/a.png' })))
    .mockResolvedValueOnce(new Response('', { status: 200 }))
  const key = await uploadImage(new File(['png'], 'a.png', { type: 'image/png' }), 'dispute_evidence', { matchId: 13 })
  expect(key).toBe('dispute_evidence/13/a.png')
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ purpose: 'dispute_evidence', contentType: 'image/png', matchId: 13 })
  expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ 'Content-Type': 'image/png' })
})
