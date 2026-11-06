import { uploadRefereeIdentityDocument } from '../../api/upload'
import { assertUploadSize } from '../../shared/uploadLimits'

/** ตอบรับแล้วต้องขอเอกสารไหม — backend คืน docsRequired false เมื่อมีเอกสารในการตรวจที่ค้างอยู่แล้ว */
export const needsIdentityDocs = (answer?: { requiresAdminApproval?: boolean; docsRequired?: boolean }) =>
  !!answer?.requiresAdminApproval && answer.docsRequired !== false

/** อัปโหลดเอกสารยืนยันตัวตนแล้วคืน key — ใช้ร่วมกันทั้งหน้าโปรไฟล์และ popup หลังตอบรับคำเชิญ */
export async function uploadIdentityDocs(files: File[]): Promise<string[]> {
  files.forEach(assertUploadSize)
  // 31 ต.ค. 2569 — รับ PDF ด้วย (backend เปิดให้ referee_identity แล้ว)
  if (files.some(f => !['application/pdf', 'image/png', 'image/jpeg'].includes(f.type))) throw new Error('เลือกไฟล์ PDF, JPEG หรือ PNG เท่านั้น')
  const keys: string[] = []
  for (const file of files) keys.push(await uploadRefereeIdentityDocument(file))
  return keys
}
