/**
 * src/api/reference.ts — R01, R02, R03
 */
import { apiFetch, mockDelay, USE_MOCK } from "./client";
import type { Faculty, Department, SportType } from "../types/dto";
import { mockFaculties, mockDepartments, mockSportTypes } from "../mocks/reference.mock";

export async function getFaculties(): Promise<{ items: Faculty[] }> {
  if (USE_MOCK) return mockDelay({ items: mockFaculties });
  return apiFetch("/faculties");
}

export async function getDepartments(facultyId: number): Promise<{ items: Department[] }> {
  if (USE_MOCK) {
    return mockDelay({ items: mockDepartments.filter((d) => d.facultyId === facultyId) });
  }
  return apiFetch(`/faculties/${facultyId}/departments`);
}

export async function getSportTypes(): Promise<{ items: SportType[] }> {
  if (USE_MOCK) return mockDelay({ items: mockSportTypes });
  return apiFetch("/sport-types");
}
