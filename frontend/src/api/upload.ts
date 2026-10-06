import { apiFetch, ApiError, USE_MOCK } from './client'
import { shrinkImage } from '../mocks/imageInput'

export const UPLOAD_IMAGE_ACCEPT = 'image/png,image/jpeg'

/** ข้อความของการบันทึกรูปใช้ร่วมกันทั้ง avatar และโลโก้ รวมกรณี HMR เปลี่ยนคลาส ApiError */
export function imageUploadErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  switch (code) {
    case 'AVATAR_KEY_INVALID': return 'รูปโปรไฟล์นี้ใช้กับบัญชีของคุณไม่ได้ กรุณาอัปโหลดรูปใหม่'
    case 'TEAM_LOGO_KEY_INVALID': return 'โลโก้นี้ใช้กับทีมนี้ไม่ได้ กรุณาอัปโหลดรูปใหม่'
    case 'AVATAR_KEY_NOT_FOUND':
    case 'TEAM_LOGO_KEY_NOT_FOUND': return 'ไม่พบไฟล์รูปที่อัปโหลดไว้ กรุณาเลือกไฟล์และอัปโหลดใหม่'
    case 'NOT_TEAM_LEADER': return 'เฉพาะหัวหน้าทีมเท่านั้นที่เปลี่ยนโลโก้ได้'
    case 'UNSUPPORTED_FILE_TYPE': return 'กรุณาเลือกไฟล์ PNG หรือ JPEG เท่านั้น'
    case 'STORAGE_UNAVAILABLE': return 'ระบบจัดเก็บรูปไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'
    case 'UPLOAD_FAILED': return 'อัปโหลดรูปไม่สำเร็จ กรุณาลองอัปโหลดใหม่'
  }
  if (error instanceof TypeError) return 'เชื่อมต่อระบบอัปโหลดไม่ได้ กรุณาลองใหม่'
  return error instanceof Error ? error.message : 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่'
}

export async function uploadImage(
  file: File,
  purpose: 'avatar' | 'team_logo' | 'dispute_evidence' | 'referee_identity',
  options: { teamId?: number; matchId?: number } = {}
): Promise<string> {
  if (USE_MOCK) return shrinkImage(file)

  // ไม่เปลี่ยน MIME label ของ GIF/WebP ให้เป็น JPEG โดยที่เนื้อไฟล์ยังเป็นชนิดเดิม
  const contentType = file.type
  if (contentType !== 'image/png' && contentType !== 'image/jpeg') {
    throw new ApiError(400, { code: 'UNSUPPORTED_FILE_TYPE', message: 'กรุณาเลือกไฟล์ PNG หรือ JPEG เท่านั้น' })
  }
  if (purpose === 'team_logo' && (!Number.isSafeInteger(options.teamId) || (options.teamId ?? 0) < 1)) {
    throw new ApiError(400, { code: 'VALIDATION_FAILED', message: 'ไม่พบทีมที่จะเปลี่ยนโลโก้ กรุณาเปิดหน้าทีมใหม่' })
  }

  if (purpose === 'dispute_evidence' && (!Number.isSafeInteger(options.matchId) || (options.matchId ?? 0) < 1)) {
    throw new ApiError(400, { code: 'VALIDATION_FAILED', message: 'A valid match is required for evidence upload.' })
  }

  const presign = await apiFetch<{ uploadUrl: string; objectKey: string }>('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ purpose, contentType, ...(purpose === 'team_logo' ? { teamId: options.teamId } : {}), ...(purpose === 'dispute_evidence' ? { matchId: options.matchId } : {}) }),
  })

  let put: Response
  try {
    // URL นี้มีลายเซ็นอยู่แล้ว ไม่ส่ง bearer token ของ backend ไป storage
    put = await fetch(presign.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } })
  } catch {
    throw new ApiError(0, { code: 'UPLOAD_FAILED', message: 'อัปโหลดรูปไม่สำเร็จ กรุณาลองอัปโหลดใหม่' })
  }
  if (!put.ok) {
    throw new ApiError(put.status, { code: 'UPLOAD_FAILED', message: 'อัปโหลดรูปไม่สำเร็จ กรุณาลองอัปโหลดใหม่' })
  }
  return presign.objectKey
}
