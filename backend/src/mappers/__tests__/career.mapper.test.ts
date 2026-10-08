import { describe, expect, it } from 'vitest';
import { toCareerTournamentDto } from '../career.mapper.js';

describe('toCareerTournamentDto', () => {
  it('maps a tournament career row and normalizes aggregate numbers', () => {
    const dto = toCareerTournamentDto({
      tournament_id: 12,
      tournament_name: 'KU Cup',
      sport_type_id: 2,
      tournament_status: 'completed',
      has_approved: 1,          // ใบสมัครยังอนุมัติอยู่ — เคสหลักของ U04
      team_id: 7,
      team_name: 'Blue',
      played: '5' as any,
      wins: '3' as any,
      losses: '2' as any,
      champion: 1,
    });

    expect(dto).toEqual({
      tournament: { id: 12, name: 'KU Cup', sportTypeId: 2, status: 'completed' },
      team: { id: 7, name: 'Blue' },
      played: 5,
      wins: 3,
      losses: 2,
      champion: true,
      withdrawn: false,
    });
  });

  /**
   * มติ 5 ต.ค. (FE เลือก ก) — ทัวร์ที่ทีมถอนตัวหลังแข่งจบ **ยังอยู่ในรายการ** และตัวเลขยังนับ
   * สิ่งที่เปลี่ยนคือมีธงบอก ⇒ FE ติดป้าย "ทีมถอนตัวแล้ว" ได้ ไม่ใช่แสดงเหมือนแข่งจบปกติ
   *
   * ★ เคสนี้ตั้ง has_approved: 0 แต่ปล่อย played/wins/losses ให้มีค่า โดยเจตนา
   *   เพราะนั่นคือสภาพจริงของเคสนี้ (ลงแข่งไปแล้วจริง แล้วทีมถอนทีหลัง)
   *   ถ้าใส่ 0 หมด เทสจะผ่านได้แม้โค้ดเผลอล้างตัวเลขของทัวร์ที่ถอนทิ้ง
   */
  it('มติ 5 ต.ค. — has_approved 0 ⇒ withdrawn true แต่ตัวเลขที่ลงแข่งจริงยังอยู่', () => {
    const dto = toCareerTournamentDto({
      tournament_id: 12,
      tournament_name: 'KU Cup',
      sport_type_id: 2,
      tournament_status: 'completed',
      has_approved: 0,
      team_id: 7,
      team_name: 'Blue',
      played: 5,
      wins: 3,
      losses: 2,
      champion: 0,
    });

    expect(dto.withdrawn).toBe(true);
    expect(dto).toMatchObject({ played: 5, wins: 3, losses: 2, champion: false });
  });
});
