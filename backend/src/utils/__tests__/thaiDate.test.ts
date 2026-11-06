import { describe, expect, it } from 'vitest';
import { thaiDateOf, thaiDatePlusDays } from '../thaiDate.js';

/**
 * 31 ต.ค. 2569 — วันที่ตามเวลาไทย · ขอบที่พลาดซ้ำหลายรอบคือ 00:00–06:59 ไทย (ยังเป็นวันก่อนหน้าใน UTC)
 */
describe('thaiDateOf', () => {
    it.each([
        ['2026-10-31T00:00:00+07:00', '2026-10-31'],   // เที่ยงคืนไทย = 17:00Z วันที่ 30
        ['2026-10-31T06:59:00+07:00', '2026-10-31'],   // ก่อน 7 โมง — เดิมระบบนับเป็นวันที่ 30
        ['2026-10-31T07:00:00+07:00', '2026-10-31'],
        ['2026-10-31T23:59:00+07:00', '2026-10-31'],
        ['2026-10-30T23:59:00+07:00', '2026-10-30'],
    ])('%s → %s', (iso, day) => {
        expect(thaiDateOf(new Date(iso))).toBe(day);
        expect(thaiDateOf(new Date(iso).getTime())).toBe(day);
    });
});

describe('thaiDatePlusDays', () => {
    it('นับจากวันไทย ข้ามเดือนได้', () => {
        expect(thaiDatePlusDays(new Date('2026-10-31T01:00:00+07:00'), 3)).toBe('2026-11-03');
        expect(thaiDatePlusDays(new Date('2026-10-31T01:00:00+07:00'), 0)).toBe('2026-10-31');
    });
});
