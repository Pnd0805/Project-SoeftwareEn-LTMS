import { z } from "zod";
import {
  BracketFormatEnum,
  EligibilityRuleTypeEnum,
  GenderRequirementEnum,
  TournamentStatusEnum,
} from "../types/enums";

// ช่องวันที่พิมพ์ได้เองต้องกันวันที่ไม่มีจริง เช่น 31 ก.พ. เหมือน native date input เดิม
const dateSchema = z.iso.date({ error: "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)" });

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
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)]).nullable().optional(),
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

/**
 * วันที่ตามเวลาไทย (YYYY-MM-DD) ของวันเวลาปิดรับสมัคร
 * ★ ค่าจาก `<input type="datetime-local">` ไม่มีเขตเวลา (เช่น `2026-10-05T17:00`) = เวลาไทยที่ผู้ใช้พิมพ์ ⇒ ตัดวันที่ได้เลย
 *   ค่าจาก backend มีเขตเวลา (`…Z` / `+07:00`) ⇒ แปลงเป็นเวลาไทย +07:00 ก่อนตัดวันที่
 */
const thaiDateOf = (value: string): string | null => {
  if (/^\d{4}-\d{2}-\d{2}T[^Z+-]*$/.test(value)) return value.slice(0, 10);
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10) : null;
};

/**
 * ตรงกับ backend `ensureSchedule` — แก้ 30 ต.ค. 2569: **วันแข่งวันแรกต้องไม่ก่อนวันปิดรับสมัคร** (วันเดียวกันได้)
 * เดิมเทียบเวลาปิดรับสมัครกับเที่ยงคืน UTC ของวันแข่ง ⇒ ปิดรับสมัครวันเดียวกับวันแข่งวันแรกไม่ได้
 */
export const registrationClosesByEventDay = (registrationEnd: string | null, eventStartDate: string): boolean => {
  if (!registrationEnd || !/^\d{4}-\d{2}-\d{2}$/.test(eventStartDate)) return false;
  const closeDay = thaiDateOf(registrationEnd);
  return closeDay !== null && closeDay <= eventStartDate;
};

export const createTournamentSchema = tournamentFieldsSchema.refine((value) => value.minTeams <= value.maxTeams, {
  message: "จำนวนทีมขั้นต่ำต้องไม่มากกว่าจำนวนทีมสูงสุด",
  path: ["minTeams"],
}).refine((value) => new Date(value.registrationStart) < new Date(value.registrationEnd), {
  message: "วันปิดรับสมัครต้องอยู่หลังวันเปิดรับสมัคร",
  path: ["registrationEnd"],
}).refine((value) => registrationClosesByEventDay(value.registrationEnd, value.eventStartDate), {
  message: "วันแข่งวันแรกต้องไม่ก่อนวันปิดรับสมัคร",
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

/* P01: ของจริงบังคับ playerIds ส่วนโหมด prototype เลือกผู้เล่นด้วย id ของ store จึง
   ปล่อยเป็น optional ตรงนี้ แล้วให้ฟอร์มเป็นคนบังคับตามโหมด (ดู RegisterForm) */
export const applyToTournamentSchema = z.object({
  teamId: z.number().int().positive(),
  playerIds: z.array(z.number().int().positive())
    .refine((ids) => new Set(ids).size === ids.length, "มีรายชื่อผู้เล่นซ้ำกัน")
    .optional(),
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
  type: z.enum(['general', 'schedule_change', 'venue_change', 'result', 'livestream']).optional(),
  title: z.string().trim().min(1, "กรุณาระบุหัวข้อประกาศ").max(255),
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
