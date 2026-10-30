import * as MatchRepo from '../repositories/match.repo.js';
import * as UploadService from './upload.service.js';

/**
 * OD-73 (29 ต.ค. 2569) — ลบรูปบัตรนักศึกษา/บัตรประชาชนที่ผู้เล่นส่งตอนเช็คอินออนไลน์ (photo_online)
 *
 * ปัญหา: ไม่มีโค้ดไหนลบไฟล์ `checkin_document/` เลย ⇒ รูปบัตรของผู้เล่นทุกคนค้างใน MinIO ตลอดไป
 *   และตอนส่งรูปใหม่ทับแถวที่ถูกปฏิเสธ (reCheckin) รูปเก่าก็ค้างโดยไม่มีแถวชี้ถึง
 *   หลักการเดียวกับ OD-70 (ภาพบัตรกรรมการ) — ข้อมูลส่วนบุคคล เก็บเท่าที่จำเป็น
 *
 * ลบสองทาง:
 *   ① แถวที่ยังถือรูป แต่หมดเวลาโต้แย้ง/ร้องเรียนแล้ว (กฎ QA 30 ต.ค. · ดู MatchRepo.findPurgeableCheckinDocs) — purgeCheckinDocuments
 *   ② ไฟล์ที่ไม่มีแถวไหนชี้ถึง (ส่งทับ · อัปแล้วไม่กดส่ง · ทัวร์ถูกลบทั้งแถว) — sweepOrphanCheckinDocs
 *
 * ★ ลบแค่ไฟล์กับคีย์ **ไม่แตะผลเช็คอิน** (สถานะ · ชนิดบัตร · กรรมการที่ตรวจ · เวลา) — ยังเป็นหลักฐานว่าใครเช็คอิน
 * ★ ลบทีละคีย์เสมอ — ไม่มีการลบทั้งโฟลเดอร์
 * ★ ไม่ทำกับรูปโปรไฟล์/โลโก้ทีม — สองอย่างนั้นลบรูปเก่าตอนเปลี่ยนรูปอยู่แล้ว และไม่ใช่เอกสารยืนยันตัวตน (ผู้ใช้เคาะ 29 ต.ค.)
 */

/**
 * ระยะกันชน **หลังหมดเวลาโต้แย้ง** (verified_at + dispute_window_hours) — และหลังทัวร์ถูกยกเลิก/ลบ
 * 🔴 QA 30 ต.ค. 2569 (D2) — เดิม (OD-73 · 29 ต.ค.) นับ 3 วัน "จากแมตช์จบ" ⇒ รูปหายทั้งที่ยังโต้แย้ง/ร้องเรียนได้
 *   ชื่อเดิมยังสื่อความ (เก็บต่ออีกกี่วัน) จึงคงชื่อไว้ · กฎเต็มอยู่ที่ MatchRepo.findPurgeableCheckinDocs
 */
export const CHECKIN_DOCS_RETENTION_DAYS = 3;

/**
 * ทางสำรอง: แมตช์ที่ **ไม่เคยมีผลยืนยัน** (ค้าง · แพ้บาย · ผลถูกยกทิ้ง) ลบเมื่อจบเกินกี่วัน
 * ★ ไม่มีค่านี้ = รูปของแมตช์พวกนั้นค้างตลอดกาล (แถวยังถือคีย์ งานกวาดไฟล์ไม่มีเจ้าของจึงไม่เก็บ)
 */
export const CHECKIN_DOCS_UNVERIFIED_FALLBACK_DAYS = 30;

/**
 * ② ไฟล์ที่ไม่มีแถวชี้ถึงต้องเก่ากว่านี้ก่อนถึงจะลบ
 * เพราะผู้เล่นอัปรูปก่อน (ลิงก์ presign อายุ 20 นาที) แล้วค่อยกดเช็คอิน — ระหว่างนั้นไฟล์ยังไม่มีแถวชี้ถึง
 * 1 วันเหลือเฟือ: ขอลิงก์อัปโหลดได้เฉพาะตอนเปิดเช็คอิน (ไม่กี่ชั่วโมง)
 */
export const ORPHAN_CHECKIN_DOCS_GRACE_DAYS = 1;

/**
 * ① งานเบื้องหลัง — แถวเช็คอินที่ยังถือรูป แต่หมดหน้าที่แล้ว (กฎอยู่ที่ MatchRepo.findPurgeableCheckinDocs)
 *
 * 🔴 ลำดับ: **ลบไฟล์ก่อน แล้วค่อยล้างคีย์** — ล้างก่อนแล้วลบพลาด = ไฟล์ค้างโดยไม่มีใครรู้ว่าอยู่ไหน
 *    (② จะเก็บได้ก็จริง แต่ไม่ควรพึ่งตาข่ายชั้นสองเป็นทางหลัก)
 * ★ ไฟล์ที่แถวซึ่งยังไม่หมดหน้าที่ชี้อยู่ด้วย ไม่ลบ — ตอนเช็คอินยังไม่ตรวจรูปร่าง key จึงชี้ข้ามแถวได้
 * ★ key ที่ไม่ใช่รูปเช็คอินของแมตช์นั้น (เช่นชี้ไปรูปโปรไฟล์ของใครสักคน) — **ไม่ลบไฟล์** แค่ตัดการชี้
 *    ไฟล์นั้นเป็นของอย่างอื่น ลบแล้วจะไปพังที่อื่น
 * คืนจำนวนแถวที่ล้าง (ให้ log ของ scheduler มีตัวเลขเหมือนงานอื่น)
 */
export async function purgeCheckinDocuments(): Promise<number>{
    const rows = await MatchRepo.findPurgeableCheckinDocs(CHECKIN_DOCS_RETENTION_DAYS, CHECKIN_DOCS_UNVERIFIED_FALLBACK_DAYS);
    if(rows.length === 0) return 0;

    const purgeable = new Set(rows.map(r => r.match_checkin_id));
    const holders = await MatchRepo.findCheckinRowsByDocKeys([...new Set(rows.map(r => r.document_s3_key))]);
    const heldElsewhere = new Set(holders.filter(h => !purgeable.has(h.match_checkin_id)).map(h => h.document_s3_key));

    const deleted = new Map<string, boolean>();   // คีย์เดียวกันอาจอยู่หลายแถว — ลบครั้งเดียว
    let cleared = 0;
    for(const row of rows){
        const key = row.document_s3_key;
        if(heldElsewhere.has(key)) continue;
        if(UploadService.isCheckinDocumentKey(key, row.match_id)){
            if(!deleted.has(key)) deleted.set(key, await UploadService.deleteObjectConfirmed(key));
            if(deleted.get(key) !== true) continue;   // ลบพลาด — แถวคงเดิม รอบหน้าลองใหม่
        }
        if(await MatchRepo.clearCheckinDocument(row.match_checkin_id, key)) cleared++;
    }
    return cleared;
}

/**
 * ② งานเบื้องหลัง — ไฟล์ใต้ `checkin_document/` ที่ไม่มีแถวไหนชี้ถึง และเก่ากว่า ORPHAN_CHECKIN_DOCS_GRACE_DAYS วัน
 * ★ ใช้ prefix แค่ **ไล่รายชื่อ** · ลบทีละคีย์ · ต้องเป็นรูปชื่อไฟล์เช็คอินเป๊ะ (ไฟล์อื่นใต้ prefix เดียวกันไม่แตะ)
 * ★ อ่านรายชื่อไฟล์ **ก่อน** อ่านคีย์ในฐาน — ไฟล์ที่ถูกส่งเข้าแถวระหว่างนั้นจะอยู่ในชุดคีย์ที่อ่านทีหลัง ไม่ถูกลบผิด
 * คืนจำนวนไฟล์ที่ลบ
 */
export async function sweepOrphanCheckinDocs(now = new Date()): Promise<number>{
    const objects = await UploadService.listObjectsByPrefix(UploadService.CHECKIN_DOCUMENT_PREFIX);
    if(objects.length === 0) return 0;
    const referenced = await MatchRepo.findAllReferencedCheckinDocKeys();
    const cutoff = now.getTime() - ORPHAN_CHECKIN_DOCS_GRACE_DAYS * 24 * 60 * 60 * 1000;

    let deleted = 0;
    for(const obj of objects){
        if(!UploadService.isCheckinDocumentKey(obj.key)) continue;
        if(referenced.has(obj.key)) continue;
        // "เก่ากว่า" 1 วัน — อายุเท่ากับ 1 วันพอดียังไม่ลบ
        if(obj.lastModified === null || obj.lastModified.getTime() >= cutoff) continue;
        if(await UploadService.deleteObjectConfirmed(obj.key)) deleted++;
    }
    return deleted;
}
