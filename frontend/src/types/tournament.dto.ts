import type {
  BracketFormat,
  EligibilityRuleType,
  ExternalApprovalStatus,
  GenderRequirement,
  RefereeInvitationStatus,
  TournamentApplicationStatus,
  TournamentScopeType,
  TournamentStatus,
} from "./enums";
import type { TeamRef, UserRef } from "./dto";

export interface TournamentDto {
  id: number;
  name: string;
  sportTypeId: number;
  bracketFormat: BracketFormat | null;
  scopeType: TournamentScopeType;
  organizingFacultyId: number | null;
  organizingDepartmentId: number | null;
  requestedByUserId: number;
  status: TournamentStatus;
  registrationOpen: boolean;
  registrationStart: string | null;
  registrationEnd: string | null;
  eventStartDate: string;
  eventEndDate: string | null;
  maxTeams: number;
  minTeams: number;
  venue: string | null;
  disputeWindowHours: number;
  genderRequirement: GenderRequirement;
  minAge: number | null;
  maxAge: number | null;
  rejectionReason: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface TournamentDetailDto extends TournamentDto {
  eligibilityRules: EligibilityRuleDto[];
  referees: TournamentRefereeDto[];
  applications: TournamentApplicationDto[];
}

export interface EligibilityRuleDto {
  id: number;
  tournamentId: number;
  ruleType: EligibilityRuleType;
  ruleValue: number;
}

export interface TournamentRefereeDto {
  id: number;
  tournamentId: number;
  userId: number;
  user: UserRef;
  matchId: number | null;
  invitedBy: number;
  invitationStatus: RefereeInvitationStatus;
  isExternal: boolean;
  externalApprovalStatus: ExternalApprovalStatus;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface TournamentApplicationDto {
  id: number;
  tournamentId: number;
  teamId: number;
  team: TeamRef;
  hardFilterPassed: boolean | null;
  hardFilterDetails: Record<string, unknown> | null;
  softFilterDocuments: Record<string, unknown> | null;
  status: TournamentApplicationStatus;
  reviewedBy: number | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  appliedAt: string;
}

export interface TournamentListResponse {
  items: TournamentDto[];
}

export interface CreateTournamentRequest {
  name: string;
  sportTypeId: number;
  bracketFormat?: BracketFormat | null;
  scopeType: TournamentScopeType;
  organizingFacultyId?: number | null;
  organizingDepartmentId?: number | null;
  eventStartDate: string;
  eventEndDate?: string | null;
  maxTeams: number;
  minTeams: number;
  venue?: string | null;
  disputeWindowHours?: number;
  genderRequirement?: GenderRequirement;
  minAge?: number | null;
  maxAge?: number | null;
}

export type UpdateTournamentRequest = Partial<CreateTournamentRequest> & {
  registrationOpen?: boolean;
  registrationStart?: string | null;
  registrationEnd?: string | null;
};

export interface CreateEligibilityRuleRequest {
  ruleType: EligibilityRuleType;
  ruleValue: number;
}

export interface InviteTournamentRefereeRequest {
  userId: number;
  isExternal?: boolean;
}

export interface ApplyToTournamentRequest {
  teamId: number;
  /**
   * รายชื่อผู้ลงแข่งของนัดนี้ — ไม่ส่งมาก็ถือว่าทั้งทีม
   * Hard filter ตรวจรายคนจากรายชื่อนี้ ไม่ใช่จากสมาชิกทั้งทีม (FR-PV-01)
   */
  squad?: string[];
}

export interface ReviewTournamentApplicationRequest {
  status: Extract<TournamentApplicationStatus, "approved" | "rejected">;
  rejectionReason?: string | null;
}

export interface TournamentAnnouncementDto {
  id: number;
  tournamentId: number;
  authorId: number;
  title: string;
  body: string;
  createdAt: string;
}

export interface TournamentAnnouncementListResponse {
  items: TournamentAnnouncementDto[]
}

export interface CreateTournamentAnnouncementRequest {
  title: string;
  body: string;
}

export interface TournamentFeedbackDto {
  id: number;
  tournamentId: number;
  userId: number;
  rating: number;
  text: string;
  createdAt: string;
}

export interface SubmitTournamentFeedbackRequest {
  rating: number;
  text: string;
}

export interface DrawTournamentRequest {
  teamIds?: number[];
}
