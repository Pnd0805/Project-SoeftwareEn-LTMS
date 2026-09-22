import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/comment.repo.js', () => ({
  insert: vi.fn(() => Promise.resolve(5)),
  countRecentByUser: vi.fn(() => Promise.resolve({ count: 0, retryAfterSeconds: 1 })),
  findById: vi.fn(),
  findByMatch: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
  markReported: vi.fn(),
  remove: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../repositories/match.repo.js', () => ({ findMatchById: vi.fn(() => Promise.resolve({ match_id: 1 })) }));

import * as Service from '../comment.service.js';
import * as CommentRepo from '../../repositories/comment.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import type { CommentRow } from '../../repositories/comment.repo.js';

function row(overrides: Partial<CommentRow> = {}): CommentRow {
  return { match_comment_id: 5, match_id: 1, user_id: 50, full_name: 'สมชาย', profile_image_key: null,
           content: 'สู้ๆ', is_reported: 0, removed_at: null, created_at: new Date(0), ...overrides };
}
async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(MatchRepo.findMatchById).mockResolvedValue({ match_id: 1 } as never);
  vi.mocked(CommentRepo.findById).mockResolvedValue(row());
  vi.mocked(CommentRepo.remove).mockResolvedValue(true);
  vi.mocked(CommentRepo.countRecentByUser).mockResolvedValue({ count: 0, retryAfterSeconds: 1 });
});

describe('spam guard — มติ 22 ก.ย.: ไม่เกิน 5 คอมเมนต์ต่อนาที', () => {
  it('the 5th comment inside a minute is still allowed (4 before it)', async () => {
    vi.mocked(CommentRepo.countRecentByUser).mockResolvedValue({ count: 4, retryAfterSeconds: 30 });
    await expect(Service.postComment(1, 50, 'x')).resolves.toMatchObject({ id: 5 });
    expect(CommentRepo.countRecentByUser).toHaveBeenCalledWith(50, 60);
  });

  it('the 6th → 429 COMMENT_RATE_LIMITED with retryAfterSeconds, nothing saved', async () => {
    vi.mocked(CommentRepo.countRecentByUser).mockResolvedValue({ count: 5, retryAfterSeconds: 42 });
    const err = await errOf(Service.postComment(1, 50, 'x'));
    expect(err).toMatchObject({ status: 429, code: 'COMMENT_RATE_LIMITED', extra: { retryAfterSeconds: 42 } });
    expect(CommentRepo.insert).not.toHaveBeenCalled();
  });

  it('an unknown match is still 404 (checked before the limit)', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(null);
    vi.mocked(CommentRepo.countRecentByUser).mockResolvedValue({ count: 9, retryAfterSeconds: 10 });
    expect(await errOf(Service.postComment(999, 50, 'x'))).toMatchObject({ status: 404 });
  });
});

describe('comments', () => {
  it('posts and returns the new comment marked isMine', async () => {
    await expect(Service.postComment(1, 50, 'สู้ๆ')).resolves.toMatchObject({ id: 5, content: 'สู้ๆ', isMine: true, author: { id: 50 } });
    expect(CommentRepo.insert).toHaveBeenCalledWith(1, 50, 'สู้ๆ');
  });

  it('404 MATCH_NOT_FOUND', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(null);
    expect(await errOf(Service.postComment(999, 50, 'x'))).toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
  });

  it('lists with isMine only for the viewer', async () => {
    vi.mocked(CommentRepo.findByMatch).mockResolvedValue({ rows: [row(), row({ match_comment_id: 6, user_id: 60 })], totalItems: 2 });
    const { items, pagination } = await Service.listComments(1, 50, 1, 20, 0);
    expect(items.map(i => i.isMine)).toEqual([true, false]);
    expect(pagination.totalItems).toBe(2);
  });

  it('owner deletes their own comment', async () => {
    await Service.deleteOwnComment(5, 50);
    expect(CommentRepo.remove).toHaveBeenCalledWith(5, 50, null);
  });

  it("403 NOT_COMMENT_OWNER when deleting someone else's", async () => {
    expect(await errOf(Service.deleteOwnComment(5, 99))).toMatchObject({ status: 403, code: 'NOT_COMMENT_OWNER' });
  });

  it('404 for a removed comment', async () => {
    vi.mocked(CommentRepo.findById).mockResolvedValue(row({ removed_at: new Date() }));
    expect(await errOf(Service.deleteOwnComment(5, 50))).toMatchObject({ status: 404, code: 'COMMENT_NOT_FOUND' });
    expect(await errOf(Service.reportComment(5, 99))).toMatchObject({ status: 404 });
  });

  it('anyone else can report; own comment → 400', async () => {
    await expect(Service.reportComment(5, 99)).resolves.toEqual({ id: 5, isReported: true });
    expect(CommentRepo.markReported).toHaveBeenCalledWith(5);
    expect(await errOf(Service.reportComment(5, 50))).toMatchObject({ status: 400, code: 'CANNOT_REPORT_OWN_COMMENT' });
  });

  it('admin removes with an audit reason; again → 409', async () => {
    await Service.removeCommentByAdmin(5, 1, 'หยาบคาย');
    expect(CommentRepo.remove).toHaveBeenCalledWith(5, 1, { reason: 'หยาบคาย' });
    vi.mocked(CommentRepo.findById).mockResolvedValue(row({ removed_at: new Date() }));
    expect(await errOf(Service.removeCommentByAdmin(5, 1))).toMatchObject({ status: 409, code: 'COMMENT_ALREADY_REMOVED' });
  });
});
