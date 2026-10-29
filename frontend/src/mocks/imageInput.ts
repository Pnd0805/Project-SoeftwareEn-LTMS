/**
 * src/mocks/imageInput.ts — รับรูปจากเครื่องผู้ใช้ในโหมด mock
 *
 * ไม่มี backend รับอัปโหลด จึงอ่านไฟล์ในเครื่องแล้วเก็บเป็น data URL
 *
 * ต้องย่อก่อนเสมอ: mock เก็บสถานะลง `localStorage` ซึ่งมีเพดานราว 5MB
 * รูปจากกล้องมือถือใบเดียวก็เกินแล้ว และเกินเมื่อไหร่ `setItem` จะโยน
 * QuotaExceededError ทำให้ทั้ง state บันทึกไม่ลง ไม่ใช่แค่รูปหาย
 *
 * ของจริงตาม NF-SE-03 อัปขึ้น S3 แล้วเก็บเป็น key ขอ presigned URL ตอนแสดง
 * — คนละทาง แต่ฟิลด์ `logoUrl` เดียวกันรองรับทั้งสองแบบ
 */

/** ขนาดสูงสุดของไฟล์ที่ยอมรับก่อนย่อ — กันไฟล์ใหญ่จนเบราว์เซอร์ค้างตอน decode */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/**
 * ย่อรูปให้ด้านยาวไม่เกิน `max` แล้วคืนเป็น data URL แบบ JPEG
 * ได้ไฟล์ราวสิบกิโล ซึ่งพอสำหรับอวาตาร์ 24–96px ทุกจุดในแอป
 */
export function shrinkImage(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('เลือกได้เฉพาะไฟล์รูปภาพ'))
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('ไฟล์ใหญ่เกิน 8MB — เลือกรูปที่เล็กกว่านี้'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('ไฟล์นี้ไม่ใช่รูปภาพที่เปิดได้'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('เบราว์เซอร์นี้วาดภาพลง canvas ไม่ได้'))
          return
        }
        /* พื้นขาวก่อนวาด — PNG โปร่งใสที่แปลงเป็น JPEG จะได้พื้นดำถ้าไม่ทำ */
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
