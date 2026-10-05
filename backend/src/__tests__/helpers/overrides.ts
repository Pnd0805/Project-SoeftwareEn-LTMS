/**
 * `Partial<T>` ที่ยอมให้ "ใส่คีย์มา แต่ค่าเป็น undefined" ได้
 *
 * ═══ ทำไมต้องมีชนิดนี้ ═══
 * tsconfig เปิด `exactOptionalPropertyTypes` ⇒ สำหรับ TypeScript
 *     { }                  = ไม่มีคีย์ user
 *     { user: undefined }  = มีคีย์ user ค่าเป็น undefined
 * สองอันนี้ **คนละชนิดกัน** และ `Partial<Request>` รับได้แค่อันแรก
 *
 * แต่ makeReq() ของเทส controller ทุกไฟล์ตั้งค่าตั้งต้นเป็น user ที่ล็อกอินแล้ว
 * แล้ว spread overrides ทับ:
 *
 *     return { params : {...} , body : {} , user : { user_id : 7 } , ...overrides }
 *
 * ⇒ วิธีเขียนเทส "ไม่มีคนล็อกอิน" คือ **ยกเลิกค่าตั้งต้น** ด้วย makeReq({ user : undefined })
 *   ซึ่งการ spread จะได้คีย์ user ที่มีค่า undefined ไม่ใช่ไม่มีคีย์
 *
 * ★ สำหรับโค้ดที่ถูกทดสอบ สองอย่างนี้แยกไม่ออก — `req.user` อ่านได้ undefined เท่ากัน
 *   ⇒ นี่ไม่ใช่การเลี่ยงชนิดให้ผ่าน แต่เป็นการประกาศชนิดที่ตรงกับที่เทสต้องการจริง
 *
 * ทางเลือกอื่นที่ไม่เอา:
 *   - `as any` ตรงที่เรียก 91 จุด      ⇒ ปิดการตรวจทั้งก้อน รวมคีย์ที่พิมพ์ผิดด้วย
 *   - `delete req.user` หลังสร้าง      ⇒ เทสอ่านยากขึ้น และต้องแยกตัวแปรทุกจุด
 *   - ปิด exactOptionalPropertyTypes   ⇒ ลดความเข้มของทั้งโปรเจกต์เพื่อแก้เรื่องเทส
 */
export type Overrides<T> = { [K in keyof T]?: T[K] | undefined };
