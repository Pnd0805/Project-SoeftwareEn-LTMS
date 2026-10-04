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
      pickemTolerance: { exact: 0, close: 1 },
      pickemPoints: { spotOn: 10, close: 7, sideOnly: 4 },
    });
  });

  // ══════════════ OD-63 — เส้นและแต้มของ Pick'em ต้องออก API ══════════════
  // FE ต้องอธิบายกฎให้ผู้ใช้ก่อนกดส่ง · ค่าอยู่ใน sport_types (ผู้จัดแก้ได้) ⇒ hardcode ฝั่ง FE ไม่ได้

  it('ส่งเส้นของกีฬานั้นตามจริง ไม่สลับ exact กับ close', () => {
    const basketball = {
      sport_type_id: 2,
      name: 'บาสเกตบอล',
      min_members: 5,
      max_members: 12,
      default_mode: 'onsite',
      pickem_tolerance_exact: 5,
      pickem_tolerance_close: 10,
    };
    expect(toSportTypeDto(basketball as any).pickemTolerance).toEqual({ exact: 5, close: 10 });
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
    expect(dto.pickemTolerance).toEqual({ exact: 0, close: 0 });
    expect(dto.pickemTolerance.exact).toBe(0);
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
