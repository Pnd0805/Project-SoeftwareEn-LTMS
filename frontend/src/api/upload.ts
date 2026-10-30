import { apiFetch, ApiError, USE_MOCK } from './client'
import { shrinkImage } from '../mocks/imageInput'
import { assertUploadSize } from '../shared/uploadLimits'

export const UPLOAD_IMAGE_ACCEPT = 'image/png,image/jpeg'
/** "เอกสาร" ที่ backend รับ PDF (M16): คำขอทีม Official (T15) · ยืนยันตัวตนกรรมการภายนอก (U12 — 31 ต.ค. 2569) */
export const OFFICIAL_DOC_ACCEPT = 'application/pdf,image/png,image/jpeg'
export const IDENTITY_DOC_ACCEPT = OFFICIAL_DOC_ACCEPT
const OFFICIAL_DOC_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])

/** ข้อความของการบันทึกรูปใช้ร่วมกันทั้ง avatar และโลโก้ รวมกรณี HMR เปลี่ยนคลาส ApiError */
export function imageUploadErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error && error.status === 429) return 'ขออัปโหลดถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  switch (code) {
    case 'REFEREE_IDENTITY_KEY_INVALID': return 'เอกสารนี้ใช้ยืนยันตัวตนของบัญชีคุณไม่ได้ กรุณาอัปโหลดเอกสาร PDF, JPEG หรือ PNG ใหม่จากบัญชีนี้ แล้วส่งอีกครั้ง'
    case 'AVATAR_KEY_INVALID': return 'รูปโปรไฟล์นี้ใช้กับบัญชีของคุณไม่ได้ กรุณาอัปโหลดรูปใหม่'
    case 'TEAM_LOGO_KEY_INVALID': return 'โลโก้นี้ใช้กับทีมนี้ไม่ได้ กรุณาอัปโหลดรูปใหม่'
    case 'AVATAR_KEY_NOT_FOUND':
    case 'TEAM_LOGO_KEY_NOT_FOUND': return 'ไม่พบไฟล์รูปที่อัปโหลดไว้ กรุณาเลือกไฟล์และอัปโหลดใหม่'
    case 'NOT_TEAM_LEADER': return 'เฉพาะหัวหน้าทีมเท่านั้นที่เปลี่ยนโลโก้ได้'
    case 'TEAM_OFFICIAL_DOC_INVALID': return 'เอกสารนี้ใช้กับคำขอของทีมนี้ไม่ได้ กรุณาอัปโหลดไฟล์ใหม่'
    case 'TEAM_OFFICIAL_DOC_NOT_FOUND': return 'ไม่พบไฟล์เอกสารที่อัปโหลดไว้ กรุณาเลือกไฟล์และอัปโหลดใหม่'
    case 'UNSUPPORTED_FILE_TYPE': return 'กรุณาเลือกไฟล์ PNG หรือ JPEG เท่านั้น'
    case 'STORAGE_UNAVAILABLE': return 'ระบบจัดเก็บรูปไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง'
    case 'UPLOAD_FAILED': return 'อัปโหลดรูปไม่สำเร็จ กรุณาลองอัปโหลดใหม่'
  }
  if (error instanceof TypeError) return 'เชื่อมต่อระบบอัปโหลดไม่ได้ กรุณาลองใหม่'
  return error instanceof Error ? error.message : 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่'
}

export async function uploadImage(
  file: File,
  purpose: 'avatar' | 'team_logo' | 'dispute_evidence' | 'referee_identity' | 'report_evidence',
  options: { teamId?: number; matchId?: number } = {}
): Promise<string> {
  assertUploadSize(file)
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

  return presignAndPut(file, contentType, {
    purpose, contentType,
    ...(purpose === 'team_logo' ? { teamId: options.teamId } : {}),
    ...(purpose === 'dispute_evidence' ? { matchId: options.matchId } : {}),
  })
}

/**
 * เอกสารประกอบคำขอทีม Official — 30 ต.ค. 2569 เปลี่ยนจาก "พิมพ์ข้อความ" เป็น "อัปโหลดไฟล์"
 * (เดิมคิวแอดมินเซ็นทุกบรรทัดเป็นลิงก์ไฟล์ ⇒ แอดมินเปิดไม่ได้ทุกใบ) · รับ PDF / PNG / JPEG
 * ★ โหมด mock ไม่มีที่เก็บไฟล์ — คืนชื่อไฟล์ไว้แสดงในคิวแอดมินจำลอง
 */
export async function uploadTeamOfficialDocument(file: File, teamId: number): Promise<string> {
  assertUploadSize(file)
  if (!OFFICIAL_DOC_TYPES.has(file.type)) {
    throw new ApiError(400, { code: 'UNSUPPORTED_FILE_TYPE', message: 'กรุณาเลือกไฟล์ PDF, PNG หรือ JPEG เท่านั้น' })
  }
  if (USE_MOCK) return file.name
  if (!Number.isSafeInteger(teamId) || teamId < 1) {
    throw new ApiError(400, { code: 'VALIDATION_FAILED', message: 'ไม่พบทีมที่จะยื่นเอกสาร กรุณาเปิดหน้าทีมใหม่' })
  }
  return presignAndPut(file, file.type, { purpose: 'team_official_document', contentType: file.type, teamId })
}

/**
 * เอกสารยืนยันตัวตนกรรมการภายนอก — 31 ต.ค. 2569 รับ PDF ด้วย (ผู้ใช้แจ้ง "ส่งเป็น pdf ไม่ได้")
 * ★ ไม่ผ่าน uploadImage เพราะตัวนั้นรับแค่รูป · คิวแอดมิน (IdentityDocs) แสดง PDF เป็นลิงก์เปิดไฟล์อยู่แล้ว
 */
export async function uploadRefereeIdentityDocument(file: File): Promise<string> {
  assertUploadSize(file)
  if (!OFFICIAL_DOC_TYPES.has(file.type)) {
    throw new ApiError(400, { code: 'UNSUPPORTED_FILE_TYPE', message: 'กรุณาเลือกไฟล์ PDF, PNG หรือ JPEG เท่านั้น' })
  }
  if (USE_MOCK) return file.type === 'application/pdf' ? file.name : shrinkImage(file)
  return presignAndPut(file, file.type, { purpose: 'referee_identity', contentType: file.type })
}

/** ขอ URL อัปโหลด (M16) แล้ว PUT ไฟล์ขึ้นที่เก็บ · คืน object key เมื่อ PUT สำเร็จเท่านั้น */
async function presignAndPut(file: File, contentType: string, body: Record<string, unknown>): Promise<string> {
  const presign = await apiFetch<{ uploadUrl: string; objectKey: string }>('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify(body),
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
