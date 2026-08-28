/**
 * src/mocks/reference.mock.ts
 * ⚠️ ตัวเลข min/max/รายชื่อ เป็นค่าจำลองเพื่อ dev เท่านั้น ไม่ใช่ของจริงจาก DB
 * (schema.sql กำหนดแค่ "มีคอลัมน์นี้" ไม่ได้กำหนดค่าจริง — ค่าจริงมาจาก seed data ของ backend ผ่าน R01-R03)
 * รายชื่อคณะอิงจาก FACS ใน ltms-prototype.html, ตัวเลขกีฬาอิงจาก SPORT_MIN ในไฟล์เดียวกัน
 */
import type { Faculty, Department, SportType } from "../types/dto";

export const mockFaculties: Faculty[] = [
  { id: 1, name: "Engineering" },
  { id: 2, name: "Science" },
  { id: 3, name: "Medicine" },
  { id: 4, name: "Law" },
  { id: 5, name: "Architecture" },
  { id: 6, name: "Nursing" },
  { id: 7, name: "Business Admin" },
  { id: 8, name: "Education" },
];

export const mockDepartments: Department[] = [
  { id: 1, name: "General", facultyId: 1 },
  { id: 2, name: "Computer Engineering", facultyId: 1 },
  { id: 3, name: "Physics", facultyId: 2 },
  { id: 4, name: "Biology", facultyId: 2 },
];

export const mockSportTypes: SportType[] = [
  { id: 1, name: "Football", minMembers: 7, maxMembers: 18, defaultMode: "onsite" },
  { id: 2, name: "Futsal", minMembers: 5, maxMembers: 12, defaultMode: "onsite" },
  { id: 3, name: "Basketball", minMembers: 5, maxMembers: 12, defaultMode: "onsite" },
  { id: 4, name: "Volleyball", minMembers: 6, maxMembers: 14, defaultMode: "onsite" },
  { id: 5, name: "Badminton", minMembers: 2, maxMembers: 6, defaultMode: "onsite" },
  { id: 6, name: "VALORANT", minMembers: 5, maxMembers: 8, defaultMode: "online" },
  { id: 7, name: "ROV", minMembers: 5, maxMembers: 8, defaultMode: "online" },
  { id: 8, name: "Chess", minMembers: 1, maxMembers: 3, defaultMode: "onsite" },
];
