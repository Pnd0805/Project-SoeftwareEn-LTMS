import { z } from "zod";
import {
  BracketFormatEnum,
  EligibilityRuleTypeEnum,
  GenderRequirementEnum,
  TournamentStatusEnum,
} from "../types/enums";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");

/**
 * ช่อง datetime-local ของเบราว์เซอร์ให้ค่ามาแบบ "2026-09-18T21:00" ซึ่งไม่มีโซนเวลา
 * เติมโซนเวลาของเครื่องให้ก่อนตรวจ จะได้ส่ง "+07:00" ไป ไม่ใช่รูปแบบ Z
 * (backend เอาค่าไปใส่ MySQL ตรงๆ แล้วพังเป็น 500 ถ้าเป็น Z — แจ้งทีม backend ไว้แล้ว)
 */
const pad2 = (n: number) => String(Math.trunc(n)).padStart(2, "0");
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const isoWithOffset = z.string().datetime({ offset: true });
const withLocalOffset = (value: string) => {
  const minutes = -new Date(value).getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  return `${value}:00${sign}${pad2(Math.abs(minutes) / 60)}:${pad2(Math.abs(minutes) % 60)}`;
};
const dateTimeSchema = z.string()
  .refine((value) => localDateTimePattern.test(value) || isoWithOffset.safeParse(value).success, {
    message: "รูปแบบวันเวลาไม่ถูกต้อง",
  })
  .transform((value) => (localDateTimePattern.test(value) ? withLocalOffset(value) : value));

const tournamentFieldsSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อการแข่งขัน").max(200, "ชื่อการแข่งขันต้องไม่เกิน 200 ตัวอักษร"),
  sportTypeId: z.number().int().positive(),
  bracketFormat: BracketFormatEnum.nullable().optional(),
  /* MVP รับแค่ระดับภาควิชากับคณะ — 'university' มีในฐานข้อมูลแต่ยังรอ Change Management
     (API Design Part 3 · OpenAPI ของ POST /tournaments รับแค่สองค่านี้) */
  scopeType: z.enum(["department", "faculty"], { message: "เลือกได้เฉพาะระดับภาควิชาหรือคณะ" }),
  organizingFacultyId: z.number().int().positive().nullable().optional(),
  organizingDepartmentId: z.number().int().positive().nullable().optional(),
  /* backend บังคับครบทั้งสี่วัน และต้องเรียงกัน (tournament.service ensureSchedule) */
  registrationStart: dateTimeSchema,
  registrationEnd: dateTimeSchema,
  eventStartDate: dateSchema,
  eventEndDate: dateSchema,
  maxTeams: z.number().int().positive("จำนวนทีมต้องมากกว่า 0"),
  minTeams: z.number().int().positive("จำนวนทีมต้องมากกว่า 0"),
  venue: z.string().trim().min(1, "กรุณาระบุสนามแข่งขัน").max(255),
  disputeWindowHours: z.number().int().nonnegative().optional(),
  genderRequirement: GenderRequirementEnum.optional(),
  minAge: z.number().int().nonnegative().nullable().optional(),
  maxAge: z.number().int().nonnegative().nullable().optional(),
  /* คณะและชั้นปีที่เปิดรับ — ฟอร์มเก็บเป็นสองลิสต์เพราะกรอกเป็นติ๊กถูก ส่วน backend
     รับเป็นลิสต์เดียว [{type,value}] แปลงกันตอนส่ง (ดู toEligibilityRules)
     ว่างทั้งคู่ = ไม่จำกัด · ชั้นปี backend รับ 1–8 (normalizeEligibilityRules) */
  eligibilityFacultyIds: z.array(z.number().int().positive()).max(50).optional(),
  eligibilityYears: z.array(z.number().int().min(1).max(8)).max(8).optional(),
});

/** สองลิสต์ของฟอร์ม → รูปที่ C01/C09 รับ · ไม่มีอะไรเลยคืน `[]` = ไม่จำกัด */
export const toEligibilityRules = (
  facultyIds: number[] = [],
  years: number[] = [],
): Array<{ type: "faculty" | "year"; value: number }> => [
  ...facultyIds.map((value) => ({ type: "faculty" as const, value })),
  ...years.map((value) => ({ type: "year" as const, value })),
];

/** Mirrors backend `ensureSchedule`: a date-only event starts at 00:00 UTC. */
export const registrationClosesBeforeEvent = (registrationEnd: string | null, eventStartDate: string): boolean => {
  if (!registrationEnd || !eventStartDate) return false;
  const registrationEndMs = new Date(registrationEnd).getTime();
  const eventStartMs = new Date(eventStartDate).getTime();
  return Number.isFinite(registrationEndMs) && Number.isFinite(eventStartMs) && registrationEndMs < eventStartMs;
};

export const createTournamentSchema = tournamentFieldsSchema.refine((value) => value.minTeams <= value.maxTeams, {
  message: "จำนวนทีมขั้นต่ำต้องไม่มากกว่าจำนวนทีมสูงสุด",
  path: ["minTeams"],
}).refine((value) => new Date(value.registrationStart) < new Date(value.registrationEnd), {
  message: "วันปิดรับสมัครต้องอยู่หลังวันเปิดรับสมัคร",
  path: ["registrationEnd"],
}).refine((value) => registrationClosesBeforeEvent(value.registrationEnd, value.eventStartDate), {
  message: "วันแข่งวันแรกต้องอยู่หลังวันปิดรับสมัคร",
  path: ["eventStartDate"],
}).refine((value) => value.eventEndDate >= value.eventStartDate, {
  message: "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น",
  path: ["eventEndDate"],
}).refine((value) => value.minAge == null || value.maxAge == null || value.minAge <= value.maxAge, {
  message: "อายุขั้นต่ำต้องไม่มากกว่าอายุสูงสุด",
  path: ["minAge"],
/* ระดับการแข่งขันผูกกับหน่วยงานที่จัด — backend เช็คคู่นี้ใน ensureCreateReferences */
}).refine((value) => value.organizingFacultyId != null, {
  message: "กรุณาเลือกคณะที่จัดการแข่งขัน",
  path: ["organizingFacultyId"],
}).refine((value) => value.scopeType !== "department" || value.organizingDepartmentId != null, {
  message: "ระดับภาควิชาต้องเลือกภาควิชาที่จัด",
  path: ["organizingDepartmentId"],
}).refine((value) => value.scopeType !== "faculty" || value.organizingDepartmentId == null, {
  message: "ระดับคณะต้องไม่ระบุภาควิชา",
  path: ["organizingDepartmentId"],
});

export const updateTournamentSchema = tournamentFieldsSchema.partial().extend({
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
