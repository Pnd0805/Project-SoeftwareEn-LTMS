/**
 * src/api/admin.ts — Person 4 (Admin · Organizer approval · Referee)
 *
 * แพตเทิร์นเดียวกับ `api/team.ts` — อ่านผ่านสะพาน เขียนตอบ 501 ในโหมด mock
 * ทุก path เป็นการอนุมานจนกว่าจะได้ GUIDE/06 · mark ด้วย TODO(guide)
 */
import { apiFetch, mockDelay, mockReject, USE_MOCK } from "./client";
import type {
  TournamentRequestDto,
  ReviewTournamentRequest,
  TournamentRefereeDto,
  RefereeCoverageDto,
  AppointRefereeRequest,
  AnswerAppointmentRequest,
  AdminScopeDto,
  GrantAdminScopeRequest,
  UserAdminViewDto,
  SuspendUserRequest,
  AuditLogDto,
  AuditLogQuery,
} from "../types/admin.dto";
import {
  storeAdminScopes, storeAuditLogs, storeRefereeCoverage, storeTournamentReferees,
  storeTournamentRequests, storeUsersForAdmin,
} from "../mocks/adminBridge";
import type { TeamRef } from "../mocks/teamBridge";

const notFound = <T>(what: string): Promise<T> =>
  mockReject<T>(404, { code: "NOT_FOUND", message: `ไม่พบ${what}ที่ต้องการ` });

const notImplemented = <T>(what: string): Promise<T> =>
  mockReject<T>(501, {
    code: "MOCK_READ_ONLY",
    message: `โหมด mock ยังไม่รองรับ${what} — ต่อ backend จริงก่อน`,
  });

// ══════════════ คิวอนุมัติทัวร์นาเมนต์ — FR-TC-02 ══════════════

/** TODO(guide): GET /admin/tournament-requests */
export async function getTournamentRequests(): Promise<{ items: TournamentRequestDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeTournamentRequests() });
  return apiFetch("/admin/tournament-requests");
}

/**
 * TODO(guide): POST /admin/tournament-requests/:id/review
 * อนุมัติแล้ว FR-TC-03 สั่งให้สร้างระเบียนสถานะ Private และตั้งผู้ยื่นเป็น Organizer
 * ไม่อนุมัติต้องมีเหตุผลและส่งกลับถึงผู้ยื่น (FR-TC-02)
 */
export async function reviewTournamentRequest(
  requestId: TeamRef, input: ReviewTournamentRequest,
): Promise<TournamentRequestDto> {
  if (USE_MOCK) return notImplemented<TournamentRequestDto>("การพิจารณาคำขอจัดทัวร์นาเมนต์");
  return apiFetch(`/admin/tournament-requests/${requestId}/review`, {
    method: "POST", body: JSON.stringify(input),
  });
}

// ══════════════ กรรมการ ══════════════

/** TODO(guide): GET /tournaments/:id/referees — RefereePanel */
export async function getTournamentReferees(
  tournamentId: TeamRef,
): Promise<{ items: TournamentRefereeDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeTournamentReferees(tournamentId) });
  return apiFetch(`/tournaments/${tournamentId}/referees`);
}

/**
 * TODO(guide): GET /tournaments/:id/referee-coverage
 * FR-RM-03 — ครบ 2 คนหรือยัง กระทบทั้งหน้ากรรมการและ `can.recordStats` ของสไลซ์ 3
 */
export async function getRefereeCoverage(tournamentId: TeamRef): Promise<RefereeCoverageDto> {
  if (USE_MOCK) {
    const c = storeRefereeCoverage(tournamentId);
    return c ? mockDelay(c) : notFound<RefereeCoverageDto>("ทัวร์นาเมนต์");
  }
  return apiFetch(`/tournaments/${tournamentId}/referee-coverage`);
}

/** TODO(guide): POST /tournaments/:id/referees — เชิญเป็นกรรมการ (FR-RM-01) */
export async function appointReferee(
  tournamentId: TeamRef, input: AppointRefereeRequest,
): Promise<TournamentRefereeDto> {
  if (USE_MOCK) return notImplemented<TournamentRefereeDto>("การเชิญกรรมการ");
  return apiFetch(`/tournaments/${tournamentId}/referees`, {
    method: "POST", body: JSON.stringify(input),
  });
}

/** TODO(guide): POST /referee-appointments/:id — ตอบรับหรือปฏิเสธ (FR-RM-01) */
export async function answerAppointment(
  appointmentId: TeamRef, input: AnswerAppointmentRequest,
): Promise<TournamentRefereeDto> {
  if (USE_MOCK) return notImplemented<TournamentRefereeDto>("การตอบรับเป็นกรรมการ");
  return apiFetch(`/referee-appointments/${appointmentId}`, {
    method: "POST", body: JSON.stringify(input),
  });
}

/** TODO(guide): DELETE /tournaments/:id/referees/:userId — ถอดออก (บันทึก removed_by) */
export async function removeReferee(
  tournamentId: TeamRef, userId: number,
): Promise<void> {
  if (USE_MOCK) return notImplemented<void>("การถอดกรรมการ");
  return apiFetch(`/tournaments/${tournamentId}/referees/${userId}`, { method: "DELETE" });
}

/** TODO(guide): POST /admin/referee-approvals/:id — FR-RM-02 อนุมัติกรรมการภายนอก */
export async function approveExternalReferee(
  refereeId: TeamRef, approve: boolean,
): Promise<TournamentRefereeDto> {
  if (USE_MOCK) return notImplemented<TournamentRefereeDto>("การอนุมัติกรรมการภายนอก");
  return apiFetch(`/admin/referee-approvals/${refereeId}`, {
    method: "POST", body: JSON.stringify({ approve }),
  });
}

// ══════════════ ผู้ใช้และสิทธิ์ — FR-UM-05 ══════════════

/** TODO(guide): GET /admin/users */
export async function getUsersForAdmin(): Promise<{ items: UserAdminViewDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeUsersForAdmin() });
  return apiFetch("/admin/users");
}

/** TODO(guide): GET /admin/scopes */
export async function getAdminScopes(): Promise<{ items: AdminScopeDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeAdminScopes() });
  return apiFetch("/admin/scopes");
}

/** TODO(guide): POST /admin/scopes — ให้สิทธิ์ผู้ดูแล */
export async function grantAdminScope(input: GrantAdminScopeRequest): Promise<AdminScopeDto> {
  if (USE_MOCK) return notImplemented<AdminScopeDto>("การให้สิทธิ์ผู้ดูแล");
  return apiFetch("/admin/scopes", { method: "POST", body: JSON.stringify(input) });
}

/** TODO(guide): DELETE /admin/scopes/:id — เพิกถอนสิทธิ์ */
export async function revokeAdminScope(scopeId: TeamRef): Promise<void> {
  if (USE_MOCK) return notImplemented<void>("การเพิกถอนสิทธิ์");
  return apiFetch(`/admin/scopes/${scopeId}`, { method: "DELETE" });
}

/**
 * TODO(guide): POST /admin/users/:id/suspension — FR-UM-05
 * ผู้ใช้ที่ถูกระงับต้องเข้าสู่ระบบไม่ได้ **และไม่นับเป็นสมาชิกทีมที่มีสิทธิ์ลงแข่ง**
 * ข้อหลังเปลี่ยนจำนวนสมาชิกที่ใช้ได้ของทุกทีมที่คนนั้นอยู่ — invalidate ให้ครบ
 */
export async function suspendUser(
  userId: TeamRef, input: SuspendUserRequest,
): Promise<UserAdminViewDto> {
  if (USE_MOCK) return notImplemented<UserAdminViewDto>("การระงับบัญชี");
  return apiFetch(`/admin/users/${userId}/suspension`, {
    method: "POST", body: JSON.stringify(input),
  });
}

// ══════════════ Audit — FR-TC-05 ══════════════

/** TODO(guide): GET /admin/audit-logs */
export async function getAuditLogs(query: AuditLogQuery = {}): Promise<{ items: AuditLogDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeAuditLogs() });
  const qs = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  );
  return apiFetch(`/admin/audit-logs?${qs}`);
}
