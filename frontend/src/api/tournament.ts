import { apiFetch, mockReject, USE_MOCK } from "./client";
import type {
  ApplyToTournamentRequest,
  CreateEligibilityRuleRequest,
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

function findTournament(id: number): TournamentDto | undefined {
  return mockTournaments.find((item) => item.id === id && item.deletedAt === null);
}

export async function getTournaments(params: { status?: TournamentDto["status"]; sportTypeId?: number } = {}): Promise<TournamentListResponse> {
  if (USE_MOCK) {
    const items = mockTournaments.filter((item) =>
      item.deletedAt === null &&
      (!params.status || item.status === params.status) &&
      (params.sportTypeId === undefined || item.sportTypeId === params.sportTypeId),
    );
    return tournamentMockDelay({ items });
  }
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.sportTypeId !== undefined) query.set("sportTypeId", String(params.sportTypeId));
  return apiFetch(`/tournaments${query.size ? `?${query}` : ""}`);
}

export async function getTournament(id: number): Promise<TournamentDetailDto> {
  if (USE_MOCK) {
    const tournament = findTournament(id);
    if (!tournament) return notFound("ไม่พบการแข่งขัน");
    return tournamentMockDelay({
      ...tournament,
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
      registrationStart: null,
      registrationEnd: null,
      eventStartDate: input.eventStartDate,
      eventEndDate: input.eventEndDate ?? null,
      maxTeams: input.maxTeams,
      minTeams: input.minTeams,
      venue: input.venue ?? null,
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
  return apiFetch(`/tournaments/${id}`, { method: "DELETE" });
}

export async function addEligibilityRule(id: number, input: CreateEligibilityRuleRequest): Promise<EligibilityRuleDto> {
  if (USE_MOCK) {
    if (!findTournament(id)) return notFound("ไม่พบการแข่งขัน");
    const rule = { id: nextTournamentMockId(), tournamentId: id, ...input };
    mockEligibilityRules.push(rule);
    return tournamentMockDelay(rule);
  }
  return apiFetch(`/tournaments/${id}/eligibility-rules`, { method: "POST", body: JSON.stringify(input) });
}

export async function removeEligibilityRule(id: number, ruleId: number): Promise<void> {
  if (USE_MOCK) {
    const index = mockEligibilityRules.findIndex((item) => item.id === ruleId && item.tournamentId === id);
    if (index < 0) return notFound("ไม่พบกฎคุณสมบัติ");
    mockEligibilityRules.splice(index, 1);
    return tournamentMockDelay(undefined);
  }
  return apiFetch(`/tournaments/${id}/eligibility-rules/${ruleId}`, { method: "DELETE" });
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
  return apiFetch(`/tournaments/${id}/referees`, { method: "POST", body: JSON.stringify(input) });
}

export async function applyToTournament(id: number, input: ApplyToTournamentRequest): Promise<TournamentApplicationDto> {
  if (USE_MOCK) {
    if (!findTournament(id)) return notFound("ไม่พบการแข่งขัน");
    const storeTeam = findStoreTeam(input.teamId);
    const team = mockTournamentTeams.find((item) => item.id === input.teamId)
      ?? (storeTeam ? { id: input.teamId, name: storeTeam.name } : undefined);
    if (!team) return notFound("ไม่พบทีม");
    const application: TournamentApplicationDto = {
      id: nextTournamentMockId(), tournamentId: id, teamId: input.teamId, team,
      hardFilterPassed: null, hardFilterDetails: null, softFilterDocuments: null,
      status: "pending", reviewedBy: null, reviewedAt: null, rejectionReason: null, appliedAt: isoNow(),
    };
    mockTournamentApplications.push(application);
    return tournamentMockDelay(application);
  }
  return apiFetch(`/tournaments/${id}/applications`, { method: "POST", body: JSON.stringify(input) });
}

export async function reviewApplication(id: number, applicationId: number, input: ReviewTournamentApplicationRequest): Promise<TournamentApplicationDto> {
  if (USE_MOCK) {
    const application = mockTournamentApplications.find((item) => item.id === applicationId && item.tournamentId === id);
    if (!application) return notFound("ไม่พบใบสมัคร");
    application.status = input.status;
    application.rejectionReason = input.rejectionReason ?? null;
    application.reviewedBy = 1;
    application.reviewedAt = isoNow();
    return tournamentMockDelay(application);
  }
  return apiFetch(`/tournaments/${id}/applications/${applicationId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function approveApplication(id: number, applicationId: number): Promise<TournamentApplicationDto> {
  return reviewApplication(id, applicationId, { status: "approved" });
}

export async function rejectApplication(id: number, applicationId: number, rejectionReason: string): Promise<TournamentApplicationDto> {
  return reviewApplication(id, applicationId, { status: "rejected", rejectionReason });
}

export async function approveAllApplications(id: number): Promise<void> {
  if (USE_MOCK) {
    mockTournamentApplications.filter((item) => item.tournamentId === id && item.status === "pending")
      .forEach((item) => { item.status = "approved"; item.reviewedBy = 1; item.reviewedAt = isoNow(); });
    return tournamentMockDelay(undefined);
  }
  return apiFetch(`/tournaments/${id}/applications/approve-all`, { method: "POST" });
}

export async function allowApplicationWithdrawal(id: number, applicationId: number): Promise<TournamentApplicationDto> {
  if (USE_MOCK) {
    const application = mockTournamentApplications.find((item) => item.tournamentId === id && item.id === applicationId);
    if (!application) return notFound("ไม่พบใบสมัคร");
    application.status = "withdrawn";
    return tournamentMockDelay(application);
  }
  return apiFetch(`/tournaments/${id}/applications/${applicationId}/withdraw`, { method: "POST" });
}

export async function publishTournament(id: number): Promise<TournamentDto> {
  if (USE_MOCK) {
    const tournament = findTournament(id);
    if (!tournament) return notFound("ไม่พบการแข่งขัน");
    tournament.status = "public";
    tournament.registrationOpen = true;
    return tournamentMockDelay(tournament);
  }
  return apiFetch(`/tournaments/${id}/publish`, { method: "POST" });
}

export async function drawTournament(id: number, input: DrawTournamentRequest = {}): Promise<TournamentDto> {
  if (USE_MOCK) {
    const tournament = findTournament(id);
    if (!tournament) return notFound("ไม่พบการแข่งขัน");
    tournament.status = "completed";
    return tournamentMockDelay(tournament);
  }
  return apiFetch(`/tournaments/${id}/draw`, { method: "POST", body: JSON.stringify(input) });
}

export async function createAnnouncement(id: number, input: CreateTournamentAnnouncementRequest): Promise<TournamentAnnouncementDto> {
  if (USE_MOCK) {
    const announcement = { id: nextTournamentMockId(), tournamentId: id, authorId: 1, ...input, createdAt: isoNow() };
    mockTournamentAnnouncements.push(announcement);
    return tournamentMockDelay(announcement);
  }
  return apiFetch(`/tournaments/${id}/announcements`, { method: "POST", body: JSON.stringify(input) });
}

export async function getAnnouncements(id: number): Promise<TournamentAnnouncementListResponse> {
  if (USE_MOCK) {
    return tournamentMockDelay({ items: mockTournamentAnnouncements.filter(item => item.tournamentId === id) });
  }
  return apiFetch(`/tournaments/${id}/announcements`);
}

export async function submitFeedback(id: number, input: SubmitTournamentFeedbackRequest): Promise<TournamentFeedbackDto> {
  if (USE_MOCK) return tournamentMockDelay({ id: nextTournamentMockId(), tournamentId: id, userId: 1, ...input, createdAt: isoNow() });
  return apiFetch(`/tournaments/${id}/feedback`, { method: "POST", body: JSON.stringify(input) });
}

export async function saveEntryNotes(id: number, text: string): Promise<TournamentDto> {
  if (USE_MOCK) return updateTournament(id, {});
  return apiFetch(`/tournaments/${id}/entry-notes`, { method: "PATCH", body: JSON.stringify({ text }) });
}

export async function requestFilterChange(id: number, input: { rules: unknown; reason: string }): Promise<TournamentDto> {
  if (USE_MOCK) return updateTournament(id, {});
  return apiFetch(`/tournaments/${id}/filter-change`, { method: "POST", body: JSON.stringify(input) });
}
