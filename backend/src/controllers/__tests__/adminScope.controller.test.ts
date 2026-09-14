import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/adminScope.service.js', () => ({
  getAllOfficialRequest: vi.fn(),
  approveTeamRequest: vi.fn(),
  rejectTeamOfficial: vi.fn(),
}));

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

vi.mock('../../utils/pagination.js', () => ({
  parsePagination: vi.fn(),
}));

import {
  getAllOfficialRequest,
  approveTeamOfficial,
  rejectTeamOfficial,
} from '../adminScope.controller.js';
import * as AdminService from '../../services/adminScope.service.js';
import { parseId } from '../../utils/parseId.js';
import { parsePagination } from '../../utils/pagination.js';
import { AppError } from '../../utils/AppError.js';

const mockedAdminService = vi.mocked(AdminService);
const mockedParseId = vi.mocked(parseId);
const mockedParsePagination = vi.mocked(parsePagination);

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adminScope.controller getAllOfficialRequest()', () => {
  it('parses pagination from the query and responds 200 with the service result', async () => {
    const req = { query: { page: '2', pageSize: '10' } } as unknown as Request;
    const res = makeRes();
    mockedParsePagination.mockReturnValue({ newpage: 2, newpageSize: 10, offset: 10 });
    const serviceResult = { items: [{ id: 1 }], totalPages: 3 };
    mockedAdminService.getAllOfficialRequest.mockResolvedValue(serviceResult as any);

    await getAllOfficialRequest(req, res);

    expect(mockedParsePagination).toHaveBeenCalledWith('2', '10');
    expect(mockedAdminService.getAllOfficialRequest).toHaveBeenCalledWith(10, 2, 10);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('passes through undefined query params (pagination utility applies its own defaults)', async () => {
    const req = { query: {} } as unknown as Request;
    const res = makeRes();
    mockedParsePagination.mockReturnValue({ newpage: 1, newpageSize: 20, offset: 0 });
    mockedAdminService.getAllOfficialRequest.mockResolvedValue({ items: [] } as any);

    await getAllOfficialRequest(req, res);

    expect(mockedParsePagination).toHaveBeenCalledWith(undefined, undefined);
    expect(mockedAdminService.getAllOfficialRequest).toHaveBeenCalledWith(0, 1, 20);
  });

  it('propagates a service error', async () => {
    const req = { query: {} } as unknown as Request;
    const res = makeRes();
    mockedParsePagination.mockReturnValue({ newpage: 1, newpageSize: 20, offset: 0 });
    const serviceError = new Error('DB_DOWN');
    mockedAdminService.getAllOfficialRequest.mockRejectedValue(serviceError);

    await expect(getAllOfficialRequest(req, res)).rejects.toBe(serviceError);
  });
});

describe('adminScope.controller approveTeamOfficial()', () => {
  it('parses the request id and approves it as the acting admin, responds 200', async () => {
    const req = { params: { id: '5' }, admin: { user_id: 9 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(5);
    const serviceResult = { id: 5, status: 'approved' };
    mockedAdminService.approveTeamRequest.mockResolvedValue(serviceResult as any);

    await approveTeamOfficial(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('5', 'รหัสคำร้อง', 'id');
    expect(mockedAdminService.approveTeamRequest).toHaveBeenCalledWith(9, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error and never calls the service when parseId fails', async () => {
    const req = { params: { id: 'bad' }, admin: { user_id: 9 } } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(approveTeamOfficial(req, res)).rejects.toBe(parseError);
    expect(mockedAdminService.approveTeamRequest).not.toHaveBeenCalled();
  });
});

describe('adminScope.controller rejectTeamOfficial()', () => {
  it('parses the request id and rejects it with a reason, responds 200', async () => {
    const req = {
      params: { id: '5' },
      admin: { user_id: 9 },
      body: { reason: 'เอกสารไม่ครบ' },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(5);
    const serviceResult = { id: 5, status: 'rejected' };
    mockedAdminService.rejectTeamOfficial.mockResolvedValue(serviceResult as any);

    await rejectTeamOfficial(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('5', 'รหัสคำร้อง', 'id');
    expect(mockedAdminService.rejectTeamOfficial).toHaveBeenCalledWith(9, 5, 'เอกสารไม่ครบ');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates a service error (e.g. request already decided)', async () => {
    const req = {
      params: { id: '5' },
      admin: { user_id: 9 },
      body: { reason: 'x' },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(5);
    const serviceError = new AppError(409, 'ALREADY_DECIDED', 'x');
    mockedAdminService.rejectTeamOfficial.mockRejectedValue(serviceError);

    await expect(rejectTeamOfficial(req, res)).rejects.toBe(serviceError);
  });
});
