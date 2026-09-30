import { apiFetch, ApiError, USE_MOCK } from './client'
import { shrinkImage } from '../mocks/imageInput'

export async function uploadImage(
  file: File,
  purpose: 'avatar' | 'team_logo',
  options: { teamId?: number } = {}
): Promise<string> {
  if (USE_MOCK) {
    return shrinkImage(file)
  }

  const contentType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const presign = await apiFetch<{ uploadUrl: string; objectKey: string }>('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({
      purpose,
      contentType,
      ...(purpose === 'team_logo' ? { teamId: options.teamId } : {}),
    }),
  })

  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
  })

  if (!put.ok) {
    throw new ApiError(put.status, {
      code: 'UPLOAD_FAILED',
      message: 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    })
  }

  return presign.objectKey
}
