import * as MatchHistoryRepo from '../repositories/matchHistory.repo.js';
import { toMatchHistoryDto } from '../mappers/matchHistory.mapper.js';
import { checkUser } from '../utils/checkExist.js';

export async function getMatchHistory(userId: number) {
    await checkUser(userId);
    const rows = await MatchHistoryRepo.findVerifiedMatchHistoryByUser(userId);
    const stats = await MatchHistoryRepo.findStatsForUserMatches(userId, rows.map(row => row.match_id));
    const byMatch = new Map<number, MatchHistoryRepo.MatchHistoryStatRow[]>();
    for (const stat of stats) {
        const current = byMatch.get(stat.match_id) ?? [];
        current.push(stat);
        byMatch.set(stat.match_id, current);
    }
    return { items: rows.map(row => toMatchHistoryDto(row, byMatch.get(row.match_id) ?? [])) };
}
