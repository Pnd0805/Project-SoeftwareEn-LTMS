import type { MatchHistoryRow, MatchHistoryStatRow } from '../repositories/matchHistory.repo.js';

export type MatchHistoryStatDto = {
    statKey: string;
    statLabelTh: string;
    value: number | null;
};

export function toMatchHistoryDto(row: MatchHistoryRow, stats: MatchHistoryStatRow[]) {
    return {
        matchId: row.match_id,
        tournament: {
            id: row.tournament_id,
            name: row.tournament_name,
            sportTypeId: row.sport_type_id,
        },
        team: { id: row.my_team_id, name: row.my_team_name },
        opponent: row.opponent_team_id === null ? null : {
            id: row.opponent_team_id,
            name: row.opponent_team_name,
        },
        roundNumber: row.round_number,
        scheduledTime: row.scheduled_time?.toISOString() ?? null,
        startedAt: row.started_at?.toISOString() ?? null,
        playedAt: (row.actual_end_time ?? row.verified_at)?.toISOString() ?? null,
        venue: row.venue,
        mode: row.mode,
        scoreData: row.score_data,
        result: row.winner_team_id === null ? null : row.winner_team_id === row.my_team_id ? 'win' as const : 'loss' as const,
        /** แมตช์นี้อยู่ในทัวร์ที่ทีมของผู้ใช้ถอนตัวไปแล้ว — ผลยังนับ แต่ FE ควรติดป้าย (มติ 5 ต.ค.) */
        withdrawn: row.has_approved === 0,
        playerStats: stats.map(stat => ({
            statKey: stat.stat_key,
            statLabelTh: stat.stat_label_th,
            value: stat.value_int,
        })),
    };
}
