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
     * คนที่ถอนแล้วสมัครใหม่ (A1) จะมีสองใบ ถ้า group แยกตามสถานะจะได้สองแถวที่ตัวเลขซ้ำกัน
     * เพราะ LEFT JOIN แมตช์ผูกกับ (ทัวร์, ทีม) ไม่ได้ผูกกับใบสมัคร
     */
    has_approved: number;
};

/**
 * OD-47 — `tournamentId` กรองให้เหลือทัวร์เดียว ใช้โดย "โปรไฟล์ในทัวร์" (RW06)
 *
 * ตัวเลขต่อทัวร์ชุดเดียวกันเป๊ะกับที่ U14 คืน ⇒ หน้าในทัวร์กับหน้าโปรไฟล์จะไม่แสดงเลขขัดกัน
 * ถ้าเขียน SQL ใหม่แยกอีกชุด สองหน้าจะเพี้ยนกันเองวันที่มีใครแก้นิยาม played/wins ที่เดียว
 *
 * `includeWithdrawn` (OD-47 แก้ 2 ต.ค.) — นับใบที่ `withdrawn` ด้วย **ค่าเริ่มต้นไม่นับ**
 *   เปิดเฉพาะ RW06 (โปรไฟล์ในทัวร์) เพราะ M19 รายชื่อผู้เล่นตั้งใจแสดงคนของทีมที่ถอนตัวด้วย
 *   (มติ 26 ก.ย. — แมตช์ที่แข่งไปแล้วต้องบอกได้ว่าใครลงสนาม) ⇒ ชื่อกดได้แต่กดไปเจอ 404
 *   U14 (career ในหน้าโปรไฟล์) **ยังไม่เปลี่ยน** เพราะจะขยับตัวเลขโปรไฟล์ของทุกคนที่ทีมเคยถอน
 *   ซึ่งเป็นโค้ดของคนอื่นและ FE อาจแสดงอยู่แล้ว — ยกเป็นคำถามแยกให้ทีมตัดสิน (ทางเลือก ข ของ OD-47)
 *
 *   นัดที่เป็นชนะบายจากการถอนไม่ถูกนับให้อยู่ดี เพราะ walkover เก็บเป็น
 *   `match_result_status = 'walkover'` แต่ query นี้รับแค่ `'verified'`
 */
export async function findCareerByUser(userId: number, tournamentId?: number,
                                       includeWithdrawn = false): Promise<CareerTournamentRow[]> {
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
