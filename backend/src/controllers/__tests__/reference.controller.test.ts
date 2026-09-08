import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/reference.service.js', () => ({
  getFaculty: vi.fn(),
  getDepartmentByFaculty: vi.fn(),
  getSportType: vi.fn(),
  getStatDefinitionBySportType: vi.fn(),
}));

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

import {
  getAllFaculty,
  getDepartmentByFaculty,
  getAllSportType,
  getStatDefinitionBySportType,
} from '../reference.controller.js';
import * as Reference from '../../services/reference.service.js';
import { parseId } from '../../utils/parseId.js';
import { AppError } from '../../utils/AppError.js';

const mockedReference = vi.mocked(Reference);
const mockedParseId = vi.mocked(parseId);

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reference.controller getAllFaculty()', () => {
  it('responds 200 with every faculty from the service', async () => {
    const req = {} as Request;
    const res = makeRes();
    const serviceResult = { items: [{ id: 1, name: 'Engineering' }] };
    mockedReference.getFaculty.mockResolvedValue(serviceResult as any);

    await getAllFaculty(req, res);

    expect(mockedReference.getFaculty).toHaveBeenCalledWith();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates a service error', async () => {
    const req = {} as Request;
    const res = makeRes();
    const serviceError = new Error('DB_DOWN');
    mockedReference.getFaculty.mockRejectedValue(serviceError);

    await expect(getAllFaculty(req, res)).rejects.toBe(serviceError);
  });
});

describe('reference.controller getDepartmentByFaculty()', () => {
  it('parses the faculty id param and responds 200 with departments', async () => {
    const req = { params: { id: '3' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(3);
    const serviceResult = { items: [{ id: 10, name: 'Computer Eng' }] };
    mockedReference.getDepartmentByFaculty.mockResolvedValue(serviceResult as any);

    await getDepartmentByFaculty(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('3', 'รหัสคณะ');
    expect(mockedReference.getDepartmentByFaculty).toHaveBeenCalledWith(3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates the error and never calls the service when parseId fails', async () => {
    const req = { params: { id: 'not-a-number' } } as unknown as Request;
    const res = makeRes();
    const parseError = new AppError(400, 'INVALID_ID', 'x');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(getDepartmentByFaculty(req, res)).rejects.toBe(parseError);
    expect(mockedReference.getDepartmentByFaculty).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('propagates FACULTY_NOT_FOUND from the service', async () => {
    const req = { params: { id: '999' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(999);
    const serviceError = new AppError(404, 'FACULTY_NOT_FOUND', 'x');
    mockedReference.getDepartmentByFaculty.mockRejectedValue(serviceError);

    await expect(getDepartmentByFaculty(req, res)).rejects.toBe(serviceError);
  });
});

describe('reference.controller getAllSportType()', () => {
  it('responds 200 with every sport type from the service', async () => {
    const req = {} as Request;
    const res = makeRes();
    const serviceResult = { items: [{ id: 1, name: 'Football' }] };
    mockedReference.getSportType.mockResolvedValue(serviceResult as any);

    await getAllSportType(req, res);

    expect(mockedReference.getSportType).toHaveBeenCalledWith();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });
});

describe('reference.controller getStatDefinitionBySportType()', () => {
  it('parses the sport type id param and responds 200 with stat definitions', async () => {
    const req = { params: { id: '5' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(5);
    const serviceResult = { items: [{ id: 1, statKey: 'goals' }] };
    mockedReference.getStatDefinitionBySportType.mockResolvedValue(serviceResult as any);

    await getStatDefinitionBySportType(req, res);

    expect(mockedParseId).toHaveBeenCalledWith('5', 'รหัสกีฬา');
    expect(mockedReference.getStatDefinitionBySportType).toHaveBeenCalledWith(5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(serviceResult);
  });

  it('propagates SPORT_TYPE_NOT_FOUND from the service', async () => {
    const req = { params: { id: '999' } } as unknown as Request;
    const res = makeRes();
    mockedParseId.mockReturnValue(999);
    const serviceError = new AppError(404, 'SPORT_TYPE_NOT_FOUND', 'x');
    mockedReference.getStatDefinitionBySportType.mockRejectedValue(serviceError);

    await expect(getStatDefinitionBySportType(req, res)).rejects.toBe(serviceError);
  });
});
