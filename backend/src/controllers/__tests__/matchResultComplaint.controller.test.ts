import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/matchResultComplaint.service.js', () => ({
  fileComplaint: vi.fn(),
  listComplaintsOfMatch: vi.fn(),
  getComplaint: vi.fn(),
  attachOrganizerStatement: vi.fn(),
  decideComplaint: vi.fn(),
}));

import {
  fileComplaint,
  listComplaintsOfMatch,
  getComplaint,
  attachOrganizerStatement,
  decideComplaint,
} from '../matchResultComplaint.controller.js';
import * as ComplaintService from '../../services/matchResultComplaint.service.js';

const mockedService = vi.mocked(ComplaintService);

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// S13 — ยื่นเรื่องร้องเรียนผลแมตช์
describe('matchResultComplaint.controller fileComplaint()', () => {
  it('files the complaint for the match in the path as the logged-in user, responds 201', async () => {
    const body = { reason: 'คะแนนผิด', evidenceUrl: 'https://example.test/x.png' };
    const req = { params: { id: '7' }, user: { user_id: 3 }, body } as unknown as Request;
    const res = makeRes();
    const created = { complaint_id: 100, match_id: 7 };
    mockedService.fileComplaint.mockResolvedValue(created as never);

    await fileComplaint(req, res);

    expect(mockedService.fileComplaint).toHaveBeenCalledWith(7, 3, body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it('rejects a bad match id with the match label and does not file anything', async () => {
    const req = { params: { id: 'abc' }, user: { user_id: 3 }, body: {} } as unknown as Request;

    await expect(fileComplaint(req, makeRes())).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      extra: { fields: { id: expect.stringContaining('รหัสแมตช์') } },
    });
    expect(mockedService.fileComplaint).not.toHaveBeenCalled();
  });

  it('propagates a service error (e.g. 48-hour window closed)', async () => {
    const req = { params: { id: '7' }, user: { user_id: 3 }, body: {} } as unknown as Request;
    const err = new Error('WINDOW_CLOSED');
    mockedService.fileComplaint.mockRejectedValue(err);

    await expect(fileComplaint(req, makeRes())).rejects.toBe(err);
  });
});

// S13b
describe('matchResultComplaint.controller listComplaintsOfMatch()', () => {
  it('lists complaints of the match, responds 200', async () => {
    const req = { params: { id: '7' } } as unknown as Request;
    const res = makeRes();
    const list = [{ complaint_id: 100 }, { complaint_id: 101 }];
    mockedService.listComplaintsOfMatch.mockResolvedValue(list as never);

    await listComplaintsOfMatch(req, res);

    expect(mockedService.listComplaintsOfMatch).toHaveBeenCalledWith(7);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(list);
  });

  it('rejects a bad match id', async () => {
    const req = { params: { id: '0' } } as unknown as Request;
    await expect(listComplaintsOfMatch(req, makeRes())).rejects.toMatchObject({ status: 400 });
    expect(mockedService.listComplaintsOfMatch).not.toHaveBeenCalled();
  });
});

// S13c
describe('matchResultComplaint.controller getComplaint()', () => {
  it('reads one complaint by its own id, responds 200', async () => {
    const req = { params: { id: '100' } } as unknown as Request;
    const res = makeRes();
    mockedService.getComplaint.mockResolvedValue({ complaint_id: 100 } as never);

    await getComplaint(req, res);

    expect(mockedService.getComplaint).toHaveBeenCalledWith(100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ complaint_id: 100 });
  });

  it('rejects a bad complaint id with the complaint label (not the match label)', async () => {
    const req = { params: { id: 'x' } } as unknown as Request;
    await expect(getComplaint(req, makeRes())).rejects.toMatchObject({
      status: 400,
      extra: { fields: { id: expect.stringContaining('รหัสเรื่องร้องเรียน') } },
    });
    expect(mockedService.getComplaint).not.toHaveBeenCalled();
  });

  it('propagates a not-found error', async () => {
    const req = { params: { id: '100' } } as unknown as Request;
    const err = new Error('COMPLAINT_NOT_FOUND');
    mockedService.getComplaint.mockRejectedValue(err);
    await expect(getComplaint(req, makeRes())).rejects.toBe(err);
  });
});

// S13d — ผู้จัดแนบความเห็น
describe('matchResultComplaint.controller attachOrganizerStatement()', () => {
  it('attaches the statement as the logged-in organizer, responds 200', async () => {
    const body = { statement: 'ตรวจแล้ว คะแนนถูกต้อง' };
    const req = { params: { id: '100' }, user: { user_id: 9 }, body } as unknown as Request;
    const res = makeRes();
    mockedService.attachOrganizerStatement.mockResolvedValue({ complaint_id: 100 } as never);

    await attachOrganizerStatement(req, res);

    expect(mockedService.attachOrganizerStatement).toHaveBeenCalledWith(100, 9, body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ complaint_id: 100 });
  });

  it('rejects a bad complaint id', async () => {
    const req = { params: { id: '1.5' }, user: { user_id: 9 }, body: {} } as unknown as Request;
    await expect(attachOrganizerStatement(req, makeRes())).rejects.toMatchObject({ status: 400 });
    expect(mockedService.attachOrganizerStatement).not.toHaveBeenCalled();
  });

  it('propagates a service error (e.g. not the organizer)', async () => {
    const req = { params: { id: '100' }, user: { user_id: 9 }, body: {} } as unknown as Request;
    const err = new Error('FORBIDDEN');
    mockedService.attachOrganizerStatement.mockRejectedValue(err);
    await expect(attachOrganizerStatement(req, makeRes())).rejects.toBe(err);
  });
});

// S13e — แอดมินวินิจฉัย
describe('matchResultComplaint.controller decideComplaint()', () => {
  it('decides the complaint as the logged-in admin, responds 200', async () => {
    const body = { decision: 'upheld', note: 'แก้คะแนน' };
    const req = { params: { id: '100' }, user: { user_id: 1 }, body } as unknown as Request;
    const res = makeRes();
    const decided = { complaint_id: 100, status: 'upheld' };
    mockedService.decideComplaint.mockResolvedValue(decided as never);

    await decideComplaint(req, res);

    expect(mockedService.decideComplaint).toHaveBeenCalledWith(100, 1, body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(decided);
  });

  it('rejects a bad complaint id', async () => {
    const req = { params: { id: '-1' }, user: { user_id: 1 }, body: {} } as unknown as Request;
    await expect(decideComplaint(req, makeRes())).rejects.toMatchObject({ status: 400 });
    expect(mockedService.decideComplaint).not.toHaveBeenCalled();
  });

  it('propagates a service error (e.g. already decided)', async () => {
    const req = { params: { id: '100' }, user: { user_id: 1 }, body: {} } as unknown as Request;
    const err = new Error('ALREADY_DECIDED');
    mockedService.decideComplaint.mockRejectedValue(err);
    await expect(decideComplaint(req, makeRes())).rejects.toBe(err);
  });
});
