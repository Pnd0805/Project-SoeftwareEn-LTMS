import { uploadImage } from '../../api/upload'
import { assertUploadSize } from '../../shared/uploadLimits'

/** ตอบรับแล้วต้องขอเอกสารไหม — backend คืน docsRequired false เมื่อมีเอกสารในการตรวจที่ค้างอยู่แล้ว */
export const needsIdentityDocs = (answer?: { requiresAdminApproval?: boolean; docsRequired?: boolean }) =>
  !!answer?.requiresAdminApproval && answer.docsRequired !== false

/** อัปโหลดเอกสารยืนยันตัวตนแล้วคืน key — ใช้ร่วมกันทั้งหน้าโปรไฟล์และ popup หลังตอบรับคำเชิญ */
export async function uploadIdentityDocs(files: File[]): Promise<string[]> {
  files.forEach(assertUploadSize)
  if (files.some(f => !['image/png', 'image/jpeg'].includes(f.type))) throw new Error('เลือกไฟล์ JPEG หรือ PNG เท่านั้น')
  const keys: string[] = []
  for (const file of files) keys.push(await uploadImage(file, 'referee_identity'))
  return keys
}
