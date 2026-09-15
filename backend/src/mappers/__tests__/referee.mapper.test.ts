import { describe, it, expect } from 'vitest';
import { toTournamentRefereeDto, toMyRefereeInvitationDto } from '../referee.mapper.js';

describe('toTournamentRefereeDto', () => {
  it('maps a referee row into a nested user ref plus status/external fields', () => {
    const row = {
      tournament_referee_id: 1,
      user_id: 5,
      full_name: 'กรรมการ A',
      profile_image_key: 'avatar.png',
      invitation_status: 'accepted',
      is_external: 1,
      external_approval_status: 'approved',
    };

    expect(toTournamentRefereeDto(row as any)).toEqual({
      id: 1,
      user: { id: 5, fullName: 'กรรมการ A', avatarUrl: 'avatar.png' },
      invitationStatus: 'accepted',
      isExternal: true,
      externalApprovalStatus: 'approved',
    });
  });

  it('maps is_external 0 to boolean false', () => {
    const row = {
      tournament_referee_id: 1,
      user_id: 5,
      full_name: 'กรรมการ A',
      profile_image_key: null,
      invitation_status: 'pending',
      is_external: 0,
      external_approval_status: 'not_required',
    };

    expect(toTournamentRefereeDto(row as any).isExternal).toBe(false);
  });

  it('maps a null avatar through the nested user ref as null', () => {
    const row = {
      tournament_referee_id: 1,
      user_id: 5,
      full_name: 'กรรมการ A',
      profile_image_key: null,
      invitation_status: 'pending',
      is_external: 0,
      external_approval_status: 'not_required',
    };

    expect(toTournamentRefereeDto(row as any).user.avatarUrl).toBeNull();
  });
});

describe('toMyRefereeInvitationDto', () => {
  it('maps the invitation row into a nested tournament ref, including ISO createdAt', () => {
    const row = {
      tournament_referee_id: 1,
      tournament_id: 3,
      name: 'Summer Cup',
      sport_type_id: 2,
      event_start_date: '2024-06-01',
      is_external: 1,
      created_at: new Date('2024-05-01T10:00:00Z'),
    };

    expect(toMyRefereeInvitationDto(row as any)).toEqual({
      id: 1,
      tournament: {
        id: 3,
        name: 'Summer Cup',
        sportTypeId: 2,
        eventStartDate: '2024-06-01',
      },
      isExternal: true,
      createdAt: '2024-05-01T10:00:00.000Z',
    });
  });

  it('maps is_external 0 to boolean false', () => {
    const row = {
      tournament_referee_id: 1,
      tournament_id: 3,
      name: 'Summer Cup',
      sport_type_id: 2,
      event_start_date: '2024-06-01',
      is_external: 0,
      created_at: new Date('2024-05-01T10:00:00Z'),
    };

    expect(toMyRefereeInvitationDto(row as any).isExternal).toBe(false);
  });
});
