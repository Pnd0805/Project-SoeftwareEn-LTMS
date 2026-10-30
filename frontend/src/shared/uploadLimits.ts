export const IMAGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024
export const PDF_UPLOAD_MAX_BYTES = 10 * 1024 * 1024

/** ตรวจเพื่อแจ้งผู้ใช้ก่อนขอลิงก์อัปโหลด; การบังคับโควตาจริงยังเป็นหน้าที่ server */
export function assertUploadSize(file: Blob) {
  const pdf = file.type === 'application/pdf'
  if (file.size > (pdf ? PDF_UPLOAD_MAX_BYTES : IMAGE_UPLOAD_MAX_BYTES)) {
    throw new Error(`ไฟล์ใหญ่เกิน ${pdf ? '10' : '5'} MB กรุณาเลือกไฟล์ที่เล็กกว่านี้`)
  }
}
