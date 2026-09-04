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
  storeAdminScopes, storeAuditLogs, storeRefereeCoverage, storeRefInviteIdOf,
  storeTournamentIdOf, storeTournamentReferees, storeTournamentRequests,
  storeUserIdOf, storeUsersForAdmin,
} from "../mocks/adminBridge";
import {
  getState,
  appointReferee as storeAppointReferee,
  answerAppointment as storeAnswerAppointment,
  removeReferee as storeRemoveReferee,
} from "../shared/store";
import { numOf } from "../mocks/storeBridge";
import {
  writeGrantAdminScope, writeRevokeAdminScope, writeReviewTournamentRequest, writeSuspendUser,
} from "../mocks/adminWrites";
import type { TeamRef } from "../mocks/teamBridge";

const notFound = <T>(what: string): Promise<T> =>
  mockReject<T>(404, { code: "NOT_FOUND", message: `ไม่พบ${what}ที่ต้องการ` });

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
  if (USE_MOCK) {
    /* อ่านแถวไว้ก่อนตัดสิน — พอตัดสินแล้วทัวร์นาเมนต์ออกจากคิว (สถานะไม่ใช่ pending)
       `storeTournamentRequests()` จะหาไม่เจออีก ผู้เรียกจึงต้องได้ของที่อ่านไว้ก่อน */
    const before = storeTournamentRequests().find((r) => r.id === Number(requestId));
    if (!writeReviewTournamentRequest(requestId, input.approve)) {
      return notFound<TournamentRequestDto>("คำขอจัดทัวร์นาเมนต์");
    }
    if (!before) return notFound<TournamentRequestDto>("คำขอจัดทัวร์นาเมนต์");
    return mockDelay<TournamentRequestDto>({
      ...before,
      status: input.approve ? "private" : "rejected",
      rejectionReason: input.approve ? null : (input.rejectionReason ?? null),
    });
  }
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

/**
 * SDS §S3: POST /tournaments/{id}/referees — แต่งตั้งกรรมการ (FR-OM-05, FR-RM-01)
 *
 * โหมด mock สั่งงานผ่าน store โดยตรง ไม่ใช่เขียนลง array แยก
 * เพราะ `storeTournamentReferees()` อ่านจาก store อยู่แล้ว — เขียนที่อื่นจะได้
 * สองแหล่งความจริงที่ค่อยๆ เพี้ยนออกจากกัน
 */
export async function appointReferee(
  tournamentId: TeamRef, input: AppointRefereeRequest,
): Promise<TournamentRefereeDto> {
  if (USE_MOCK) {
    const tid = storeTournamentIdOf(tournamentId);
    const uid = storeUserIdOf(input.userId);
    if (!tid || !uid) return notFound<TournamentRefereeDto>("ทัวร์นาเมนต์หรือผู้ใช้");

    const state = getState();
    const t = state.tournaments.find((x: { id: string }) => x.id === tid);

    /* เชิญคนเดิมซ้ำไม่มีความหมาย — store กันเฉพาะคำเชิญที่ยังค้าง ไม่ได้กันคนที่
       ตอบรับไปแล้ว ปล่อยไว้จะได้แถวซ้ำในรายชื่อกรรมการ */
    if ((t?.referees ?? []).includes(uid)) {
      return mockReject<TournamentRefereeDto>(409, {
        code: "ALREADY_REFEREE",
        message: "คนนี้เป็นกรรมการของรายการนี้อยู่แล้ว",
      });
    }

    /* กรรมการต้องไม่ลงแข่งในรายการที่ตัวเองตัดสิน — คนที่ได้ประโยชน์จากผล
       ไม่ควรเป็นคนบันทึกผล (NF-SE-05 ตรวจสอบย้อนหลังได้ก็ต่อเมื่อไม่มีส่วนได้เสีย) */
    const entered = state.registrations
      .filter((r: { tour: string; status: string }) => r.tour === tid && r.status === 'approved')
      .map((r: { team: string }) => r.team);
    const playsHere = state.teams.some(
      (tm: { id: string; members: string[] }) => entered.includes(tm.id) && tm.members.includes(uid),
    );
    if (playsHere) {
      return mockReject<TournamentRefereeDto>(409, {
        code: "REFEREE_IS_COMPETING",
        message: "คนนี้ลงแข่งในรายการนี้อยู่ จึงเป็นกรรมการรายการเดียวกันไม่ได้",
      });
    }

    storeAppointReferee(tid, uid);
    const row = storeTournamentReferees(tid).find((r) => r.user.id === input.userId);
    return row ? mockDelay(row) : notFound<TournamentRefereeDto>("คำเชิญที่เพิ่งสร้าง");
  }
  return apiFetch(`/tournaments/${tournamentId}/referees`, {
    method: "POST", body: JSON.stringify(input),
  });
}

/** SDS §S3: PATCH /referee-assignments/{id} — ตอบรับหรือปฏิเสธ (FR-RM-01) */
export async function answerAppointment(
  appointmentId: TeamRef, input: AnswerAppointmentRequest,
): Promise<TournamentRefereeDto> {
  if (USE_MOCK) {
    const inviteId = storeRefInviteIdOf(appointmentId);
    if (!inviteId) return notFound<TournamentRefereeDto>("คำเชิญเป็นกรรมการ");
    const invite = getState().refInvites.find((i: { id: string }) => i.id === inviteId);
    storeAnswerAppointment(inviteId, input.accept);
    const row = invite
      ? storeTournamentReferees(invite.tour).find((r) => r.user.id === numOf(invite.user))
      : undefined;
    return row ? mockDelay(row) : notFound<TournamentRefereeDto>("กรรมการหลังตอบรับ");
  }
  return apiFetch(`/referee-assignments/${appointmentId}`, {
    method: "PATCH", body: JSON.stringify(input),
  });
}

/** TODO(guide): DELETE /tournaments/:id/referees/:userId — ถอดออก (บันทึก removed_by) */
export async function removeReferee(
  tournamentId: TeamRef, userId: number,
): Promise<void> {
  if (USE_MOCK) {
    const tid = storeTournamentIdOf(tournamentId);
    const uid = storeUserIdOf(userId);
    if (!tid || !uid) return notFound<void>("ทัวร์นาเมนต์หรือกรรมการ");
    storeRemoveReferee(tid, uid);
    return mockDelay(undefined);
  }
  return apiFetch(`/tournaments/${tournamentId}/referees/${userId}`, { method: "DELETE" });
}

/** TODO(guide): POST /admin/referee-approvals/:id — FR-RM-02 อนุมัติกรรมการภายนอก */
export async function approveExternalReferee(
  refereeId: TeamRef, approve: boolean,
): Promise<TournamentRefereeDto> {
  if (USE_MOCK) {
    /* FR-RM-02 ใช้กับกรรมการที่เป็นบุคคลภายนอกเท่านั้น แต่ prototype ไม่มีแนวคิดนี้
       ทุกคนเป็นนิสิตในระบบ `storeTournamentReferees()` จึงคืน isExternal: false เสมอ
       ตอบ 409 ตรงๆ ดีกว่าแกล้งสำเร็จ เพราะไม่มีอะไรให้อนุมัติจริง */
    void refereeId; void approve;
    return mockReject<TournamentRefereeDto>(409, {
      code: "NOT_APPLICABLE",
      message: "ชุดข้อมูลตัวอย่างไม่มีกรรมการภายนอก — ทุกคนเป็นนิสิตในระบบอยู่แล้ว",
    });
  }
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
  if (USE_MOCK) {
    if (!writeGrantAdminScope(input.userId)) return notFound<AdminScopeDto>("ผู้ใช้");
    const row = storeAdminScopes().find((sc) => sc.user.id === input.userId);
    return row ? mockDelay(row) : notFound<AdminScopeDto>("สิทธิ์ที่เพิ่งให้");
  }
  return apiFetch("/admin/scopes", { method: "POST", body: JSON.stringify(input) });
}

/** TODO(guide): DELETE /admin/scopes/:id — เพิกถอนสิทธิ์ */
export async function revokeAdminScope(scopeId: TeamRef): Promise<void> {
  if (USE_MOCK) {
    if (!writeRevokeAdminScope(scopeId)) return notFound<void>("สิทธิ์ผู้ดูแล");
    return mockDelay(undefined);
  }
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
  if (USE_MOCK) {
    if (!writeSuspendUser(userId, input.suspend, input.reason)) {
      return notFound<UserAdminViewDto>("ผู้ใช้");
    }
    const row = storeUsersForAdmin().find((u) => u.user.id === Number(userId));
    return row ? mockDelay(row) : notFound<UserAdminViewDto>("ผู้ใช้หลังระงับ");
  }
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
