import { z } from "zod";
import {
  BracketFormatEnum,
  EligibilityRuleTypeEnum,
  GenderRequirementEnum,
  TournamentScopeTypeEnum,
  TournamentStatusEnum,
} from "../types/enums";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
const dateTimeSchema = z.string().datetime({ offset: true, message: "รูปแบบวันเวลาไม่ถูกต้อง" });

export const createTournamentSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อการแข่งขัน").max(200, "ชื่อการแข่งขันต้องไม่เกิน 200 ตัวอักษร"),
  sportTypeId: z.number().int().positive(),
  bracketFormat: BracketFormatEnum.nullable().optional(),
  scopeType: TournamentScopeTypeEnum,
  organizingFacultyId: z.number().int().positive().nullable().optional(),
  organizingDepartmentId: z.number().int().positive().nullable().optional(),
  eventStartDate: dateSchema,
  eventEndDate: dateSchema.nullable().optional(),
  maxTeams: z.number().int().positive("จำนวนทีมต้องมากกว่า 0"),
  minTeams: z.number().int().positive("จำนวนทีมต้องมากกว่า 0"),
  venue: z.string().trim().max(255).nullable().optional(),
  disputeWindowHours: z.number().int().nonnegative().optional(),
  genderRequirement: GenderRequirementEnum.optional(),
  minAge: z.number().int().nonnegative().nullable().optional(),
  maxAge: z.number().int().nonnegative().nullable().optional(),
}).refine((value) => value.minTeams <= value.maxTeams, {
  message: "จำนวนทีมขั้นต่ำต้องไม่มากกว่าจำนวนทีมสูงสุด",
  path: ["minTeams"],
}).refine((value) => !value.eventEndDate || value.eventEndDate >= value.eventStartDate, {
  message: "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น",
  path: ["eventEndDate"],
}).refine((value) => value.minAge == null || value.maxAge == null || value.minAge <= value.maxAge, {
  message: "อายุขั้นต่ำต้องไม่มากกว่าอายุสูงสุด",
  path: ["minAge"],
});

export const updateTournamentSchema = createTournamentSchema.partial().extend({
  registrationOpen: z.boolean().optional(),
  registrationStart: dateTimeSchema.nullable().optional(),
  registrationEnd: dateTimeSchema.nullable().optional(),
});

export const eligibilityRuleSchema = z.object({
  ruleType: EligibilityRuleTypeEnum,
  ruleValue: z.number().int().positive("ค่ากฎต้องมากกว่า 0"),
});

export const inviteTournamentRefereeSchema = z.object({
  userId: z.number().int().positive(),
  isExternal: z.boolean().optional(),
});

export const applyToTournamentSchema = z.object({
  teamId: z.number().int().positive(),
});

export const reviewTournamentApplicationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().trim().max(500).nullable().optional(),
}).refine((value) => value.status !== "rejected" || Boolean(value.rejectionReason), {
  message: "กรุณาระบุเหตุผลเมื่อไม่อนุมัติใบสมัคร",
  path: ["rejectionReason"],
});

export const tournamentStatusSchema = TournamentStatusEnum;

export const createTournamentAnnouncementSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุหัวข้อประกาศ").max(200),
  body: z.string().trim().min(1, "กรุณาระบุข้อความประกาศ").max(5000),
});

export const submitTournamentFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(600),
});

export const drawTournamentSchema = z.object({
  teamIds: z.array(z.number().int().positive()).min(2).optional(),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type EligibilityRuleInput = z.infer<typeof eligibilityRuleSchema>;
export type InviteTournamentRefereeInput = z.infer<typeof inviteTournamentRefereeSchema>;
export type ApplyToTournamentInput = z.infer<typeof applyToTournamentSchema>;
export type ReviewTournamentApplicationInput = z.infer<typeof reviewTournamentApplicationSchema>;
export type CreateTournamentAnnouncementInput = z.infer<typeof createTournamentAnnouncementSchema>;
export type SubmitTournamentFeedbackInput = z.infer<typeof submitTournamentFeedbackSchema>;
