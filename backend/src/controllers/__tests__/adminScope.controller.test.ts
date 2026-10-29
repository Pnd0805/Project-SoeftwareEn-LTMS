import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/adminScope.service.js', () => ({
  getAllOfficialRequest: vi.fn(),
  approveTeamRequest: vi.fn(),
  rejectTeamOfficial: vi.fn(),
  getAllTransferRequest: vi.fn(),
  approveTransferRequest: vi.fn(),
  rejectTransferRequest: vi.fn(),
  transferLeaderByAdmin: vi.fn(),
  listUsers: vi.fn(),
  suspendUser: vi.fn(),
  listScopes: vi.fn(),
  grantScope: vi.fn(),
  revokeScope: vi.fn(),
  listAuditLogs: vi.fn(),
  listUserReports: vi.fn(),
  approveUserReport: vi.fn(),
  rejectUserReport: vi.fn(),
}));

vi.mock('../../services/oversight.service.js', () => ({
  getStalledWork: vi.fn(),
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
  getAllTransferRequest,
  approveTransfer,
  rejectTransfer,
  transferLeaderByAdmin,
  listUsers,
  suspendUser,
  listScopes,
  grantScope,
  revokeScope,
  listAuditLogs,
  listUserReports,
  approveUserReport,
  rejectUserReport,
  getStalledWork,
} from '../adminScope.controller.js';
import * as AdminService from '../../services/adminScope.service.js';
import * as OversightService from '../../services/oversight.service.js';
import { parseId } from '../../utils/parseId.js';
import { parsePagination } from '../../utils/pagination.js';
import { AppError } from '../../utils/AppError.js';

const mockedAdminService = vi.mocked(AdminService);
const mockedOversight = vi.mocked(OversightService);
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

// ============================= C3 — leader transfer =============================

const admin = { user_id: 9, scopes: [{ scope_type: 'university' }] };
const page = { newpage: 2, newpageSize: 10, offset: 10 };

describe('adminScope.controller getAllTransferRequest()', () => {
  it('parses pagination and responds 200 with the pending transfer requests', async () => {
    const req = { query: { page: '2', pageSize: '10' } } as unknown as Request;
    const res = makeRes();
    mockedParsePagination.mockReturnValue(page);
    const result = { items: [{ id: 1 }] };
    mockedAdminService.getAllTransferRequest.mockResolvedValue(result as any);

    await getAllTransferRequest(req, res);

    expect(mockedParsePagination).toHaveBeenCalledWith('2', '10');
    expect(mockedAdminService.getAllTransferRequest).toHaveBeenCalledWith(10, 2, 10);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });
});

describe('adminScope.controller approveTransfer()', () => {
  it('approves the transfer request as the acting admin, responds 200', async () => {
    const req = { params: { id: '5' }, admin } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(5);
    mockedAdminService.approveTransferRequest.mockResolvedValue({ id: 5 } as any);

    await approveTransfer(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('5', 'รหัสคำร้อง', 'id');
    expect(mockedAdminService.approveTransferRequest).toHaveBeenCalledWith(9, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: 5 });
  });

  it('does not call the service when the id is invalid', async () => {
    const req = { params: { id: 'x' }, admin } as unknown as Request;
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementation(() => { throw parseError; });

    await expect(approveTransfer(req, makeRes())).rejects.toBe(parseError);
    expect(mockedAdminService.approveTransferRequest).not.toHaveBeenCalled();
  });
});

describe('adminScope.controller rejectTransfer()', () => {
  it('rejects the transfer request with a reason, responds 200', async () => {
    const req = { params: { id: '5' }, admin, body: { reason: 'ไม่ได้รับความยินยอม' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(5);
    mockedAdminService.rejectTransferRequest.mockResolvedValue({ id: 5 } as any);

    await rejectTransfer(req, res);

    expect(mockedAdminService.rejectTransferRequest).toHaveBeenCalledWith(9, 5, 'ไม่ได้รับความยินยอม');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('propagates a service error', async () => {
    const req = { params: { id: '5' }, admin, body: { reason: 'x' } } as unknown as Request;
    mockedParseId.mockReturnValue(5);
    const err = new AppError(409, 'ALREADY_DECIDED', 'x');
    mockedAdminService.rejectTransferRequest.mockRejectedValue(err);

    await expect(rejectTransfer(req, makeRes())).rejects.toBe(err);
  });
});

describe('adminScope.controller transferLeaderByAdmin()', () => {
  it('parses the team id with the team label and transfers to newLeaderId, responds 200', async () => {
    const req = { params: { id: '30' }, admin, body: { newLeaderId: 44 } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(30);
    mockedAdminService.transferLeaderByAdmin.mockResolvedValue({ team_id: 30, leader_id: 44 } as any);

    await transferLeaderByAdmin(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('30', 'รหัสทีม', 'id');
    expect(mockedAdminService.transferLeaderByAdmin).toHaveBeenCalledWith(9, 30, 44);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ team_id: 30, leader_id: 44 });
  });
});

// ============================= C2 — users =============================

describe('adminScope.controller listUsers()', () => {
  it('passes the whole admin object, all filters and pagination to the service', async () => {
    const req = {
      admin,
      query: { page: '2', pageSize: '10', q: 'somchai', facultyId: '4', suspended: 'true' },
    } as unknown as Request;
    const res = makeRes();
    mockedParsePagination.mockReturnValue(page);
    mockedAdminService.listUsers.mockResolvedValue({ items: [] } as any);

    await listUsers(req, res);

    expect(mockedAdminService.listUsers).toHaveBeenCalledWith(
      admin, { q: 'somchai', facultyId: 4, suspended: true }, 10, 2, 10,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ items: [] });
  });

  it('maps suspended=false to false', async () => {
    const req = { admin, query: { suspended: 'false' } } as unknown as Request;
    mockedParsePagination.mockReturnValue({ newpage: 1, newpageSize: 20, offset: 0 });
    mockedAdminService.listUsers.mockResolvedValue({ items: [] } as any);

    await listUsers(req, makeRes());

    expect(mockedAdminService.listUsers.mock.calls[0]![1]).toEqual({ q: undefined, facultyId: undefined, suspended: false });
  });

  it.each([['yes'], ['1'], [''], [['true', 'false']]])('ignores suspended=%j (only "true"/"false" count)', async (suspended) => {
    const req = { admin, query: { suspended } } as unknown as Request;
    mockedParsePagination.mockReturnValue({ newpage: 1, newpageSize: 20, offset: 0 });
    mockedAdminService.listUsers.mockResolvedValue({ items: [] } as any);

    await listUsers(req, makeRes());

    expect(mockedAdminService.listUsers.mock.calls[0]![1]).toMatchObject({ suspended: undefined });
  });

  it('drops q and facultyId when they arrive as arrays (repeated query keys)', async () => {
    const req = { admin, query: { q: ['a', 'b'], facultyId: ['1', '2'] } } as unknown as Request;
    mockedParsePagination.mockReturnValue({ newpage: 1, newpageSize: 20, offset: 0 });
    mockedAdminService.listUsers.mockResolvedValue({ items: [] } as any);

    await listUsers(req, makeRes());

    expect(mockedAdminService.listUsers.mock.calls[0]![1]).toEqual({ q: undefined, facultyId: undefined, suspended: undefined });
  });

  it('passes a non-numeric facultyId through as NaN (service decides what to do)', async () => {
    const req = { admin, query: { facultyId: 'abc' } } as unknown as Request;
    mockedParsePagination.mockReturnValue({ newpage: 1, newpageSize: 20, offset: 0 });
    mockedAdminService.listUsers.mockResolvedValue({ items: [] } as any);

    await listUsers(req, makeRes());

    expect(mockedAdminService.listUsers.mock.calls[0]![1].facultyId).toBeNaN();
  });
});

describe('adminScope.controller suspendUser()', () => {
  it('passes admin, user id and every body field in order, responds 200', async () => {
    const req = {
      params: { id: '12' },
      admin,
      body: { suspended: true, reason: 'สแปม', days: 7, category: 'spam' },
    } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(12);
    mockedAdminService.suspendUser.mockResolvedValue({ user_id: 12 } as any);

    await suspendUser(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('12', 'รหัสผู้ใช้', 'id');
    expect(mockedAdminService.suspendUser).toHaveBeenCalledWith(admin, 12, true, 'สแปม', 7, 'spam');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes undefined for optional fields left out (unsuspend)', async () => {
    const req = { params: { id: '12' }, admin, body: { suspended: false } } as unknown as Request;
    mockedParseId.mockReturnValue(12);
    mockedAdminService.suspendUser.mockResolvedValue({ user_id: 12 } as any);

    await suspendUser(req, makeRes());

    expect(mockedAdminService.suspendUser).toHaveBeenCalledWith(admin, 12, false, undefined, undefined, undefined);
  });
});

// ============================= C2 — scopes =============================

describe('adminScope.controller listScopes()', () => {
  it('passes the facultyId filter as a number with pagination', async () => {
    const req = { admin, query: { page: '2', pageSize: '10', facultyId: '4' } } as unknown as Request;
    const res = makeRes();
    mockedParsePagination.mockReturnValue(page);
    mockedAdminService.listScopes.mockResolvedValue({ items: [] } as any);

    await listScopes(req, res);

    expect(mockedAdminService.listScopes).toHaveBeenCalledWith(admin, { facultyId: 4 }, 10, 2, 10);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('leaves facultyId undefined when not given', async () => {
    const req = { admin, query: {} } as unknown as Request;
    mockedParsePagination.mockReturnValue({ newpage: 1, newpageSize: 20, offset: 0 });
    mockedAdminService.listScopes.mockResolvedValue({ items: [] } as any);

    await listScopes(req, makeRes());

    expect(mockedAdminService.listScopes).toHaveBeenCalledWith(admin, { facultyId: undefined }, 0, 1, 20);
  });
});

describe('adminScope.controller grantScope()', () => {
  it('grants the scope from the body and responds 201 (created)', async () => {
    const req = { admin, body: { userId: 44, scopeType: 'faculty', facultyId: 4 } } as unknown as Request;
    const res = makeRes();
    const created = { admin_scope_id: 3 };
    mockedAdminService.grantScope.mockResolvedValue(created as any);

    await grantScope(req, res);

    expect(mockedAdminService.grantScope).toHaveBeenCalledWith(admin, 44, 'faculty', 4);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it('propagates a service error (e.g. not allowed to grant this scope)', async () => {
    const req = { admin, body: { userId: 44, scopeType: 'university' } } as unknown as Request;
    const err = new AppError(403, 'FORBIDDEN', 'x');
    mockedAdminService.grantScope.mockRejectedValue(err);

    await expect(grantScope(req, makeRes())).rejects.toBe(err);
  });
});

describe('adminScope.controller revokeScope()', () => {
  it('parses the scope id with its own label and revokes it, responds 200', async () => {
    const req = { params: { id: '3' }, admin } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    mockedAdminService.revokeScope.mockResolvedValue({ revoked: true } as any);

    await revokeScope(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('3', 'รหัส admin scope', 'id');
    expect(mockedAdminService.revokeScope).toHaveBeenCalledWith(admin, 3);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not revoke anything when the id is invalid', async () => {
    const req = { params: { id: '0' }, admin } as unknown as Request;
    const parseError = new AppError(400, 'VALIDATION_FAILED', 'x');
    mockedParseId.mockImplementation(() => { throw parseError; });

    await expect(revokeScope(req, makeRes())).rejects.toBe(parseError);
    expect(mockedAdminService.revokeScope).not.toHaveBeenCalled();
  });
});

// ============================= C2 — audit logs =============================

describe('adminScope.controller listAuditLogs()', () => {
  it('passes all four filters, converting the id filters to numbers', async () => {
    const req = {
      admin,
      query: { page: '2', pageSize: '10', entityType: 'team', entityId: '30', userId: '12', actionType: 'suspend' },
    } as unknown as Request;
    const res = makeRes();
    mockedParsePagination.mockReturnValue(page);
    mockedAdminService.listAuditLogs.mockResolvedValue({ items: [] } as any);

    await listAuditLogs(req, res);

    expect(mockedAdminService.listAuditLogs).toHaveBeenCalledWith(
      admin, { entityType: 'team', entityId: 30, userId: 12, actionType: 'suspend' }, 10, 2, 10,
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('leaves every filter undefined when the query is empty', async () => {
    const req = { admin, query: {} } as unknown as Request;
    mockedParsePagination.mockReturnValue({ newpage: 1, newpageSize: 20, offset: 0 });
    mockedAdminService.listAuditLogs.mockResolvedValue({ items: [] } as any);

    await listAuditLogs(req, makeRes());

    expect(mockedAdminService.listAuditLogs).toHaveBeenCalledWith(
      admin, { entityType: undefined, entityId: undefined, userId: undefined, actionType: undefined }, 0, 1, 20,
    );
  });
});

// ============================= C2 — user reports =============================

describe('adminScope.controller listUserReports()', () => {
  it('passes admin and pagination, responds 200', async () => {
    const req = { admin, query: { page: '2', pageSize: '10' } } as unknown as Request;
    const res = makeRes();
    mockedParsePagination.mockReturnValue(page);
    mockedAdminService.listUserReports.mockResolvedValue({ items: [] } as any);

    await listUserReports(req, res);

    expect(mockedAdminService.listUserReports).toHaveBeenCalledWith(admin, 10, 2, 10);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('adminScope.controller approveUserReport()', () => {
  it('passes days and category from the body, responds 200', async () => {
    const req = { params: { id: '8' }, admin, body: { days: 3, category: 'harassment' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(8);
    mockedAdminService.approveUserReport.mockResolvedValue({ report_id: 8 } as any);

    await approveUserReport(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('8', 'รหัสคำร้อง', 'id');
    expect(mockedAdminService.approveUserReport).toHaveBeenCalledWith(admin, 8, 3, 'harassment');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('works with no body at all (schema makes the whole body optional)', async () => {
    const req = { params: { id: '8' }, admin } as unknown as Request;
    mockedParseId.mockReturnValue(8);
    mockedAdminService.approveUserReport.mockResolvedValue({ report_id: 8 } as any);

    await approveUserReport(req, makeRes());

    expect(mockedAdminService.approveUserReport).toHaveBeenCalledWith(admin, 8, undefined, undefined);
  });
});

describe('adminScope.controller rejectUserReport()', () => {
  it('rejects the report with a reason, responds 200', async () => {
    const req = { params: { id: '8' }, admin, body: { reason: 'หลักฐานไม่พอ' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(8);
    mockedAdminService.rejectUserReport.mockResolvedValue({ report_id: 8 } as any);

    await rejectUserReport(req, res);

    expect(mockedAdminService.rejectUserReport).toHaveBeenCalledWith(admin, 8, 'หลักฐานไม่พอ');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ============================= OD-34 — oversight =============================

describe('adminScope.controller getStalledWork()', () => {
  it('calls the oversight service with no arguments and responds 200', async () => {
    const res = makeRes();
    const stalled = { pendingTournaments: 2, openComplaints: 1 };
    mockedOversight.getStalledWork.mockResolvedValue(stalled as any);

    await getStalledWork({} as Request, res);

    expect(mockedOversight.getStalledWork).toHaveBeenCalledWith();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(stalled);
  });

  it('propagates a service error', async () => {
    const err = new Error('DB_DOWN');
    mockedOversight.getStalledWork.mockRejectedValue(err);
    await expect(getStalledWork({} as Request, makeRes())).rejects.toBe(err);
  });
});
