import pool from '../config/db.js';
import type { RowDataPacket } from 'mysql2';
import type { TournamentRow } from '../types/db.js';

export type CareerTournamentRow = {
    tournament_id: number;
    tournament_name: string;
    sport_type_id: number;
    tournament_status: TournamentRow['tournament_status'];
    team_id: number;
    team_name: string;
    played: number;
    wins: number;
    losses: number;
    champion: number;
    /**
     * OD-47 (แก้ 2 ต.ค.) — 1 = ใบสมัครของทัวร์นี้ยัง `approved` · 0 = เหลือแต่ใบที่ `withdrawn`
     *
     * คิดเป็น MAX() ไม่ใช่ใส่ใน GROUP BY เพื่อให้ยังได้ **หนึ่งแถวต่อ (ทัวร์, ทีม)** เหมือนเดิม
     *
     * 🔴 แก้คำอธิบาย 6 ต.ค. — เหตุผลเดิมที่เขียนไว้ (2 ต.ค.) ผิด
     *   เดิมเขียนว่า "คนที่ถอนแล้วสมัครใหม่ (A1) จะมีสองใบ" ซึ่ง **ฐานห้ามไว้แล้ว**:
     *     tournament_applications  UNIQUE (tournament_id, team_id)
     *     application_players      UNIQUE (tournament_id, user_id)
     *   ⇒ หนึ่งทีมมีใบเดียวต่อทัวร์ และหนึ่งคนอยู่ได้ใบเดียวต่อทัวร์
     *   ⇒ "สมัครใหม่" ใช้แถวเดิม ไม่เกิดใบที่สอง ⇒ เคสที่กลัวไว้เกิดไม่ได้
     *   (ตรวจกับฐานจริงแล้ว 6 ต.ค. — INSERT ใบที่สองถูกปฏิเสธด้วย ERROR 1062)
     *
     * ★ แต่ MAX() ยังถูกและยังควรอยู่ ด้วยเหตุผลที่ต่างออกไป: มันทำให้คอลัมน์นี้
     *   ไม่ต้องเข้า GROUP BY ⇒ นิยามของ "หนึ่งแถว" ยังผูกกับ (ทัวร์, ทีม) อย่างเดียว
     *   ซึ่งตรงกับ LEFT JOIN แมตช์ที่ผูกกับ (ทัวร์, ทีม) ไม่ได้ผูกกับใบสมัคร
     *   ⇒ ถ้าวันหนึ่ง unique key ถูกถอดออก query นี้ก็ยังไม่แตกเป็นสองแถว
     *
     * ★ 6 ต.ค. — ค่านี้ถูกส่งออก API แล้วในชื่อ `withdrawn` (ตรงข้ามกัน) ทั้ง U14 · RW05 · RW06
     *   FE ขอมาเพื่อติดป้าย "ทีมถอนตัวแล้ว" บนรายการ ⇒ ห้ามเอาออกโดยไม่บอก FE
     */
    has_approved: number;
};

/**
 * OD-47 — `tournamentId` กรองให้เหลือทัวร์เดียว ใช้โดย "โปรไฟล์ในทัวร์" (RW06)
 *
 * ตัวเลขต่อทัวร์ชุดเดียวกันเป๊ะกับที่ U14 คืน ⇒ หน้าในทัวร์กับหน้าโปรไฟล์จะไม่แสดงเลขขัดกัน
 * ถ้าเขียน SQL ใหม่แยกอีกชุด สองหน้าจะเพี้ยนกันเองวันที่มีใครแก้นิยาม played/wins ที่เดียว
 *
 * `includeWithdrawn` — นับใบที่ `withdrawn` ด้วย
 *
 * ★ 6 ต.ค. 2569 — **ไม่มีค่าเริ่มต้นแล้ว ต้องส่งทุกครั้ง** (เดิม default false)
 *   FE ตอบข้อ ก (`TO-BACKEND-2026-10-05-withdrawn-stats.md`) ⇒ ทั้งสามเส้นที่ใช้ repo นี้
 *   (U14 · RW05 · RW06) ส่ง true หมด ⇒ ค่าเริ่มต้น false กลายเป็นค่าที่ไม่มีใครใช้
 *   ถ้าปล่อยไว้ วันที่มีเส้นที่สี่ คนเขียนจะได้ false มาเงียบ ๆ แล้วเลขจะไม่ตรงกับอีกสามหน้า
 *   โดยไม่มี error ไม่มีใครรู้ ⇒ บังคับให้ส่ง เพื่อให้ tsc ไล่ถามทุกจุดที่เรียก
 *   (บทเรียนเดียวกับ InsertMatchInput.bestOf · OD-69)
 *
 * เหตุที่นับใบที่ถอน (มติ 5 ต.ค. — FE เลือก ก):
 *   มติ 26 ก.ย. ตกลงแล้วว่า "แมตช์ที่แข่งไปแล้วต้องบอกได้ว่าใครลงสนาม" ⇒ M19 รายชื่อผู้เล่น
 *   แสดงคนของทีมที่ถอนตัวอยู่แล้ว · ผลยังอยู่ในตารางคะแนน · RW06 นับแล้ว
 *   ⇒ ถ้า U14/RW05 ไม่นับ ระบบจะตอบไม่ตรงกันเองสามที่ และชื่อใน M19 จะกดไปเจอหน้าว่าง
 *
 * 🔴 นัดที่เป็นชนะบายจากการถอน **ไม่ถูกนับให้อยู่ดี** เพราะ walkover เก็บเป็น
 *   `match_result_status = 'walkover'` แต่ query นี้รับแค่ `'verified'`
 *   ⇒ ไม่ได้แถมแมตช์ที่ไม่มีใครลงสนามให้ใคร (FE ยืนยันข้อนี้มาด้วย)
 */
export async function findCareerByUser(userId: number, tournamentId: number | undefined,
                                       includeWithdrawn: boolean): Promise<CareerTournamentRow[]> {
    const [rows] = await pool.query<(CareerTournamentRow & RowDataPacket)[]>(
        `SELECT
            t.tournament_id,
            t.name AS tournament_name,
            t.sport_type_id,
            t.tournament_status,
            ta.team_id,
            tm.name AS team_name,
            COUNT(mr.match_id) AS played,
            SUM(CASE WHEN mr.winner_team_id = ta.team_id THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN mr.winner_team_id IS NOT NULL AND mr.winner_team_id <> ta.team_id THEN 1 ELSE 0 END) AS losses,
            CASE WHEN t.champion_team_id = ta.team_id THEN 1 ELSE 0 END AS champion,
            MAX(CASE WHEN ta.tournament_application_status = 'approved' THEN 1 ELSE 0 END) AS has_approved
         FROM application_players ap
         JOIN tournament_applications ta ON ta.tournament_application_id = ap.tournament_application_id
         JOIN tournaments t ON t.tournament_id = ta.tournament_id
         JOIN teams tm ON tm.team_id = ta.team_id
         LEFT JOIN matches m
           ON m.tournament_id = ta.tournament_id
          AND (m.team_a_id = ta.team_id OR m.team_b_id = ta.team_id)
         LEFT JOIN match_results mr
           ON mr.match_id = m.match_id
          AND mr.match_result_status = 'verified'
         WHERE ap.user_id = ?
           AND (ta.tournament_application_status = 'approved'
                OR (? = 1 AND ta.tournament_application_status = 'withdrawn'))
           AND t.deleted_at IS NULL
           AND (? IS NULL OR t.tournament_id = ?)
         GROUP BY t.tournament_id, t.name, t.sport_type_id, t.tournament_status,
                  t.champion_team_id, ta.team_id, tm.name
         ORDER BY COALESCE(t.completed_at, t.event_end_date, t.event_start_date) DESC, t.tournament_id DESC`,
        [userId, includeWithdrawn ? 1 : 0, tournamentId ?? null, tournamentId ?? null]
    );
    return rows;
}
