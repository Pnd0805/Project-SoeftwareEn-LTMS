import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import { ApiError, setAccessToken } from './client'
import { imageUploadErrorMessage, uploadImage, uploadTeamOfficialDocument } from './upload'
import { IMAGE_UPLOAD_MAX_BYTES, PDF_UPLOAD_MAX_BYTES } from '../shared/uploadLimits'

const fetchMock = vi.fn()
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status })
const png = () => new File(['png'], 'photo.png', { type: 'image/png' })
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); setAccessToken('backend-test-token') })
afterEach(() => { setAccessToken(null); vi.unstubAllGlobals() })

describe('real image uploads', () => {
  it.each(['avatar', 'team_logo', 'dispute_evidence', 'referee_identity', 'report_evidence'] as const)('rejects oversized %s before presign', async purpose => {
    const file = png(); Object.defineProperty(file, 'size', { value: IMAGE_UPLOAD_MAX_BYTES + 1 })
    await expect(uploadImage(file, purpose, { teamId: 7, matchId: 13 })).rejects.toThrow('5 MB')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each([['image/png', IMAGE_UPLOAD_MAX_BYTES, '5 MB'], ['application/pdf', PDF_UPLOAD_MAX_BYTES, '10 MB']] as const)('rejects oversized official %s documents before presign', async (type, limit, message) => {
    const file = new File(['x'], 'doc', { type }); Object.defineProperty(file, 'size', { value: limit + 1 })
    await expect(uploadTeamOfficialDocument(file, 7)).rejects.toThrow(message)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each([['image/png', IMAGE_UPLOAD_MAX_BYTES], ['application/pdf', PDF_UPLOAD_MAX_BYTES]] as const)('accepts %s at exactly the size limit', async (type, limit) => {
    const file = new File(['x'], 'doc', { type }); Object.defineProperty(file, 'size', { value: limit })
    fetchMock.mockResolvedValueOnce(json({ uploadUrl: 'https://storage.test/doc', objectKey: 'doc/key' })).mockResolvedValueOnce(new Response(null, { status: 200 }))
    await expect(uploadTeamOfficialDocument(file, 7)).resolves.toBe('doc/key')
  })
  it('explains upload throttling and never sends a PUT after 429', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'RATE_LIMITED', message: 'Raw limit' } }, 429))
    let error: unknown
    try { await uploadImage(png(), 'avatar') } catch (failure) { error = failure }
    expect(imageUploadErrorMessage(error)).toContain('ขออัปโหลดถี่เกินไป')
    expect(error).toMatchObject({ status: 429, message: expect.stringContaining('รอสักครู่') })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('uploads identity documents under the authenticated user without sending backend credentials to storage', async () => {
    const key = 'referee_identity/9/00000000-0000-4000-8000-000000000009.png'
    fetchMock.mockResolvedValueOnce(json({ uploadUrl: 'https://storage.test/private-identity', objectKey: key }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    expect(await uploadImage(png(), 'referee_identity')).toBe(key)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ purpose: 'referee_identity', contentType: 'image/png' })
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ 'Content-Type': 'image/png' })
  })
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
  it.each(['REFEREE_IDENTITY_KEY_INVALID', 'AVATAR_KEY_INVALID', 'TEAM_LOGO_KEY_INVALID', 'NOT_TEAM_LEADER', 'UNSUPPORTED_FILE_TYPE', 'STORAGE_UNAVAILABLE'])('explains %s even for an error from another client module instance', code => {
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
