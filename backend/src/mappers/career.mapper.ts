import type { CareerTournamentRow } from '../repositories/career.repo.js';

export type CareerTournamentDto = {
    tournament: {
        id: number;
        name: string;
        sportTypeId: number;
        status: CareerTournamentRow['tournament_status'];
    };
    team: { id: number; name: string };
    played: number;
    wins: number;
    losses: number;
    champion: boolean;
    /**
     * ทีมถอนตัวจากทัวร์นี้ไปแล้ว แต่นัดที่ลงแข่งจริงยังนับอยู่ (มติ 5 ต.ค. — FE เลือกข้อ ก)
     *
     * 🔴 ไม่มีธงนี้ FE ติดป้าย "ทีมถอนตัวแล้ว" ไม่ได้ ⇒ ผู้ใช้จะเห็นทัวร์ที่ตัวเองถอนออกไปแล้ว
     *   โผล่ในประวัติเหมือนแข่งจบปกติ ซึ่งอ่านได้ว่าระบบจำผิด
     * ★ ไม่ต้องคิวรีเพิ่ม — career.repo คืน has_approved มาอยู่แล้วตั้งแต่ OD-47 (2 ต.ค.)
     */
    withdrawn: boolean;
};

export function toCareerTournamentDto(row: CareerTournamentRow): CareerTournamentDto {
    return {
        tournament: {
            id: row.tournament_id,
            name: row.tournament_name,
            sportTypeId: row.sport_type_id,
            status: row.tournament_status,
        },
        team: { id: row.team_id, name: row.team_name },
        played: Number(row.played),
        wins: Number(row.wins),
        losses: Number(row.losses),
        champion: Boolean(row.champion),
        withdrawn: row.has_approved === 0,
    };
}
