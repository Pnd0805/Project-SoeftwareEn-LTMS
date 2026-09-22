import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/feedback.service.js', () => ({ removeCommentByOrganizer: vi.fn() }));

import { removeCommentByOrganizer } from '../feedback.controller.js';
import * as FeedbackService from '../../services/feedback.service.js';

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as Response;
}
const req = (body: unknown) => ({ user: { user_id: 7 }, params: { id: '20', cid: '1' }, body }) as unknown as Request;
async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string; extra?: { fields?: Record<string, string> } });
}

beforeEach(() => vi.clearAllMocks());

/**
 * E17c — DELETE มี body ได้แต่ไม่ผ่าน validate middleware จึง safeParse ในคอนโทรลเลอร์
 * reason บังคับคือหัวใจของ "กันลบคำวิจารณ์เงียบ ๆ" (มติ 23 ก.ย. ข้อ 6.3.1) จึงต้องมีเทสคุม
 */
describe('removeCommentByOrganizer — reason is mandatory', () => {
  it('passes the trimmed reason through to the service and answers 204', async () => {
    const res = makeRes();
    await removeCommentByOrganizer(req({ reason: '  คำหยาบ  ' }), res);
    expect(FeedbackService.removeCommentByOrganizer).toHaveBeenCalledWith(20, 1, 7, 'คำหยาบ');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it.each([
    ['no body at all', undefined],
    ['empty object', {}],
    ['blank reason', { reason: '   ' }],
    ['too long', { reason: 'x'.repeat(256) }],
    ['wrong type', { reason: 5 }],
  ])('400 VALIDATION_FAILED — %s · nothing is removed', async (_label, body) => {
    const err = await errOf(removeCommentByOrganizer(req(body), makeRes()));
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(err!.extra!.fields!['reason']).toBeTruthy();
    expect(FeedbackService.removeCommentByOrganizer).not.toHaveBeenCalled();
  });
});
