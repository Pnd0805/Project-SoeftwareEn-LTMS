import { describe, it, expect } from 'vitest';
import {
  toGetOfficialRequest,
  toRequestApproveDto,
  toRequestRejectDto,
} from '../adminScope.mapper.js';

describe('toGetOfficialRequest', () => {
  it('maps the request row into nested team and requestedBy refs, with ISO createdAt', () => {
    const row = {
      team_admin_request_id: 1,
      team_admin_request_status: 'pending' as const,
      requested_at: new Date('2024-04-01T00:00:00Z'),
      team_id: 10,
      name: 'Dream Team',
      sport_type_id: 2,
      user_id: 5,
      full_name: 'สมชาย ใจดี',
      profile_image_key: 'avatar.png',
    };

    expect(toGetOfficialRequest(row as any)).toEqual({
      id: 1,
      team: { id: 10, name: 'Dream Team', sportTypeId: 2 },
      requestedBy: { id: 5, fullName: 'สมชาย ใจดี', avatarUrl: 'avatar.png' },
      status: 'pending',
      createdAt: '2024-04-01T00:00:00.000Z',
    });
  });

  it('maps a null requester avatar through as null', () => {
    const row = {
      team_admin_request_id: 1,
      team_admin_request_status: 'pending' as const,
      requested_at: new Date('2024-04-01T00:00:00Z'),
      team_id: 10,
      name: 'Dream Team',
      sport_type_id: 2,
      user_id: 5,
      full_name: 'สมชาย ใจดี',
      profile_image_key: null,
    };

    expect(toGetOfficialRequest(row as any).requestedBy.avatarUrl).toBeNull();
  });

  it.each(['pending', 'approved', 'rejected'])('preserves the "%s" status value', (status) => {
    const row = {
      team_admin_request_id: 1,
      team_admin_request_status: status as any,
      requested_at: new Date('2024-04-01T00:00:00Z'),
      team_id: 10,
      name: 'Dream Team',
      sport_type_id: 2,
      user_id: 5,
      full_name: 'สมชาย ใจดี',
      profile_image_key: null,
    };

    expect(toGetOfficialRequest(row as any).status).toBe(status);
  });
});

describe('toRequestApproveDto', () => {
  it('maps team_id and official_status', () => {
    const row = { team_id: 10, official_status: 'Official' as const };
    expect(toRequestApproveDto(row)).toEqual({ teamId: 10, officialStatus: 'Official' });
  });

  it('preserves the "Unofficial" status value', () => {
    const row = { team_id: 10, official_status: 'Unofficial' as const };
    expect(toRequestApproveDto(row).officialStatus).toBe('Unofficial');
  });
});

describe('toRequestRejectDto', () => {
  it('maps status and a non-null rejection_reason', () => {
    const row = {
      team_admin_request_status: 'rejected' as const,
      rejection_reason: 'เอกสารไม่ครบ',
    };

    expect(toRequestRejectDto(row)).toEqual({
      status: 'rejected',
      reason: 'เอกสารไม่ครบ',
    });
  });

  it('passes a null rejection_reason through as null', () => {
    const row = {
      team_admin_request_status: 'pending' as const,
      rejection_reason: null,
    };

    expect(toRequestRejectDto(row).reason).toBeNull();
  });
});
