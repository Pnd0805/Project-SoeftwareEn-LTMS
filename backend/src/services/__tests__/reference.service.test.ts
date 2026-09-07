import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/faculty.repo.js', () => ({
  findAllFaculties: vi.fn(),
  findFacultyById: vi.fn(),
  findDepartmentsByFaculty: vi.fn(),
}));

vi.mock('../../repositories/sportType.repo.js', () => ({
  findAllSportTypes: vi.fn(),
  findSportTypeById: vi.fn(),
  findStatDefinitionsBySportType: vi.fn(),
}));

vi.mock('../../mappers/reference.mapper.js', () => ({
  toFacultyDto: vi.fn(),
  toDepartmentDto: vi.fn(),
  toSportTypeDto: vi.fn(),
  toSportStatDefinitionDto: vi.fn(),
}));

import * as referenceService from '../reference.service.js';
import * as FacRepo from '../../repositories/faculty.repo.js';
import * as SportRepo from '../../repositories/sportType.repo.js';
import {
  toFacultyDto,
  toDepartmentDto,
  toSportTypeDto,
  toSportStatDefinitionDto,
} from '../../mappers/reference.mapper.js';

const mockedFacRepo = vi.mocked(FacRepo);
const mockedSportRepo = vi.mocked(SportRepo);
const mockedToFacultyDto = vi.mocked(toFacultyDto);
const mockedToDepartmentDto = vi.mocked(toDepartmentDto);
const mockedToSportTypeDto = vi.mocked(toSportTypeDto);
const mockedToSportStatDefinitionDto = vi.mocked(toSportStatDefinitionDto);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getFaculty', () => {
  it('returns every faculty mapped to a DTO', async () => {
    const rows = [{ faculty_id: 1, name: 'Engineering' }, { faculty_id: 2, name: 'Science' }];
    mockedFacRepo.findAllFaculties.mockResolvedValue(rows as any);
    mockedToFacultyDto
      .mockReturnValueOnce({ id: 1, name: 'Engineering' } as any)
      .mockReturnValueOnce({ id: 2, name: 'Science' } as any);

    const result = await referenceService.getFaculty();

    // .map() invokes the callback as (item, index, array) — only assert
    // on the item each call actually cares about.
    expect(mockedToFacultyDto.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(mockedToFacultyDto.mock.calls[1]?.[0]).toEqual(rows[1]);
    expect(result).toEqual({ items: [{ id: 1, name: 'Engineering' }, { id: 2, name: 'Science' }] });
  });

  it('returns an empty items array when there are no faculties', async () => {
    mockedFacRepo.findAllFaculties.mockResolvedValue([]);

    const result = await referenceService.getFaculty();

    expect(result).toEqual({ items: [] });
    expect(mockedToFacultyDto).not.toHaveBeenCalled();
  });
});

describe('getDepartmentByFaculty', () => {
  it('returns mapped departments when the faculty exists', async () => {
    mockedFacRepo.findFacultyById.mockResolvedValue({ faculty_id: 1, name: 'Engineering' } as any);
    const deptRows = [{ department_id: 10, faculty_id: 1, name: 'Computer Eng' }];
    mockedFacRepo.findDepartmentsByFaculty.mockResolvedValue(deptRows as any);
    mockedToDepartmentDto.mockReturnValue({ id: 10, name: 'Computer Eng' } as any);

    const result = await referenceService.getDepartmentByFaculty(1);

    expect(mockedFacRepo.findFacultyById).toHaveBeenCalledWith(1);
    expect(mockedFacRepo.findDepartmentsByFaculty).toHaveBeenCalledWith(1);
    expect(mockedToDepartmentDto.mock.calls[0]?.[0]).toEqual(deptRows[0]);
    expect(result).toEqual({ items: [{ id: 10, name: 'Computer Eng' }] });
  });

  it('throws FACULTY_NOT_FOUND when the faculty does not exist', async () => {
    mockedFacRepo.findFacultyById.mockResolvedValue(null);

    await expect(referenceService.getDepartmentByFaculty(999)).rejects.toMatchObject({
      status: 404,
      code: 'FACULTY_NOT_FOUND',
    });
    expect(mockedFacRepo.findDepartmentsByFaculty).not.toHaveBeenCalled();
  });
});

describe('getSportType', () => {
  it('returns every sport type mapped to a DTO', async () => {
    const rows = [{ sport_type_id: 1, name: 'Football' }];
    mockedSportRepo.findAllSportTypes.mockResolvedValue(rows as any);
    mockedToSportTypeDto.mockReturnValue({ id: 1, name: 'Football' } as any);

    const result = await referenceService.getSportType();

    expect(mockedToSportTypeDto.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(result).toEqual({ items: [{ id: 1, name: 'Football' }] });
  });

  it('returns an empty items array when there are no sport types', async () => {
    mockedSportRepo.findAllSportTypes.mockResolvedValue([]);

    const result = await referenceService.getSportType();

    expect(result).toEqual({ items: [] });
  });
});

describe('getStatDefinitionBySportType', () => {
  it('returns mapped stat definitions when the sport type exists', async () => {
    mockedSportRepo.findSportTypeById.mockResolvedValue({ sport_type_id: 1, name: 'Football' } as any);
    const statRows = [{ sport_stat_definition_id: 1, stat_key: 'goals' }];
    mockedSportRepo.findStatDefinitionsBySportType.mockResolvedValue(statRows as any);
    mockedToSportStatDefinitionDto.mockReturnValue({ id: 1, key: 'goals' } as any);

    const result = await referenceService.getStatDefinitionBySportType(1);

    expect(mockedSportRepo.findSportTypeById).toHaveBeenCalledWith(1);
    expect(mockedSportRepo.findStatDefinitionsBySportType).toHaveBeenCalledWith(1);
    expect(mockedToSportStatDefinitionDto.mock.calls[0]?.[0]).toEqual(statRows[0]);
    expect(result).toEqual({ items: [{ id: 1, key: 'goals' }] });
  });

  it('throws SPORT_TYPE_NOT_FOUND when the sport type does not exist', async () => {
    mockedSportRepo.findSportTypeById.mockResolvedValue(null);

    await expect(referenceService.getStatDefinitionBySportType(999)).rejects.toMatchObject({
      status: 404,
      code: 'SPORT_TYPE_NOT_FOUND',
    });
    expect(mockedSportRepo.findStatDefinitionsBySportType).not.toHaveBeenCalled();
  });
});
