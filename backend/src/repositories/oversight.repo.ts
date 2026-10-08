import pool from '../config/db.js';
import type { RowDataPacket } from 'mysql2';
import { ORG_RESOLVE_HOURS } from '../config/scoring.js';
import { notSuspendedSql } from '../utils/suspension.js';

/**
 * OD-34 — คิวที่ค้างจนต้องมีคนเข้ามาปลดล็อก · ใช้กับ GET /admin/oversight/stalled เท่านั้น
 *
 * ทุกคิวรีในไฟล์นี้คืน **ตัวเลขกับ id** ไม่คืนเนื้อหาของเรื่อง (ไม่มีเหตุผล ไม่มีหลักฐาน ไม่มีชื่อคน)
 * เพราะ root เป็นคนตรวจ ไม่ใช่คนตัดสิน — ต้องรู้แค่ว่า "มีของค้าง เท่าไร ที่ไหน" พอให้ตัดสินใจว่า
 * ต้องแต่งตั้งแอดมินมหาวิทยาลัยคนใหม่ไหม · ถ้าอยากอ่านเนื้อหาแปลว่ากำลังจะเข้าไปตัดสินเอง
 *
 * เส้นเวลาใช้ ORG_RESOLVE_HOURS ตัวเดียวกับที่ requireCanResolveDispute และ escalatesAt() ใช้
 * จะได้ไม่มีนาฬิกาเรือนที่สองให้เพี้ยนกัน
 */

/**
 * ข้อโต้แย้งที่ผู้จัดเงียบเกิน ORG_RESOLVE_HOURS แล้ว — ตรงกับเงื่อนไขที่ requireCanResolveDispute
 * เปิดให้แอดมินมหาวิทยาลัยกดแทนได้พอดี · นับจาก dispute_raised_at ไม่ใช่เวลาที่แมตช์จบ
 */
export async function findStalledDisputes(): Promise<number[]>{
    const [ rows ] = await pool.query<({ match_id : number } & RowDataPacket)[]>(
        `SELECT m.match_id
           FROM matches m
           JOIN match_results r ON r.match_id = m.match_id
          WHERE m.match_status = 'disputed'
            AND r.dispute_raised_at IS NOT NULL
            AND r.dispute_resolved_at IS NULL
            AND r.dispute_raised_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
          ORDER BY r.dispute_raised_at`, [ORG_RESOLVE_HOURS]);
    return rows.map(r => r.match_id);
}

/** เรื่องร้องเรียนผลแมตช์ที่ขึ้นถึงชั้นแอดมินแล้วแต่ยังไม่มีใครวินิจฉัย (ใช้ idx_complaint_queue) */
export async function findComplaintsAwaitingAdmin(): Promise<number[]>{
    const [ rows ] = await pool.query<({ match_result_complaint_id : number } & RowDataPacket)[]>(
        `SELECT match_result_complaint_id
           FROM match_result_complaints
          WHERE complaint_status = 'open'
            AND created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
          ORDER BY created_at`, [ORG_RESOLVE_HOURS]);
    return rows.map(r => r.match_result_complaint_id);
}

/**
 * ★ ตัวเลขที่สำคัญที่สุดในก้อนนี้ — LAST_UNIVERSITY_ADMIN รับประกันว่า **มี** แอดมินมหาวิทยาลัยเหลือ
 * แต่ไม่ได้รับประกันว่าคนนั้น **ใช้งานได้** · ถ้า active เป็น 0 ทั้งที่ total ไม่เป็น 0
 * แปลว่าระบบกำลังตันและทางแก้คือ root แต่งตั้งคนใหม่ (ไม่ใช่ root กดแทน)
 */
export async function countUniversityAdmins(): Promise<{ total : number , active : number }>{
    const [ rows ] = await pool.query<({ total : number , active : number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS total , SUM(${notSuspendedSql('u')}) AS active
           FROM admin_scopes s JOIN users u ON u.user_id = s.user_id
          WHERE s.scope_type = 'university_wide'`);
    const row = rows[0];
    return { total : Number(row?.total ?? 0) , active : Number(row?.active ?? 0) };
}
