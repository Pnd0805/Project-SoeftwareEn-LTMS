import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/tournamentReferee.repo.js', () => ({
  findRecentApproval: vi.fn(),
  findOpenReview: vi.fn(),
  findLatestRejection: vi.fn(),
  findLiveExternalRows: vi.fn(),
  submitDocsForUser: vi.fn(),
}));

import {
  getIdentityState,
  getMyIdentity,
  submitMyDocs,
  resolveApprovalForAccept,
} from '../refereeIdentity.service.js';
import * as RefRepo from '../../repositories/tournamentReferee.repo.js';

const mockedRefRepo = vi.mocked(RefRepo);

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getIdentityState', () => {
  it('returns "approved" with an expiry one year after approved_at when a recent approval exists', async () => {
    const approvedAt = new Date('2024-01-01T00:00:00Z');
    mockedRefRepo.findRecentApproval.mockResolvedValue({
      tournament_referee_id: 1,
      approved_by: 9,
      approved_at: approvedAt,
    } as any);

    const result = await getIdentityState(100);

    expect(result).toEqual({
      status: 'approved',
      approvedAt,
      expiresAt: new Date(approvedAt.getTime() + ONE_YEAR_MS),
      adminMessage: null,
      docsSubmitted: true,
    });
    // approved is a terminal branch — the later lookups should be skipped
    expect(mockedRefRepo.findOpenReview).not.toHaveBeenCalled();
    expect(mockedRefRepo.findLatestRejection).not.toHaveBeenCalled();
  });

  it('does not treat a recent-approval row with a null approved_at as approved', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue({
      tournament_referee_id: 1,
      approved_by: null,
      approved_at: null,
    } as any);
    mockedRefRepo.findOpenReview.mockResolvedValue(null);
    mockedRefRepo.findLatestRejection.mockResolvedValue(null);

    const result = await getIdentityState(100);

    expect(result.status).toBe('none');
  });

  it('returns "pending" from an open review, carrying its admin message and docs-submitted flag', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue({
      tournament_referee_id: 1,
      external_approval_status: 'pending',
      external_verification_docs: ['doc.pdf'],
      external_rejection_reason: null,
    } as any);

    const result = await getIdentityState(100);

    expect(result).toEqual({
      status: 'pending',
      approvedAt: null,
      expiresAt: null,
      adminMessage: null,
      docsSubmitted: true,
    });
    expect(mockedRefRepo.findLatestRejection).not.toHaveBeenCalled();
  });

  it('returns "needs_docs" from an open review with docsSubmitted false when no docs are attached', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue({
      tournament_referee_id: 1,
      external_approval_status: 'needs_docs',
      external_verification_docs: null,
      external_rejection_reason: 'เอกสารไม่ชัด',
    } as any);

    const result = await getIdentityState(100);

    expect(result).toEqual({
      status: 'needs_docs',
      approvedAt: null,
      expiresAt: null,
      adminMessage: 'เอกสารไม่ชัด',
      docsSubmitted: false,
    });
  });

  it('returns "rejected" with the rejection reason when there is a latest rejection and nothing open/approved', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue(null);
    mockedRefRepo.findLatestRejection.mockResolvedValue({
      approved_at: null,
      external_rejection_reason: 'ปลอมเอกสาร',
    } as any);

    const result = await getIdentityState(100);

    expect(result).toEqual({
      status: 'rejected',
      approvedAt: null,
      expiresAt: null,
      adminMessage: 'ปลอมเอกสาร',
      docsSubmitted: false,
    });
  });

  it('returns "none" when there is no approval, open review, or rejection at all', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue(null);
    mockedRefRepo.findLatestRejection.mockResolvedValue(null);

    const result = await getIdentityState(100);

    expect(result).toEqual({
      status: 'none',
      approvedAt: null,
      expiresAt: null,
      adminMessage: null,
      docsSubmitted: false,
    });
  });
});

describe('getMyIdentity', () => {
  function mockState(status: 'none' | 'pending' | 'needs_docs' | 'approved' | 'rejected', docsSubmitted = false) {
    if (status === 'approved') {
      mockedRefRepo.findRecentApproval.mockResolvedValue({
        tournament_referee_id: 1, approved_by: 1, approved_at: new Date(),
      } as any);
      return;
    }
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    if (status === 'pending' || status === 'needs_docs') {
      mockedRefRepo.findOpenReview.mockResolvedValue({
        tournament_referee_id: 1, external_approval_status: status,
        external_verification_docs: docsSubmitted ? ['doc.pdf'] : null, external_rejection_reason: null,
      } as any);
      mockedRefRepo.findLatestRejection.mockResolvedValue(null);
      return;
    }
    mockedRefRepo.findOpenReview.mockResolvedValue(null);
    if (status === 'rejected') {
      mockedRefRepo.findLatestRejection.mockResolvedValue({ approved_at: null, external_rejection_reason: 'x' } as any);
      return;
    }
    mockedRefRepo.findLatestRejection.mockResolvedValue(null);
  }

  it('sets docsRequired true for status "none"', async () => {
    mockState('none');
    mockedRefRepo.findLiveExternalRows.mockResolvedValue([]);

    const result = await getMyIdentity(100);

    expect(result.docsRequired).toBe(true);
  });

  it('sets docsRequired true for status "needs_docs"', async () => {
    mockState('needs_docs');
    mockedRefRepo.findLiveExternalRows.mockResolvedValue([]);

    const result = await getMyIdentity(100);

    expect(result.docsRequired).toBe(true);
  });

  it('sets docsRequired true for "pending" without submitted docs, and false once docs are submitted', async () => {
    mockState('pending', false);
    mockedRefRepo.findLiveExternalRows.mockResolvedValue([]);
    const withoutDocs = await getMyIdentity(100);
    expect(withoutDocs.docsRequired).toBe(true);

    vi.resetAllMocks();
    mockState('pending', true);
    mockedRefRepo.findLiveExternalRows.mockResolvedValue([]);
    const withDocs = await getMyIdentity(100);
    expect(withDocs.docsRequired).toBe(false);
  });

  it('sets docsRequired false for "approved" and "rejected"', async () => {
    mockState('approved');
    mockedRefRepo.findLiveExternalRows.mockResolvedValue([]);
    expect((await getMyIdentity(100)).docsRequired).toBe(false);

    vi.resetAllMocks();
    mockState('rejected');
    mockedRefRepo.findLiveExternalRows.mockResolvedValue([]);
    expect((await getMyIdentity(100)).docsRequired).toBe(false);
  });

  it('maps live external rows to the tournaments list', async () => {
    mockState('pending', true);
    mockedRefRepo.findLiveExternalRows.mockResolvedValue([
      { tournament_referee_id: 1, tournament_id: 10, tournament_name: 'Tour A', external_approval_status: 'pending' },
      { tournament_referee_id: 2, tournament_id: 20, tournament_name: 'Tour B', external_approval_status: 'pending' },
    ] as any);

    const result = await getMyIdentity(100);

    expect(result.tournaments).toEqual([
      { id: 10, name: 'Tour A', tournamentRefereeId: 1, externalApprovalStatus: 'pending' },
      { id: 20, name: 'Tour B', tournamentRefereeId: 2, externalApprovalStatus: 'pending' },
    ]);
  });

  it('returns an empty tournaments array when there are no live external rows', async () => {
    mockState('none');
    mockedRefRepo.findLiveExternalRows.mockResolvedValue([]);

    const result = await getMyIdentity(100);

    expect(result.tournaments).toEqual([]);
  });
});

describe('submitMyDocs', () => {
  const input = { docs: ['doc1.pdf', 'doc2.pdf'] };

  it('throws DOCS_NOT_EXPECTED when the user is already approved, without touching the repo write', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue({
      tournament_referee_id: 1, approved_by: 1, approved_at: new Date(),
    } as any);

    await expect(submitMyDocs(100, input)).rejects.toMatchObject({ status: 409, code: 'DOCS_NOT_EXPECTED' });
    expect(mockedRefRepo.submitDocsForUser).not.toHaveBeenCalled();
  });

  it('throws DOCS_NOT_EXPECTED when no rows were affected (no pending external invitation)', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue(null);
    mockedRefRepo.findLatestRejection.mockResolvedValue(null);
    mockedRefRepo.submitDocsForUser.mockResolvedValue(0);

    await expect(submitMyDocs(100, input)).rejects.toMatchObject({ status: 409, code: 'DOCS_NOT_EXPECTED' });
  });

  it('submits the docs and returns a pending result with the affected count when rows are updated', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue(null);
    mockedRefRepo.findLatestRejection.mockResolvedValue(null);
    mockedRefRepo.submitDocsForUser.mockResolvedValue(3);

    const result = await submitMyDocs(100, input);

    expect(mockedRefRepo.submitDocsForUser).toHaveBeenCalledWith(100, input.docs);
    expect(result).toEqual({ status: 'pending', docsCount: 2, tournamentsUpdated: 3 });
  });

  it('allows re-submitting docs while in "needs_docs" (not just "none")', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue({
      tournament_referee_id: 1, external_approval_status: 'needs_docs',
      external_verification_docs: null, external_rejection_reason: 'เอกสารไม่ชัด',
    } as any);
    mockedRefRepo.submitDocsForUser.mockResolvedValue(1);

    const result = await submitMyDocs(100, input);

    expect(result).toEqual({ status: 'pending', docsCount: 2, tournamentsUpdated: 1 });
  });
});

describe('resolveApprovalForAccept', () => {
  it('returns "not_required" immediately for an internal (non-external) invitation, without any repo lookups', async () => {
    const result = await resolveApprovalForAccept({ is_external: 0, user_id: 100 } as any, undefined);

    expect(result).toEqual({
      status: 'not_required', approvedBy: null, approvedAt: null, docs: null, reason: null, joinsOpenReview: false,
    });
    expect(mockedRefRepo.findRecentApproval).not.toHaveBeenCalled();
  });

  it('copies a prior approval within the last year for an external referee, ignoring any open review', async () => {
    const approvedAt = new Date('2024-06-01T00:00:00Z');
    mockedRefRepo.findRecentApproval.mockResolvedValue({
      tournament_referee_id: 9, approved_by: 5, approved_at: approvedAt,
    } as any);

    const result = await resolveApprovalForAccept({ is_external: 1, user_id: 100 } as any, undefined);

    expect(result).toEqual({
      status: 'approved', approvedBy: 5, approvedAt, docs: null, reason: null, joinsOpenReview: false,
    });
    expect(mockedRefRepo.findOpenReview).not.toHaveBeenCalled();
  });

  it('joins an existing open review when no docs are supplied', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue({
      tournament_referee_id: 9, external_approval_status: 'needs_docs',
      external_verification_docs: ['old.pdf'], external_rejection_reason: 'แก้ไข',
    } as any);

    const result = await resolveApprovalForAccept({ is_external: 1, user_id: 100 } as any, undefined);

    expect(result).toEqual({
      status: 'needs_docs', approvedBy: null, approvedAt: null,
      docs: ['old.pdf'], reason: 'แก้ไข', joinsOpenReview: true,
    });
  });

  it('starts a fresh "pending" review (ignoring the open one) when docs are supplied alongside an open review', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue({
      tournament_referee_id: 9, external_approval_status: 'needs_docs',
      external_verification_docs: null, external_rejection_reason: 'แก้ไข',
    } as any);

    const result = await resolveApprovalForAccept({ is_external: 1, user_id: 100 }, ['new.pdf']);

    expect(result).toEqual({
      status: 'pending', approvedBy: null, approvedAt: null,
      docs: ['new.pdf'], reason: null, joinsOpenReview: true, // an open review did exist, even though we didn't join it
    });
  });

  it('starts a fresh "pending" review with docs:null and joinsOpenReview:false when there is no prior approval, no open review, and no docs', async () => {
    mockedRefRepo.findRecentApproval.mockResolvedValue(null);
    mockedRefRepo.findOpenReview.mockResolvedValue(null);

    const result = await resolveApprovalForAccept({ is_external: 1, user_id: 100 } as any, undefined);

    expect(result).toEqual({
      status: 'pending', approvedBy: null, approvedAt: null, docs: null, reason: null, joinsOpenReview: false,
    });
  });
});
