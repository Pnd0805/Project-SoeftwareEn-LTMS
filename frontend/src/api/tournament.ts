import { ApiError, apiFetch, mockReject, USE_MOCK } from "./client";
import {
  storeAnnouncementDtos, storeApplicationDto, whyApplyBlocked, writeAllowWithdrawal, writeApplyToTournament,
  writeApproveAllRegistrations,
  writeApproveRegistration, writeDrawTournament, writeEntryNotes, writePostAnnouncement,
  writePublishTournament, writeRejectRegistration, writeRequestFilterChange, writeSendFeedback,
  type TournamentRef, type TournamentWriteBlock,
} from "../mocks/tournamentWrites";
import type { Rules } from "../shared/types";
import type {
  ApplyToTournamentRequest,
  CreateEligibilityRuleRequest,
  AmendmentRequestPayload,
  CreateTournamentRequest,
  EligibilityRuleDto,
  InviteTournamentRefereeRequest,
  ReviewTournamentApplicationRequest,
  TournamentApplicationDto,
  TournamentDetailDto,
  TournamentDto,
  TournamentRefereeDto,
  TournamentListResponse,
  CreateTournamentAnnouncementRequest,
  TournamentAnnouncementDto,
  TournamentAnnouncementListResponse,
  SubmitTournamentFeedbackRequest,
  TournamentFeedbackDto,
  DrawTournamentRequest,
  UpdateTournamentRequest,
} from "../types/tournament.dto";
import {
  isoNow,
  mockDelay as tournamentMockDelay,
  mockEligibilityRules,
  mockTournamentApplications,
  mockTournamentReferees,
  mockTournamentTeams,
  mockTournamentUsers,
  mockTournamentAnnouncements,
  mockTournaments,
  nextTournamentMockId,
} from "../mocks/tournament.mock";
import { findStoreTeam } from "../mocks/teamBridge";

const notFound = <T>(message: string): Promise<T> =>
  mockReject(404, { code: "NOT_FOUND", message });

/** backend ยังไม่มี endpoint นี้ — ตอบ 501 แทนการยิงไปเส้นทางที่ไม่มีอยู่ */
const unavailable = <T>(what: string): Promise<T> =>
  Promise.reject(new ApiError(501, { code: "ENDPOINT_UNAVAILABLE", message: `${what} ยังไม่มีใน backend` }));

/** ส่งเหตุผลที่ชั้น mock ปฏิเสธต่อเป็น error รูปเดียวกับ backend */
const rejectWith = <T>(b: TournamentWriteBlock): Promise<T> =>
  mockReject<T>(b.status, { code: b.code, message: b.message });

/** คำขอที่ยังกรอกไม่ครบ — บอกที่ชั้นนี้ ดีกว่ายิงไปให้ backend ตอบ 400 */
const blockedRequest = <T>(message: string): Promise<T> =>
  Promise.reject(new ApiError(400, { code: "VALIDATION_FAILED", message }));

/** ทัวร์นาเมนต์จาก seed หาไม่เจอ = ref เป็น id ของ fixture ให้ทางเดิมจัดการต่อ */
const notInStore = (b: TournamentWriteBlock) => b.code === "TOURNAMENT_NOT_FOUND";

// The mock application array is recreated when Vite reloads this module. Keep
// only status overrides separately so demo cancel/withdraw behaves like the
// backend and survives a browser refresh.
const MOCK_APPLICATION_STATUS_KEY = "ltms.mock-application-statuses.v1";
type MockApplicationStatus = TournamentApplicationDto["status"];

function readMockApplicationStatusOverrides(): Record<string, MockApplicationStatus> {
  try {
    const raw = localStorage.getItem(MOCK_APPLICATION_STATUS_KEY);
    return raw ? JSON.parse(raw) as Record<string, MockApplicationStatus> : {};
  } catch {
    return {};
  }
}

function persistMockApplicationStatus(application: TournamentApplicationDto) {
  try {
    const overrides = readMockApplicationStatusOverrides();
    overrides[String(application.id)] = application.status;
    localStorage.setItem(MOCK_APPLICATION_STATUS_KEY, JSON.stringify(overrides));
  } catch { /* storage can be unavailable in private browsing */ }
}

function restoreMockApplicationStatuses() {
  const overrides = readMockApplicationStatusOverrides();
  mockTournamentApplications.forEach((application) => {
    const status = overrides[String(application.id)];
    if (status) application.status = status;
  });
}

if (USE_MOCK) restoreMockApplicationStatuses();

function findTournament(id: number): TournamentDto | undefined {
  return mockTournaments.find((item) => item.id === id && item.deletedAt === null);
}

export async function getTournaments(params: { status?: "public" | "completed"; sportTypeId?: number; facultyId?: number; q?: string } = {}): Promise<TournamentListResponse> {
  if (USE_MOCK) {
    const items = mockTournaments.filter((item) =>
      item.deletedAt === null &&
      (!params.status || item.status === params.status) &&
      (params.sportTypeId === undefined || item.sportTypeId === params.sportTypeId),
    );
    return tournamentMockDelay({ items });
  }
  /* C06 รองรับรายการสาธารณะที่กำลังแข่ง (public) และจบแล้ว (completed). */
  const query = new URLSearchParams();
  if (params.status !== undefined) query.set("status", params.status);
  if (params.sportTypeId !== undefined) query.set("sportTypeId", String(params.sportTypeId));
  if (params.facultyId !== undefined) query.set("facultyId", String(params.facultyId));
  if (params.q) query.set("q", params.q);
  return apiFetch(`/tournaments${query.size ? `?${query}` : ""}`);
}

export async function getTournament(id: number): Promise<TournamentDetailDto> {
  if (USE_MOCK) {
    const tournament = findTournament(id);
    if (!tournament) return notFound("ไม่พบการแข่งขัน");
    return tournamentMockDelay({
      ...tournament,
      championTeamId: null,
      completedAt: null,
      eligibilityRules: mockEligibilityRules.filter((item) => item.tournamentId === id),
      referees: mockTournamentReferees.filter((item) => item.tournamentId === id),
      applications: mockTournamentApplications.filter((item) => item.tournamentId === id),
    });
  }
  return apiFetch(`/tournaments/${id}`);
}

export async function createTournament(input: CreateTournamentRequest): Promise<TournamentDto> {
  if (USE_MOCK) {
    const tournament: TournamentDto = {
      id: nextTournamentMockId(),
      name: input.name,
      sportTypeId: input.sportTypeId,
      bracketFormat: input.bracketFormat ?? null,
      scopeType: input.scopeType,
      organizingFacultyId: input.organizingFacultyId ?? null,
      organizingDepartmentId: input.organizingDepartmentId ?? null,
      requestedByUserId: 1,
      status: "pending_approval",
      registrationOpen: false,
      registrationStart: input.registrationStart,
      registrationEnd: input.registrationEnd,
      eventStartDate: input.eventStartDate,
      eventEndDate: input.eventEndDate,
      maxTeams: input.maxTeams,
      minTeams: input.minTeams,
      venue: input.venue,
      disputeWindowHours: input.disputeWindowHours ?? 24,
      genderRequirement: input.genderRequirement ?? "any",
      minAge: input.minAge ?? null,
      maxAge: input.maxAge ?? null,
      rejectionReason: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: isoNow(),
      deletedAt: null,
    };
    mockTournaments.push(tournament);
    return tournamentMockDelay(tournament);
  }
  return apiFetch("/tournaments", { method: "POST", body: JSON.stringify(input) });
}

export async function updateTournament(id: number, input: UpdateTournamentRequest): Promise<TournamentDto> {
  if (USE_MOCK) {
    const tournament = findTournament(id);
    if (!tournament) return notFound("ไม่พบการแข่งขัน");
    Object.assign(tournament, input);
    return tournamentMockDelay(tournament);
  }
  return apiFetch(`/tournaments/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function deleteTournament(id: number): Promise<void> {
  if (USE_MOCK) {
    const tournament = findTournament(id);
    if (!tournament) return notFound("ไม่พบการแข่งขัน");
    tournament.deletedAt = isoNow();
    return tournamentMockDelay(undefined);
  }
  return unavailable<void>("การลบทัวร์นาเมนต์");
}

export async function addEligibilityRule(id: number, input: CreateEligibilityRuleRequest): Promise<EligibilityRuleDto> {
  if (USE_MOCK) {
    if (!findTournament(id)) return notFound("ไม่พบการแข่งขัน");
    const rule = { id: nextTournamentMockId(), tournamentId: id, ...input };
    mockEligibilityRules.push(rule);
    return tournamentMockDelay(rule);
  }
  return unavailable<EligibilityRuleDto>("การเพิ่มกฎคุณสมบัติ (backend มีแค่ GET /tournaments/:id/eligibility-rules)");
}

export async function removeEligibilityRule(id: number, ruleId: number): Promise<void> {
  if (USE_MOCK) {
    const index = mockEligibilityRules.findIndex((item) => item.id === ruleId && item.tournamentId === id);
    if (index < 0) return notFound("ไม่พบกฎคุณสมบัติ");
    mockEligibilityRules.splice(index, 1);
    return tournamentMockDelay(undefined);
  }
  void ruleId;
  return unavailable<void>("การลบกฎคุณสมบัติ");
}

export async function inviteReferee(id: number, input: InviteTournamentRefereeRequest): Promise<TournamentRefereeDto> {
  if (USE_MOCK) {
    if (!findTournament(id)) return notFound("ไม่พบการแข่งขัน");
    const user = mockTournamentUsers.find((item) => item.id === input.userId);
    if (!user) return notFound("ไม่พบผู้ใช้");
    const referee: TournamentRefereeDto = {
      id: nextTournamentMockId(), tournamentId: id, userId: input.userId, user,
      matchId: null, invitedBy: 1, invitationStatus: "pending",
      isExternal: input.isExternal ?? false,
      externalApprovalStatus: input.isExternal ? "pending" : "not_required",
      approvedBy: null, approvedAt: null, createdAt: isoNow(),
    };
    mockTournamentReferees.push(referee);
    return tournamentMockDelay(referee);
  }
  /* inviteRefereeSchema บังคับ isExternal (ไม่ใช่ optional) และรับ matchIds
     ไม่ส่ง matchIds = เชิญเข้า pool เฉยๆ ยังคุมแมตช์ไหนไม่ได้จนกว่าจะมอบหมาย */
  return apiFetch(`/tournaments/${id}/referees`, {
    method: "POST",
    body: JSON.stringify({
      userId: input.userId,
      isExternal: input.isExternal ?? false,
      matchIds: input.matchIds ?? [],
    }),
  });
}

export async function applyToTournament(id: TournamentRef, input: ApplyToTournamentRequest): Promise<TournamentApplicationDto> {
  if (USE_MOCK) {
    /* ทัวร์นาเมนต์จาก seed สมัครเข้า store — พร้อมด่านครบชุด (ช่วงรับสมัคร ที่นั่งเต็ม
       สมัครซ้ำ hard filter และคนเดียวลงสองทีม) ดู mocks/tournamentWrites.ts */
    const why = whyApplyBlocked(id, input.teamId, input.squad ?? []);
    if (why === null) {
      const rid = writeApplyToTournament(id, input.teamId, input.squad ?? []);
      const dto = rid ? storeApplicationDto(rid) : null;
      if (dto) return tournamentMockDelay(dto);
    } else if (why !== 'ไม่พบการแข่งขัน' && why !== 'ไม่พบทีม') {
      return mockReject<TournamentApplicationDto>(422, { code: "ENTRY_REFUSED", message: why });
    }

    if (!findTournament(Number(id))) return notFound("ไม่พบการแข่งขัน");
    const storeTeam = findStoreTeam(input.teamId);
    const team = mockTournamentTeams.find((item) => item.id === input.teamId)
      ?? (storeTeam ? { id: input.teamId, name: storeTeam.name } : undefined);
    if (!team) return notFound("ไม่พบทีม");
    const application: TournamentApplicationDto = {
      id: nextTournamentMockId(), tournamentId: Number(id), teamId: input.teamId, team,
      hardFilterPassed: null, hardFilterDetails: null, softFilterDocuments: null,
      status: "pending", reviewedBy: null, reviewedAt: null, rejectionReason: null, appliedAt: isoNow(),
    };
    mockTournamentApplications.push(application);
    return tournamentMockDelay(application);
  }
  /* `squad` เป็น id ของ store ส่งไปก็ไม่มีความหมาย — ประกอบ body เองให้เหลือเฉพาะ
     ช่องที่ applyTournamentSchema รับ */
  return apiFetch(`/tournaments/${id}/applications`, {
    method: "POST",
    body: JSON.stringify({ teamId: input.teamId, playerIds: input.playerIds ?? [] }),
  });
}

/** Current backend contract: organizer-only registration list. */
export async function getTournamentApplications(id: number): Promise<import('../types/tournament.dto').BackendTournamentApplicationsResponse> {
  if (USE_MOCK) {
    const tournament = findTournament(id)
    return tournamentMockDelay({ items: tournament ? mockTournamentApplications.filter(item => item.tournamentId === id).map(item => ({
      id: item.id,
      team: item.team,
      status: item.status,
      hardFilterPassed: item.hardFilterPassed === true,
      softFilterDocuments: item.softFilterDocuments,
      appliedAt: item.appliedAt,
    })) : [] })
  }
  return apiFetch(`/tournaments/${id}/applications`)
}

/** Public list of teams whose applications were approved for a tournament. */
export async function getTournamentTeams(id: number): Promise<import('../types/tournament.dto').BackendTournamentTeamsResponse> {
  if (!USE_MOCK) return apiFetch(`/tournaments/${id}/teams`);
  const sportTypeId = findTournament(id)?.sportTypeId ?? 0;
  return tournamentMockDelay({ items: mockTournamentApplications
    .filter(item => item.tournamentId === id && item.status === "approved")
    .map(item => ({ ...item.team, sportTypeId })) });
}

/** Current backend contract: applications led by the signed-in user. */
export async function getMyApplications(): Promise<import('../types/tournament.dto').BackendMyApplicationsResponse> {
  if (!USE_MOCK) return apiFetch("/me/applications");
  return tournamentMockDelay({ items: mockTournamentApplications.map(item => ({
    id: item.id,
    tournament: { id: item.tournamentId, name: findTournament(item.tournamentId)?.name ?? "Tournament" },
    team: item.team,
    status: item.status,
    rejectionReason: item.rejectionReason,
    appliedAt: item.appliedAt,
  })) });
}

export async function cancelMyApplication(applicationId: number): Promise<void> {
  if (!USE_MOCK) return apiFetch(`/applications/${applicationId}/cancel`, { method: "POST" });
  const application = mockTournamentApplications.find(item => item.id === applicationId);
  if (!application) return notFound("Application");
  application.status = "cancelled";
  persistMockApplicationStatus(application);
  return tournamentMockDelay(undefined);
}

export async function withdrawMyApplication(applicationId: number): Promise<void> {
  if (!USE_MOCK) return apiFetch(`/applications/${applicationId}/withdraw`, { method: "POST" });
  const application = mockTournamentApplications.find(item => item.id === applicationId);
  if (!application) return notFound("Application");
  application.status = "withdrawn";
  persistMockApplicationStatus(application);
  return tournamentMockDelay(undefined);
}

export async function reviewApplication(id: TournamentRef, applicationId: TournamentRef, input: ReviewTournamentApplicationRequest): Promise<TournamentApplicationDto> {
  if (USE_MOCK) {
    /* ทัวร์นาเมนต์จาก seed ตัดสินใบสมัครที่ store — ที่เดียวกับที่หน้าจัดการอ่าน */
    const ok = input.status === "approved"
      ? writeApproveRegistration(applicationId)
      : writeRejectRegistration(applicationId, input.rejectionReason ?? "");
    if (ok) {
      const dto = storeApplicationDto(applicationId);
      if (dto) return tournamentMockDelay(dto);
    }
    const application = mockTournamentApplications.find((item) => item.id === applicationId && item.tournamentId === id);
    if (!application) return notFound("ไม่พบใบสมัคร");
    application.status = input.status;
    application.rejectionReason = input.rejectionReason ?? null;
    application.reviewedBy = 1;
    application.reviewedAt = isoNow();
    return tournamentMockDelay(application);
  }
  const action = input.status === "approved" ? "approve" : "reject";
  const body = input.status === "rejected"
    ? JSON.stringify({ reason: input.rejectionReason ?? '' })
    : undefined;
  return apiFetch(`/applications/${applicationId}/${action}`, { method: "POST", body });
}

export async function approveApplication(id: TournamentRef, applicationId: TournamentRef): Promise<TournamentApplicationDto> {
  return reviewApplication(id, applicationId, { status: "approved" });
}

export async function rejectApplication(id: TournamentRef, applicationId: TournamentRef, rejectionReason: string): Promise<TournamentApplicationDto> {
  return reviewApplication(id, applicationId, { status: "rejected", rejectionReason });
}

export async function cancelApplication(id: TournamentRef, applicationId: TournamentRef): Promise<TournamentApplicationDto> {
  if (USE_MOCK) {
    const application = mockTournamentApplications.find((item) => item.tournamentId === id && item.id === applicationId);
    if (!application) return notFound("ไม่พบใบสมัคร");
    application.status = "cancelled";
    return tournamentMockDelay(application);
  }
  void id;
  return apiFetch(`/applications/${applicationId}/cancel`, { method: "POST" });
}

export async function approveAllApplications(id: TournamentRef): Promise<void> {
  if (USE_MOCK) {
    if (writeApproveAllRegistrations(id) > 0) return tournamentMockDelay(undefined);
    mockTournamentApplications.filter((item) => item.tournamentId === id && item.status === "pending")
      .forEach((item) => { item.status = "approved"; item.reviewedBy = 1; item.reviewedAt = isoNow(); });
    return tournamentMockDelay(undefined);
  }
  void id;
  return mockReject<void>(501, {
    code: "NOT_IMPLEMENTED",
    message: "Backend ยังไม่มี endpoint สำหรับอนุมัติใบสมัครทั้งหมด",
  });
}

export async function allowApplicationWithdrawal(id: TournamentRef, applicationId: TournamentRef): Promise<TournamentApplicationDto> {
  if (USE_MOCK) {
    if (writeAllowWithdrawal(applicationId)) {
      const dto = storeApplicationDto(applicationId);
      if (dto) return tournamentMockDelay(dto);
    }
    const application = mockTournamentApplications.find((item) => item.tournamentId === id && item.id === applicationId);
    if (!application) return notFound("ไม่พบใบสมัคร");
    application.status = "withdrawn";
    return tournamentMockDelay(application);
  }
  void id;
  return apiFetch(`/applications/${applicationId}/withdraw`, { method: "POST" });
}

/** POST /tournaments/:id/publish — BR-10 ต้องมีกรรมการที่มีสิทธิ์ครบก่อน */
export async function publishTournament(id: TournamentRef): Promise<TournamentDto | void> {
  if (USE_MOCK) {
    /* ทัวร์นาเมนต์จาก seed เขียนลง store — เดิมหน้าจอส่ง Number('t-bkb') = NaN กดแล้วเงียบ */
    const blocked = writePublishTournament(id);
    if (!blocked) return tournamentMockDelay(undefined);
    if (!notInStore(blocked)) return rejectWith<void>(blocked);
    const tournament = findTournament(Number(id));
    if (!tournament) return notFound("ไม่พบการแข่งขัน");
    tournament.status = "public";
    tournament.registrationOpen = true;
    return tournamentMockDelay(tournament);
  }
  return apiFetch(`/tournaments/${id}/publish`, { method: "POST" });
}

export async function drawTournament(
  id: TournamentRef,
  input: DrawTournamentRequest = {},
): Promise<{ tournament: TournamentDto; bracket: import('../types/tournament.dto').DrawTournamentResponse | null }> {
  if (USE_MOCK) {
    if (writeDrawTournament(id, input.teamIds)) {
      /* สายถูกสร้างใน store แล้ว — ไม่มี TournamentDto ให้คืน จึงคืนตัวที่มีอยู่
         ผู้เรียกใช้แค่รู้ว่าสำเร็จ แล้ว invalidate ให้หน้าอ่านใหม่เอง */
      const first = mockTournaments[0];
      if (first) return tournamentMockDelay({ tournament: first, bracket: null });
    }
    const tournament = findTournament(Number(id));
    if (!tournament) return notFound("ไม่พบการแข่งขัน");
    /* เดิมตั้ง status = "completed" ตรงนี้ — การจับสายทำให้ทัวร์นาเมนต์จบทันที
       ซึ่งกลับหัวกลับหางกับความหมายของมัน การสร้างแมตช์จริงเป็นของ Match API
       (SDS §S5: POST /tournaments/{id}/brackets) mock จึงยังไม่สร้างสายให้
       แต่ต้องไม่ทำลายสถานะที่ถูกอยู่แล้ว */
    return tournamentMockDelay({ tournament, bracket: null });
  }
  /* เส้นจริงคือ POST /tournaments/:id/bracket และรับ seedingMethod ไม่ใช่รายชื่อทีม
     (manual ต้องส่ง manualSeeds — ดู createBracket() ใน api/match.ts) */
  const bracket = await apiFetch<import('../types/tournament.dto').DrawTournamentResponse>(`/tournaments/${id}/bracket`, {
    method: "POST",
    body: JSON.stringify({
      seedingMethod: input.teamIds?.length ? "manual" : "random",
      ...(input.teamIds?.length ? { manualSeeds: input.teamIds } : {}),
      ...(input.replace ? { replace: true } : {}),
    }),
  });
  const tournament = await apiFetch<TournamentDto>(`/tournaments/${id}`);
  return { tournament, bracket };
}

/** C14b — organizer explicitly closes a tournament after every match is completed. */
export function completeTournament(id: number): Promise<import('../types/tournament.dto').CompleteTournamentResponse> {
  return apiFetch(`/tournaments/${id}/complete`, { method: "POST" });
}

/** POST /tournaments/:id/announcements — ผู้จัดเท่านั้น · แจ้งหัวหน้าทีมที่ได้ที่นั่ง */
export async function createAnnouncement(id: TournamentRef, input: CreateTournamentAnnouncementRequest): Promise<TournamentAnnouncementDto> {
  if (USE_MOCK) {
    const created = writePostAnnouncement(id, input.title, input.body);
    if (typeof created === "string") {
      const dto = storeAnnouncementDtos(id)?.[0];
      if (dto) return tournamentMockDelay(dto);
    } else if (!notInStore(created)) {
      return rejectWith<TournamentAnnouncementDto>(created);
    }
    const announcement = { id: nextTournamentMockId(), tournamentId: Number(id), authorId: 1, ...input, createdAt: isoNow() };
    mockTournamentAnnouncements.push(announcement);
    return tournamentMockDelay(announcement);
  }
  return apiFetch(`/tournaments/${id}/announcements`, { method: "POST", body: JSON.stringify(input) });
}

export async function getAnnouncements(id: TournamentRef): Promise<TournamentAnnouncementListResponse> {
  if (USE_MOCK) {
    /* ประกาศของทัวร์นาเมนต์ใน seed อยู่ใน store — เดิมอ่านแต่อาร์เรย์ fixture จึงไม่เคยขึ้น */
    const fromStore = storeAnnouncementDtos(id);
    if (fromStore) return tournamentMockDelay({ items: fromStore });
    return tournamentMockDelay({ items: mockTournamentAnnouncements.filter(item => item.tournamentId === Number(id)) });
  }
  return apiFetch(`/tournaments/${id}/announcements`);
}

export async function submitFeedback(id: TournamentRef, input: SubmitTournamentFeedbackRequest): Promise<TournamentFeedbackDto> {
  if (USE_MOCK) {
    const blocked = writeSendFeedback(id, input.rating, input.text ?? "");
    if (blocked && !notInStore(blocked)) return rejectWith<TournamentFeedbackDto>(blocked);
    return tournamentMockDelay({ id: nextTournamentMockId(), tournamentId: Number(id), userId: 1, ...input, createdAt: isoNow() });
  }
  return unavailable<TournamentFeedbackDto>("การให้คะแนนและรีวิวทัวร์นาเมนต์ (FR-CM-02)");
}

export async function saveEntryNotes(id: TournamentRef, text: string): Promise<TournamentDto | void> {
  if (USE_MOCK) {
    const blocked = writeEntryNotes(id, text);
    if (!blocked) return tournamentMockDelay(undefined);
    if (!notInStore(blocked)) return rejectWith<void>(blocked);
    return updateTournament(Number(id), {});
  }
  void text;
  return unavailable<TournamentDto>("บันทึกหมายเหตุการรับสมัคร");
}

/**
 * C09 — ขอแก้เงื่อนไขการเข้าร่วมของทัวร์ที่อนุมัติไปแล้ว
 *
 * ผู้เรียกส่งมาทั้งสองรูป เพราะสองโหมดเก็บคนละอย่าง: mock เก็บ `Rules` ของ prototype
 * ทั้งก้อนพร้อมเหตุผล · ของจริงส่งเฉพาะช่องที่ `allowedAmendmentFields` รับ
 *
 * เดิมส่ง `{ rules, reason }` เข้าไปตรงๆ ซึ่ง backend ตอบ
 * `400 AMENDMENT_FIELD_NOT_ALLOWED` ทุกครั้ง — ไม่มีช่องชื่อ `rules` หรือ `reason`
 * ในรายการที่รับ (เหตุผลไม่มีที่เก็บเลย ดู BACKEND-GAPS)
 */
export async function requestFilterChange(
  id: TournamentRef,
  input: { rules: unknown; reason: string; changes?: AmendmentRequestPayload },
): Promise<TournamentDto | void> {
  if (USE_MOCK) {
    const blocked = writeRequestFilterChange(id, input.rules as Rules, input.reason);
    if (!blocked) return tournamentMockDelay(undefined);
    if (!notInStore(blocked)) return rejectWith<void>(blocked);
    return updateTournament(Number(id), {});
  }
  const changes = input.changes ?? {};
  if (Object.keys(changes).length === 0) {
    return blockedRequest<void>("ยังไม่ได้เปลี่ยนเงื่อนไขไหนเลย");
  }
  /* เหตุผลเป็นช่องบังคับตั้งแต่ migration 020 (มติ 20 ก.ย.) — เคยไม่มีที่เก็บ เราจึง
     ถอดช่องกรอกออกไปรอบหนึ่ง ตอนนี้กลับมาแล้ว ไม่ส่งมาคือ 400 ทุกใบ */
  const reason = input.reason.trim();
  if (!reason) return blockedRequest<void>("กรุณาระบุเหตุผลที่ขอแก้ไข");
  return apiFetch(`/tournaments/${id}/amendment-requests`, {
    method: "POST",
    body: JSON.stringify({ requestedChanges: changes, reason }),
  });
}

/** C09b — every amendment submitted by this tournament's organizer, newest first. */
export function getTournamentAmendmentRequests(
  id: number,
): Promise<{ items: import('../types/tournament.dto').TournamentAmendmentHistoryItemDto[] }> {
  return apiFetch(`/tournaments/${id}/amendment-requests`);
}

// ══════════════════════════════════════════════════════════════════════════
// เส้นของ backend ที่ frontend ยังไม่เคยมีฟังก์ชันเรียก (BE_KN 98aa300)
// ══════════════════════════════════════════════════════════════════════════

/** POST /tournaments/:id/unpublish — ผู้จัด · ซ่อนรายการกลับเป็น private */
export function unpublishTournament(id: number): Promise<{ id: number; status: string }> {
  return apiFetch(`/tournaments/${id}/unpublish`, { method: "POST" });
}

/** POST /tournaments/:id/open-registration — ผู้จัด */
export function openRegistration(id: number): Promise<{ id: number; registrationOpen: boolean }> {
  return apiFetch(`/tournaments/${id}/open-registration`, { method: "POST" });
}

/** POST /tournaments/:id/close-registration — ผู้จัด · ต้องปิดก่อนจับสาย */
export function closeRegistration(id: number): Promise<{ id: number; registrationOpen: boolean }> {
  return apiFetch(`/tournaments/${id}/close-registration`, { method: "POST" });
}

/** POST /tournaments/:id/approve — Admin ที่มีขอบเขตครอบคลุมรายการนี้ */
export function approveTournament(id: number): Promise<{ id: number; status: string; organizerId: number }> {
  return apiFetch(`/tournaments/${id}/approve`, { method: "POST" });
}

/** POST /tournaments/:id/reject — ต้องมีเหตุผล (400 TOURNAMENT_REJECT_REASON_REQUIRED) */
export function rejectTournament(id: number, reason: string): Promise<{ id: number; status: string }> {
  return apiFetch(`/tournaments/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
}

/** GET /me/tournament-requests — คำขอจัดทัวร์นาเมนต์ของฉันและสถานะล่าสุด */
export function getMyTournamentRequests(): Promise<{
  items: import("../types/tournament.dto").BackendMyTournamentRequestDto[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  return apiFetch("/me/tournament-requests");
}

/**
 * GET /tournaments/:id/eligibility-rules — เงื่อนไขคณะ/ชั้นปีของรายการ (อ่านอย่างเดียว)
 * ⚠️ backend ยังไม่มีเส้นสำหรับ "เพิ่ม/ลบ" กฎ — ตอนนี้ต้องใส่แถวใน DB เอง
 */
export function getEligibilityRules(
  id: number,
): Promise<{ items: import("../types/tournament.dto").BackendEligibilityRuleDto[] }> {
  return apiFetch(`/tournaments/${id}/eligibility-rules`);
}

/** GET /applications/:id — ผู้จัดหรือหัวหน้าทีมของใบสมัครนั้น */
export function getApplicationDetail(
  applicationId: number,
): Promise<import("../types/tournament.dto").BackendApplicationDetailDto> {
  return apiFetch(`/applications/${applicationId}`);
}

/** PATCH /announcements/:id — ผู้จัดแก้ประกาศ */
export function updateAnnouncement(
  announcementId: number,
  input: { title?: string; body?: string },
): Promise<TournamentAnnouncementDto> {
  return apiFetch(`/announcements/${announcementId}`, { method: "PATCH", body: JSON.stringify(input) });
}

/** DELETE /announcements/:id — ผู้จัดลบประกาศ */
export function deleteAnnouncement(announcementId: number): Promise<void> {
  return apiFetch(`/announcements/${announcementId}`, { method: "DELETE" });
}

/** POST /uploads/presign — ขอลิงก์อัปโหลดรูป (รับเฉพาะ image/jpeg กับ image/png) */
export function presignUpload(
  input: import("../types/tournament.dto").PresignUploadRequest,
): Promise<import("../types/tournament.dto").PresignUploadResponse> {
  return apiFetch("/uploads/presign", { method: "POST", body: JSON.stringify(input) });
}
