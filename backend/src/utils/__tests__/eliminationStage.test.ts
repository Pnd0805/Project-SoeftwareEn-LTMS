import { describe, it, expect } from 'vitest';
import { eliminationLabels, type SettledBracketNode } from '../eliminationStage.js';

/**
 * 🆕 FE-32 (7 ต.ค. 2569 · มติ ข) — ป้าย "ตกรอบ N ทีมสุดท้าย" ในตารางอันดับ
 *
 * ★ เป็นตรรกะล้วน ไม่แตะฐาน ⇒ เทสที่นี่ครอบได้ทุกรูปทรงของสายโดยไม่ต้องสร้างทัวร์จริง
 *   (เส้นทาง HTTP มีเทสของตัวเองที่ integration — ที่นั่นพิสูจน์ว่า query ส่งข้อมูลถูกรูป)
 */

const win = (round : number, a : number, b : number, winner : number): SettledBracketNode =>
    ({ bracket_type : 'winners', round, team_a_id : a, team_b_id : b, winner_team_id : winner });
const lose = (round : number, a : number, b : number, winner : number): SettledBracketNode =>
    ({ bracket_type : 'losers', round, team_a_id : a, team_b_id : b, winner_team_id : winner });

describe('eliminationLabels', () => {
    it('ลีกพบกันหมด → ไม่มีป้ายเลย (ที่นั่น rank คือคำตอบจริง)', () => {
        const labels = eliminationLabels('round_robin', [win(1, 1, 2, 1)], [1, 2, 3, 4]);

        expect([...labels.values()]).toEqual([null, null, null, null]);
    });

    it('ไม่รู้รูปแบบ (null) → ไม่เดา', () => {
        expect(eliminationLabels(null, [win(1, 1, 2, 1)], [1, 2]).get(2)).toBeNull();
    });

    describe('แพ้คัดออกรอบเดียว (single elimination)', () => {
        // 8 ทีม: R1 สี่คู่ → R2 สองคู่ → R3 รอบชิง
        const bracket8 = [
            win(1, 1, 2, 1), win(1, 3, 4, 3), win(1, 5, 6, 5), win(1, 7, 8, 7),
            win(2, 1, 3, 1), win(2, 5, 7, 5),
            win(3, 1, 5, 1),
        ];
        const teams8 = [1, 2, 3, 4, 5, 6, 7, 8];

        it('ติดป้ายครบทุกชั้นตั้งแต่รอบแรกถึงแชมป์', () => {
            const labels = eliminationLabels('single_elimination', bracket8, teams8);

            expect(labels.get(2)).toBe('ตกรอบ 8 ทีมสุดท้าย');
            expect(labels.get(4)).toBe('ตกรอบ 8 ทีมสุดท้าย');
            expect(labels.get(6)).toBe('ตกรอบ 8 ทีมสุดท้าย');
            expect(labels.get(8)).toBe('ตกรอบ 8 ทีมสุดท้าย');
            expect(labels.get(3)).toBe('ตกรอบ 4 ทีมสุดท้าย');
            expect(labels.get(7)).toBe('ตกรอบ 4 ทีมสุดท้าย');
            expect(labels.get(5)).toBe('รองแชมป์');
            expect(labels.get(1)).toBe('แชมป์');
        });

        /**
         * 🔴 เคสที่สำคัญที่สุด — ทัวร์ยังแข่งไม่จบ
         *   ถ้าเช็คแค่ "รอบท้ายสุดที่มีผล" ทีมที่แพ้รอบรองจะได้ป้าย "รองแชมป์"
         *   และทีมที่ยังไม่แพ้จะได้ "แชมป์" ทั้งที่ยังไม่ได้แข่งรอบชิงกัน
         */
        it('ยังไม่แข่งรอบชิง → ยังไม่มีแชมป์/รองแชมป์ · ทีมที่ยังอยู่ได้ null', () => {
            const labels = eliminationLabels('single_elimination', bracket8.slice(0, 6), teams8);

            expect(labels.get(3)).toBe('ตกรอบ 4 ทีมสุดท้าย');
            expect(labels.get(7)).toBe('ตกรอบ 4 ทีมสุดท้าย');
            expect(labels.get(1)).toBeNull();
            expect(labels.get(5)).toBeNull();
        });

        /**
         * 🔴 รอบแรกที่เพิ่งจบไปคู่เดียว — ผู้แพ้คู่นั้นต้องไม่ใช่ "รองแชมป์"
         *   เคสนี้จับกรณีที่เช็คแค่ "เป็นรอบท้ายสุดที่มีผล และมีผู้แพ้คนเดียว" ซึ่งเป็นจริง
         *   ตั้งแต่แมตช์แรกของทัวร์จบ ⇒ ทีมที่ตกรอบแรกจะได้ป้ายรองแชมป์ทันที
         *   เงื่อนไขที่ถูกต้องต้องรวม "ตกแล้วเหลือทีมเดียว" ด้วย
         */
        it('เพิ่งจบรอบแรกคู่เดียว → ผู้แพ้ได้ "ตกรอบ 4 ทีมสุดท้าย" ไม่ใช่ "รองแชมป์"', () => {
            const labels = eliminationLabels('single_elimination', [win(1, 1, 2, 1)], [1, 2, 3, 4]);

            expect(labels.get(2)).toBe('ตกรอบ 4 ทีมสุดท้าย');
            expect(labels.get(1)).toBeNull();
        });

        /**
         * ★ จำนวนทีมไม่ใช่เลขยกกำลังสอง (มีทีมบายรอบแรก)
         *   6 ทีม: R1 สองคู่ (4 ทีม) · 2 ทีมบายเข้า R2
         *   ⇒ ผู้แพ้ R1 ต้องเป็น "ตกรอบ 6 ทีมสุดท้าย" ไม่ใช่ 8 — ซึ่งสูตร 2^n จะคำนวณผิด
         */
        it('มีทีมบายรอบแรก → นับจากจำนวนทีมจริง ไม่ใช่เลขยกกำลังสอง', () => {
            const labels = eliminationLabels('single_elimination', [
                win(1, 1, 2, 1), win(1, 3, 4, 3),
                win(2, 1, 5, 1), win(2, 3, 6, 3),
                win(3, 1, 3, 1),
            ], [1, 2, 3, 4, 5, 6]);

            expect(labels.get(2)).toBe('ตกรอบ 6 ทีมสุดท้าย');
            expect(labels.get(4)).toBe('ตกรอบ 6 ทีมสุดท้าย');
            expect(labels.get(5)).toBe('ตกรอบ 4 ทีมสุดท้าย');
            expect(labels.get(6)).toBe('ตกรอบ 4 ทีมสุดท้าย');
            expect(labels.get(3)).toBe('รองแชมป์');
            expect(labels.get(1)).toBe('แชมป์');
        });
    });

    describe('แพ้สองครั้งตกรอบ (double elimination)', () => {
        /**
         * 🔴 หัวใจของรูปแบบนี้ — **แพ้ ≠ ตกรอบ**
         *   แพ้ในสาย winners แล้วไหลไปสาย losers ⇒ ยังอยู่ในทัวร์
         *   ถ้าตัวคิดป้ายนับการแพ้ในสาย winners ทีมที่ยังแข่งอยู่จะถูกประกาศว่าตกรอบ
         */
        it('แพ้ในสาย winners ยังไม่ตกรอบ', () => {
            const labels = eliminationLabels('double_elimination', [win(1, 1, 2, 1)], [1, 2, 3, 4]);

            expect(labels.get(2)).toBeNull();
        });

        it('แพ้ในสาย losers = ตกรอบ · แพ้ grand final = รองแชมป์', () => {
            const labels = eliminationLabels('double_elimination', [
                win(1, 1, 2, 1), win(1, 3, 4, 3),
                lose(1, 2, 4, 2),          // 4 ตกรอบ (เหลือ 3 ทีม)
                lose(2, 2, 3, 3),          // 2 ตกรอบ (เหลือ 2 ทีม)
                { bracket_type : 'grand_final', round : null, team_a_id : 1, team_b_id : 3, winner_team_id : 1 },
            ], [1, 2, 3, 4]);

            expect(labels.get(4)).toBe('ตกรอบ 4 ทีมสุดท้าย');
            expect(labels.get(2)).toBe('ตกรอบ 3 ทีมสุดท้าย');
            expect(labels.get(3)).toBe('รองแชมป์');
            expect(labels.get(1)).toBe('แชมป์');
        });

        /**
         * 🔴 `grand_final` มี `round` เป็น NULL ตาม schema
         *   ถ้าอ่านเป็น 0 มันจะกลายเป็นรอบแรกสุด แล้วรองแชมป์จะถูกนับว่าตกรอบแรก
         *   เทสนี้จับเคสนั้นโดยเฉพาะ — ไม่มีสาย losers เลย มีแต่ grand final
         */
        it('grand final ที่ round เป็น NULL ต้องถูกนับเป็นรอบท้ายสุด ไม่ใช่รอบแรก', () => {
            const labels = eliminationLabels('double_elimination', [
                lose(1, 2, 3, 2),
                { bracket_type : 'grand_final', round : null, team_a_id : 1, team_b_id : 2, winner_team_id : 1 },
            ], [1, 2, 3]);

            expect(labels.get(3)).toBe('ตกรอบ 3 ทีมสุดท้าย');
            expect(labels.get(2)).toBe('รองแชมป์');
            expect(labels.get(1)).toBe('แชมป์');
        });
    });

    describe('ข้อมูลที่ไม่สมบูรณ์ — ไม่เดา', () => {
        it('ผู้ชนะไม่ใช่ทีมใดในโหนดนั้น (ข้อมูลเพี้ยน) → ข้ามไป ไม่ติดป้ายผิดคน', () => {
            const labels = eliminationLabels('single_elimination', [win(1, 1, 2, 99)], [1, 2]);

            expect(labels.get(1)).toBeNull();
            expect(labels.get(2)).toBeNull();
        });

        it('โหนดที่ยังไม่มีทีมครบ (ช่องว่าง) → ข้ามไป', () => {
            const labels = eliminationLabels('single_elimination', [
                { bracket_type : 'winners', round : 1, team_a_id : 1, team_b_id : null, winner_team_id : 1 },
            ], [1, 2]);

            expect([...labels.values()]).toEqual([null, null]);
        });

        /** ★ ทีมที่ไม่อยู่ในตารางอันดับ (ถอนตัวแล้วถูกตัดออก) ต้องไม่ถูกนับเข้า N */
        it('ผู้แพ้ที่ไม่อยู่ในรายชื่อทีม → ไม่ถูกนับ', () => {
            const labels = eliminationLabels('single_elimination', [win(1, 1, 77, 1)], [1, 2]);

            expect(labels.has(77)).toBe(false);
            expect(labels.get(1)).toBeNull();
        });

        it('ไม่มีทีมเลย → Map ว่าง ไม่ throw', () => {
            expect(eliminationLabels('single_elimination', [], []).size).toBe(0);
        });
    });
});
