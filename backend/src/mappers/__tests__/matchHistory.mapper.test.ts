import { describe, expect, it } from 'vitest';
import { toMatchHistoryDto } from '../matchHistory.mapper.js';

describe('matchHistory.mapper', () => {
    it('maps a verified match with opponent, result, timestamps and player stats', () => {
        const dto = toMatchHistoryDto({
            match_id: 10,
            round_number: 2,
            scheduled_time: new Date('2026-09-20T08:00:00Z'),
            started_at: new Date('2026-09-20T08:05:00Z'),
            actual_end_time: new Date('2026-09-20T09:00:00Z'),
            venue: 'Gym A',
            mode: 'onsite',
            tournament_id: 3,
            tournament_name: 'KU Cup',
            sport_type_id: 1,
            my_team_id: 5,
            my_team_name: 'Blue',
            opponent_team_id: 6,
            opponent_team_name: 'Red',
            winner_team_id: 5,
            score_data: { teamA: 2, teamB: 1 },
            verified_at: new Date('2026-09-20T09:10:00Z'),
            has_approved: 1,
        }, [{ match_id: 10, stat_key: 'goals', stat_label_th: 'ประตู', value_int: 2 }]);

        expect(dto).toMatchObject({
            matchId: 10,
            team: { id: 5, name: 'Blue' },
            opponent: { id: 6, name: 'Red' },
            result: 'win',
            playedAt: '2026-09-20T09:00:00.000Z',
            playerStats: [{ statKey: 'goals', statLabelTh: 'ประตู', value: 2 }],
        });
    });
    /**
     * มติ 5 ต.ค. (FE เลือก ก) — แมตช์ของทัวร์ที่ทีมถอนตัวไปแล้ว **ยังอยู่ในประวัติ** และผลยังนับ
     * สิ่งที่เพิ่มคือธงบอก ⇒ FE ติดป้ายได้ ไม่ใช่แสดงเหมือนทีมที่ยังแข่งอยู่
     *
     * ★ ปล่อย winner_team_id ให้ชนะไว้โดยเจตนา — ถ้าใส่ null เทสจะผ่านได้แม้โค้ดเผลอ
     *   ล้างผลของแมตช์ในทัวร์ที่ถอนทิ้ง ซึ่งเป็นสิ่งที่มติข้อนี้ห้ามพอดี
     */
    it('มติ 5 ต.ค. — has_approved 0 ⇒ withdrawn true แต่ผลแพ้ชนะยังอยู่', () => {
        const dto = toMatchHistoryDto({
            match_id: 11,
            round_number: null,
            scheduled_time: null,
            started_at: null,
            actual_end_time: null,
            venue: null,
            mode: 'onsite',
            tournament_id: 3,
            tournament_name: 'KU Cup',
            sport_type_id: 1,
            my_team_id: 5,
            my_team_name: 'Blue',
            opponent_team_id: 6,
            opponent_team_name: 'Red',
            winner_team_id: 5,
            score_data: null,
            verified_at: new Date('2026-09-20T09:10:00Z'),
            has_approved: 0,
        }, []);

        expect(dto.withdrawn).toBe(true);
        expect(dto.result).toBe('win');
    });
});
