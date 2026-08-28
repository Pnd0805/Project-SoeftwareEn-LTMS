/**
 * src/mocks/user.mock.ts
 * mock in-memory "ตาราง users" — ใช้แทน DB ตอนยังไม่มี backend
 * persona 5 คนตั้งตาม ltms-prototype.html (คนละหน้าที่ ล็อกอินสลับได้) แต่ field ตรงกับ MeDto จริง
 * ⚠️ passwordForMock/userType อยู่ในนี้เพื่อให้ mockLogin ใช้เช็คได้เท่านั้น ห้ามส่งออกจาก api/user.ts
 */
import type { MeDto } from "../types/dto";
import type { UserType } from "../types/enums";

export interface MockUserRecord extends MeDto {
  userType: UserType;
  passwordForMock: string;
}

export const mockUsers: MockUserRecord[] = [
  {
    id: 1, fullName: "Rattana Admin", email: "admin@ltms.test",
    gender: "female", birthDate: "1985-03-14", facultyId: 1, departmentId: 1, year: 0,
    avatarUrl: null, contactInfo: null, address: null, totalPoints: 0,
    notificationPrefs: null, createdAt: "2025-01-01T00:00:00+07:00",
    userType: "staff", passwordForMock: "password123",
  },
  {
    id: 2, fullName: "Thanwa Sirichai", email: "organizer@ltms.test",
    gender: "male", birthDate: "2003-05-20", facultyId: 1, departmentId: 1, year: 4,
    avatarUrl: null, contactInfo: null, address: null, totalPoints: 120,
    notificationPrefs: null, createdAt: "2025-06-01T00:00:00+07:00",
    userType: "student", passwordForMock: "password123",
  },
  {
    id: 3, fullName: "Kittipong Rojana", email: "referee@ltms.test",
    gender: "male", birthDate: "2003-02-11", facultyId: 2, departmentId: 3, year: 4,
    avatarUrl: null, contactInfo: null, address: null, totalPoints: 40,
    notificationPrefs: null, createdAt: "2025-06-01T00:00:00+07:00",
    userType: "student", passwordForMock: "password123",
  },
  {
    id: 4, fullName: "Sirawit Kanchana", email: "leader@ltms.test",
    gender: "male", birthDate: "2004-09-03", facultyId: 1, departmentId: 2, year: 3,
    avatarUrl: null, contactInfo: null, address: null, totalPoints: 85,
    notificationPrefs: null, createdAt: "2025-06-01T00:00:00+07:00",
    userType: "student", passwordForMock: "password123",
  },
  {
    id: 5, fullName: "Mongkol Thanit", email: "player@ltms.test",
    // วันเกิดนี้ตั้งใจให้ตกกฎอายุ (ทดสอบ Hard Filter P01 ทีหลัง) — คัดลอกเจตนาจาก prototype
    gender: "male", birthDate: "2009-06-02", facultyId: 1, departmentId: 2, year: 1,
    avatarUrl: null, contactInfo: null, address: null, totalPoints: 10,
    notificationPrefs: null, createdAt: "2025-10-01T00:00:00+07:00",
    userType: "student", passwordForMock: "password123",
  },
];

export let nextMockUserId = mockUsers.length + 1;
export function takeNextMockUserId(): number {
  return nextMockUserId++;
}
