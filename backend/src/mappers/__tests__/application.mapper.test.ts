import { describe, it, expect } from 'vitest';
import {
  toMyApplicationDto,
  toOrganizerApplicationDto,
  toApplicationDetailDto,
} from '../application.mapper.js';

describe('toMyApplicationDto', () => {
  it('maps a leader application row into nested tournament and team refs', () => {
    const row = {
      tournament_application_id: 1,
      tournament_id: 5,
      tournament_name: 'Summer Cup',
      team_id: 10,
      team_name: 'Dream Team',
      sport_type_id: 2,
      tournament_application_status: 'pending',
      rejection_reason: null,
      applied_at: '2024-05-01T00:00:00.000Z',
    };

    expect(toMyApplicationDto(row as any)).toEqual({
      id: 1,
      tournament: { id: 5, name: 'Summer Cup' },
      team: { id: 10, name: 'Dream Team', sportTypeId: 2 },
      status: 'pending',
      rejectionReason: null,
      appliedAt: '2024-05-01T00:00:00.000Z',
    });
  });

  it('passes through a non-null rejectionReason unchanged', () => {
    const row = {
      tournament_application_id: 1,
      tournament_id: 5,
      tournament_name: 'Summer Cup',
      team_id: 10,
      team_name: 'Dream Team',
      sport_type_id: 2,
      tournament_application_status: 'rejected',
      rejection_reason: 'เอกสารไม่ครบ',
      applied_at: '2024-05-01T00:00:00.000Z',
    };

    expect(toMyApplicationDto(row as any).rejectionReason).toBe('เอกสารไม่ครบ');
  });
});

describe('toOrganizerApplicationDto', () => {
  it('maps an organizer application row, including team ref and filter fields', () => {
    const row = {
      tournament_application_id: 1,
      team_id: 10,
      team_name: 'Dream Team',
      sport_type_id: 2,
      tournament_application_status: 'pending',
      hard_filter_passed: 1,
      soft_filter_documents: ['doc1.pdf'],
      applied_at: '2024-05-01T00:00:00.000Z',
    };

    expect(toOrganizerApplicationDto(row as any)).toEqual({
      id: 1,
      team: { id: 10, name: 'Dream Team', sportTypeId: 2 },
      status: 'pending',
      hardFilterPassed: true,
      softFilterDocuments: ['doc1.pdf'],
      appliedAt: '2024-05-01T00:00:00.000Z',
    });
  });

  it('coerces a falsy hard_filter_passed (0) into boolean false', () => {
    const row = {
      tournament_application_id: 1,
      team_id: 10,
      team_name: 'Dream Team',
      sport_type_id: 2,
      tournament_application_status: 'pending',
      hard_filter_passed: 0,
      soft_filter_documents: [],
      applied_at: '2024-05-01T00:00:00.000Z',
    };

    expect(toOrganizerApplicationDto(row as any).hardFilterPassed).toBe(false);
  });

  it('coerces a truthy hard_filter_passed into boolean true even if not already 1', () => {
    const row = {
      tournament_application_id: 1,
      team_id: 10,
      team_name: 'Dream Team',
      sport_type_id: 2,
      tournament_application_status: 'pending',
      hard_filter_passed: 2,
      soft_filter_documents: [],
      applied_at: '2024-05-01T00:00:00.000Z',
    };

    expect(toOrganizerApplicationDto(row as any).hardFilterPassed).toBe(true);
  });
});

describe('toApplicationDetailDto', () => {
  it('maps the detail row including per-member hardFilterDetails, with presigned softFilterDocuments passed in separately', () => {
    const row = {
      tournament_application_id: 1,
      tournament_id: 5,
      team_id: 10,
      team_name: 'Dream Team',
      sport_type_id: 2,
      tournament_application_status: 'approved',
      hard_filter_details: [{ userId: 1, fullName: 'Somchai', passed: true }],
      soft_filter_documents: ['doc1.pdf', 'doc2.pdf'],
    };
    const presignedUrls = ['https://s3.example.com/doc1.pdf?sig=abc', 'https://s3.example.com/doc2.pdf?sig=def'];

    expect(toApplicationDetailDto(row as any, presignedUrls)).toEqual({
      id: 1,
      tournamentId: 5,
      team: { id: 10, name: 'Dream Team', sportTypeId: 2 },
      status: 'approved',
      hardFilterDetails: [{ userId: 1, fullName: 'Somchai', passed: true }],
      softFilterDocuments: presignedUrls,
    });
  });

  it('defaults hardFilterDetails to an empty array when the DB value is null', () => {
    const row = {
      tournament_application_id: 1,
      tournament_id: 5,
      team_id: 10,
      team_name: 'Dream Team',
      sport_type_id: 2,
      tournament_application_status: 'pending',
      hard_filter_details: null,
      soft_filter_documents: null,
    };

    const result = toApplicationDetailDto(row as any, []);
    expect(result.hardFilterDetails).toEqual([]);
    expect(result.softFilterDocuments).toEqual([]);
  });
});
