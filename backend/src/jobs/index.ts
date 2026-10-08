import type { Job } from './scheduler.js';
import { sweepAndNotify } from '../services/team.service.js';
import { sweepAutoDeleteTournaments } from '../services/tournament.service.js';

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
    { name : 'ปิดทัวร์ที่ยังไม่เผยแพร่จนถึงวันแข่ง (BR-03)' , run : sweepAutoDeleteTournaments },
    { name : 'กวาดทีมร้าง (TM-07 · BR-06)' , run : sweepAndNotify },
];
