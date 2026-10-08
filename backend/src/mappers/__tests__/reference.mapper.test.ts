import { describe, it, expect } from 'vitest';
import {
  toFacultyDto,
  toDepartmentDto,
  toSportTypeDto,
  toSportStatDefinitionDto,
} from '../reference.mapper.js';
import { PICKEM_TIER_POINTS } from '../../config/scoring.js';

describe('toFacultyDto', () => {
  it('maps snake_case DB fields to camelCase DTO fields', () => {
    const row = { faculty_id: 1, name: 'Engineering' };
    expect(toFacultyDto(row as any)).toEqual({ id: 1, name: 'Engineering' });
  });
});

describe('toDepartmentDto', () => {
  it('maps department_id, faculty_id, and name correctly', () => {
    const row = { department_id: 10, faculty_id: 1, name: 'Computer Engineering' };
    expect(toDepartmentDto(row as any)).toEqual({
      id: 10,
      facultyId: 1,
      name: 'Computer Engineering',
    });
  });
});

describe('toSportTypeDto', () => {
  it('maps all fields including min/max member counts and default mode', () => {
    const row = {
      sport_type_id: 3,
      name: 'Football',
      min_members: 7,
      max_members: 11,
      default_mode: 'onsite',
      // migration 047 — ฟุตบอลนับแต้มในเกมเดียว ไม่ได้แข่งเป็นรอบ
      supports_best_of: 0,
      // OD-63 — คอลัมน์จริงของฟุตบอล (migration 040) · ใส่ใน fixture ให้ตรงกับที่ query คืนมา
      pickem_tolerance_exact: 0,
      pickem_tolerance_close: 1,
    };
    expect(toSportTypeDto(row as any)).toEqual({
      id: 3,
      name: 'Football',
      minMembers: 7,
      maxMembers: 11,
      defaultMode: 'onsite',
      supportsBestOf: false,
      pickemTolerance: { spotOn: 0, close: 1 },
      pickemPoints: { spotOn: 10, close: 7, sideOnly: 4 },
    });
  });

  /**
   * 🆕 มติ 7 ต.ค. 2569 (①ก · FE ขอมา) — "กีฬานี้แข่งเป็นรอบไหม" ต้องออก API
   *   FE เคยต้องจับคู่ **ชื่อกีฬา** ในโค้ดตัวเองเพื่อรู้ว่าจะโชว์ตัวเลือก BO-N หรือไม่
   *   ⇒ เพิ่มกีฬาใหม่ในฐาน FE ต้องแก้โค้ดตาม ซึ่งไม่มีใครรู้ว่าต้องแก้
   * ★ ส่งเป็น boolean ไม่ใช่เลข 0/1 ตามคอลัมน์ — FE ใช้ตรงตัวในเงื่อนไข ไม่ต้องแปลง
   */
  it.each([
    ['กีฬาที่แข่งเป็นรอบ ส่ง true', 1, true],
    ['กีฬาที่นับแต้ม ส่ง false', 0, false],
  ])('%s', (_name, column, expected) => {
    const row = {
      sport_type_id: 4, name: 'E-Sport: RoV', min_members: 5, max_members: 7,
      default_mode: 'online', supports_best_of: column,
      pickem_tolerance_exact: 0, pickem_tolerance_close: 0,
    };

    expect(toSportTypeDto(row as any)).toMatchObject({ supportsBestOf: expected });
  });

  // ══════════════ OD-63 — เส้นและแต้มของ Pick'em ต้องออก API ══════════════
  // FE ต้องอธิบายกฎให้ผู้ใช้ก่อนกดส่ง · ค่าอยู่ใน sport_types (ผู้จัดแก้ได้) ⇒ hardcode ฝั่ง FE ไม่ได้

  it('ส่งเส้นของกีฬานั้นตามจริง ไม่สลับ spotOn กับ close', () => {
    const basketball = {
      sport_type_id: 2,
      name: 'บาสเกตบอล',
      min_members: 5,
      max_members: 12,
      default_mode: 'onsite',
      pickem_tolerance_exact: 5,
      pickem_tolerance_close: 10,
    };
    expect(toSportTypeDto(basketball as any).pickemTolerance).toEqual({ spotOn: 5, close: 10 });
  });

  it('เส้น 0 ต้องออกไปเป็น 0 ไม่ใช่หายหรือกลายเป็นค่าตั้งต้น', () => {
    // แบด/RoV ตั้ง (0,0) โดยเจตนา ⇒ ชั้นรองไม่ยิงเลย
    // ★ ถ้าเขียน `row.pickem_tolerance_exact || DEFAULT` เคสนี้จะเพี้ยนเงียบ ๆ เพราะ 0 เป็น falsy
    const badminton = {
      sport_type_id: 5,
      name: 'แบดมินตัน',
      min_members: 1,
      max_members: 2,
      default_mode: 'onsite',
      pickem_tolerance_exact: 0,
      pickem_tolerance_close: 0,
    };
    const dto = toSportTypeDto(badminton as any);
    expect(dto.pickemTolerance).toEqual({ spotOn: 0, close: 0 });
    expect(dto.pickemTolerance.spotOn).toBe(0);
  });

  it('คีย์ของ tolerance ต้องชื่อเดียวกับชั้นใน points — ไม่ใช่ exact ตามชื่อคอลัมน์', () => {
    // ★ สองก้อนนี้ใช้คู่กันเสมอ (เส้นไม่มีประโยชน์ถ้าไม่รู้แต้ม และกลับกัน)
    //   ⇒ ชื่อคีย์ต้องตรงกัน เพื่อให้ FE วนลูป tolerance[tier] / points[tier] ได้
    //   เทสนี้กันคนเปลี่ยนกลับไปเป็น exact ตามชื่อคอลัมน์ในฐาน
    const row = {
      sport_type_id: 2,
      name: 'บาสเกตบอล',
      min_members: 5,
      max_members: 12,
      default_mode: 'onsite',
      pickem_tolerance_exact: 5,
      pickem_tolerance_close: 10,
    };
    const dto = toSportTypeDto(row as any);
    expect(Object.keys(dto.pickemTolerance).sort()).toEqual(['close', 'spotOn']);
    expect(dto.pickemTolerance).not.toHaveProperty('exact');
    // ทุกคีย์ของ tolerance ต้องมีชั้นที่ตรงกันใน points
    for (const key of Object.keys(dto.pickemTolerance)) {
      expect(dto.pickemPoints).toHaveProperty(key);
    }
  });

  it('แต้มมาจาก config ตัวเดียวกับที่คิดแต้มจริง ไม่ใช่เลขที่พิมพ์ซ้ำใน mapper', () => {
    // ★ เทสนี้ไม่ได้ตรวจว่าเป็น 10/7/4 — ตรวจว่า "ผูกกับ config" ⇒ วันไหนทีมเปลี่ยนแต้ม
    //   DTO ตามไปเอง และถ้ามีคน hardcode เลขทับใน mapper เทสนี้จะแดง
    const row = {
      sport_type_id: 1,
      name: 'ฟุตบอล',
      min_members: 7,
      max_members: 11,
      default_mode: 'onsite',
      pickem_tolerance_exact: 0,
      pickem_tolerance_close: 1,
    };
    expect(toSportTypeDto(row as any).pickemPoints).toEqual({
      spotOn: PICKEM_TIER_POINTS.spot_on,
      close: PICKEM_TIER_POINTS.close,
      sideOnly: PICKEM_TIER_POINTS.side_only,
    });
  });

  it('preserves the "online" default mode value as-is', () => {
    const row = {
      sport_type_id: 4,
      name: 'Chess',
      min_members: 1,
      max_members: 1,
      default_mode: 'online',
      pickem_tolerance_exact: 0,
      pickem_tolerance_close: 0,
    };
    expect(toSportTypeDto(row as any).defaultMode).toBe('online');
  });
});

describe('toSportStatDefinitionDto', () => {
  it('maps every field to its camelCase DTO equivalent', () => {
    const row = {
      sport_stat_definition_id: 5,
      sport_type_id: 3,
      stat_key: 'goals',
      stat_label_th: 'ประตู',
      data_type: 'integer',
      display_order: 1,
    };
    expect(toSportStatDefinitionDto(row as any)).toEqual({
      statDefinitionId: 5,
      statKey: 'goals',
      statLabelTh: 'ประตู',
      dataType: 'integer',
      displayOrder: 1,
    });
  });
});
