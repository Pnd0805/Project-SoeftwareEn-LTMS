# LTMS — API Design ตอนที่ 3
## Request / Response Schema (MVP — 93 endpoint)

**เวอร์ชัน:** 0.1 (ร่างแรก)
**วันที่:** 2 สิงหาคม 2569
**ต่อจาก:** `LTMS_API_Design_Part0-1.md` (Conventions) และ `LTMS_API_Design_Part2.md` (Endpoint Matrix)
**ขอบเขต:** เฉพาะ 93 endpoint ที่ระบุ Sprint = MVP ในตอนที่ 2 (รวม R05 ที่เพิ่มรอบ 5) — Sprint #1/#2 (53 endpoint) ทำในตอนที่ 3.1 ภายหลัง
**ยังไม่รวม:** error catalog เต็ม (ตอนที่ 4 — ที่นี่ใส่แค่ error code ที่เกี่ยวข้องโดยตรง), OpenAPI YAML (ตอนที่ 5)

---

# 0. Shared Types

ใช้ซ้ำทั้งเอกสาร ไม่ประกาศซ้ำในแต่ละ endpoint

```ts
// Envelope มาตรฐาน (ตอนที่ 0–1 หัวข้อ 1.7)
type ListResponse<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

type ErrorResponse = {
  error: { code: string; message: string; fields?: Record<string, string> };
};

// อ้างอิงบุคคล/ทีมแบบย่อ — ใช้ฝัง (embed) ใน response อื่นแทนการ join เต็ม
type UserRef  = { id: number; fullName: string; avatarUrl: string | null };
type TeamRef  = { id: number; name: string; sportTypeId: number };

// วันเวลา — ISO 8601 + timezone เสมอ (ตอนที่ 0–1 หัวข้อ 1.12)
type ISODateTime = string;  // "2026-08-02T14:30:00+07:00"
type ISODate     = string;  // "2026-08-02"
```

**Pagination request (ใช้ร่วมกันทุก `GET` แบบ list):**
```
?page=1&pageSize=20&sort=createdAt&order=desc
```

---

# 1. Auth

### A01 — `POST /auth/register`
```ts
// Request
{
  fullName: string;        // 2–100 ตัวอักษร
  email: string;           // ต้องไม่ซ้ำ (FR-UM-01)
  password: string;        // ≥8 ตัว มีตัวเลข ≥1 ตัว
  gender: 'male' | 'female' | 'other';
  birthDate: ISODate;
  facultyId: number;
  departmentId: number;
  year: number;            // ชั้นปี
}

// Response 201
{ id: number; fullName: string; email: string }

// Error 400 (fields ตัวอย่าง)
{ error: { code: 'VALIDATION_FAILED', message: '...', fields: {
  email: 'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว',
  password: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษรและมีตัวเลขอย่างน้อย 1 ตัว'
}}}
```
> `facultyId`/`departmentId`/`year` เป็น self-report ตาม AS-04 — Hard Filter (P01) พึ่งข้อมูลนี้ ไม่ตรวจกับฐานทะเบียนจริง

### A02 — `POST /auth/login`
```ts
// Request
{ email: string; password: string }

// Response 200
{
  accessToken: string;
  expiresIn: number;       // วินาที — ปัจจุบัน 604800 (7 วัน)
  tokenType: 'Bearer';
  user: { id: number; fullName: string; userType: 'student' | 'staff' | 'external' };
}

// Error 401: ข้อมูลไม่ถูกต้อง
// Error 403: { code: 'ACCOUNT_SUSPENDED', message: 'บัญชีนี้ถูกระงับการใช้งาน' }
```

### A03 — `POST /auth/logout`
```ts
// Request: (ไม่มี body)
// Response 204 (ไม่มี body)
```

---

# 2. Users & Profile

### U01 — `GET /me`
```ts
// Response 200
{
  id: number; fullName: string; email: string;
  gender: string; birthDate: ISODate;
  facultyId: number; departmentId: number; year: number;
  avatarUrl: string | null; contactInfo: string | null; address: string | null;
  totalPoints: number;
  notificationPrefs: Record<string, boolean>;
  createdAt: ISODateTime;
}
```

### U02 — `PATCH /me`
```ts
// Request (ทุกฟิลด์ optional — ส่งเฉพาะที่จะแก้)
{ avatarUrl?: string; contactInfo?: string; address?: string }
// ★ ห้ามรับ email, password, facultyId ผ่าน endpoint นี้ — แยกไปที่ auth/change-password และไม่เปิดให้แก้คณะหลังสมัคร

// Response 200: เหมือน U01
```

### U03 — `GET /users/:id`
```ts
// Response 200 (สาธารณะ — ไม่มี email, contactInfo, address, totalPoints)
{
  id: number; fullName: string; avatarUrl: string | null;
  facultyId: number; departmentId: number;
  teams: TeamRef[];
}
// Error 404: ไม่พบผู้ใช้
```

### U04 — `GET /users/:id/stats`
```ts
// Response 200 (read-only, คำนวณจาก player_profile_stats)
{
  userId: number;
  overall: { matchesPlayed: number; wins: number; losses: number; winRate: number; championCount: number };
  bySport: Array<{ sportTypeId: number; sportName: string; matchesPlayed: number; wins: number; losses: number }>;
}
```

### U06 — `GET /users/search?q=`
```ts
// Query: q (string, ≥3 ตัวอักษร, บังคับ)
// Response 200 (ไม่ paginate — จำกัด 20 รายการตายตัว)
{ items: Array<{ id: number; fullName: string; avatarUrl: string | null }> }
// Error 400: { code: 'QUERY_TOO_SHORT', message: 'กรุณาพิมพ์อย่างน้อย 3 ตัวอักษร' }
```

---

# 3. Reference Data

### R01 — `GET /faculties`
```ts
// Response 200
{ items: Array<{ id: number; name: string }> }
```

### R02 — `GET /faculties/:id/departments`
```ts
// Response 200
{ items: Array<{ id: number; name: string; facultyId: number }> }
```

### R03 — `GET /sport-types`
```ts
// Response 200
{
  items: Array<{
    id: number; name: string;
    minMembers: number; maxMembers: number;
    defaultMode: 'onsite' | 'online';
  }>
}
// ★ frontend ใช้แสดงผลเท่านั้น ห้ามใช้ตัดสินแทน backend (DC-02)
```

---

# 4. Teams

### T01 — `POST /teams`
```ts
// Request
{ name: string; sportTypeId: number }

// Response 201
{ id: number; name: string; sportTypeId: number; readinessStatus: 'Forming'; leaderId: number }

// Error 409: { code: 'TEAM_NAME_TAKEN', message: 'มีทีมชื่อนี้ในประเภทกีฬานี้แล้ว' }
// Error 422: { code: 'TEAM_QUOTA_EXCEEDED', message: 'คุณมีทีม Unofficial ครบ 5 ทีมแล้ว' }  (BR-05)
```

### T02 — `GET /me/teams`
```ts
// Response 200 (ไม่ paginate — จำนวนทีมต่อคนจำกัดอยู่แล้วตาม BR-05)
{
  items: Array<{
    id: number; name: string; sportTypeId: number;
    readinessStatus: 'Forming' | 'Ready' | 'Inactive';
    officialStatus: 'unofficial' | 'pending' | 'official';
    memberCount: number; role: 'leader' | 'member';
  }>
}
```

### T03 — `GET /teams/:id`
```ts
// Response 200 (สาธารณะ)
{
  id: number; name: string; sportTypeId: number;
  readinessStatus: string; officialStatus: string;
  leader: UserRef;
  memberCount: number;
  createdAt: ISODateTime;
}
```

### T04 — `PATCH /teams/:id`
```ts
// Request
{ name?: string }

// Response 200: เหมือน T03
// ★ ถ้าทีม officialStatus='official' หรือมีการสมัครที่ approved อยู่ → บันทึกลง team_edit_log + แจ้ง Organizer ของทัวร์ที่เกี่ยวข้อง (ตาม FR-TM-04)
```

### T05 — `DELETE /teams/:id`
```ts
// Response 204
// Error 409: { code: 'TEAM_IN_COMPETITION', message: 'ทีมนี้กำลังอยู่ระหว่างการแข่งขัน กรุณาใช้การถอนตัวแทนการลบทีม',
//              suggestedAction: 'POST /applications/:applicationId/withdraw' }
```

### T06 — `GET /teams/:id/members`
```ts
// Response 200
{
  items: Array<{
    userId: number; fullName: string; avatarUrl: string | null;
    position: 'starter' | 'substitute';
    joinedAt: ISODateTime;
  }>
}
// ★ contactInfo ของสมาชิกไม่แสดงในนี้ ต้องเรียก U03 ต่อรายคนถ้าจำเป็น
```

### T07 — `PATCH /teams/:id/members/:uid`
```ts
// Request
{ position: 'starter' | 'substitute' }

// Response 200: { userId, position }
```

### T08 — `DELETE /teams/:id/members/:uid`
```ts
// Response 204
// ★ ถ้าถอดแล้วสมาชิกเหลือน้อยกว่า min_members → backend เปลี่ยน readinessStatus เป็น 'Forming' อัตโนมัติ (ไม่ต้องแจ้งใน response แยก — ดูค่าจาก GET /teams/:id ถัดไป)
```

### T09 — `POST /teams/:id/invitations`
```ts
// Request
{ invitedUserId: number }

// Response 201
{ id: number; invitedUserId: number; status: 'pending'; expiresAt: ISODateTime }

// Error 409: { code: 'ALREADY_MEMBER', message: 'ผู้ใช้นี้อยู่ในทีมแล้ว' }
// Error 404: ไม่พบผู้ใช้
```

### T10 — `GET /teams/:id/invitations`
```ts
// Response 200
{ items: Array<{ id: number; invitedUser: UserRef; status: 'pending'|'accepted'|'rejected'|'expired'; createdAt: ISODateTime }> }
```

### T11 — `DELETE /teams/:id/invitations/:iid`
```ts
// Response 204
// Error 409: { code: 'INVITATION_ALREADY_ANSWERED', message: 'คำเชิญนี้ถูกตอบรับ/ปฏิเสธไปแล้ว ยกเลิกไม่ได้' }
```

### T12 — `GET /me/invitations`
```ts
// Response 200
{ items: Array<{ id: number; team: TeamRef; invitedBy: UserRef; expiresAt: ISODateTime }> }
```

### T13 — `POST /invitations/:id/accept`
```ts
// Response 200
{ teamId: number; teamReadinessStatus: 'Forming' | 'Ready' }
// ★ readinessStatus ในนี้คือค่าล่าสุดหลังรับเข้า — frontend เช็คตรงนี้เพื่อรู้ว่าทีมพร้อมหรือยัง ไม่ต้องยิง GET ซ้ำ

// Error 422: { code: 'TEAM_QUOTA_EXCEEDED', message: 'คุณมีทีม Unofficial ครบ 5 ทีมแล้ว ไม่สามารถรับคำเชิญนี้ได้' }  (BR-05)
// Error 410: { code: 'INVITATION_EXPIRED', message: 'คำเชิญนี้หมดอายุแล้ว' }
```

### T14 — `POST /invitations/:id/decline`
```ts
// Response 204
```

### T15 — `POST /teams/:id/official-request`
```ts
// Request
{ supportingDocs: string[] }  // array ของ S3 key

// Response 201
{ id: number; status: 'pending' }
```

### T16 — `GET /admin/team-requests`
```ts
// Response 200 (paginated)
{ items: Array<{ id: number; team: TeamRef; requestedBy: UserRef; status: string; createdAt: ISODateTime }>, pagination }
```

### T17 — `POST /admin/team-requests/:id/approve`
```ts
// Response 200
{ teamId: number; officialStatus: 'official' }

// Error 422: { code: 'MEMBER_CONFLICT', message: 'สมาชิกบางคนสังกัดทีม Official อื่นในกีฬาเดียวกันแล้ว',
//              conflictingMembers: [{ userId: number; fullName: string; conflictingTeamName: string }] }  (BR-05)
```

### T18 — `POST /admin/team-requests/:id/reject`
```ts
// Request
{ reason: string }  // บังคับ

// Response 200
{ status: 'rejected'; reason: string }
```

---

# 5. Tournaments

### C01 — `POST /tournaments`
```ts
// Request
{
  name: string;
  sportTypeId: number;
  bracketFormat: 'single_elim' | 'double_elim' | 'round_robin';
  scopeType: 'department' | 'faculty';   // ⚠️ 'university' ถ้าเปิดใช้ multi-faculty
  organizingFacultyId: number;
  organizingDepartmentId: number | null;
  registrationStart: ISODateTime;
  registrationEnd: ISODateTime;
  eventStartDate: ISODate;
  eventEndDate: ISODate;
  maxTeams: number;
  minTeams: number;
  venue: string;
  genderRequirement: 'any' | 'male' | 'female';
  minAge: number | null;
  maxAge: number | null;
}

// Response 201
{ id: number; status: 'pending_approval'; name: string }

// Error 400: { fields: { eventStartDate: 'วันแข่งขันต้องอยู่หลังวันปิดรับสมัคร' } }  (FR-TC-01)
```

### C02 — `GET /me/tournament-requests`
```ts
// Response 200 (paginated)
{ items: Array<{ id: number; name: string; status: string; rejectionReason: string | null; createdAt: ISODateTime }>, pagination }
```

### C03 — `GET /admin/tournament-requests`
```ts
// Response 200 (paginated, เฉพาะ status='pending_approval')
{ items: Array<{ id: number; name: string; requestedBy: UserRef; sportTypeId: number; eventStartDate: ISODate; createdAt: ISODateTime }>, pagination }
```

### C04 — `POST /tournaments/:id/approve`
```ts
// Response 200
{ id: number; status: 'private'; organizerId: number }
```

### C05 — `POST /tournaments/:id/reject`
```ts
// Request
{ reason: string }  // บังคับ — Error 400 ถ้าไม่ส่ง

// Response 200
{ id: number; status: 'rejected'; reason: string }
```

### C06 — `GET /tournaments`
```ts
// Query: ?sportTypeId=&facultyId=&q=&page=&pageSize=
// ★ backend เขียนทับ status='public' เสมอ ไม่สนใจ query param ที่ client ส่งมา

// Response 200 (paginated)
{
  items: Array<{
    id: number; name: string; sportTypeId: number;
    eventStartDate: ISODate; eventEndDate: ISODate;
    registrationOpen: boolean; venue: string;
    organizingFacultyId: number;
  }>,
  pagination
}
```

### C07 — `GET /tournaments/:id`
```ts
// Response 200
// ถ้า status='private' และผู้เรียกไม่ใช่ ORG/ADM → 404 (ไม่ใช่ 403 — ไม่ยืนยันว่ามีทัวร์นี้อยู่)
{
  id: number; name: string; sportTypeId: number; status: string;
  bracketFormat: string; scopeType: string;
  registrationOpen: boolean; registrationStart: ISODateTime; registrationEnd: ISODateTime;
  eventStartDate: ISODate; eventEndDate: ISODate;
  maxTeams: number; minTeams: number; venue: string;
  genderRequirement: string; minAge: number | null; maxAge: number | null;
  organizer: UserRef;
  approvedTeamCount: number;
}
```

### C08 — `PATCH /tournaments/:id`
```ts
// Request (เฉพาะฟิลด์ที่ "ไม่กระทบเงื่อนไขการสมัคร" — allowlist ฝั่ง backend)
{ venue?: string; description?: string }
// ★ ส่ง eventStartDate/maxTeams/genderRequirement มาที่นี่ → เพิกเฉย ไม่ error แต่ไม่มีผล ต้องใช้ C09 แทน

// Response 200: เหมือน C07
```

### C13 — `POST /tournaments/:id/publish`
```ts
// Response 200
{ id: number; status: 'public' }

// Error 409: { code: 'REFEREES_INCOMPLETE', message: 'กรุณาแต่งตั้งกรรมการให้ครบก่อนเปิดเผยแพร่',
//              refereesAccepted: number; refereesRequired: number }  (BR-10)
```

### C14 — `POST /tournaments/:id/unpublish`
```ts
// Response 200: { id: number; status: 'private' }
```

### C15 — `POST /tournaments/:id/open-registration`
```ts
// Response 200: { id: number; registrationOpen: true }
```

### C16 — `POST /tournaments/:id/close-registration`
```ts
// Response 200: { id: number; registrationOpen: false }
```

### C17 — `GET /tournaments/:id/eligibility-rules`
```ts
// Response 200
{ items: Array<{ ruleType: string; ruleValue: number | string }> }
```

---

# 6. Referees

### F01 — `POST /tournaments/:id/referees`
```ts
// Request
{ userId: number; isExternal: boolean }

// Response 201
{ id: number; userId: number; invitationStatus: 'pending'; isExternal: boolean }

// Error 409: { code: 'ALREADY_INVITED', message: 'ผู้ใช้นี้ถูกเชิญเป็นกรรมการของทัวร์นี้แล้ว' }
```

### F02 — `GET /tournaments/:id/referees`
```ts
// Response 200
{
  items: Array<{ id: number; user: UserRef; invitationStatus: string; isExternal: boolean; externalApprovalStatus: string }>,
  acceptedCount: number;   // ใช้เช็ค BR-10 ฝั่ง frontend ก่อนกด publish
}
```

### F03 — `DELETE /tournaments/:id/referees/:rid`
```ts
// Response 204
// ★ ลบ match_referees ที่ผูกอยู่ในทรานแซกชันเดียวกัน
// Error 409: { code: 'WOULD_BREAK_REFEREE_MINIMUM', message: 'ถอดกรรมการคนนี้จะทำให้จำนวนกรรมการไม่ครบเงื่อนไข กรุณาปิดการเผยแพร่ทัวร์นาเมนต์ก่อน' }
```

### F04 — `GET /me/referee-invitations`
```ts
// Response 200
{ items: Array<{ id: number; tournament: { id: number; name: string }; isExternal: boolean; createdAt: ISODateTime }> }
```

### F05 — `POST /referee-invitations/:id/accept`
```ts
// Response 200
{ id: number; invitationStatus: 'accepted'; requiresAdminApproval: boolean }
// requiresAdminApproval = true ถ้า isExternal=true (ยังไม่ได้สิทธิ์จนกว่า Admin อนุมัติ)
```

### F06 — `POST /referee-invitations/:id/decline`
```ts
// Response 204
```

### F11 — `POST /matches/:id/referees`
```ts
// Request
{ tournamentRefereeId: number }

// Response 201
{ matchId: number; tournamentRefereeId: number; referee: UserRef }

// Error 409: { code: 'REFEREE_NOT_ACCEPTED', message: 'กรรมการคนนี้ยังไม่ได้ตอบรับเข้าร่วมทัวร์นาเมนต์' }
```

### F12 — `GET /matches/:id/referees`
```ts
// Response 200
{ items: Array<{ tournamentRefereeId: number; referee: UserRef }> }
```

### F13 — `DELETE /matches/:id/referees/:rid`
```ts
// Response 204
```

---

# 7. Applications

### P01 — `POST /tournaments/:id/applications`
```ts
// Request
{ teamId: number }

// Response 201
{ id: number; status: 'pending'; hardFilterPassed: true }

// Error 422 (Hard Filter ไม่ผ่าน — BR-08)
{
  error: {
    code: 'HARD_FILTER_FAILED',
    message: 'สมาชิกบางคนไม่ผ่านเงื่อนไขการสมัคร',
    details: [
      { userId: number; fullName: string; reason: 'gender' | 'age' | 'year' | 'faculty' }
    ]
  }
}
// Error 409: { code: 'REGISTRATION_CLOSED' } | { code: 'ALREADY_APPLIED' } | { code: 'TEAM_NOT_READY', message: 'ทีมต้องมีสถานะ Ready ก่อนสมัคร' }
```

### P02 — `GET /me/applications`
```ts
// Response 200 (paginated)
{ items: Array<{ id: number; tournament: { id: number; name: string }; team: TeamRef; status: string; rejectionReason: string | null; appliedAt: ISODateTime }>, pagination }
```

### P03 — `GET /tournaments/:id/applications`
```ts
// Response 200 (paginated)
{
  items: Array<{
    id: number; team: TeamRef; status: string;
    hardFilterPassed: boolean;
    softFilterDocuments: string[];   // S3 key ของรูปบัตร (ข้อ 12.5)
    appliedAt: ISODateTime;
  }>,
  pagination
}
```

### P04 — `GET /applications/:id`
```ts
// Response 200
{
  id: number; tournamentId: number; team: TeamRef; status: string;
  hardFilterDetails: Array<{ userId: number; fullName: string; passed: boolean; reason?: string }>;
  softFilterDocuments: string[];   // presigned URL อายุสั้น ไม่ใช่ S3 key ดิบ
}
```

### P05 — `POST /applications/:id/approve`
```ts
// Response 200: { id: number; status: 'approved' }
```

### P06 — `POST /applications/:id/reject`
```ts
// Request: { reason: string }  // บังคับ
// Response 200: { id: number; status: 'rejected'; reason: string }
```

### P07 — `POST /applications/:id/cancel`
```ts
// Response 200: { id: number; status: 'cancelled' }
// Error 409: { code: 'ALREADY_DECIDED', message: 'คำขอนี้ถูกพิจารณาไปแล้ว ยกเลิกไม่ได้' }  // ต้องเป็น pending เท่านั้น
```

### P08 — `POST /applications/:id/withdraw`
```ts
// Response 200
{ id: number; status: 'withdrawn'; bracketExists: boolean }
// ★ bracketExists=true → frontend แสดงคำเตือนว่า Organizer ต้องจัดสายใหม่ (FR-TR-04)
```

### P09 — `GET /tournaments/:id/teams`
```ts
// Response 200 (สาธารณะ, เฉพาะ status='approved')
{ items: TeamRef[] }
```

---

# 8. Brackets & Matches

### M01 — `POST /tournaments/:id/bracket`
```ts
// Request
{ seedingMethod: 'random' | 'manual'; manualSeeds?: number[] /* team id เรียงตามลำดับ ถ้า manual */ }

// Response 201
{ matchCount: number; bracketFormat: string; nodeCount: number }
// ★★ รอบ 5: nodeCount = 0 เสมอถ้า bracketFormat='round_robin' (ไม่สร้าง bracket_nodes เลย — ข้อ 12.3)

// Error 422: { code: 'TEAM_COUNT_MISMATCH', message: 'จำนวนทีมไม่สอดคล้องกับรูปแบบการแข่งขันที่เลือก' }
```

### M02 — `GET /tournaments/:id/bracket`
```ts
// Response 200 — ★★ รอบ 5: อ่านจาก bracket_nodes ใน MySQL (เดิมอ่านจาก MongoDB)
{
  bracketFormat: string;
  nodes: Array<{
    nodeId: number;
    bracketType: 'winners' | 'losers' | 'grand_final';
    round: number | null;        // null สำหรับ grand_final
    matchNumber: number;
    teamA: TeamRef | null;
    teamB: TeamRef | null;
    matchId: number | null;      // null = ยังไม่สร้างแมตช์จริง (รอ schedule)
    matchStatus: string | null;
    advancesToNodeId: number | null;
    // ★ คำนวณ ณ เวลา query ไม่ได้เก็บเป็นคอลัมน์จริงใน bracket_nodes
    //   หาโดย JOIN: node.match_id → matches.next_match_id → node อื่นที่ match_id ตรงกัน
    //   ทำแบบนี้เพื่อไม่ให้มี "ตัวชี้" ซ้ำกับ matches.next_match_id ซึ่งเป็น source of truth ตัวเดียว (เลือกทาง B)
  }>
}

// ★ Round Robin: nodes = [] เสมอ (ไม่มีแนวคิด node) — frontend ต้องใช้ GET /tournaments/:id/matches
//   ร่วมกับ GET /tournaments/:id/standings แสดงผลแทน ไม่ใช้ endpoint นี้เลย
```

### M04 — `GET /tournaments/:id/matches`
```ts
// Query: ?teamId=&status=&round=
// Response 200 (paginated)
{
  items: Array<{
    id: number; round: number; teamA: TeamRef | null; teamB: TeamRef | null;
    scheduledTime: ISODateTime | null; venue: string | null; status: string;
  }>,
  pagination
}
```

### M05 — `GET /matches/:id`
```ts
// Response 200
{
  id: number; tournamentId: number; round: number;
  teamA: TeamRef | null; teamB: TeamRef | null;
  scheduledTime: ISODateTime | null; venue: string | null;
  checkinOpenAt: ISODateTime | null; status: string; mode: 'onsite' | 'online';
  nextMatchId: number | null;
}
```

### M06 — `PATCH /matches/:id/schedule`
```ts
// Request
{ scheduledTime: ISODateTime; venue: string }

// Response 200: เหมือน M05
// Error 409: { code: 'SCHEDULE_CONFLICT', message: 'ทีมหรือสนามนี้มีนัดแข่งในเวลาดังกล่าวแล้ว',
//              conflictingMatchId: number }  (FR-MM-02)
```

### M09 — `POST /matches/:id/open-checkin`
```ts
// Response 200: { id: number; status: 'checkin_open'; checkinOpenAt: ISODateTime }
```

### M10 — `POST /matches/:id/start`
```ts
// Response 200: { id: number; status: 'in_progress' }
// Error 409: { code: 'INSUFFICIENT_CHECKINS', message: 'ยังมีผู้เล่นเช็คอินไม่ครบ' }
```

### M11 — `GET /matches/:id/checkin-qr`
```ts
// Response 200
{ qrPayload: string; expiresAt: ISODateTime }
```

### M12 — `POST /matches/:id/checkins`
```ts
// Request (on-site)
{ method: 'qr'; qrPayload: string }
// Request (online)
{ method: 'document'; documentType: 'student_id' | 'national_id'; documentS3Key: string }

// Response 201 (หรือ 200 ถ้ากดซ้ำ — idempotent ตาม UNIQUE (match_id, user_id))
{ id: number; status: 'checked_in' | 'pending_verification'; checkedInAt: ISODateTime }

// Error 403: { code: 'NOT_IN_APPROVED_ROSTER', message: 'คุณไม่อยู่ในรายชื่อทีมที่ได้รับอนุมัติของแมตช์นี้' }
```

### M13 — `GET /matches/:id/checkins`
```ts
// Response 200
{ items: Array<{ userId: number; fullName: string; method: string; status: string; checkedInAt: ISODateTime }> }
```

### M14 — `POST /matches/:id/checkins/:cid/verify`
```ts
// Response 200: { id: number; status: 'verified' }
```

### M15 — `POST /matches/:id/checkins/:cid/reject`
```ts
// Request: { reason: string }  // บังคับ
// Response 200: { id: number; status: 'rejected'; reason: string }
```

### M16 — `POST /uploads/presign`
```ts
// Request
{ purpose: 'checkin_document' | 'soft_filter_document'; contentType: 'image/jpeg' | 'image/png'; matchId?: number; tournamentId?: number }

// Response 200
{ uploadUrl: string; objectKey: string; expiresIn: number }
```

---

# 9. Match Results

### S01 — `POST /matches/:id/result`
```ts
// Request
{ winnerTeamId: number; scoreData: Record<string, number> }  // เช่น { teamAScore: 3, teamBScore: 2 }

// Response 201
{ id: number; matchId: number; status: 'submitted'; submittedBy: number }

// Error 403: { code: 'WRONG_SUBMITTER_ROLE', message: 'ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้' }  (BR-13)
// Error 409: { code: 'INSUFFICIENT_REFEREES', message: 'ต้องมีกรรมการยืนยันแล้วอย่างน้อย 2 คนสำหรับการแข่งแบบ on-site ที่บันทึกสถิติ' }  (BR-11)
```

### S02 — `POST /matches/:id/result/verify`
```ts
// Response 200
{ matchId: number; status: 'verified'; winnerTeamId: number; nextMatchId: number | null }
// ★ Response กลับมาแปลว่าทั้ง 9 ขั้นตอนใน transaction สำเร็จครบแล้ว (bracket, standings, stats, pick'em, notify, audit)

// Error 403: { code: 'SAME_PERSON_CANNOT_VERIFY', message: 'ผู้ยืนยันต้องไม่ใช่คนเดียวกับผู้ส่งผล' }  (BR-12)
```

### S03 — `POST /matches/:id/result/dispute`
```ts
// Request: { reason: string }  // บังคับ

// Response 200: { matchId: number; status: 'disputed' }
// Error 409: { code: 'DISPUTE_WINDOW_CLOSED', message: 'พ้นระยะเวลาที่เปิดให้โต้แย้งผลแล้ว' }  (dispute_window_hours)
// Error 409: { code: 'DISPUTE_ALREADY_ACTIVE', message: 'มีข้อโต้แย้งที่ยังไม่ได้ข้อยุติอยู่แล้ว' }  (BR-14)
```

### S04 — `POST /matches/:id/result/resolve`
```ts
// Request
{ resolution: 'uphold' | 'reject'; resolutionNote: string }

// Response 200: { matchId: number; status: 'verified' | 'rejected' }
```

### S05 — `GET /matches/:id/result`
```ts
// Response 200 (คืนเฉพาะเมื่อ status='verified', ไม่งั้น 404)
{
  matchId: number; winnerTeamId: number; scoreData: Record<string, number>;
  isAmended: boolean; amendedAt: ISODateTime | null; amendReason: string | null;
  verifiedAt: ISODateTime;
}
```

### S06 — `POST /matches/:id/stats`
```ts
// Request — ★★ รอบ 5: อิง sport_stat_definitions แทน JSON อิสระ (เดิม player_match_stats.stats)
{
  playerStats: Array<{
    userId: number;
    values: Array<{ statDefinitionId: number; value: number }>
  }>
}

// Response 201: { matchId: number; recordedCount: number }
// Error 400: { code: 'UNKNOWN_STAT_DEFINITION', message: 'มีรายการสถิติที่ไม่ตรงกับประเภทกีฬานี้' }
// ★ backend ต้องเช็คว่าทุก statDefinitionId ที่ส่งมาตรงกับ sport_type_id ของทัวร์นาเมนต์นี้จริง (ผ่าน matches → tournaments → sport_type_id)
```

### S07 — `GET /matches/:id/stats`
```ts
// Response 200 — ★★ รอบ 5: คืนพร้อม label ภาษาไทยจาก sport_stat_definitions ให้ frontend แสดงผลตรงๆ
{
  items: Array<{
    userId: number; fullName: string;
    stats: Array<{ statKey: string; statLabelTh: string; value: number }>
  }>
}
```

### R05 — `GET /sport-types/:id/stat-definitions` (🆕 endpoint ใหม่ รอบ 5)
```ts
// Response 200 — ★ ให้ frontend รู้ว่ากีฬานี้ต้องโชว์ฟอร์มกรอกสถิติอะไรบ้าง ก่อนเรียก S06
{
  items: Array<{
    statDefinitionId: number;
    statKey: string;          // 'goals', 'yellow_cards' ฯลฯ
    statLabelTh: string;      // 'ประตู', 'ใบเหลือง'
    dataType: 'integer' | 'decimal' | 'boolean';
    displayOrder: number;
  }>
}
// ★ ไม่ต้องล็อกอิน (Auth: —) เหมือน R03 (GET /sport-types) เพราะเป็นข้อมูลอ้างอิงสาธารณะ
```

### S10 — `GET /tournaments/:id/winner`
```ts
// Response 200 (คืนเฉพาะเมื่อทัวร์นาเมนต์ completed)
{ championTeam: TeamRef; runnerUpTeam: TeamRef | null; summary: Record<string, unknown> }
```

### S11 — `GET /tournaments/:id/dashboard`
```ts
// Response 200
{ teamCount: number; playerCount: number; matchCount: number; matchesCompleted: number }
```

### S12 — `GET /tournaments/:id/standings`
```ts
// Response 200 (read-only)
{ items: Array<{ team: TeamRef; wins: number; losses: number; pointsFor: number; pointsAgainst: number; rank: number }> }
```

---

# 10. Engagement (MVP เฉพาะ Announcement + Livestream)

### E08 — `POST /tournaments/:id/announcements`
```ts
// Request: { title: string; body: string }
// Response 201: { id: number; title: string; body: string; createdAt: ISODateTime }
```

### E09 — `GET /tournaments/:id/announcements`
```ts
// Response 200 (paginated)
{ items: Array<{ id: number; title: string; body: string; createdAt: ISODateTime }>, pagination }
```

### E10 — `PATCH /announcements/:id`
```ts
// Request: { title?: string; body?: string }
// Response 200: เหมือน E08
```

### E11 — `DELETE /announcements/:id`
```ts
// Response 204 (soft delete)
```

### E12 — `PUT /matches/:id/livestream`
```ts
// Request: { youtubeUrl: string }
// Response 200: { matchId: number; youtubeUrl: string }
// Error 400: { code: 'INVALID_YOUTUBE_URL', message: 'ลิงก์ YouTube ไม่ถูกต้อง' }
```

---

# 11. หมายเหตุข้ามกลุ่มที่ต้องระวังตอนเขียนโค้ด

**ทุก response ที่มี `avatarUrl`, `documentS3Key`, หรือรูปใดๆ ต้องเป็น presigned URL อายุสั้น ไม่ใช่ S3 key ดิบ** ยกเว้น request ขาเข้า (เช่น M12) ที่รับ key ดิบเพราะเป็นค่าที่ client เพิ่งได้จาก M16 มา

**`softFilterDocuments` ใน P03 กับ P04 คืนคนละแบบ** — P03 (list) คืน S3 key ดิบเพื่อประหยัด ไม่ generate URL ทุกแถวในหน้า list / P04 (detail) คืน presigned URL เพราะ Organizer จะเปิดดูรูปจริง

**ฟิลด์ `hardFilterPassed` กับ `hardFilterDetails` ต่างสโคป** — P01 คืนแค่ boolean รวม (ผ่านหรือไม่ผ่าน) ส่วน P04 คืนรายละเอียดรายคน (`hardFilterDetails`) ที่ดึงจาก `hard_filter_details` (เก็บตอนสมัครไว้แล้ว ไม่คำนวณใหม่ — ตอนที่ 2 ข้อ P03)

**`isAmended`/`amendedAt`/`amendReason` ต้องมีในทุก response ที่คืนผลการแข่งขัน** (S05 และที่ใดก็ตามที่ embed ผลแมตช์) เพื่อให้หน้าเว็บแสดงป้ายได้ตาม NF-SE-05 — คำนวณจาก `amended_at IS NOT NULL` ไม่ใช่ enum (ตอนที่ 0–1 หัวข้อ 1.6)

**ทุก endpoint ที่ต้องมี `reason` บังคับ (C05, T18, P06, M15, S03) ต้องตอบ 400 ถ้าไม่ส่งมา ไม่ใช่ตั้งเป็นค่าว่าง** — ตรวจด้วย Zod schema ที่ backend เป็นต้นแบบ

---

# 12. ลำดับถัดไป

| ตอน | เนื้อหา | สถานะ |
|---|---|---|
| 0–1 | Conventions + Resource Inventory | ✅ |
| 2 | Endpoint Matrix (146 endpoint) | ✅ |
| **3** | **Request/Response Schema (MVP 93 endpoint)** | ✅ เอกสารนี้ |
| 3.1 | Request/Response Schema (Sprint #1/#2 — 53 endpoint) | ✅ |
| 4 | Error catalog รวม (ภาษาไทย) | ถัดไป |
| 5 | OpenAPI 3.1 YAML | |

**ข้อเสนอ** — ไปตอนที่ 4 (error catalog) ก่อนตอนที่ 3.1 เพราะ error code ที่กระจายอยู่ในเอกสารนี้ (เช่น `HARD_FILTER_FAILED`, `TEAM_QUOTA_EXCEEDED`) ควรรวมเป็นรายการเดียวที่ backend อ้างอิงได้จากจุดเดียว ก่อนขยายไป Sprint #1/#2 ต่อ
