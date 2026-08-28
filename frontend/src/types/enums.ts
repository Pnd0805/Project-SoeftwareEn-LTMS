/**
 * src/types/enums.ts
 *
 * สร้างจาก schema.sql โดยตรง (parse ทุกคอลัมน์ ENUM(...) จริง ไม่ได้พิมพ์มือ)
 * กฎ: ค่า enum ไม่แปลง — string ที่ DB เก็บไหลตรงไป API แล้วมาถึง frontend เป๊ะๆ
 * ห้ามพิมพ์ enum string ซ้ำที่อื่นในโปรเจกต์ ให้ import จากไฟล์นี้จุดเดียว
 *
 * หมายเหตุการตั้งชื่อ:
 *  - Mode ใช้ร่วมกัน 2 จุด (sport_types.default_mode, matches.mode) ค่าเหมือนกันเป๊ะ
 *  - ExternalApprovalStatus ใช้ร่วมกัน 2 จุด (tournaments.organizer_external_approval_status,
 *    tournament_referees.external_approval_status) ค่าเหมือนกันเป๊ะ
 *  - AdminScopeType (admin_scopes.scope_type) กับ TournamentScopeType (tournaments.scope_type)
 *    ชื่อคอลัมน์ใน SQL เหมือนกัน ("scope_type") แต่ค่าคนละชุด — แยกชื่อ TS ป้องกันชนกัน
 *  - TeamReadinessStatus / TeamOfficialStatus ค่าเป็น PascalCase จริงจาก DB (Forming/Ready,
 *    Unofficial/Official) ไม่ใช่พิมพ์ผิด ห้ามแก้เป็น lowercase
 */

import { z } from "zod";

// ───────── กลุ่ม 1 — ข้อมูลอ้างอิง ─────────

// sport_types.default_mode, matches.mode
export const ModeEnum = z.enum(["onsite", "online"]);
export type Mode = z.infer<typeof ModeEnum>;
export const ModeOptions = ModeEnum.options;
export const ModeLabel: Record<Mode, string> = {
  "onsite": "Onsite",
  "online": "Online",
};


// ───────── กลุ่ม 2 — ผู้ใช้และสิทธิ์ ─────────

// users.gender
export const GenderEnum = z.enum(["male", "female", "other"]);
export type Gender = z.infer<typeof GenderEnum>;
export const GenderOptions = GenderEnum.options;
export const GenderLabel: Record<Gender, string> = {
  "male": "Male",
  "female": "Female",
  "other": "Other",
};

// users.user_type
export const UserTypeEnum = z.enum(["student", "staff", "external"]);
export type UserType = z.infer<typeof UserTypeEnum>;
export const UserTypeOptions = UserTypeEnum.options;
export const UserTypeLabel: Record<UserType, string> = {
  "student": "Student",
  "staff": "Staff",
  "external": "External",
};

// admin_scopes.scope_type
export const AdminScopeTypeEnum = z.enum(["faculty", "university_wide"]);
export type AdminScopeType = z.infer<typeof AdminScopeTypeEnum>;
export const AdminScopeTypeOptions = AdminScopeTypeEnum.options;
export const AdminScopeTypeLabel: Record<AdminScopeType, string> = {
  "faculty": "Faculty admin",
  "university_wide": "University-wide admin",
};


// ───────── กลุ่ม 3 — ทีม ─────────

// teams.readiness_status
export const TeamReadinessStatusEnum = z.enum(["Forming", "Ready"]);
export type TeamReadinessStatus = z.infer<typeof TeamReadinessStatusEnum>;
export const TeamReadinessStatusOptions = TeamReadinessStatusEnum.options;
export const TeamReadinessStatusLabel: Record<TeamReadinessStatus, string> = {
  "Forming": "Forming",
  "Ready": "Ready",
};

// teams.official_status
export const TeamOfficialStatusEnum = z.enum(["Unofficial", "Official"]);
export type TeamOfficialStatus = z.infer<typeof TeamOfficialStatusEnum>;
export const TeamOfficialStatusOptions = TeamOfficialStatusEnum.options;
export const TeamOfficialStatusLabel: Record<TeamOfficialStatus, string> = {
  "Unofficial": "Unofficial",
  "Official": "Official",
};

// teams.deleted_reason
export const TeamDeletedReasonEnum = z.enum(["no_registration", "leader_deleted", "inactive_6_months"]);
export type TeamDeletedReason = z.infer<typeof TeamDeletedReasonEnum>;
export const TeamDeletedReasonOptions = TeamDeletedReasonEnum.options;
export const TeamDeletedReasonLabel: Record<TeamDeletedReason, string> = {
  "no_registration": "No registration on record",
  "leader_deleted": "Deleted by leader",
  "inactive_6_months": "Inactive 6+ months",
};

// team_members.position
export const TeamMemberPositionEnum = z.enum(["starter", "substitute"]);
export type TeamMemberPosition = z.infer<typeof TeamMemberPositionEnum>;
export const TeamMemberPositionOptions = TeamMemberPositionEnum.options;
export const TeamMemberPositionLabel: Record<TeamMemberPosition, string> = {
  "starter": "Starter",
  "substitute": "Substitute",
};

// team_invitations.team_invitation_status
export const TeamInvitationStatusEnum = z.enum(["pending", "accepted", "rejected", "expired"]);
export type TeamInvitationStatus = z.infer<typeof TeamInvitationStatusEnum>;
export const TeamInvitationStatusOptions = TeamInvitationStatusEnum.options;
export const TeamInvitationStatusLabel: Record<TeamInvitationStatus, string> = {
  "pending": "Pending",
  "accepted": "Accepted",
  "rejected": "Rejected",
  "expired": "Expired",
};

// team_admin_requests.request_type
export const TeamAdminRequestTypeEnum = z.enum(["official_status", "leader_transfer"]);
export type TeamAdminRequestType = z.infer<typeof TeamAdminRequestTypeEnum>;
export const TeamAdminRequestTypeOptions = TeamAdminRequestTypeEnum.options;
export const TeamAdminRequestTypeLabel: Record<TeamAdminRequestType, string> = {
  "official_status": "Request Official status",
  "leader_transfer": "Transfer leadership",
};

// team_admin_requests.team_admin_request_status
export const TeamAdminRequestStatusEnum = z.enum(["pending", "approved", "rejected"]);
export type TeamAdminRequestStatus = z.infer<typeof TeamAdminRequestStatusEnum>;
export const TeamAdminRequestStatusOptions = TeamAdminRequestStatusEnum.options;
export const TeamAdminRequestStatusLabel: Record<TeamAdminRequestStatus, string> = {
  "pending": "Pending",
  "approved": "Approved",
  "rejected": "Rejected",
};


// ───────── กลุ่ม 4 — ทัวร์นาเมนต์ ─────────

// tournaments.bracket_format
export const BracketFormatEnum = z.enum(["single_elimination", "double_elimination", "round_robin"]);
export type BracketFormat = z.infer<typeof BracketFormatEnum>;
export const BracketFormatOptions = BracketFormatEnum.options;
export const BracketFormatLabel: Record<BracketFormat, string> = {
  "single_elimination": "Single elimination",
  "double_elimination": "Double elimination",
  "round_robin": "Round robin",
};

// tournaments.scope_type  ⚠️ ⚠️ 'university' รอ Change Management
export const TournamentScopeTypeEnum = z.enum(["department", "faculty", "university"]);
export type TournamentScopeType = z.infer<typeof TournamentScopeTypeEnum>;
export const TournamentScopeTypeOptions = TournamentScopeTypeEnum.options;
export const TournamentScopeTypeLabel: Record<TournamentScopeType, string> = {
  "department": "Department",
  "faculty": "Faculty",
  "university": "University-wide",
};

// tournaments.organizer_external_approval_status, tournament_referees.external_approval_status  ⚠️ ⚠️ external Organizer รอ Change Management
export const ExternalApprovalStatusEnum = z.enum(["not_required", "pending", "approved", "rejected"]);
export type ExternalApprovalStatus = z.infer<typeof ExternalApprovalStatusEnum>;
export const ExternalApprovalStatusOptions = ExternalApprovalStatusEnum.options;
export const ExternalApprovalStatusLabel: Record<ExternalApprovalStatus, string> = {
  "not_required": "Not required",
  "pending": "Pending review",
  "approved": "Approved",
  "rejected": "Rejected",
};

// tournaments.tournament_status
export const TournamentStatusEnum = z.enum(["pending_approval", "rejected", "private", "public", "completed", "auto_deleted"]);
export type TournamentStatus = z.infer<typeof TournamentStatusEnum>;
export const TournamentStatusOptions = TournamentStatusEnum.options;
export const TournamentStatusLabel: Record<TournamentStatus, string> = {
  "pending_approval": "Pending admin approval",
  "rejected": "Rejected",
  "private": "Private (draft)",
  "public": "Public",
  "completed": "Completed",
  "auto_deleted": "Auto-deleted",
};

// tournaments.gender_requirement
export const GenderRequirementEnum = z.enum(["any", "male", "female"]);
export type GenderRequirement = z.infer<typeof GenderRequirementEnum>;
export const GenderRequirementOptions = GenderRequirementEnum.options;
export const GenderRequirementLabel: Record<GenderRequirement, string> = {
  "any": "Open to all",
  "male": "Male only",
  "female": "Female only",
};

// tournament_eligibility_rules.rule_type
export const EligibilityRuleTypeEnum = z.enum(["year", "faculty"]);
export type EligibilityRuleType = z.infer<typeof EligibilityRuleTypeEnum>;
export const EligibilityRuleTypeOptions = EligibilityRuleTypeEnum.options;
export const EligibilityRuleTypeLabel: Record<EligibilityRuleType, string> = {
  "year": "Year restriction",
  "faculty": "Faculty restriction",
};

// tournament_amendment_requests.tournament_amendment_request_status
export const TournamentAmendmentRequestStatusEnum = z.enum(["pending", "approved", "rejected"]);
export type TournamentAmendmentRequestStatus = z.infer<typeof TournamentAmendmentRequestStatusEnum>;
export const TournamentAmendmentRequestStatusOptions = TournamentAmendmentRequestStatusEnum.options;
export const TournamentAmendmentRequestStatusLabel: Record<TournamentAmendmentRequestStatus, string> = {
  "pending": "Pending",
  "approved": "Approved",
  "rejected": "Rejected",
};

// tournament_referees.invitation_status
export const RefereeInvitationStatusEnum = z.enum(["pending", "accepted", "rejected"]);
export type RefereeInvitationStatus = z.infer<typeof RefereeInvitationStatusEnum>;
export const RefereeInvitationStatusOptions = RefereeInvitationStatusEnum.options;
export const RefereeInvitationStatusLabel: Record<RefereeInvitationStatus, string> = {
  "pending": "Pending",
  "accepted": "Accepted",
  "rejected": "Rejected",
};

// tournament_applications.tournament_application_status
export const TournamentApplicationStatusEnum = z.enum(["pending", "approved", "rejected", "cancelled", "withdrawn"]);
export type TournamentApplicationStatus = z.infer<typeof TournamentApplicationStatusEnum>;
export const TournamentApplicationStatusOptions = TournamentApplicationStatusEnum.options;
export const TournamentApplicationStatusLabel: Record<TournamentApplicationStatus, string> = {
  "pending": "Pending review",
  "approved": "Approved",
  "rejected": "Rejected",
  "cancelled": "Cancelled by applicant",
  "withdrawn": "Withdrawn",
};


// ───────── กลุ่ม 5 — สาย/แมตช์/เช็คอิน/ผล ─────────

// bracket_nodes.bracket_type
export const BracketTypeEnum = z.enum(["winners", "losers", "grand_final"]);
export type BracketType = z.infer<typeof BracketTypeEnum>;
export const BracketTypeOptions = BracketTypeEnum.options;
export const BracketTypeLabel: Record<BracketType, string> = {
  "winners": "Winners bracket",
  "losers": "Losers bracket",
  "grand_final": "Grand final",
};

// matches.match_status
export const MatchStatusEnum = z.enum(["scheduled", "checkin_open", "in_progress", "completed", "disputed"]);
export type MatchStatus = z.infer<typeof MatchStatusEnum>;
export const MatchStatusOptions = MatchStatusEnum.options;
export const MatchStatusLabel: Record<MatchStatus, string> = {
  "scheduled": "Scheduled",
  "checkin_open": "Check-in open",
  "in_progress": "In progress",
  "completed": "Completed",
  "disputed": "Disputed",
};

// match_checkins.method
export const CheckinMethodEnum = z.enum(["qr_onsite", "photo_online", "manual_by_referee"]);
export type CheckinMethod = z.infer<typeof CheckinMethodEnum>;
export const CheckinMethodOptions = CheckinMethodEnum.options;
export const CheckinMethodLabel: Record<CheckinMethod, string> = {
  "qr_onsite": "QR (on-site)",
  "photo_online": "Photo upload (online)",
  "manual_by_referee": "Manual by referee",
};

// match_checkins.match_checkin_status
export const MatchCheckinStatusEnum = z.enum(["success", "rejected", "exception"]);
export type MatchCheckinStatus = z.infer<typeof MatchCheckinStatusEnum>;
export const MatchCheckinStatusOptions = MatchCheckinStatusEnum.options;
export const MatchCheckinStatusLabel: Record<MatchCheckinStatus, string> = {
  "success": "Success",
  "rejected": "Rejected",
  "exception": "Exception",
};

// match_checkins.document_type
export const CheckinDocumentTypeEnum = z.enum(["student_id", "national_id"]);
export type CheckinDocumentType = z.infer<typeof CheckinDocumentTypeEnum>;
export const CheckinDocumentTypeOptions = CheckinDocumentTypeEnum.options;
export const CheckinDocumentTypeLabel: Record<CheckinDocumentType, string> = {
  "student_id": "Student ID",
  "national_id": "National ID",
};

// match_results.submitted_role
export const ResultSubmittedRoleEnum = z.enum(["team_leader", "referee"]);
export type ResultSubmittedRole = z.infer<typeof ResultSubmittedRoleEnum>;
export const ResultSubmittedRoleOptions = ResultSubmittedRoleEnum.options;
export const ResultSubmittedRoleLabel: Record<ResultSubmittedRole, string> = {
  "team_leader": "Team leader",
  "referee": "Referee",
};

// match_results.match_result_status
export const MatchResultStatusEnum = z.enum(["submitted", "verified", "disputed", "rejected"]);
export type MatchResultStatus = z.infer<typeof MatchResultStatusEnum>;
export const MatchResultStatusOptions = MatchResultStatusEnum.options;
export const MatchResultStatusLabel: Record<MatchResultStatus, string> = {
  "submitted": "Submitted",
  "verified": "Verified",
  "disputed": "Disputed",
  "rejected": "Rejected",
};

// sport_stat_definitions.data_type
export const StatDataTypeEnum = z.enum(["integer", "decimal", "boolean"]);
export type StatDataType = z.infer<typeof StatDataTypeEnum>;
export const StatDataTypeOptions = StatDataTypeEnum.options;
export const StatDataTypeLabel: Record<StatDataType, string> = {
  "integer": "Integer",
  "decimal": "Decimal",
  "boolean": "Boolean",
};


// ───────── กลุ่ม 6 — ประกาศ/ฟีดแบ็ก/รางวัล ─────────

// announcements.announcement_type
export const AnnouncementTypeEnum = z.enum(["general", "schedule_change", "venue_change", "result", "livestream"]);
export type AnnouncementType = z.infer<typeof AnnouncementTypeEnum>;
export const AnnouncementTypeOptions = AnnouncementTypeEnum.options;
export const AnnouncementTypeLabel: Record<AnnouncementType, string> = {
  "general": "General",
  "schedule_change": "Schedule change",
  "venue_change": "Venue change",
  "result": "Result",
  "livestream": "Livestream",
};

// tournament_feedback.feedback_type
export const FeedbackTypeEnum = z.enum(["comment", "organizer_feedback", "mvp_vote"]);
export type FeedbackType = z.infer<typeof FeedbackTypeEnum>;
export const FeedbackTypeOptions = FeedbackTypeEnum.options;
export const FeedbackTypeLabel: Record<FeedbackType, string> = {
  "comment": "Comment",
  "organizer_feedback": "Organizer feedback",
  "mvp_vote": "MVP vote",
};

// rewards.reward_type
export const RewardTypeEnum = z.enum(["badge", "achievement"]);
export type RewardType = z.infer<typeof RewardTypeEnum>;
export const RewardTypeOptions = RewardTypeEnum.options;
export const RewardTypeLabel: Record<RewardType, string> = {
  "badge": "Badge",
  "achievement": "Achievement",
};

// point_transactions.source
export const PointTransactionSourceEnum = z.enum(["pickem_correct", "reward_redeem", "admin_adjustment", "other"]);
export type PointTransactionSource = z.infer<typeof PointTransactionSourceEnum>;
export const PointTransactionSourceOptions = PointTransactionSourceEnum.options;
export const PointTransactionSourceLabel: Record<PointTransactionSource, string> = {
  "pickem_correct": "Correct Pick'em",
  "reward_redeem": "Reward redeemed",
  "admin_adjustment": "Admin adjustment",
  "other": "Other",
};

