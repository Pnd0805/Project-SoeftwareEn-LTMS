import { describe, expect, it } from 'vitest';
import { toTournamentDetailDto } from '../tournament.mapper.js';

describe('toTournamentDetailDto', () => {
  it('exposes entryNotes in tournament detail', () => {
    const row = {
      tournament_id: 7,
      name: 'KU Open',
      description: null,
      entry_notes: 'กรุณานำบัตรนิสิตมาแสดง',
      sport_type_id: 1,
      bracket_format: 'single_elimination',
      scope_type: 'faculty',
      organizing_faculty_id: 1,
      organizing_department_id: null,
      tournament_status: 'private',
      registration_open: 0,
      registration_start: null,
      registration_end: null,
      event_start_date: '2026-10-10',
      event_end_date: '2026-10-10',
      max_teams: 8,
      min_teams: 2,
      venue: 'สนามกีฬา',
      gender_requirement: 'any',
      min_age: null,
      max_age: null,
      champion_team_id: null,
      completed_at: null,
    } as any;

    const dto = toTournamentDetailDto(row, { id: 1, name: 'Organizer' } as any, 0);
    expect(dto.entryNotes).toBe('กรุณานำบัตรนิสิตมาแสดง');
  });
});
