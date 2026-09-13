/**
 * src/api/admin.ts — Person 4 (Admin · Organizer approval · Referee)
 *
 * แพตเทิร์นเดียวกับ `api/team.ts` — โหมด mock อ่านผ่าน mocks/adminBridge.ts และเขียน
 * ผ่าน mocks/adminWrites.ts · นอกโหมด mock ยิงเฉพาะ route ที่ origin/backend มีจริง
 * ที่ยังไม่มีตอบ 501 (ENDPOINT_UNAVAILABLE) ทันที ไม่ยิงไปเส้นทางที่ไม่มีอยู่
 */
import { ApiError, apiFetch, mockDelay, mockReject, USE_MOCK } from "./client";
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
  OfficialTeamRequestDto,
  ApproveTeamOfficialResponse,
  RejectTeamOfficialResponse,
  MyRefereeInvitationDto,
  ExternalRefereeRequestDto,
  ReviewExternalRefereeRequest,
} from "../types/admin.dto";
import {
  storeAdminScopes, storeAuditLogs, storeExternalRefereeRequests, storeRefereeCoverage,
  storeRefInviteIdOf, storeTournamentIdOf, storeTournamentReferees, storeTournamentRequests,
  storeUserIdOf, storeUsersForAdmin, storeMyRefereeInvitations,
} from "../mocks/adminBridge";
import { storeTeamAdminRequests } from "../mocks/teamBridge";
import { writeReviewTeamRequest, type WriteBlock } from "../mocks/teamWrites";
import { getState } from "../shared/store";
import { numOf } from "../mocks/storeBridge";
import {
  writeAnswerRefereeInvite, writeAppointReferee, writeGrantAdminScope, writeRemoveReferee,
  writeReviewExternalReferee, writeReviewTournamentRequest, writeRevokeAdminScope, writeSuspendUser,
} from "../mocks/adminWrites";
import type { TeamRef } from "../mocks/teamBridge";

const notFound = <T>(what: string): Promise<T> =>
  mockReject<T>(404, { code: "NOT_FOUND", message: `ไม่พบ${what}ที่ต้องการ` });

/** ตรงกับ adminScope.service ของ backend — ตัดสินซ้ำไม่ได้ */
const alreadyDecided = <T>(): Promise<T> =>
  mockReject<T>(409, { code: "ALREADY_DECIDED", message: "คําขอนี้ถูกพิจารณาไปแล้ว" });

/** ส่งเหตุผลที่ชั้น mock ปฏิเสธต่อเป็น error รูปเดียวกับ backend */
const rejectWith = <T>(b: WriteBlock): Promise<T> =>
  mockReject<T>(b.status, { code: b.code, message: b.message, details: b.details });

/**
 * backend ยังไม่มี endpoint นี้ (ดู FEAT-1-REMAINING หมวด backend blockers)
 * ตอบ 501 ทันทีแทนการยิงไปเส้นทางที่ไม่มีอยู่ — หน้าจอบอกไว้ว่าใช้ไม่ได้
 */
const unavailable = <T>(what: string): Promise<T> =>
  Promise.reject(new ApiError(501, { code: "ENDPOINT_UNAVAILABLE", message: `${what} ยังไม่มีใน backend` }));

// ══════════════ คิวคำร้องทีม Official — FR-TM-06, FR-TM-08 ══════════════

/**
 * GET /admin/team-requests — university-wide admin only (403 INSUFFICIENT_ADMIN_SCOPE)
 * โหมด mock แปลงแถวของ store เป็นรูปเดียวกับ backend (adminScope.mapper) หน้าจอจึง
 * จัดการ DTO รูปเดียว ไม่ต้องเช็คว่าแถวมาจากไหน
 */
export async function getTeamRequests(): Promise<{ items: OfficialTeamRequestDto[] }> {
  if (USE_MOCK) {
    return mockDelay({
      items: storeTeamAdminRequests().map((r) => ({
        id: r.id,
        team: { id: r.team.id, name: r.team.name },
        requestedBy: r.requestedBy,
        status: r.status === "approved" || r.status === "rejected" ? r.status : "pending",
        createdAt: r.requestedAt,
      })),
    });
  }
  return apiFetch("/admin/team-requests");
}

/** alias สำหรับความสะดวกและ backward compatibility */
export const getTeamAdminRequests = getTeamRequests;

/** POST /admin/team-requests/:id/approve → 200 { teamId, officialStatus } */
export async function approveTeamRequest(requestId: TeamRef): Promise<ApproveTeamOfficialResponse> {
  if (USE_MOCK) {
    const before = storeTeamAdminRequests().find((r) => r.id === Number(requestId));
    if (!before) return notFound<ApproveTeamOfficialResponse>("คำร้องขอทีม Official");
    if (before.status !== "pending") return alreadyDecided<ApproveTeamOfficialResponse>();
    /* backend ตอบ 422 MEMBER_CONFLICT เมื่อสมาชิกสังกัดทีม Official อื่นในกีฬาเดียวกัน */
    if (before.blockingMembers.length) {
      return mockReject<ApproveTeamOfficialResponse>(422, {
        code: "MEMBER_CONFLICT",
        message: "สมาชิกบางคนสังกัดทีม Official อื่นในกีฬาเดียวกันแล้ว",
        details: before.blockingMembers,
      });
    }
    if (!writeReviewTeamRequest(requestId, true)) return notFound<ApproveTeamOfficialResponse>("คำร้องขอทีม Official");
    return mockDelay({ teamId: before.team.id, officialStatus: "Official" as const });
  }
  return apiFetch(`/admin/team-requests/${requestId}/approve`, { method: "POST" });
}

/** POST /admin/team-requests/:id/reject body { reason } → 200 { status, reason } */
export async function rejectTeamRequest(
  requestId: TeamRef,
  reason: string,
): Promise<RejectTeamOfficialResponse> {
  if (USE_MOCK) {
    if (!reason.trim()) {
      return mockReject<RejectTeamOfficialResponse>(400, {
        code: "TEAM_REJECT_REASON_REQUIRED",
        message: "กรุณาระบุเหตุผลที่ปฏิเสธคำร้อง",
      });
    }
    const before = storeTeamAdminRequests().find((r) => r.id === Number(requestId));
    if (!before) return notFound<RejectTeamOfficialResponse>("คำร้องขอทีม Official");
    if (before.status !== "pending") return alreadyDecided<RejectTeamOfficialResponse>();
    if (!writeReviewTeamRequest(requestId, false)) return notFound<RejectTeamOfficialResponse>("คำร้องขอทีม Official");
    return mockDelay({ status: "rejected" as const, reason: reason.trim() });
  }
  return apiFetch(`/admin/team-requests/${requestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** Helper รองรับการตัดสินทั้ง approve / reject */
export async function reviewTeamRequest(
  requestId: TeamRef,
  input: { approve: boolean; rejectionReason?: string; reason?: string },
): Promise<unknown> {
  if (input.approve) {
    return approveTeamRequest(requestId);
  }
  return rejectTeamRequest(requestId, input.reason ?? input.rejectionReason ?? "ปฏิเสธโดยผู้ดูแลระบบ");
}

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

/**
 * F02: GET /tournaments/:id/referees — organizer only
 * backend คืน `{ items, acceptedCount }` หน้าจอใช้ acceptedCount ตรงๆ ไม่นับเอง
 */
export async function getTournamentReferees(
  tournamentId: TeamRef,
): Promise<{ items: TournamentRefereeDto[]; acceptedCount: number }> {
  if (USE_MOCK) {
    const items = storeTournamentReferees(tournamentId);
    /* นับเฉพาะคนที่มีสิทธิ์จริง — บุคคลภายนอกที่ตอบรับแล้วแต่ Admin ยังไม่อนุมัติไม่นับ (FR-RM-02)
       ⚠️ referee.service ของ backend ตอนนี้นับทุกแถวที่ invitationStatus เป็น accepted */
    return mockDelay({ items, acceptedCount: items.filter((r) => r.isActive).length });
  }
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
  return unavailable<RefereeCoverageDto>("การตรวจจำนวนกรรมการ (referee coverage)");
}

/**
 * F01: POST /tournaments/:id/referees { userId, isExternal } — แต่งตั้งกรรมการ (FR-OM-05, FR-RM-01)
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
    const t = state.tournaments.find((x) => x.id === tid);
    const invites = state.refInvites.filter((i) => i.tour === tid && i.user === uid);

    /* เชิญคนเดิมซ้ำไม่มีความหมาย — store กันเฉพาะคำเชิญที่ยังค้าง ไม่ได้กันคนที่
       ตอบรับไปแล้ว ปล่อยไว้จะได้แถวซ้ำในรายชื่อกรรมการ */
    if ((t?.referees ?? []).includes(uid)) {
      return mockReject<TournamentRefereeDto>(409, {
        code: "ALREADY_REFEREE",
        message: "คนนี้เป็นกรรมการของรายการนี้อยู่แล้ว",
      });
    }
    /* referee.service ของ backend ตอบ 409 เดียวกันเมื่อมีคำเชิญค้างอยู่ */
    if (invites.some((i) => i.status === "pending")) {
      return mockReject<TournamentRefereeDto>(409, {
        code: "REFEREE_INVITATION_PENDING",
        message: "ส่งคำเชิญถึงคนนี้ไปแล้ว รอเขาตอบ",
      });
    }
    if (invites.some((i) => i.status === "accepted" && i.approval === "pending")) {
      return mockReject<TournamentRefereeDto>(409, {
        code: "REFEREE_AWAITING_APPROVAL",
        message: "คนนี้ตอบรับแล้ว รอ Admin อนุมัติกรรมการภายนอก",
      });
    }
    if (state.users.find((u) => u.id === uid)?.suspended) {
      return mockReject<TournamentRefereeDto>(409, {
        code: "USER_SUSPENDED",
        message: "บัญชีนี้ถูกระงับอยู่ แต่งตั้งเป็นกรรมการไม่ได้",
      });
    }

    /* กรรมการต้องไม่ลงแข่งในรายการที่ตัวเองตัดสิน — คนที่ได้ประโยชน์จากผล
       ไม่ควรเป็นคนบันทึกผล (NF-SE-05 ตรวจสอบย้อนหลังได้ก็ต่อเมื่อไม่มีส่วนได้เสีย) */
    const entered = state.registrations
      .filter((r) => r.tour === tid && r.status === "approved")
      .map((r) => r.team);
    const playsHere = state.teams.some((tm) => entered.includes(tm.id) && tm.members.includes(uid));
    if (playsHere) {
      return mockReject<TournamentRefereeDto>(409, {
        code: "REFEREE_IS_COMPETING",
        message: "คนนี้ลงแข่งในรายการนี้อยู่ จึงเป็นกรรมการรายการเดียวกันไม่ได้",
      });
    }

    writeAppointReferee(tid, uid);
    const row = storeTournamentReferees(tid)
      .find((r) => r.user.id === input.userId && r.invitationStatus === "pending");
    return row ? mockDelay(row) : notFound<TournamentRefereeDto>("คำเชิญที่เพิ่งสร้าง");
  }
  return apiFetch(`/tournaments/${tournamentId}/referees`, {
    method: "POST", body: JSON.stringify(input),
  });
}

/** F05/F06: POST /referee-invitations/:id/accept หรือ /decline (FR-RM-01) */
export async function answerAppointment(
  appointmentId: TeamRef, input: AnswerAppointmentRequest,
): Promise<TournamentRefereeDto | { id: number | string; invitationStatus: string }> {
  if (USE_MOCK) {
    const inviteId = storeRefInviteIdOf(appointmentId);
    if (!inviteId) return notFound<TournamentRefereeDto>("คำเชิญเป็นกรรมการ");
    const invite = getState().refInvites.find((i) => i.id === inviteId);
    if (invite && invite.status !== "pending") {
      return mockReject<TournamentRefereeDto>(409, {
        code: "INVITATION_ALREADY_ANSWERED",
        message: "คำเชิญนี้ตอบไปแล้ว",
      });
    }
    writeAnswerRefereeInvite(inviteId, input.accept);
    const row = invite
      ? storeTournamentReferees(invite.tour).find((r) => r.user.id === numOf(invite.user))
      : undefined;
    if (row) return mockDelay(row);
    /* ปฏิเสธแล้วแถวหายจากรายชื่อกรรมการ — เดิมตรงนี้ตอบ 404 ทั้งที่ปฏิเสธสำเร็จแล้ว */
    return mockDelay({ id: numOf(inviteId), invitationStatus: input.accept ? "accepted" : "rejected" });
  }
  const action = input.accept ? "accept" : "decline";
  return apiFetch(`/referee-invitations/${appointmentId}/${action}`, {
    method: "POST",
  });
}

/** F04: GET /me/referee-invitations — รายการคำเชิญกรรมการของฉัน */
export async function getMyRefereeInvitations(): Promise<{ items: MyRefereeInvitationDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeMyRefereeInvitations() });
  return apiFetch("/me/referee-invitations");
}

/** F05: POST /referee-invitations/:id/accept — ตอบรับคำเชิญเป็นกรรมการ */
export async function acceptRefereeInvitation(
  invitationId: TeamRef,
): Promise<{ id: number | string; invitationStatus: string; requiresAdminApproval?: boolean }> {
  if (USE_MOCK) {
    const inviteId = storeRefInviteIdOf(invitationId);
    /* backend คืน requiresAdminApproval เมื่อคำเชิญเป็นบุคคลภายนอก — ตอบเหมือนกัน */
    const external = !!getState().refInvites.find((i) => i.id === inviteId)?.external;
    await answerAppointment(invitationId, { accept: true });
    return { id: invitationId, invitationStatus: "accepted", requiresAdminApproval: external };
  }
  return apiFetch(`/referee-invitations/${invitationId}/accept`, { method: "POST" });
}

/** F06: POST /referee-invitations/:id/decline — ปฏิเสธคำเชิญเป็นกรรมการ */
export async function declineRefereeInvitation(
  invitationId: TeamRef,
): Promise<void> {
  if (USE_MOCK) {
    await answerAppointment(invitationId, { accept: false });
    return;
  }
  return apiFetch(`/referee-invitations/${invitationId}/decline`, { method: "POST" });
}

/**
 * TODO(guide): DELETE /tournaments/:id/referees/:userId — ถอดออก (บันทึก removed_at, removed_by)
 *
 * ผู้จัดถอดได้ทุกเมื่อ รวมถึงถอนคำเชิญที่ยังไม่ตอบ · referee.service ของ backend ข้ามแถวที่
 * removed_at มีค่าแล้วตอนเชิญซ้ำ แต่ยังไม่มี route ให้ถอด นอกโหมด mock จึงตอบ 501
 */
export async function removeReferee(
  tournamentId: TeamRef, userId: number,
): Promise<void> {
  if (USE_MOCK) {
    const blocked = writeRemoveReferee(tournamentId, userId);
    return blocked ? rejectWith<void>(blocked) : mockDelay(undefined);
  }
  return unavailable<void>("การถอดกรรมการ");
}

// ══════════════ กรรมการภายนอก — FR-RM-02 ══════════════

/**
 * คำขอกรรมการภายนอกที่รอ Admin — SDS รวมไว้ในคิว GET /admin/requests
 * origin/backend รับ isExternal ตอนแต่งตั้งแล้ว แต่ยังไม่มี route ให้ Admin อนุมัติ
 */
export async function getExternalRefereeRequests(): Promise<{ items: ExternalRefereeRequestDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeExternalRefereeRequests() });
  return unavailable<{ items: ExternalRefereeRequestDto[] }>("คิวอนุมัติกรรมการภายนอก");
}

/** SDS PATCH /admin/requests/{id} — อนุมัติหรือไม่อนุมัติ (ไม่อนุมัติต้องมีเหตุผล) */
export async function reviewExternalReferee(
  requestId: TeamRef, input: ReviewExternalRefereeRequest,
): Promise<ExternalRefereeRequestDto> {
  if (USE_MOCK) {
    /* อ่านแถวก่อนตัดสิน — ตัดสินแล้วคำขอออกจากคิว หาไม่เจออีก */
    const before = storeExternalRefereeRequests().find((r) => r.id === Number(requestId));
    const blocked = writeReviewExternalReferee(requestId, input.approve, input.reason);
    if (blocked) return rejectWith<ExternalRefereeRequestDto>(blocked);
    return before
      ? mockDelay({ ...before, status: input.approve ? "approved" as const : "rejected" as const })
      : notFound<ExternalRefereeRequestDto>("คำขอกรรมการภายนอก");
  }
  return unavailable<ExternalRefereeRequestDto>("การอนุมัติกรรมการภายนอก");
}

// ══════════════ ผู้ใช้และสิทธิ์ — FR-UM-05 ══════════════

/** SDS GET /admin/users — ยังไม่มีใน origin/backend */
export async function getUsersForAdmin(): Promise<{ items: UserAdminViewDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeUsersForAdmin() });
  return unavailable<{ items: UserAdminViewDto[] }>("รายชื่อผู้ใช้สำหรับ Admin");
}

/** TODO(guide): GET /admin/scopes */
export async function getAdminScopes(): Promise<{ items: AdminScopeDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeAdminScopes() });
  return apiFetch("/admin/scopes");
}

/** ให้สิทธิ์ผู้ดูแล — ยังไม่มีใน origin/backend */
export async function grantAdminScope(input: GrantAdminScopeRequest): Promise<AdminScopeDto> {
  if (USE_MOCK) {
    const blocked = writeGrantAdminScope(input.userId);
    if (blocked) return rejectWith<AdminScopeDto>(blocked);
    const row = storeAdminScopes().find((sc) => sc.user.id === input.userId);
    return row ? mockDelay(row) : notFound<AdminScopeDto>("สิทธิ์ที่เพิ่งให้");
  }
  return unavailable<AdminScopeDto>("การให้สิทธิ์ผู้ดูแล");
}

/** เพิกถอนสิทธิ์ผู้ดูแล — ยังไม่มีใน origin/backend */
export async function revokeAdminScope(scopeId: TeamRef): Promise<void> {
  if (USE_MOCK) {
    const blocked = writeRevokeAdminScope(scopeId);
    return blocked ? rejectWith<void>(blocked) : mockDelay(undefined);
  }
  return unavailable<void>("การเพิกถอนสิทธิ์ผู้ดูแล");
}

/**
 * SDS PATCH /admin/users/{id}/suspend — FR-UM-05 (ยังไม่มีใน origin/backend)
 * ผู้ใช้ที่ถูกระงับต้องเข้าสู่ระบบไม่ได้ **และไม่นับเป็นสมาชิกทีมที่มีสิทธิ์ลงแข่ง**
 * ข้อหลังเปลี่ยนจำนวนสมาชิกที่ใช้ได้ของทุกทีมที่คนนั้นอยู่ — invalidate ให้ครบ
 */
export async function suspendUser(
  userId: TeamRef, input: SuspendUserRequest,
): Promise<UserAdminViewDto> {
  if (USE_MOCK) {
    const blocked = writeSuspendUser(userId, input.suspend, input.reason);
    if (blocked) return rejectWith<UserAdminViewDto>(blocked);
    const row = storeUsersForAdmin().find((u) => u.user.id === Number(userId));
    return row ? mockDelay(row) : notFound<UserAdminViewDto>("ผู้ใช้หลังระงับ");
  }
  return unavailable<UserAdminViewDto>("การระงับบัญชี");
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
