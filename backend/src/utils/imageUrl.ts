import { env } from '../config/env.js';

// ประกอบ URL สาธารณะตรงๆ ไม่ต้อง presign — ใช้กับ avatar/team_logo เท่านั้น (ตั้งใจให้ทุกคนเห็นอยู่แล้ว ต่าง
// จากเอกสารส่วนตัวที่ต้อง presign) ไม่หมดอายุ cache ได้ เรียกซ้ำในลิสต์ยาวๆ ได้โดยไม่มีต้นทุนเพิ่ม (ไม่ยิง S3 เลย)
// อยู่ใน utils/ ไม่ใช่ services/upload.service.ts เพราะ mapper ต้องเรียกใช้ตรงๆ — mapper ห้ามพึ่ง service (ผิดลำดับชั้น)
export function toPublicImageUrl(objectKey: string | null): string | null {
    if (objectKey === null) return null;
    return `${env.S3_PUBLIC_BASE}/${objectKey}`;
}
