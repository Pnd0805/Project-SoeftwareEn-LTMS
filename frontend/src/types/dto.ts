/**
 * src/types/dto.ts
 *
 * DTO = รูปข้อมูล (camelCase) ที่ frontend ได้จาก API จริง ตรงตาม mapper ฝั่ง backend
 * อ้างอิงจาก GUIDE/06 - Endpoint Reference MVP 93 แถว A01-A03, U01-U04, U06, R01-R03, R05
 *
 * ขอบเขตไฟล์นี้ (รอบนี้ทำแค่ Step 1-2 ของ backend roadmap): Auth + Users + Reference data
 * ที่เหลือ (Team/Tournament/Match/Result/...) ค่อยเพิ่มทีหลังตามจังหวะที่ backend ทำ endpoint เสร็จ
 * ห้ามเดา field ล่วงหน้าเองสำหรับ endpoint ที่ยังไม่เห็นใน GUIDE/06 — เพิ่มตอนถึงคิวจริงเท่านั้น
 */
import type { Gender, UserType, Mode, StatDataType } from "./enums";

// ══════════════ Auth — A01-A03 ══════════════
export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  gender: Gender;
  birthDate: string; // "YYYY-MM-DD"
  facultyId: number;
  departmentId: number;
  year: number;
}
export interface RegisterResponse {
  id: number;
  fullName: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  accessToken: string;
  expiresIn: number; // วินาที เช่น 604800
  tokenType: "Bearer";
  user: {
    id: number;
    fullName: string;
    userType: UserType;
  };
}

// ══════════════ Users & Profile — U01-U04, U06 ══════════════
export interface MeDto {
  id: number;
  fullName: string;
  email: string;
  gender: Gender;
  birthDate: string;
  facultyId: number;
  departmentId: number;
  year: number;
  avatarUrl: string | null;
  contactInfo: string | null;
  address: string | null;
  totalPoints: number;
  notificationPrefs: Record<string, unknown> | null;
  createdAt: string; // ISO 8601 พร้อม timezone เช่น "2026-08-02T14:30:00+07:00"
}

// U02 PATCH /me — allowlist 3 field เท่านั้น (GUIDE/06 เตือนไว้ ห้ามเพิ่มเอง)
export type UpdateMeRequest = Partial<
  Pick<MeDto, "avatarUrl" | "contactInfo" | "address">
>;

export interface UserRef {
  id: number;
  fullName: string;
  avatarUrl: string | null;
}

// U03 — ต้องไม่มี email/contactInfo/address โดยเด็ดขาด (คนละ mapper กับ MeDto)
export interface PublicUserDto extends UserRef {
  facultyId: number;
  departmentId: number;
  teams: TeamRef[];
}

// placeholder ชั่วคราวจนกว่าจะทำ Step 4 (Teams) — แค่พอให้ PublicUserDto compile ผ่าน
export interface TeamRef {
  id: number;
  name: string;
}

export interface UserStatsDto {
  userId: number;
  overall: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    championCount: number;
  };
  bySport: Array<{
    sportTypeId: number;
    sportName: string;
    matchesPlayed: number;
    wins: number;
    losses: number;
  }>;
}

export interface UserSearchResult {
  items: UserRef[];
}

// ══════════════ Reference data — R01-R03, R05 ══════════════
export interface Faculty {
  id: number;
  name: string;
}
export interface Department {
  id: number;
  name: string;
  facultyId: number;
}
export interface SportType {
  id: number;
  name: string;
  minMembers: number;
  maxMembers: number;
  defaultMode: Mode;
}
export interface StatDefinition {
  statDefinitionId: number;
  statKey: string;
  statLabelTh: string;
  dataType: StatDataType;
  displayOrder: number;
}

// ══════════════ Error shape ══════════════
// ตรงกับ AppError ฝั่ง backend (utils/AppError.ts + middlewares/errorHandler.ts)
export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}
