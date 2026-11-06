import { env } from '../config/env.js';

/**
 * งานเบื้องหลังที่รันตามเวลา — ชั่วโมงละครั้ง (มติ 8 ต.ค. 2569)
 *
 * 🔴 ทับมติ 30 ก.ย. 2569 ที่ให้ "กวาดตอนมีคนเปิดหน้าทีม"
 *   เหตุที่เปลี่ยน: การกวาดถูกเรียกใน `getTeamById()` และ `getMyTeam()`
 *   ⇒ **คนอ่านเป็นคนจ่ายค่ากวาด** ทุกครั้ง และค่านั้นโตตามจำนวนทีม
 *   A2 ทำให้เร็วขึ้นจาก ~40 วินาที เหลือ ~150 ms แต่โครงยังเหมือนเดิม — อีกปีก็กลับมาช้าอีก
 *   กฎ "ไม่ใช้งาน 14 วัน / 6 เดือน" ไม่ต้องการความแม่นระดับวินาทีอยู่แล้ว
 *
 * 🔴 ราคาที่จ่าย: ทีม/ทัวร์ที่เข้าเกณฑ์จะยังเห็นอยู่ **นานสุดเท่าช่วงเวลาของรอบ** (1 ชั่วโมง)
 *   ของเดิมหายทันทีที่มีคนเปิดหน้า · ★ แต่ "ทันที" ของเดิมก็ไม่ได้แน่นอนอยู่แล้ว
 *   ถ้าไม่มีใครเปิดหน้าทีมเลย ก็ไม่มีการกวาดเลย ⇒ ของเดิมไม่ใช่ "แม่นกว่า" แค่ "สุ่มกว่า"
 *
 * ★ อยู่ที่ `server.ts` ไม่ใช่ `app.ts` โดยตั้งใจ
 *   `app.ts` ถูก import โดยเทส integration (supertest) ⇒ ถ้าตั้ง timer ไว้ที่นั่น
 *   ทุกไฟล์เทสจะมีงานเบื้องหลังวิ่งอยู่ แล้วเทสจะแดงแบบหาสาเหตุไม่ได้
 */

export type Job = { name : string; run : () => Promise<unknown> };

/** รันทุกงานเรียงกัน — งานหนึ่งพังไม่ทำให้งานถัดไปไม่ได้รัน */
export async function runJobsOnce(jobs : Job[]) : Promise<void> {
    for(const job of jobs){
        const startedAt = Date.now();
        try{
            await job.run();
            console.log(`[job] ${job.name} เสร็จใน ${Date.now() - startedAt}ms`);
        }catch(err){
            // ★ ห้ามโยนต่อ — ถ้าโยน จะกลายเป็น unhandled rejection แล้วโปรเซสตายทั้งตัว
            //   งานเบื้องหลังพังไม่ควรทำให้ API ที่คนกำลังใช้อยู่ล่ม
            console.error(`[job] ${job.name} ล้มเหลวหลัง ${Date.now() - startedAt}ms:` , err);
        }
    }
}

/**
 * เริ่มตารางเวลา · คืนฟังก์ชันหยุด (ใช้ตอนปิดเซิร์ฟเวอร์และในเทส)
 *
 * ★ รันรอบแรกหลังเซิร์ฟเวอร์ขึ้น ไม่รอครบชั่วโมง — ไม่งั้นเครื่องที่รีสตาร์ตบ่อย
 *   จะไม่มีรอบไหนได้รันเลย · และหน่วงไว้เล็กน้อยเพื่อไม่แย่ง connection กับคำขอชุดแรก
 * ★ `unref()` เพื่อให้ timer ไม่ค้างโปรเซสไว้ตอนปิด
 */
export function startScheduler(jobs : Job[] , intervalMs = env.JOB_INTERVAL_MS) : () => void {
    if(intervalMs <= 0){
        console.log('[job] ปิดงานเบื้องหลังไว้ (JOB_INTERVAL_MS = 0)');
        return () => {};
    }

    const first = setTimeout(() => { void runJobsOnce(jobs); } , env.JOB_STARTUP_DELAY_MS);
    const timer = setInterval(() => { void runJobsOnce(jobs); } , intervalMs);
    first.unref();
    timer.unref();

    console.log(`[job] งานเบื้องหลัง ${jobs.length} งาน · ทุก ${Math.round(intervalMs / 1000)} วินาที`);
    return () => { clearTimeout(first); clearInterval(timer); };
}
