import type { MatchDetailRow, MatchListRow, MatchCheckinListRow, MatchResultSummaryCols, MatchLineupRow } from '../repositories/match.repo.js';
import type { BracketNodeListRow } from '../repositories/bracketNode.repo.js';
import type { MatchRow } from '../types/db.js';
import { toTeamRef } from './team.mapper.js';
import type { TeamRef } from './team.mapper.js';
import { toPublicImageUrl } from '../utils/imageUrl.js';

/**
 * B5 + outcome (รายงาน FE 19 ก.ย.) — สรุปผลบนแถวแมตช์ เพื่อให้ตาราง/สาย/แดชบอร์ดวาดได้จาก M04 อย่างเดียว
 *   resultStatus : สถานะใบผลล่าสุด (null = ยังไม่ส่ง) — ให้ FE แยก "รอยืนยัน" กับ "ยืนยันแล้ว"
 *   score        : score_data เฉพาะเมื่อ verified/walkover (ใบผลที่ยังไม่ยืนยันเห็นได้เฉพาะคนเกี่ยวข้องผ่าน S05 — กฎเดิม)
 *   outcome      : ความหมายของแมตช์ที่จบแล้ว ให้หน้าสายวาดช่องว่างถูก:
 *                    played   = แข่งจริง · walkover = คู่ถอน/ไม่มา (W/O)
 *                    bye      = ช่องอีกฝั่งว่างถาวร ทีมเดียวผ่าน (dead slot) — FE แสดง "BYE" แทนช่องว่าง
 *                    void     = ไม่มีใครผ่าน (แพ้ทั้งคู่ / ถอนทั้งคู่ / แมตช์ตาย) — FE แสดง "ไม่มีการแข่ง"
 */
export type MatchOutcomeKind = 'played' | 'walkover' | 'bye' | 'void';
export type MatchResultSummaryDto = {
    nextMatchId: number | null;
    loserNextMatchId: number | null;
    resultStatus: MatchResultSummaryCols['result_status'];
    score: Record<string, number> | null;
    outcome: { kind: MatchOutcomeKind; winnerTeamId: number | null; loserTeamId: number | null } | null;
};

export function toMatchResultSummary(row: MatchResultSummaryCols & { match_status: MatchRow['match_status']; team_a_id: number | null; team_b_id: number | null }): MatchResultSummaryDto {
    const settled = row.result_status === 'verified' || row.result_status === 'walkover';
    const base = {
        nextMatchId: row.next_match_id,
        loserNextMatchId: row.loser_next_match_id,
        resultStatus: row.result_status,
        score: settled ? row.result_score : null,
    };
    if (row.match_status !== 'completed') return { ...base, outcome: null };

    const winner = settled ? row.result_winner_team_id : null;
    const other = winner === null ? null : (row.team_a_id === winner ? row.team_b_id : row.team_a_id);
    let kind: MatchOutcomeKind;
    if (row.result_status === 'verified') kind = 'played';
    else if (winner === null) kind = 'void';                 // double forfeit / both withdrawn / dead match (ไม่มีใบผล)
    else if (other === null) kind = 'bye';                   // dead slot
    else kind = 'walkover';
    return { ...base, outcome: { kind, winnerTeamId: winner, loserTeamId: kind === 'played' || kind === 'walkover' ? other : null } };
}

/**
 * OD-61 ก้าวที่ 2 (4 ต.ค. 2569) — ประกอบ `TeamRef` ของทีมฝั่งหนึ่งในแมตช์/ช่องสาย
 *
 * ★ ทำไมต้องมีตัวนี้ แทนที่จะเรียก `toTeamRef(row)` ตรง ๆ เหมือนที่อื่น
 *   แถวของแมตช์เก็บสองทีมใน **แถวเดียว** (`team_a_*` / `team_b_*`) ไม่ใช่แถวละทีม
 *   ⇒ ต้องแยกคอลัมน์ออกมาเป็น "ทีม" ก่อน แล้วจึงประกอบเป็น TeamRef
 *
 * ★ แยกสองความหมายของ `null` ที่ปนกันอยู่ให้ชัด
 * ```
 * คืน null       = ช่องนั้นไม่มีทีม — bye / dead slot / สายยังไม่ถูกเติม
 * logoUrl: null  = มีทีมจริง แต่ทีมนั้นยังไม่ได้อัปโลโก้
 * ```
 *   ตัดสินด้วย `teamId` อย่างเดียว **ห้ามตัดสินด้วย logoKey** — ทีมที่มีจริงแต่ไม่มีโลโก้
 *   ต้องยังโผล่เป็นทีม ไม่ใช่หายไปทั้งก้อน
 *
 * ★ `name` / `sportTypeId` ใช้ `!` ได้เพราะ query `LEFT JOIN teams` ด้วย `team_id` เดียวกัน
 *   ⇒ ถ้า `teamId` ไม่เป็น null แถวทีมนั้นมีจริง สองคอลัมน์นั้นจึงไม่เป็น null
 */
function toMatchTeamRef(
    teamId: number | null, name: string | null, sportTypeId: number | null, logoKey: string | null,
): TeamRef | null {
    if (teamId === null) return null;
    return toTeamRef({ team_id: teamId, name: name!, sport_type_id: sportTypeId!, logo_key: logoKey });
}

export type MatchListItemDto = MatchResultSummaryDto & {
    id: number;
    round: number | null;
    teamA: TeamRef | null;      // OD-61 — ดู toMatchTeamRef()
    teamB: TeamRef | null;
    scheduledTime: Date | null;
    scheduledEndTime: Date | null;
    venue: string | null;
    status: string;
    /**
     * E12 เขียน `matches.livestream_url` มาตั้งแต่ schema แรกแต่ไม่มี route ไหนอ่านกลับ
     * ลิงก์จึงหายไปทุกครั้งที่โหลดหน้าใหม่ (FE-replay-link-write-only) · **สาธารณะ**
     * ต่างจาก `roomCode` ที่อยู่ข้าง ๆ กันแต่จำกัดผู้ดู — ลิงก์ถ่ายทอด/รีเพลย์มีไว้ให้คนดู
     */
    livestreamUrl: string | null;
};

export function toMatchListItemDto(row: MatchListRow): MatchListItemDto {
    return {
        id: row.match_id,
        round: row.round_number,
        teamA: toMatchTeamRef(row.team_a_id, row.team_a_name, row.team_a_sport_type_id, row.team_a_logo_key),
        teamB: toMatchTeamRef(row.team_b_id, row.team_b_name, row.team_b_sport_type_id, row.team_b_logo_key),
        scheduledTime: row.scheduled_time,
        scheduledEndTime: row.scheduled_end_time,
        venue: row.venue,
        status: row.match_status,
        livestreamUrl: row.livestream_url,
        ...toMatchResultSummary(row),
    };
}

export type MatchDetailItemDto = MatchResultSummaryDto & {
    id: number;
    tournamentId: number;
    round: number | null;
    teamA: TeamRef | null;      // OD-61 — ดู toMatchTeamRef()
    teamB: TeamRef | null;
    scheduledTime: Date | null;
    scheduledEndTime: Date | null;
    venue: string | null;
    checkinOpenAt: Date | null;
    startedAt: Date | null;        // เวลาเริ่มแข่งจริง (migration 026)
    actualEndTime: Date | null;    // เวลาจบแข่งจริง — ต่างจาก scheduledEndTime ที่เป็นเวลาตามตาราง 
    status: string; 
    mode : 'onsite' | 'online',
    roomCode : string | null;   // B8 — เฉพาะแมตช์ online และคนดูเป็นสมาชิกทีมในแมตช์/กรรมการ/ORG (ไม่งั้น null)
    /**
     * E12 เขียน `matches.livestream_url` มาตั้งแต่ schema แรกแต่ไม่มี route ไหนอ่านกลับ
     * ลิงก์จึงหายไปทุกครั้งที่โหลดหน้าใหม่ (FE-replay-link-write-only) · **สาธารณะ**
     * ต่างจาก `roomCode` ที่อยู่ข้าง ๆ กันแต่จำกัดผู้ดู — ลิงก์ถ่ายทอด/รีเพลย์มีไว้ให้คนดู
     */
    livestreamUrl: string | null;
}

export function toMatchDetailDto(row: MatchDetailRow, canSeeRoomCode = false): MatchDetailItemDto {
    return {
        id: row.match_id,
        tournamentId: row.tournament_id,
        round: row.round_number,
        teamA: toMatchTeamRef(row.team_a_id, row.team_a_name, row.team_a_sport_type_id, row.team_a_logo_key),
        teamB: toMatchTeamRef(row.team_b_id, row.team_b_name, row.team_b_sport_type_id, row.team_b_logo_key),
        scheduledTime: row.scheduled_time,
        scheduledEndTime: row.scheduled_end_time,
        venue: row.venue,
        checkinOpenAt: row.checkin_open_at,
        startedAt: row.started_at,
        actualEndTime: row.actual_end_time,
        status: row.match_status,
        mode: row.mode,
        roomCode: canSeeRoomCode ? row.room_code : null,
        livestreamUrl: row.livestream_url,
        ...toMatchResultSummary(row),
    };
}

// ยึดค่า DB เป็นหลักตามกฎ Part 0-1 §1.2 แต่ตอบ response เป็นคำที่สเปกเอกสารใช้ (GUIDE/07 ข้อ B2 — migration 009)
//   pending   = photo_online รอกรรมการตรวจ          → pending_verification
//   success   = QR ผ่าน / กรรมการตรวจผ่าน             → checked_in
//   exception = กรรมการอนุโลมเช็คอินให้ (manual)      → checked_in (นับว่าเช็คอินแล้ว)
// ใช้ร่วมกันทั้ง M12/M13/M14/M15 กันสถานะเดียวกันโชว์คำไม่ตรงกันตาม endpoint
export function toCheckinStatusApi(dbStatus: 'success' | 'rejected' | 'exception' | 'pending'): string {
    if (dbStatus === 'success' || dbStatus === 'exception') return 'checked_in';
    if (dbStatus === 'pending') return 'pending_verification';
    return 'rejected';
}

export type CheckinListItemDto = {
    id: number;                                   // ใช้เป็น :cid ของ M14/M15
    userId: number;
    fullName: string;
    method: 'qr_onsite' | 'photo_online' | 'manual_by_referee';
    status: string;
    documentType: 'student_id' | 'national_id' | null;
    documentUrl: string | null;                   // presigned URL — มีเฉพาะเช็คอินแบบรูป และคนดูเป็นกรรมการของแมตช์
    note: string | null;                          // M19 เหตุผลที่กรรมการอนุโลมเช็คอินให้
    /**
     * M15 เหตุผลที่ปฏิเสธ/ถอนเช็คอิน — คนละคอลัมน์กับ `note` (migration 015)
     * M15 บังคับให้กรอก และ M20 คืนให้เจ้าตัวอยู่แล้ว แต่ M13 ไม่เคยคืน กรรมการจึงไม่เห็นเหตุผล
     * ของแถวไหนเลย รวมถึงเหตุผลที่ตัวเองเพิ่งพิมพ์ (FE-checkin-reject-reason-not-listed)
     * ปลอดภัยเพราะ M13 เปิดให้เฉพาะ ORG/กรรมการของแมตช์อยู่แล้ว (403 NOT_ORGANIZER_OR_REFEREE)
     */
    rejectionReason: string | null;
    checkedInAt: Date;
};

export function toCheckinListItemDto(row: MatchCheckinListRow, documentUrl: string | null = null): CheckinListItemDto {
    return {
        id: row.match_checkin_id,
        userId: row.user_id,
        fullName: row.full_name,
        method: row.method,
        status: toCheckinStatusApi(row.match_checkin_status),
        documentType: row.document_type,
        documentUrl,
        note: row.note,
        rejectionReason: row.rejection_reason,
        checkedInAt: row.checked_in_at,
    };
}

export type LineupPlayerDto = {
    userId: number;
    fullName: string;
    avatarUrl: string | null;
    checkinStatus: string | null;      // null = ยังไม่ได้เช็คอิน
    checkedInAt: Date | null;
};

export function toLineupPlayerDto(row: MatchLineupRow): LineupPlayerDto {
    return {
        userId: row.user_id,
        fullName: row.full_name,
        avatarUrl: toPublicImageUrl(row.profile_image_key),
        checkinStatus: row.match_checkin_status === null ? null : toCheckinStatusApi(row.match_checkin_status),
        checkedInAt: row.checked_in_at,
    };
}

export type BracketNodeDto = {
    nodeId: number;
    bracketType: 'winners' | 'losers' | 'grand_final';
    round: number | null;
    matchNumber: number;
    teamA: TeamRef | null;      // OD-61 — ดู toMatchTeamRef()
    teamB: TeamRef | null;
    matchId: number | null;
    matchStatus: string | null;
    advancesToNodeId: number | null;
};

export function toBracketNodeDto(row: BracketNodeListRow): BracketNodeDto {
    return {
        nodeId: row.bracket_node_id,
        bracketType: row.bracket_type,
        round: row.round,
        matchNumber: row.match_number,
        teamA: toMatchTeamRef(row.team_a_id, row.team_a_name, row.team_a_sport_type_id, row.team_a_logo_key),
        teamB: toMatchTeamRef(row.team_b_id, row.team_b_name, row.team_b_sport_type_id, row.team_b_logo_key),
        matchId: row.match_id,
        matchStatus: row.match_status,
        advancesToNodeId: row.advances_to_node_id,
    };
}