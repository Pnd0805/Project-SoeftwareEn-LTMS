import { PICKEM_TIER_POINTS } from './scoring.js';

/**
 * OD-57 — เกณฑ์ของเหรียญ เก็บเป็นข้อมูลใน `rewards.criteria` (JSON) ไม่ใช่ฝังในโค้ด
 *
 * คอลัมน์ `criteria` มีอยู่ใน schema ตั้งแต่แรกแต่ไม่เคยมีใครอ่าน — ถ้าเลือกฝังเกณฑ์ไว้ในโค้ด
 * มันจะกลายเป็นคอลัมน์ที่เขียนแล้วไม่มีใครใช้อีกตัว แบบเดียวกับที่ OD-29/OD-30 กวาดเจอมาแล้ว
 *
 * รองรับแค่ **2 รูป** โดยตั้งใจ — เหรียญมี 6 อัน ไม่คุ้มที่จะทำภาษาเงื่อนไข (AND/OR/ช่วงเวลา)
 * ซึ่งต้องมีตัวแปลภาษาและเทสของตัวเอง · รูปที่ 3 ค่อยเพิ่มเมื่อมีเหรียญที่ต้องใช้จริง
 */

/** นับจากสถิติสะสมของผู้เล่นในกีฬานั้น (`player_profile_stats`) */
export type StatCriteria = { stat: StatColumn; gte: number };

/** นับจำนวนแมตช์ที่ทายได้ชั้น `spot_on` (`pickem_predictions.points_earned`) */
export type PickemCriteria = { pickem: 'spot_on'; gte: number };

export type RewardCriteria = StatCriteria | PickemCriteria;

/**
 * ★ allowlist ของชื่อคอลัมน์ — ค่าจาก `criteria` ถูกเอาไปต่อเป็น SQL ตรง ๆ
 * ถ้าไม่ล็อกไว้ที่นี่ แอดมินที่แก้แถว `rewards` ได้จะยิง SQL อะไรก็ได้
 */
export const STAT_COLUMNS = ['matches_played', 'wins', 'losses', 'championships'] as const;
export type StatColumn = typeof STAT_COLUMNS[number];

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/**
 * อ่าน `criteria` ที่หยิบมาจากฐาน · คืน null เมื่อรูปไม่ถูกต้อง
 *
 * ★ เหรียญที่เกณฑ์อ่านไม่ออก = **ไม่แจกให้ใครเลย** (ไม่ใช่แจกให้ทุกคน)
 *   เกณฑ์พังแล้วไม่มีใครได้ สังเกตง่ายกว่าเกณฑ์พังแล้วทุกคนได้ และย้อนกลับได้โดยไม่ต้องริบของใคร
 */
export function parseCriteria(raw: unknown): RewardCriteria | null {
    const value = typeof raw === 'string' ? safeJson(raw) : raw;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const obj = value as Record<string, unknown>;

    if (!isPositiveInt(obj['gte'])) return null;

    if (typeof obj['stat'] === 'string') {
        const stat = obj['stat'] as StatColumn;
        return STAT_COLUMNS.includes(stat) ? { stat, gte: obj['gte'] } : null;
    }
    if (obj['pickem'] === 'spot_on') {
        return { pickem: 'spot_on', gte: obj['gte'] };
    }
    return null;
}

/** mysql2 คืน JSON column เป็น object อยู่แล้ว แต่ไดรเวอร์/คอลัมน์ TEXT บางที่คืนเป็นสตริง */
function safeJson(raw: string): unknown {
    try { return JSON.parse(raw); } catch { return null; }
}

export const isStatCriteria = (c: RewardCriteria): c is StatCriteria => 'stat' in c;

/**
 * แต้มของชั้น `spot_on` — อ้างค่าคงที่ของ OD-56 ไม่ hardcode 10
 * ถ้าทีมปรับแต้มรายชั้นวันหลัง เกณฑ์ "นักทายแม่น" จะตามไปเอง ไม่กลายเป็นเลขลอย
 */
export const SPOT_ON_POINTS = PICKEM_TIER_POINTS.spot_on;
