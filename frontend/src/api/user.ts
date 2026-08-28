/**
 * src/api/user.ts — U01, U02, U03, U04, U06
 */
import { apiFetch, mockDelay, mockReject, USE_MOCK } from "./client";
import type {
  MeDto,
  UpdateMeRequest,
  PublicUserDto,
  UserStatsDto,
  UserSearchResult,
} from "../types/dto";
import { mockUsers, type MockUserRecord } from "../mocks/user.mock";

// mock ไม่มี session ฝั่ง server จริง — เก็บ "ใครล็อกอินอยู่" ไว้ตรงนี้แทน
// เรียก setMockCurrentUser() จาก onSuccess ของ useLogin/useLogout (ดู hooks/useAuth.ts)
let currentMockUserId: number | null = (() => {
  const saved = Number(localStorage.getItem("ltms-mock-user-id"));
  return Number.isInteger(saved) && saved > 0 ? saved : null;
})();
export function setMockCurrentUser(id: number | null): void {
  currentMockUserId = id;
  if (id === null) localStorage.removeItem("ltms-mock-user-id");
  else localStorage.setItem("ltms-mock-user-id", String(id));
}

function stripSecrets(u: MockUserRecord): MeDto {
  const { passwordForMock, ...me } = u;
  return me;
}

export async function getMe(): Promise<MeDto> {
  if (USE_MOCK) {
    const u = mockUsers.find((x) => x.id === currentMockUserId);
    if (!u) return mockReject(401, { code: "UNAUTHORIZED", message: "ยังไม่ได้เข้าสู่ระบบ" });
    return mockDelay(stripSecrets(u));
  }
  return apiFetch<MeDto>("/me");
}

export async function updateMe(input: UpdateMeRequest): Promise<MeDto> {
  if (USE_MOCK) {
    const u = mockUsers.find((x) => x.id === currentMockUserId);
    if (!u) return mockReject(401, { code: "UNAUTHORIZED", message: "ยังไม่ได้เข้าสู่ระบบ" });
    Object.assign(u, input);
    return mockDelay(stripSecrets(u));
  }
  return apiFetch<MeDto>("/me", { method: "PATCH", body: JSON.stringify(input) });
}

export async function getPublicUser(userId: number): Promise<PublicUserDto> {
  if (USE_MOCK) {
    const u = mockUsers.find((x) => x.id === userId);
    if (!u) return mockReject(404, { code: "NOT_FOUND", message: "ไม่พบผู้ใช้" });
    // U03 ห้ามมี email/contactInfo/address — mapper คนละตัวกับ MeDto โดยเจตนา (GUIDE/06 เตือนไว้)
    return mockDelay({
      id: u.id,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      facultyId: u.facultyId,
      departmentId: u.departmentId,
      teams: [], // เติมจริงตอนทำ Step 4 (Teams)
    });
  }
  return apiFetch<PublicUserDto>(`/users/${userId}`);
}

export async function getUserStats(userId: number): Promise<UserStatsDto> {
  if (USE_MOCK) {
    return mockDelay({
      userId,
      overall: { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, championCount: 0 },
      bySport: [],
    });
  }
  return apiFetch<UserStatsDto>(`/users/${userId}/stats`);
}

export async function searchUsers(q: string): Promise<UserSearchResult> {
  if (q.length < 3) {
    return Promise.reject(new Error("QUERY_TOO_SHORT")); // ฝั่ง UI เช็คความยาวก่อนเรียกอยู่แล้ว กันไว้อีกชั้น
  }
  if (USE_MOCK) {
    const items = mockUsers
      .filter((u) => u.fullName.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 20)
      .map((u) => ({ id: u.id, fullName: u.fullName, avatarUrl: u.avatarUrl }));
    return mockDelay({ items });
  }
  return apiFetch<UserSearchResult>(`/users/search?q=${encodeURIComponent(q)}`);
}
