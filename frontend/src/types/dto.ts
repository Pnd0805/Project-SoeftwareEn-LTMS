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
  facultyId?: number;
  departmentId?: number;
  year?: number;
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
  showProfileStats?: boolean;
  adminScope?: { id: number; scopeType: 'faculty' | 'university_wide' | 'root'; facultyId: number | null } | null;
  id: number;
  fullName: string;
  email: string;
  userType: UserType;
  gender: Gender;
  birthDate: string;
  facultyId: number | null;
  departmentId: number | null;
  year: number | null;
  avatarUrl: string | null;
  contactInfo: string | null;
  address: string | null;
  totalPoints: number;
  notificationPrefs: Record<string, unknown> | null;
  createdAt: string; // ISO 8601 พร้อม timezone เช่น "2026-08-02T14:30:00+07:00"
}

// U02 PATCH /me — avatarUrl ขาเข้ารับ objectKey จาก presign (หรือ null เพื่อลบ), ขาอ่านคืน public URL
export type UpdateMeRequest = Partial<
  Pick<MeDto, "avatarUrl" | "contactInfo" | "address" | "showProfileStats">
>;

export interface UserRef {
  id: number;
  fullName: string;
  avatarUrl: string | null;
}

// U03 — ต้องไม่มี email/contactInfo/address โดยเด็ดขาด (คนละ mapper กับ MeDto)
export interface PublicUserDto extends UserRef {
  facultyId: number | null;
  departmentId: number | null;
  teams: TeamRef[];
  /** OD-46 — เจ้าของปิดสถิติโปรไฟล์ไว้ ⇒ U04/U14/RW05 จะได้ null · รู้ได้ตั้งแต่ request แรก ไม่ต้องยิงสามเส้นก่อน */
  statsHidden?: boolean;
}

// placeholder ชั่วคราวจนกว่าจะทำ Step 4 (Teams) — แค่พอให้ PublicUserDto compile ผ่าน
export interface TeamRef {
  id: number;
  name: string;
  /** OD-61 — URL สาธารณะ · null = ยังไม่อัปโลโก้ (ต้องมีรูปแทน ไม่ใช่ซ่อนทีม) */
  logoUrl?: string | null;
}

export interface UserStatsDto {
  userId: number;
  /** OD-46 — true = เจ้าของปิดไว้ ช่องข้างล่างเป็น null (ไม่ใช่ 0 — 0 อ่านว่า "ลงแข่งแต่ไม่เคยชนะ") */
  statsHidden?: boolean;
  overall: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    championCount: number;
  } | null;
  bySport: Array<{
    sportTypeId: number;
    sportName: string;
    matchesPlayed: number;
    wins: number;
    losses: number;
  }> | null;
  /** ยอดโหวต MVP ที่ได้รับ — ตัวรอง ห้ามติดป้ายว่า "MVP" (โตตามจำนวนคนดู ไม่ใช่ฝีมือ) */
  mvpVotes?: number | null;
  /** OD-60 — จำนวนครั้งที่ได้เป็น MVP (โหวตสูงสุดในแมตช์ และอย่างน้อย 3 ใบ) — ตัวหลัก */
  mvpTimes?: number | null;
}

export interface UserSearchItem extends UserRef {
  facultyName: string | null;
  year: number | null;
}
export interface UserSearchResult {
  items: UserSearchItem[];
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
  supportsBestOf?: boolean;
  id: number;
  name: string;
  minMembers: number;
  maxMembers: number;
  defaultMode: Mode;
  /**
   * OD-63 (5 ต.ค.) — กฎ Pick'em ของกีฬานี้ · คีย์ชื่อเดียวกันโดยเจตนา (tolerance[tier] คู่กับ points[tier])
   * ความคลาดวัด "ต่อฝั่ง" ยึดฝั่งที่แย่กว่า ไม่ใช่ผลรวม · อยู่ในฐาน ผู้จัดแก้ได้ ⇒ ห้าม hardcode
   * spotOn === close (แบด/RoV/VALORANT = 0,0) คือเจตนา — ชั้นกลางไม่มีทางเกิด
   */
  pickemTolerance?: { spotOn: number; close: number };
  pickemPoints?: { spotOn: number; close: number; sideOnly: number };
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
  details?: unknown;
  /** Endpoint-specific metadata เช่น players, tournaments หรือ min/max ของ squad */
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}
