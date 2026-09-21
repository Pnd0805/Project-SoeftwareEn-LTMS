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
  BackendExternalRefereeQueueItem,
  BackendMyRefereeInvitationDto,
  BackendRefereeCoverageDto,
  BackendRefereeIdentityDto,
  BackendRefereeRequestDto,
  BackendTournamentRefereeListDto,
} from "../types/admin.dto";
import type {
  BackendAmendmentRequestDto,
  BackendPendingTournamentRequestDto,
} from "../types/tournament.dto";
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

/** 404 ของเส้นจริง — ต่างจาก notFound() ที่เป็นของโหมด mock */
const notFoundLive = <T>(what: string): Promise<T> =>
  Promise.reject(new ApiError(404, { code: "NOT_FOUND", message: `ไม่พบ${what}` }));

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
  /* เส้นจริงคือ POST /tournaments/:id/approve | /reject — id ของคำขอคือ id ของทัวร์นาเมนต์เอง
     ปฏิเสธต้องมีเหตุผล ไม่งั้น backend ตอบ 400 TOURNAMENT_REJECT_REASON_REQUIRED */
  if (input.approve) {
    return apiFetch(`/tournaments/${requestId}/approve`, { method: "POST" });
  }
  return apiFetch(`/tournaments/${requestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason: input.rejectionReason ?? "ไม่อนุมัติโดยผู้ดูแลระบบ" }),
  });
}

// ══════════════ กรรมการ ══════════════

/**
 * F02: GET /tournaments/:id/referees — organizer only
 *
 * backend คืน `{ items, acceptedCount, awaitingAdminCount }` — ใช้ทั้งสองยอดตรงๆ ไม่นับเอง
 * `acceptedCount` นับเฉพาะคนที่มีสิทธิ์จริง ส่วนบุคคลภายนอกที่ตอบรับแล้วแต่ Admin ยังไม่อนุมัติ
 * (FR-RM-02) แยกไปอยู่ `awaitingAdminCount` — ก่อน A3 ยอดแรกนับรวมคนกลุ่มหลังด้วย
 */
export async function getTournamentReferees(
  tournamentId: TeamRef,
): Promise<{ items: TournamentRefereeDto[]; acceptedCount: number; awaitingAdminCount: number }> {
  if (USE_MOCK) {
    const items = storeTournamentReferees(tournamentId);
    return mockDelay({
      items,
      acceptedCount: items.filter((r) => r.isActive).length,
      awaitingAdminCount: items.filter(
        (r) => r.isExternal && r.invitationStatus === "accepted" && r.externalApprovalStatus === "pending",
      ).length,
    });
  }
  const raw = await getBackendTournamentReferees(Number(tournamentId));
  return {
    items: raw.items.map((row) => ({
      id: row.id,
      tournamentId: Number(tournamentId),
      user: row.user,
      invitedBy: row.user,
      invitationStatus: row.invitationStatus,
      isExternal: row.isExternal,
      externalApprovalStatus: row.externalApprovalStatus,
      approvedBy: null,
      approvedAt: null,
      createdAt: "",
      removedAt: row.status === "removed" ? "removed" : null,
      removedBy: null,
      isActive: row.status === "active",
    })),
    acceptedCount: raw.acceptedCount,
    awaitingAdminCount: raw.awaitingAdminCount,
  };
}

/**
 * F14 GET /tournaments/:id/referees/coverage — ผู้จัดเท่านั้น
 * backend ตอบเป็นราย "แมตช์ที่ยังขาดกรรมการ" (needed/assigned ต่อแมตช์) ไม่ใช่ยอดรวมของรายการ
 * ตรงนี้ยุบเป็นยอดรวมตามรูปที่หน้าจอใช้ — ของดิบอยู่ที่ getBackendRefereeCoverage()
 */
export async function getRefereeCoverage(tournamentId: TeamRef): Promise<RefereeCoverageDto> {
  if (USE_MOCK) {
    const c = storeRefereeCoverage(tournamentId);
    return c ? mockDelay(c) : notFound<RefereeCoverageDto>("ทัวร์นาเมนต์");
  }
  const raw = await getBackendRefereeCoverage(Number(tournamentId));
  const required = raw.uncovered.reduce((sum, m) => sum + m.needed, 0);
  const accepted = raw.uncovered.reduce((sum, m) => sum + m.assigned, 0);
  return {
    tournamentId: Number(tournamentId),
    required,
    accepted,
    shortfall: Math.max(required - accepted, 0),
    blocksStatRecording: raw.uncovered.length > 0,
  };
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
  /* inviteRefereeSchema บังคับ isExternal และรับ matchIds (ว่าง = เข้า pool เฉยๆ) */
  return apiFetch(`/tournaments/${tournamentId}/referees`, {
    method: "POST",
    body: JSON.stringify({
      userId: input.userId,
      isExternal: input.isExternal ?? false,
      matchIds: input.matchIds ?? [],
    }),
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
 * F03 DELETE /tournaments/:id/referees/:rid — ผู้จัดถอดกรรมการออกจากรายการได้ทุกเมื่อ
 * ⚠️ :rid คือ tournamentRefereeId ไม่ใช่รหัสผู้ใช้ — ชั้นนี้แปลงให้จากรายชื่อกรรมการของรายการ
 */
export async function removeReferee(
  tournamentId: TeamRef, userId: number,
): Promise<void> {
  if (USE_MOCK) {
    const blocked = writeRemoveReferee(tournamentId, userId);
    return blocked ? rejectWith<void>(blocked) : mockDelay(undefined);
  }
  const pool = await apiFetch<{ items: Array<{ id: number; user: { id: number } }> }>(
    `/tournaments/${tournamentId}/referees`,
  );
  const row = pool.items.find((r) => r.user.id === userId);
  if (!row) return notFoundLive<void>("กรรมการคนนี้ในรายการ");
  return apiFetch(`/tournaments/${tournamentId}/referees/${row.id}`, { method: "DELETE" });
}

// ══════════════ กรรมการภายนอก — FR-RM-02 ══════════════

/**
 * AR01 GET /admin/referee-requests — คิวตรวจตัวตนกรรมการภายนอก (university-wide เท่านั้น)
 * backend จัดกลุ่ม "ต่อคน" และการอนุมัติก็เป็นรายคน (ทุกรายการที่คนนั้นรออยู่เปลี่ยนพร้อมกัน)
 * ตรงนี้คลี่เป็นแถวละ (คน × รายการ) ให้ตรงกับตารางบนหน้าจอ และให้ id = userId ที่ใช้ตัดสิน
 * ⚠️ backend ไม่ได้บอกว่าใครเป็นผู้เชิญ — invitedBy จึงเป็น null ในโหมดจริง
 */
export async function getExternalRefereeRequests(): Promise<{ items: ExternalRefereeRequestDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeExternalRefereeRequests() });
  const raw = await getPendingExternalReferees();
  return {
    items: raw.items.flatMap((row) =>
      row.tournaments.map((t) => ({
        id: row.userId,
        tournament: { id: t.id, name: t.name },
        referee: row.user,
        invitedBy: null,
        status: "pending" as const,
        createdAt: row.submittedAt,
      })),
    ),
  };
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
  /* AR02/AR03 — ตัดสินเป็นรายคน requestId ที่ส่งมาจึงเป็น userId ตามที่คลี่ไว้ข้างบน
     backend ตอบแค่สถานะใหม่ ไม่ได้ส่งรายละเอียดคำขอกลับมา ผู้เรียกต้อง invalidate แล้วอ่านคิวใหม่ */
  const userId = Number(requestId);
  if (input.approve) {
    await approveExternalRefereeIdentity(userId);
  } else {
    await rejectExternalRefereeIdentity(userId, input.reason ?? "ไม่อนุมัติโดยผู้ดูแลระบบ");
  }
  return notFoundLive<ExternalRefereeRequestDto>("รายละเอียดคำขอหลังตัดสิน (backend ไม่ได้ส่งกลับมา)");
}

// ══════════════ ผู้ใช้และสิทธิ์ — FR-UM-05 ══════════════

/** SDS GET /admin/users — ยังไม่มีใน origin/backend */
export async function getUsersForAdmin(): Promise<{ items: UserAdminViewDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeUsersForAdmin() });
  return unavailable<{ items: UserAdminViewDto[] }>("รายชื่อผู้ใช้สำหรับ Admin");
}

/** GET /admin/scopes — ยังไม่มีใน backend (แถวใน admin_scopes ต้องเพิ่มด้วยมือใน DB) */
export async function getAdminScopes(): Promise<{ items: AdminScopeDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeAdminScopes() });
  return unavailable<{ items: AdminScopeDto[] }>("รายการสิทธิ์ผู้ดูแล (/admin/scopes)");
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

/** GET /admin/audit-logs — ยังไม่มีใน backend (FR-TC-05) */
export async function getAuditLogs(query: AuditLogQuery = {}): Promise<{ items: AuditLogDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeAuditLogs() });
  void query;
  return unavailable<{ items: AuditLogDto[] }>("บันทึกการตรวจสอบย้อนหลัง (/admin/audit-logs)");
}

// ══════════════════════════════════════════════════════════════════════════
// เส้นจริงของ BE_KN 98aa300 — คืนรูปที่ backend ตอบ ไม่ใช่รูป prototype
// ══════════════════════════════════════════════════════════════════════════

/** F02 GET /tournaments/:id/referees — ผู้จัดเท่านั้น */
export function getBackendTournamentReferees(
  tournamentId: number,
): Promise<BackendTournamentRefereeListDto> {
  return apiFetch(`/tournaments/${tournamentId}/referees`);
}

/** F14 GET /tournaments/:id/referees/coverage — แมตช์ที่ยังขาดกรรมการ + คนที่เวลาซ้อน */
export function getBackendRefereeCoverage(
  tournamentId: number,
): Promise<BackendRefereeCoverageDto> {
  return apiFetch(`/tournaments/${tournamentId}/referees/coverage`);
}

/** F01 POST /tournaments/:id/referees — เชิญกรรมการ (ส่ง matchIds ไปพร้อมกันได้) */
export function inviteBackendReferee(
  tournamentId: number,
  input: { userId: number; isExternal?: boolean; matchIds?: number[] },
): Promise<{ id: number; userId: number; invitationStatus: string; isExternal: boolean; matchIds: number[] }> {
  return apiFetch(`/tournaments/${tournamentId}/referees`, {
    method: "POST",
    body: JSON.stringify({
      userId: input.userId,
      isExternal: input.isExternal ?? false,
      matchIds: input.matchIds ?? [],
    }),
  });
}

/** F04 GET /me/referee-invitations */
export function getBackendMyRefereeInvitations(): Promise<{ items: BackendMyRefereeInvitationDto[] }> {
  return apiFetch("/me/referee-invitations");
}

/**
 * F05 POST /referee-invitations/:id/accept
 * รับแมตช์ไปพร้อมกันได้ — ไม่ส่ง matchIds = เข้า pool เฉยๆ (ยังคุมแมตช์ไหนไม่ได้)
 * docs = S3 key จาก presign สำหรับกรรมการภายนอกที่ยังไม่เคยผ่านการตรวจ
 */
export function acceptBackendRefereeInvitation(
  invitationId: number,
  input: { matchIds?: number[]; docs?: string[] } = {},
): Promise<{ id: number; invitationStatus: string; requiresAdminApproval: boolean; acceptedMatchIds: number[] }> {
  return apiFetch(`/referee-invitations/${invitationId}/accept`, {
    method: "POST",
    body: JSON.stringify({ matchIds: input.matchIds ?? [], ...(input.docs ? { docs: input.docs } : {}) }),
  });
}

// ── คำขอย้าย/แลก/เพิ่มแมตช์ของกรรมการ (FR01–FR03) ────────────────────────

/**
 * FR02 POST /tournaments/:id/referee-requests/add-match — ผู้จัดขอให้กรรมการรับแมตช์เพิ่ม
 * ⚠️ ทำได้เฉพาะตอนแมตช์ยังเป็น scheduled และต้องยื่นทีละคน:
 *    พอคนแรกกดรับ คำขอที่ค้างอยู่ของแมตช์เดียวกันจะถูกยกเลิกทั้งหมด
 */
export function requestMatchReferee(
  tournamentId: number,
  tournamentRefereeId: number,
  matchId: number,
): Promise<BackendRefereeRequestDto> {
  return apiFetch(`/tournaments/${tournamentId}/referee-requests/add-match`, {
    method: "POST",
    body: JSON.stringify({ tournamentRefereeId, matchId }),
  });
}

/** FR03 POST /tournaments/:id/referee-requests/swap — ผู้จัดขอสลับแมตช์ระหว่างกรรมการสองคน */
export function requestRefereeSwap(
  tournamentId: number,
  input: { refereeAId: number; matchAId: number; refereeBId: number; matchBId: number },
): Promise<BackendRefereeRequestDto> {
  return apiFetch(`/tournaments/${tournamentId}/referee-requests/swap`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** FR01 POST /referee-requests — กรรมการขอโอน (ไม่ส่ง theirMatchId) หรือแลกแมตช์ */
export function requestRefereeTransfer(input: {
  myMatchId: number;
  toTournamentRefereeId: number;
  theirMatchId?: number;
}): Promise<BackendRefereeRequestDto> {
  return apiFetch("/referee-requests", { method: "POST", body: JSON.stringify(input) });
}

/** GET /tournaments/:id/referee-requests — ผู้จัดดูคำขอทั้งหมดของรายการ */
export function getTournamentRefereeRequests(
  tournamentId: number,
): Promise<{ items: BackendRefereeRequestDto[] }> {
  return apiFetch(`/tournaments/${tournamentId}/referee-requests`);
}

/** GET /me/referee-requests — คำขอที่รอเราตอบ (incoming) และที่เรายื่นไว้ (outgoing) */
export function getMyRefereeRequests(): Promise<{
  incoming: BackendRefereeRequestDto[];
  outgoing: BackendRefereeRequestDto[];
}> {
  return apiFetch("/me/referee-requests");
}

/** POST /referee-requests/:id/accept */
export function acceptRefereeRequest(requestId: number): Promise<BackendRefereeRequestDto> {
  return apiFetch(`/referee-requests/${requestId}/accept`, { method: "POST" });
}

/** POST /referee-requests/:id/decline */
export function declineRefereeRequest(requestId: number): Promise<BackendRefereeRequestDto> {
  return apiFetch(`/referee-requests/${requestId}/decline`, { method: "POST" });
}

/** DELETE /referee-requests/:id — ผู้ยื่นถอนคำขอของตัวเอง */
export function cancelRefereeRequest(requestId: number): Promise<void> {
  return apiFetch(`/referee-requests/${requestId}`, { method: "DELETE" });
}

// ── ตัวตนกรรมการภายนอก (U11/U12 ฝั่งกรรมการ · AR01–AR04 ฝั่ง Admin) ──────

/** U11 GET /me/referee-identity — สถานะการตรวจตัวตนของฉัน */
export function getMyRefereeIdentity(): Promise<BackendRefereeIdentityDto> {
  return apiFetch("/me/referee-identity");
}

/** U12 PUT /me/referee-identity/docs — ส่งเอกสาร 1–5 ไฟล์ (S3 key จาก presign) */
export function submitRefereeIdentityDocs(
  docs: string[],
): Promise<{ status: string; docsCount: number; tournamentsUpdated: number }> {
  return apiFetch("/me/referee-identity/docs", { method: "PUT", body: JSON.stringify({ docs }) });
}

/** AR01 GET /admin/referee-requests — คิวตรวจตัวตน จัดกลุ่มต่อคน */
export function getPendingExternalReferees(): Promise<{ items: BackendExternalRefereeQueueItem[] }> {
  return apiFetch("/admin/referee-requests");
}

/** AR02 POST /admin/referee-requests/:userId/approve — อนุมัติทุกรายการที่คนนั้นรออยู่ (ใช้ได้ 1 ปี) */
export function approveExternalRefereeIdentity(
  userId: number,
): Promise<{ userId: number; identityStatus: string; tournamentsUpdated: number }> {
  return apiFetch(`/admin/referee-requests/${userId}/approve`, { method: "POST" });
}

/** AR04 POST /admin/referee-requests/:userId/request-docs — ขอเอกสารใหม่ (ยังไม่ปฏิเสธ) */
export function requestExternalRefereeDocs(
  userId: number,
  reason: string,
): Promise<{ userId: number; identityStatus: string; reason: string; tournamentsUpdated: number }> {
  return apiFetch(`/admin/referee-requests/${userId}/request-docs`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** AR03 POST /admin/referee-requests/:userId/reject — ปฏิเสธหรือถอนอนุมัติ ต้องมีเหตุผล */
export function rejectExternalRefereeIdentity(
  userId: number,
  reason: string,
): Promise<{ userId: number; identityStatus: string; tournamentsUpdated: number }> {
  return apiFetch(`/admin/referee-requests/${userId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ── คิวคำขอแก้ไขทัวร์นาเมนต์ (C09) ───────────────────────────────────────

/** GET /admin/tournament-requests — คิวคำขอจัดทัวร์นาเมนต์ที่รอ Admin (รูปของ backend) */
export function getPendingTournamentRequests(): Promise<{
  items: BackendPendingTournamentRequestDto[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  return apiFetch("/admin/tournament-requests");
}

/** GET /admin/amendment-requests — คำขอแก้ไขที่รอ Admin */
export function getAmendmentRequests(): Promise<{
  items: BackendAmendmentRequestDto[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  return apiFetch("/admin/amendment-requests");
}

/** POST /amendment-requests/:id/approve — อนุมัติแล้ว backend เขียนค่าใหม่ลงทัวร์นาเมนต์ให้เลย */
export function approveAmendmentRequest(amendmentId: number): Promise<{ id: number; status: string }> {
  return apiFetch(`/amendment-requests/${amendmentId}/approve`, { method: "POST" });
}

/** POST /amendment-requests/:id/reject — ต้องมีเหตุผล */
export function rejectAmendmentRequest(
  amendmentId: number,
  reason: string,
): Promise<{ id: number; status: string }> {
  return apiFetch(`/amendment-requests/${amendmentId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
