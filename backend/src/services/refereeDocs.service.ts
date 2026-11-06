import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import * as UploadService from './upload.service.js';

/**
 * OD-70 (งาน ⑥ · 29 ต.ค. 2569) — ลบภาพยืนยันตัวตนกรรมการภายนอกเมื่อหมดหน้าที่
 *
 * ปัญหา: เอกสารสัญญาว่าจะลบ แต่โค้ดไม่เคยลบไฟล์ใน MinIO เลย
 *   ตอนแอดมินตัดสิน (อนุมัติ / ปฏิเสธ / ขอเอกสารใหม่) repo ล้างแค่คีย์ในฐาน
 *   ⇒ ไฟล์ค้างตลอดไปโดยไม่มีอะไรชี้ถึง ⇒ งานที่หาแถว "ยังมีคีย์" อย่างเดียวเก็บไฟล์พวกนี้ไม่ได้
 *
 * จึงลบสามทาง:
 *   ① ตอนตัดสิน — deleteDocsNoLongerReferenced (เรียกจาก refereeAdmin.service)
 *   ② แถวที่ยังถือคีย์หลังทัวร์จบเกิน 30 วัน — purgeRefereeIdentityDocs (งานเบื้องหลัง · ใบสั่งงานขั้น 2–3)
 *   ③ ไฟล์ที่ไม่มีแถวไหนชี้ถึง (ของเก่าก่อนมีงานนี้ + ลบพลาดใน ①) — sweepOrphanRefereeDocs (งานเบื้องหลัง)
 *
 * ★ ทุกทาง: ลบแค่ไฟล์กับคีย์ **ไม่แตะผลการตรวจ** (external_approval_status · approved_at) — ข้อ 2.3
 *   ผลอนุมัติใช้ข้ามทัวร์ได้ 1 ปี (มติ 6 ต.ค.) ภาพจำเป็นแค่ช่วงที่แอดมินกำลังตรวจ
 * ★ ลบทีละคีย์เสมอ — ไม่มีการลบทั้งโฟลเดอร์หรือทั้ง bucket
 */

/** ข้อ 2.2 — เก็บภาพต่อกี่วันหลังทัวร์จบ (เผื่อเรื่องโต้แย้งหลังจบ) · เปลี่ยนที่นี่ที่เดียว */
export const REFEREE_DOCS_RETENTION_DAYS = 30;

/**
 * ③ ไฟล์ที่ไม่มีแถวชี้ถึงต้องเก่ากว่านี้ก่อนถึงจะลบ
 * เพราะ user อัปโหลดไฟล์ก่อน (ลิงก์ presign) แล้วค่อยกดส่งเอกสาร — ระหว่างนั้นไฟล์ยังไม่มีแถวชี้ถึง
 * ไม่รอ = ลบไฟล์ของคนที่กำลังกรอกฟอร์มอยู่
 */
export const ORPHAN_DOCS_GRACE_DAYS = 7;

/**
 * ① หลังแอดมินตัดสิน — ลบไฟล์ที่ **ไม่มีแถวไหนของคนนี้ชี้ถึงอีกแล้ว**
 *
 * ผู้เรียกส่งคีย์ที่อ่านไว้ **ก่อน** ตัดสิน · ที่นี่อ่านใหม่ **หลัง** ตัดสิน แล้วลบเฉพาะส่วนต่าง
 *   ⇒ ไม่ต้องลอกเงื่อนไข WHERE ของ approve/reject/needs_docs มาไว้อีกที่ (ถ้าลอก วันหนึ่งจะไม่ตรงกัน)
 *   ⇒ แถวที่การตัดสินไม่ได้แตะ (เช่นแถวที่ถูกถอดแล้วยังถือคีย์อยู่) ไฟล์ของมันไม่ถูกลบใต้เท้า
 * ★ ลำดับต่างจากงาน ②: ที่นี่คีย์ถูกล้างไปก่อนแล้วโดยการตัดสิน (การตัดสินต้องไม่ล้มเพราะที่เก็บไฟล์ล่ม)
 *   ถ้าลบไฟล์พลาด ไฟล์จะกลายเป็นไฟล์ไม่มีเจ้าของ ⇒ งาน ③ เก็บให้ภายหลัง ไม่หายเงียบ
 * ★ ห้าม throw — การตัดสินสำเร็จไปแล้ว ผู้ใช้ไม่ควรเห็น error เพราะการเก็บกวาด
 */
export async function deleteDocsNoLongerReferenced(userId : number, keysBefore : string[]): Promise<number>{
    if(keysBefore.length === 0) return 0;
    try {
        const stillReferenced = new Set(await RefRepo.findDocKeysOfUser(userId));
        let deleted = 0;
        for(const key of keysBefore){
            if(stillReferenced.has(key)) continue;
            if(await UploadService.deleteObjectConfirmed(key)) deleted++;
        }
        return deleted;
    } catch (err) {
        console.error(`[referee-docs] ลบไฟล์หลังตัดสินของ user ${userId} ไม่สำเร็จ — งานกวาดไฟล์จะเก็บให้`, err);
        return 0;
    }
}

/**
 * ② งานเบื้องหลัง — แถวที่ยังถือคีย์ แต่ทัวร์จบไปแล้วเกิน REFEREE_DOCS_RETENTION_DAYS วัน
 *
 * 🔴 ลำดับ (ใบสั่งงานขั้น 3): **ลบไฟล์ก่อน แล้วค่อยปิดแถว**
 *   ถ้าปิดแถวก่อนแล้วลบไฟล์พลาด คีย์หายไปแล้ว ไฟล์จะค้างโดยไม่มีใครรู้ว่าอยู่ไหน
 * ★ ปิดแถวเฉพาะเมื่อลบไฟล์ **ครบทุกตัว** ของแถวนั้น — พลาดตัวเดียว แถวคงเดิม รอบหน้าลองใหม่
 * ★ ไฟล์ที่แถวอื่นของคนเดียวกันยังชี้อยู่ ไม่ลบ (submitDocsForUser ใส่คีย์ชุดเดียวกันให้หลายแถว)
 *   แถวที่ถือไฟล์นั้นอยู่ก็ยังไม่ปิด — รอจนทุกแถวที่ชี้ถึงเข้าเกณฑ์พร้อมกัน
 * คืนจำนวนแถวที่ปิด (ให้ log ของ scheduler มีตัวเลขเหมือนงานอื่น)
 */
export async function purgeRefereeIdentityDocs(): Promise<number>{
    const rows = await RefRepo.findPurgeableIdentityDocRows(REFEREE_DOCS_RETENTION_DAYS);
    if(rows.length === 0) return 0;

    const elsewhere = await RefRepo.findDocKeysOnOtherRows(
        [...new Set(rows.map(r => r.user_id))], rows.map(r => r.tournament_referee_id));

    const result = new Map<string, boolean>();   // คีย์เดียวกันอาจอยู่หลายแถวที่เข้าเกณฑ์ — ลบครั้งเดียว
    let closed = 0;
    for(const row of rows){
        const keys = row.external_verification_docs;
        if(keys.some(k => elsewhere.has(k))) continue;
        for(const key of keys){
            if(!result.has(key)) result.set(key, await UploadService.deleteObjectConfirmed(key));
        }
        if(keys.every(k => result.get(k) === true) && await RefRepo.closePurgedDocsRow(row.tournament_referee_id, keys)){
            closed++;
        }
    }
    return closed;
}

/**
 * ③ งานเบื้องหลัง — ไฟล์ใต้ `referee_identity/` ที่ไม่มีแถวไหนชี้ถึง และเก่ากว่า ORPHAN_DOCS_GRACE_DAYS วัน
 *
 * ★ เก็บไฟล์ที่ ① ทิ้งไว้ก่อนมีงานนี้ (ภาพของทุกคนที่เคยถูกตัดสิน) และที่ ① ลบพลาด
 * 🔴 **ต่างจากข้อห้าม 7 ของใบสั่งงาน** ("ห้ามลบด้วย prefix") — ผู้ใช้ตัดสินให้ทำ 29 ต.ค. เพราะไม่งั้นไฟล์เก่าไม่มีวันถูกลบ
 *   ยังคงเจตนาของข้อห้าม: ใช้ prefix แค่ **ไล่รายชื่อ** · ลบทีละคีย์ · ลบเฉพาะไฟล์ที่ไม่มีแถวชี้ถึง
 *   + ต้องเป็นรูปชื่อไฟล์ยืนยันตัวตนเป๊ะ (isRefereeIdentityKey) ไฟล์อื่นใต้ prefix เดียวกันไม่แตะ
 * ★ อ่านรายชื่อไฟล์ **ก่อน** อ่านคีย์ในฐาน — ไฟล์ที่ถูกส่งเข้าแถวระหว่างนั้นจะอยู่ในชุดคีย์ที่อ่านทีหลัง ไม่ถูกลบผิด
 * คืนจำนวนไฟล์ที่ลบ
 */
export async function sweepOrphanRefereeDocs(now = new Date()): Promise<number>{
    const objects = await UploadService.listObjectsByPrefix(UploadService.REFEREE_IDENTITY_PREFIX);
    if(objects.length === 0) return 0;
    const referenced = await RefRepo.findAllReferencedIdentityKeys();
    const cutoff = now.getTime() - ORPHAN_DOCS_GRACE_DAYS * 24 * 60 * 60 * 1000;

    let deleted = 0;
    for(const obj of objects){
        if(!UploadService.isRefereeIdentityKey(obj.key)) continue;
        if(referenced.has(obj.key)) continue;
        // "เก่ากว่า" 7 วัน — อายุเท่ากับ 7 วันพอดียังไม่ลบ
        if(obj.lastModified === null || obj.lastModified.getTime() >= cutoff) continue;
        if(await UploadService.deleteObjectConfirmed(obj.key)) deleted++;
    }
    return deleted;
}
