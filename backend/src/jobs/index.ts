import type { Job } from './scheduler.js';
import { sweepAndNotify } from '../services/team.service.js';
import { purgeUnverifiedAccounts } from '../services/auth.service.js';
import { purgeExpiredTournaments, sweepAutoDeleteTournaments, sweepUnapprovedPastRegistration,
         sweepUnderfilledPublicTournaments, warnBeforeAutoDelete,
         warnUnderfilledPublicTournaments } from '../services/tournament.service.js';
import { purgeRefereeIdentityDocs, sweepOrphanRefereeDocs } from '../services/refereeDocs.service.js';
import { purgeCheckinDocuments, sweepOrphanCheckinDocs } from '../services/checkinDocs.service.js';

/**
 * ทะเบียนงานเบื้องหลัง (มติ 8 ต.ค. 2569)
 *
 * ★ ไฟล์นี้เป็นที่เดียวที่บอกว่า "มีงานอะไรรันตามเวลา" — ง่ายต่อการตรวจว่าอะไรวิ่งอยู่เบื้องหลัง
 * ★ ลำดับสำคัญเล็กน้อย: ปิดทัวร์ที่ตายแล้วก่อน แล้วค่อยกวาดทีม
 *   เพราะกฎกวาดทีมดู "ใบสมัครที่ยังเดินอยู่" ⇒ ทัวร์ที่ถูกปิดไปแล้วไม่ควรช่วยให้ทีมรอด
 *   (ตอนนี้ยังไม่ต่างกันในทางปฏิบัติ เพราะกฎดูสถานะใบสมัคร ไม่ได้ดูสถานะทัวร์ — เขียนไว้กัน
 *    วันที่กฎเปลี่ยน แล้วลำดับกลับมามีผลโดยไม่มีใครนึกถึง)
 */
export const backgroundJobs : Job[] = [
    // 🔴 เตือนก่อนปิด — ต้องมาก่อนงานปิด ไม่ใช่เพราะลำดับบังคับ แต่เพราะอ่านแล้วตรงกับลำดับเหตุการณ์จริง
    //   (คิวรีเตือนตัดทัวร์ที่ถึงวันแข่งแล้วออกอยู่แล้ว ⇒ ไม่มีทางได้ทั้งคำเตือนและคำปิดในรอบเดียว)
    { name : 'เตือนผู้จัดล่วงหน้าก่อนปิดทัวร์ (BR-03)' , run : warnBeforeAutoDelete },
    { name : 'ปิดทัวร์ที่ยังไม่เผยแพร่จนถึงวันแข่ง (BR-03)' , run : sweepAutoDeleteTournaments },
    // OD-80 — ลำดับไม่สำคัญกับงานข้างบน (คนละสถานะ) · ไว้ติดกันเพราะเป็นเรื่อง "ปิดทัวร์อัตโนมัติ" เหมือนกัน
    { name : 'ปิดคำขอจัดทัวร์ที่ไม่ได้อนุมัติทันวันปิดรับสมัคร (OD-80)' , run : sweepUnapprovedPastRegistration },
    // OD-81 — ทัวร์ public ที่ทีมไม่ครบ · เตือนก่อนปิด ด้วยเหตุผลเดียวกับคู่ BR-03 ข้างบน
    //   ★ ต้องอยู่ **ก่อน** "กวาดทีมร้าง" — ใบ pending ที่ถูกยกเลิกตรงนี้ ไม่ควรช่วยให้ทีมรอดรอบกวาดนี้
    { name : 'เตือนผู้จัด 3 วันก่อนปิดทัวร์ public ที่ทีมไม่ครบ (OD-81)' , run : warnUnderfilledPublicTournaments },
    { name : 'ปิดทัวร์ public ที่ทีมไม่ครบเมื่อถึงวันแข่ง (OD-81)' , run : sweepUnderfilledPublicTournaments },
    { name : 'ลบทัวร์ที่ปิดไปเกิน 4 ปี (BR-03)' , run : purgeExpiredTournaments },
    { name : 'กวาดทีมร้าง (TM-07 · BR-06)' , run : sweepAndNotify },
    // OD-53 — ลบบัญชีที่สมัครแล้วไม่ยืนยันอีเมลเกินกำหนด (เหตุผลเรื่องข้อมูลส่วนบุคคล ไม่ใช่พื้นที่)
    //   ★ ลำดับไม่สำคัญกับงานนี้ — ไม่เกี่ยวกับการกวาดทีม/ทัวร์ และบัญชีที่ยังไม่ยืนยันไม่มีทีม
    { name : 'ลบบัญชีที่ไม่ยืนยันอีเมลเกินกำหนด (OD-53)' , run : purgeUnverifiedAccounts },
    // OD-70 (งาน ⑥) — ลำดับไม่สำคัญ ไม่เกี่ยวกับงานกวาดทีม/ทัวร์ · ③ ต่อท้าย ② เพราะ ② ลบไฟล์แล้วปิดแถวไปก่อน
    { name : 'ลบภาพยืนยันตัวตนกรรมการของทัวร์ที่จบแล้ว' , run : purgeRefereeIdentityDocs },
    { name : 'ลบภาพยืนยันตัวตนกรรมการที่ไม่มีแถวชี้ถึง (OD-70)' , run : sweepOrphanRefereeDocs },
    // OD-73 — รูปบัตรตอนเช็คอินออนไลน์ · ลำดับเดียวกับ OD-70: ① ลบไฟล์แล้วล้างคีย์ไปก่อน ② ค่อยกวาดไฟล์ไม่มีเจ้าของ
    { name : 'ลบรูปบัตรเช็คอินที่หมดเวลาโต้แย้ง/ร้องเรียนแล้ว (OD-73 · QA D2)' , run : purgeCheckinDocuments },
    { name : 'ลบรูปบัตรเช็คอินที่ไม่มีแถวชี้ถึง (OD-73)' , run : sweepOrphanCheckinDocs },
];
