import { describe, it, expect } from 'vitest';
import {
  toFacultyDto,
  toDepartmentDto,
  toSportTypeDto,
  toSportStatDefinitionDto,
} from '../reference.mapper.js';

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
    };
    expect(toSportTypeDto(row as any)).toEqual({
      id: 3,
      name: 'Football',
      minMembers: 7,
      maxMembers: 11,
      defaultMode: 'onsite',
    });
  });

  it('preserves the "online" default mode value as-is', () => {
    const row = {
      sport_type_id: 4,
      name: 'Chess',
      min_members: 1,
      max_members: 1,
      default_mode: 'online',
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
