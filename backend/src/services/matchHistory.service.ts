import * as MatchHistoryRepo from '../repositories/matchHistory.repo.js';
import { toMatchHistoryDto } from '../mappers/matchHistory.mapper.js';
import { checkUser } from '../utils/checkExist.js';
import { canSeeProfileStats } from '../utils/profileStats.js';

export async function getMatchHistory(userId: number, viewerUserId?: number) {
    const user = await checkUser(userId);
    // OD-46 — ผูกกับสวิตช์เดียวกับ U04/U14 (utils/profileStats) · items เป็น null ไม่ใช่ []
    // เพราะ [] อ่านได้ว่า "ไม่เคยลงแข่ง" ซึ่งเป็นคำตอบที่ผิดและหน้าจอแยกจากของจริงไม่ออก
    if (!(await canSeeProfileStats(user, viewerUserId))) {
        return { items: null, statsHidden: true };
    }
    const rows = await MatchHistoryRepo.findVerifiedMatchHistoryByUser(userId);
    const stats = await MatchHistoryRepo.findStatsForUserMatches(userId, rows.map(row => row.match_id));
    const byMatch = new Map<number, MatchHistoryRepo.MatchHistoryStatRow[]>();
    for (const stat of stats) {
        const current = byMatch.get(stat.match_id) ?? [];
        current.push(stat);
        byMatch.set(stat.match_id, current);
    }
    return { items: rows.map(row => toMatchHistoryDto(row, byMatch.get(row.match_id) ?? [])), statsHidden: false };
}
