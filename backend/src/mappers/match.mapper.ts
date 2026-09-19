import type { MatchDetailRow, MatchListRow, MatchCheckinListRow, MatchLineupRow } from '../repositories/match.repo.js';
import type { BracketNodeListRow } from '../repositories/bracketNode.repo.js';

export type MatchListItemDto = {
    id: number;
    round: number | null;
    teamA: { id: number; name: string; sportTypeId: number } | null;
    teamB: { id: number; name: string; sportTypeId: number } | null;
    scheduledTime: Date | null;
    scheduledEndTime: Date | null;
    venue: string | null;
    status: string;
};

export function toMatchListItemDto(row: MatchListRow): MatchListItemDto {
    return {
        id: row.match_id,
        round: row.round_number,
        teamA: row.team_a_id !== null
            ? { id: row.team_a_id, name: row.team_a_name!, sportTypeId: row.team_a_sport_type_id! }
            : null,
        teamB: row.team_b_id !== null
            ? { id: row.team_b_id, name: row.team_b_name!, sportTypeId: row.team_b_sport_type_id! }
            : null,
        scheduledTime: row.scheduled_time,
        scheduledEndTime: row.scheduled_end_time,
        venue: row.venue,
        status: row.match_status,
    };
}

export type MatchDetailItemDto = { 
    id: number;
    tournamentId: number;
    round: number | null;
    teamA: { id: number; name: string; sportTypeId: number } | null;
    teamB: { id: number; name: string; sportTypeId: number } | null;
    scheduledTime: Date | null;
    scheduledEndTime: Date | null;
    venue: string | null;
    checkinOpenAt: Date | null; 
    status: string; 
    mode : 'onsite' | 'online',
    nextMatchId: number | null;
}

export function toMatchDetailDto(row: MatchDetailRow): MatchDetailItemDto {
    return {
        id: row.match_id,
        tournamentId: row.tournament_id,
        round: row.round_number,
        teamA: row.team_a_id !== null
            ? { id: row.team_a_id, name: row.team_a_name!, sportTypeId: row.team_a_sport_type_id! }
            : null,
        teamB: row.team_b_id !== null
            ? { id: row.team_b_id, name: row.team_b_name!, sportTypeId: row.team_b_sport_type_id! }
            : null,
        scheduledTime: row.scheduled_time,
        scheduledEndTime: row.scheduled_end_time,
        venue: row.venue,
        checkinOpenAt: row.checkin_open_at,
        status: row.match_status,
        mode: row.mode,
        nextMatchId: row.next_match_id
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
        avatarUrl: row.profile_image_key,
        checkinStatus: row.match_checkin_status === null ? null : toCheckinStatusApi(row.match_checkin_status),
        checkedInAt: row.checked_in_at,
    };
}

export type BracketNodeDto = {
    nodeId: number;
    bracketType: 'winners' | 'losers' | 'grand_final';
    round: number | null;
    matchNumber: number;
    teamA: { id: number; name: string; sportTypeId: number } | null;
    teamB: { id: number; name: string; sportTypeId: number } | null;
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
        teamA: row.team_a_id !== null
            ? { id: row.team_a_id, name: row.team_a_name!, sportTypeId: row.team_a_sport_type_id! }
            : null,
        teamB: row.team_b_id !== null
            ? { id: row.team_b_id, name: row.team_b_name!, sportTypeId: row.team_b_sport_type_id! }
            : null,
        matchId: row.match_id,
        matchStatus: row.match_status,
        advancesToNodeId: row.advances_to_node_id,
    };
}