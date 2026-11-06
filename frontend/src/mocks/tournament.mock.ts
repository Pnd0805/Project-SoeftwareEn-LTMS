import type { TeamRef, UserRef } from "../types/dto";
import type {
  EligibilityRuleDto,
  TournamentApplicationDto,
  TournamentDto,
  TournamentRefereeDto,
  TournamentAnnouncementDto,
} from "../types/tournament.dto";

const TZ = "+07:00";
const now = "2026-08-01T09:00:00+07:00";

export const mockTournamentUsers: UserRef[] = [
  { id: 1, fullName: "Sirawit Kanchana", avatarUrl: null },
  { id: 2, fullName: "Kittipong Rojana", avatarUrl: null },
  { id: 9, fullName: "Rattana Admin", avatarUrl: null },
];

export const mockTournamentTeams: TeamRef[] = [
  { id: 11, name: "Byte Force" },
  { id: 12, name: "Engineering United" },
  { id: 13, name: "Circuit Breakers" },
];

export const mockTournaments: TournamentDto[] = [
  {
    id: 101,
    name: "Inter-Faculty Futsal 2026",
    sportTypeId: 2,
    bracketFormat: "single_elimination",
    scopeType: "university",
    organizingFacultyId: 1,
    organizingDepartmentId: null,
    requestedByUserId: 1,
    status: "public",
    registrationOpen: true,
    registrationStart: "2026-08-05T09:00:00+07:00",
    registrationEnd: "2026-08-20T23:59:59+07:00",
    eventStartDate: "2026-09-01",
    eventEndDate: "2026-09-07",
    maxTeams: 16,
    minTeams: 4,
    venue: "University Sports Complex",
    disputeWindowHours: 24,
    genderRequirement: "any",
    minAge: 18,
    maxAge: 30,
    rejectionReason: null,
    approvedBy: 9,
    approvedAt: "2026-07-25T14:00:00+07:00",
    createdAt: "2026-07-20T10:30:00+07:00",
    deletedAt: null,
  },
  {
    id: 102,
    name: "Faculty Chess Open",
    sportTypeId: 8,
    bracketFormat: "round_robin",
    scopeType: "faculty",
    organizingFacultyId: 2,
    organizingDepartmentId: null,
    requestedByUserId: 2,
    status: "pending_approval",
    registrationOpen: false,
    registrationStart: null,
    registrationEnd: null,
    eventStartDate: "2026-10-10",
    eventEndDate: null,
    maxTeams: 12,
    minTeams: 4,
    venue: "Science Building  main hall",
    disputeWindowHours: 24,
    genderRequirement: "any",
    minAge: null,
    maxAge: null,
    rejectionReason: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    deletedAt: null,
  },
];

export const mockEligibilityRules: EligibilityRuleDto[] = [
  { id: 1, tournamentId: 101, ruleType: "year", ruleValue: 1 },
  { id: 2, tournamentId: 101, ruleType: "faculty", ruleValue: 1 },
];

export const mockTournamentReferees: TournamentRefereeDto[] = [
  {
    id: 1,
    tournamentId: 101,
    userId: 2,
    user: mockTournamentUsers[1],
    matchId: null,
    invitedBy: 1,
    invitationStatus: "accepted",
    isExternal: false,
    externalApprovalStatus: "not_required",
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
  },
];

export const mockTournamentApplications: TournamentApplicationDto[] = [
  {
    id: 1,
    tournamentId: 101,
    teamId: 11,
    team: mockTournamentTeams[0],
    hardFilterPassed: true,
    hardFilterDetails: { facultyId: 1, year: 1 },
    softFilterDocuments: null,
    status: "approved",
    reviewedBy: 1,
    reviewedAt: "2026-08-07T11:00:00+07:00",
    rejectionReason: null,
    appliedAt: "2026-08-06T16:00:00+07:00",
  },
  {
    id: 2,
    tournamentId: 101,
    teamId: 12,
    team: mockTournamentTeams[1],
    hardFilterPassed: true,
    hardFilterDetails: { facultyId: 1 },
    softFilterDocuments: null,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    appliedAt: "2026-08-08T12:00:00+07:00",
  },
];

export const mockTournamentAnnouncements: TournamentAnnouncementDto[] = [];

export const mockDelay = <T>(value: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export function nextTournamentMockId(): number {
  const ids = [
    ...mockTournaments.map((item) => item.id),
    ...mockEligibilityRules.map((item) => item.id),
    ...mockTournamentReferees.map((item) => item.id),
    ...mockTournamentApplications.map((item) => item.id),
  ];
  return Math.max(...ids, 0) + 1;
}

export function isoNow(): string {
  return new Date().toISOString().replace("Z", TZ);
}
