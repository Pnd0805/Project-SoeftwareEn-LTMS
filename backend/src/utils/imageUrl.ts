import { env } from '../config/env.js';

// ประกอบ URL สาธารณะตรงๆ ไม่ต้อง presign — ใช้กับ avatar/team_logo เท่านั้น (ตั้งใจให้ทุกคนเห็นอยู่แล้ว ต่าง
// จากเอกสารส่วนตัวที่ต้อง presign) ไม่หมดอายุ cache ได้ เรียกซ้ำในลิสต์ยาวๆ ได้โดยไม่มีต้นทุนเพิ่ม (ไม่ยิง S3 เลย)
// อยู่ใน utils/ ไม่ใช่ services/upload.service.ts เพราะ mapper ต้องเรียกใช้ตรงๆ — mapper ห้ามพึ่ง service (ผิดลำดับชั้น)
/**
 * ★ รับ `undefined` ด้วย และถือเท่ากับ "ไม่มีรูป" (แก้ 4 ต.ค. 2569 · OD-61)
 *
 * 🔴 เดิมเช็กแค่ `=== null` ⇒ ถ้า row ที่ส่งมาไม่มีคอลัมน์นั้นเลย (query ลืม SELECT
 *   หรือ type ถูก cast ข้าม) ค่าที่ได้คือ `undefined` แล้วฟังก์ชันคืน
 *   `".../undefined"` ออกไป ⇒ หน้าจอได้ URL ที่โหลดไม่ขึ้นแทนที่จะได้ "ไม่มีรูป"
 *   = รูปแตกทั่วหน้า และไล่ต้นตอยากเพราะ API ตอบ 200 พร้อม string ที่ดูเหมือนถูก
 *
 *   `tsc` กันเคสนี้ได้เฉพาะทางที่ type ครบจริง ⇒ กันอีกชั้นที่นี่ถูกกว่า
 */
export function toPublicImageUrl(objectKey: string | null | undefined): string | null {
    if (objectKey === null || objectKey === undefined) return null;
    return `${env.S3_PUBLIC_BASE}/${objectKey}`;
}
