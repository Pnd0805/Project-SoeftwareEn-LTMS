# LTMS — API Design ตอนที่ 3.1
## Request / Response Schema (Sprint #1 / #2 — 53 endpoint)

**เวอร์ชัน:** 0.1 (ร่างแรก)
**วันที่:** 2 สิงหาคม 2569
**ต่อจาก:** `LTMS_API_Design_Part3.md` (Schema ของ MVP 93 endpoint)
**ขอบเขต:** 53 endpoint ที่เหลือจากตอนที่ 2 — Sprint #1 (45) + Sprint #2 (8, เพิ่ม E34-E36 รอบ 5)
**ยังไม่รวม:** error catalog เต็ม (ตอนที่ 4), OpenAPI YAML (ตอนที่ 5)
**Shared Types:** ใช้ร่วมกับตอนที่ 3 หัวข้อ 0 (`ListResponse<T>`, `ErrorResponse`, `UserRef`, `TeamRef`, `ISODateTime`, `ISODate`)

---

# 1. Auth — ส่วนที่เหลือ

### A04 — `POST /auth/forgot-password`
```ts
// Request: { email: string }

// Response 200 (เสมอ — ไม่ว่าอีเมลจะมีในระบบหรือไม่ ป้องกันการไล่เช็ครายชื่อ)
{ message: 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว' }
```

### A05 — `POST /auth/reset-password`
```ts
// Request
{ token: string; newPassword: string }

// Response 200: { message: 'ตั้งรหัสผ่านใหม่สำเร็จ' }

// Error 410: { code: 'RESET_TOKEN_EXPIRED', message: 'ลิงก์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่' }
// Error 409: { code: 'RESET_TOKEN_ALREADY_USED', message: 'ลิงก์นี้ถูกใช้ไปแล้ว' }
```

### A06 — `POST /auth/change-password`
```ts
// Request
{ currentPassword: string; newPassword: string }

// Response 200: { message: 'เปลี่ยนรหัสผ่านสำเร็จ' }
// Error 401: { code: 'CURRENT_PASSWORD_INCORRECT', message: 'รหัสผ่านเดิมไม่ถูกต้อง' }
```

---

# 2. Users & Profile — ส่วนที่เหลือ

### U05 — `GET /users/:id/match-history`
```ts
// Query: ?sportTypeId=&page=&pageSize=
// Response 200 (paginated)
{
  items: Array<{
    matchId: number; tournamentName: string; sportTypeId: number;
    opponent: TeamRef; result: 'win' | 'loss'; playedAt: ISODateTime;
  }>,
  pagination
}
```

### U07 — `GET /me/badges`
```ts
// Response 200
{
  items: Array<{ id: number; name: string; iconUrl: string; earnedAt: ISODateTime; isDisplayed: boolean }>
}
```

### U08 — `PATCH /me/badges/display`
```ts
// Request: { badgeIds: number[] }  // badge ที่จะโชว์บนโปรไฟล์ (จำกัดจำนวน เช่น ≤5)
// Response 200: { displayedBadgeIds: number[] }
// Error 422: { code: 'TOO_MANY_BADGES', message: 'เลือกได้ไม่เกิน 5 badge' }
```

### U09 — `GET /admin/users?q=`
```ts
// Query: q (string, ≥3 ตัวอักษร)
// Response 200 (paginated)
{
  items: Array<{
    id: number; fullName: string; email: string; userType: string;
    isSuspended: boolean; createdAt: ISODateTime;
  }>,
  pagination
}
```

### U10 — `POST /admin/users/:id/suspend`
```ts
// Request: { reason: string }  // บังคับ

// Response 200
{ id: number; isSuspended: true; reason: string; affectedTeamsRecalculated: number }
// ★ affectedTeamsRecalculated = จำนวนทีมที่ readinessStatus ถูกคำนวณใหม่ในทรานแซกชันเดียวกัน (FR-UM-05)
```

### U11 — `POST /admin/users/:id/unsuspend`
```ts
// Response 200: { id: number; isSuspended: false }
```

---

# 3. Reference Data — ส่วนที่เหลือ

### R04 — `GET /admin/scopes` ⚠️
```ts
// ⚠️ multi-faculty ยังไม่ผ่าน Change Management (ข้อ 4.3) — ตัดออกได้โดยไม่กระทบส่วนอื่น
// Response 200
{ items: Array<{ userId: number; fullName: string; scopeType: 'faculty' | 'university_wide'; facultyId: number | null }> }
```

---

# 4. Teams — ส่วนที่เหลือ

### T19 — `POST /teams/:id/transfer-leader`
```ts
// Request: { newLeaderId: number }  // ต้องเป็นสมาชิกทีมอยู่แล้ว

// Response 201 (สร้างคิวรออนุมัติ — ยังไม่เปลี่ยน leader_id ทันที ตาม BR-07)
{ id: number; status: 'pending'; currentLeaderId: number; proposedLeaderId: number }

// Error 403: { code: 'NOT_OFFICIAL_TEAM', message: 'การโอนย้ายสิทธิ์หัวหน้าทีมใช้ได้เฉพาะทีม Official' }
```

### T20 — `POST /admin/team-requests/:id/approve-transfer`
```ts
// Response 200: { teamId: number; newLeaderId: number }
// ★ endpoint นี้เท่านั้นที่เขียน UPDATE teams SET leader_id จริง
```

---

# 5. Tournaments — ส่วนที่เหลือ

### C18 — `GET /admin/tournaments/archived`
```ts
// Query: ?page=&pageSize=
// Response 200 (paginated, เฉพาะทัวร์ที่จบไปแล้ว ยังไม่ถึงกำหนดลบ 4 ปี)
{
  items: Array<{ id: number; name: string; eventEndDate: ISODate; deleteScheduledAt: ISODateTime }>,
  pagination
}
```

---

# 6. Referees — ส่วนที่เหลือ

### F07 — `POST /tournaments/:id/referees/:rid/request-approval`
```ts
// Request: { verificationDocs: string[] }  // S3 key — เฉพาะเมื่อ is_external=true

// Response 201: { id: number; externalApprovalStatus: 'pending' }
// Error 400: { code: 'NOT_EXTERNAL', message: 'กรรมการคนนี้ไม่ใช่บุคคลภายนอก ไม่ต้องขออนุมัติ' }
```

### F08 — `GET /admin/referee-approvals`
```ts
// Response 200 (paginated, เฉพาะ external_approval_status='pending')
{
  items: Array<{
    id: number; referee: UserRef; tournament: { id: number; name: string };
    verificationDocs: string[];  // presigned URL
    requestedAt: ISODateTime;
  }>,
  pagination
}
```

### F09 — `POST /admin/referee-approvals/:id/approve`
```ts
// Response 200: { id: number; externalApprovalStatus: 'approved' }
```

### F10 — `POST /admin/referee-approvals/:id/reject`
```ts
// Request: { reason: string }  // บังคับ
// Response 200: { id: number; externalApprovalStatus: 'rejected'; reason: string }
```

---

# 7. Brackets & Matches — ส่วนที่เหลือ

### M03 — `PATCH /tournaments/:id/bracket`
```ts
// Request: { seedingMethod: 'random' | 'manual'; manualSeeds?: number[] }

// Response 200: { matchCount: number }
// Error 409: { code: 'BRACKET_ALREADY_STARTED', message: 'ไม่สามารถจัดสายใหม่ได้ เพราะมีการแข่งขันเริ่มไปแล้ว' }
```

### M07 — `PATCH /matches/:id/venue`
```ts
// Request: { venue: string }
// Response 200: { matchId: number; venue: string }
// Error 409: { code: 'VENUE_CONFLICT', message: 'สนามนี้ถูกใช้ในเวลาเดียวกันแล้ว', conflictingMatchId: number }
```

### M08 — `PATCH /matches/:id/mode`
```ts
// Request: { mode: 'onsite' | 'online' }
// Response 200: { matchId: number; mode: string }
// Error 409: { code: 'MODE_LOCKED', message: 'ไม่สามารถแก้โหมดการแข่งขันได้ เพราะเปิดเช็คอินไปแล้วหรือแมตช์เริ่มแล้ว' }
```

---

# 8. Match Results — ส่วนที่เหลือ

### S08 — `PATCH /matches/:id/result`
```ts
// Request
{ winnerTeamId?: number; scoreData?: Record<string, number>; amendReason: string }  // amendReason บังคับเสมอ

// Response 200
{ matchId: number; isAmended: true; amendedAt: ISODateTime; amendReason: string }

// Error 409 (ข้อ 12.2 — ตัดสินใจแล้ว)
{
  error: {
    code: 'CANNOT_AMEND_WINNER',
    message: 'แก้ผู้ชนะไม่ได้ เพราะแมตช์รอบถัดไปเริ่มไปแล้ว กรุณาติดต่อผู้จัดการแข่งขัน'
  }
}
// ★ เงื่อนไข error นี้เกิดเฉพาะกรณี winnerTeamId เปลี่ยน AND แมตช์ที่ next_match_id ชี้ไปมีสถานะเกิน 'scheduled'
// การแก้ scoreData อย่างเดียวโดยไม่เปลี่ยนผู้ชนะ ทำได้เสมอไม่ติด error นี้
```

### S09 — `GET /tournaments/:id/report`
```ts
// Query: ?format=pdf|csv
// Response 200 (binary — Content-Type ตาม format, ไม่ใช่ JSON)
// Header: Content-Disposition: attachment; filename="tournament-{id}-report.pdf"
```

---

# 9. Engagement — Follow & Notification (FR-FN)

### E01 — `POST /users/:id/follow`
```ts
// Response 201 (หรือ 200 ถ้าติดตามอยู่แล้ว — idempotent)
{ followedUserId: number }
```

### E02 — `DELETE /users/:id/follow`
```ts
// Response 204
```

### E03 — `GET /me/following`
```ts
// Response 200 (paginated)
{ items: UserRef[], pagination }
```

### E04 — `GET /me/notifications`
```ts
// Query: ?isRead=&type=&page=&pageSize=
// Response 200 (paginated)
{
  items: Array<{
    id: number; type: 'invitation' | 'application_result' | 'schedule_change' | 'venue_change' | 'match_result';
    title: string; body: string; isRead: boolean; createdAt: ISODateTime;
    link: string | null;  // path ไปยัง resource ที่เกี่ยวข้อง เช่น /matches/88
  }>,
  pagination
}
```

### E05 — `POST /me/notifications/:id/read`
```ts
// Response 200 (idempotent — อ่านซ้ำก็ตอบ 200 เหมือนเดิม)
{ id: number; isRead: true }
```

### E06 — `POST /me/notifications/read-all`
```ts
// Response 200: { updatedCount: number }
```

### E07 — `PATCH /me/notification-prefs`
```ts
// Request
{ [type: string]: boolean }  // เช่น { invitation: true, schedule_change: false }

// Response 200: { notificationPrefs: Record<string, boolean> }
```

---

# 10. Engagement — Community (FR-CM)

### E13 — `POST /tournaments/:id/comments`
```ts
// Request: { body: string }  // rate limit 10/นาที/ผู้ใช้

// Response 201: { id: number; body: string; author: UserRef; createdAt: ISODateTime }
// Error 429: { code: 'RATE_LIMITED', message: 'ส่งความคิดเห็นถี่เกินไป กรุณารอสักครู่' }
```

### E14 — `GET /tournaments/:id/comments`
```ts
// Response 200 (paginated, ซ่อน is_removed=true)
{ items: Array<{ id: number; body: string; author: UserRef; createdAt: ISODateTime }>, pagination }
```

### E15 — `POST /comments/:id/report`
```ts
// Response 200 (idempotent): { commentId: number; isReported: true }
```

### E16 — `GET /admin/reported-comments`
```ts
// Response 200 (paginated)
{ items: Array<{ id: number; body: string; author: UserRef; tournamentId: number; reportedCount: number }>, pagination }
```

### E17 — `POST /admin/comments/:id/remove`
```ts
// Response 200: { id: number; isRemoved: true }
```

### E18 — `POST /tournaments/:id/organizer-feedback`
```ts
// Request: { body: string }
// Response 201: { id: number }
// Error 409: { code: 'ALREADY_SUBMITTED', message: 'คุณส่ง Feedback ให้ทัวร์นาเมนต์นี้ไปแล้ว' }
```

### E19 — `GET /tournaments/:id/organizer-feedback`
```ts
// Response 200 (paginated, เฉพาะ Organizer เจ้าของทัวร์เห็นได้)
{ items: Array<{ body: string; createdAt: ISODateTime }>, pagination }
// ★ ไม่คืนตัวตนผู้ส่ง (feedback ไม่ระบุชื่อ ตาม FR-CM-02)
```

### E20 — `POST /tournaments/:id/mvp-votes`
```ts
// Request: { votedForUserId: number }

// Response 201 (idempotent ผ่าน UNIQUE บน match_key — ข้อ 4.2/12.1)
{ id: number; votedForUserId: number }

// Error 403: { code: 'PLAYER_CANNOT_VOTE', message: 'ผู้ที่ลงแข่งขันในทัวร์นาเมนต์นี้ไม่สามารถโหวตได้' }  (FR-CM-03)
// Error 409: { code: 'VOTING_NOT_OPEN', message: 'ยังไม่เปิดโหวต MVP หรือปิดโหวตไปแล้ว' }
```

### E21 — `POST /matches/:id/mvp-votes`
```ts
// Request: { votedForUserId: number }
// Response 201: { id: number; votedForUserId: number }
// Error 403: { code: 'PLAYER_CANNOT_VOTE', message: 'ผู้ที่ลงแข่งในแมตช์นี้ไม่สามารถโหวตได้' }
// Error 409: { code: 'VOTING_CLOSED', message: 'พ้นระยะเวลาที่เปิดให้โหวตแล้ว' }  (dispute_window_hours)
```

### E22 — `GET /tournaments/:id/mvp-results`
```ts
// Response 200 (คืนเฉพาะเมื่อปิดรอบโหวตแล้ว ไม่งั้น 404)
{ matchMvps: Array<{ matchId: number; winner: UserRef; voteCount: number }>; tournamentMvp: UserRef | null }
```

---

# 11. Engagement — Q&A (FR-OM-08)

### E23 — `POST /tournaments/:id/questions`
```ts
// Request: { question: string }
// Response 201: { id: number; question: string; author: UserRef; createdAt: ISODateTime; answer: null }
```

### E24 — `GET /tournaments/:id/questions`
```ts
// Response 200 (paginated)
{ items: Array<{ id: number; question: string; author: UserRef; answer: string | null; answeredAt: ISODateTime | null }>, pagination }
```

### E25 — `POST /questions/:id/answer`
```ts
// Request: { answer: string }
// Response 200: { id: number; answer: string; answeredAt: ISODateTime }
// Error 409: { code: 'ALREADY_ANSWERED', message: 'คำถามนี้ถูกตอบไปแล้ว' }  (ตอบรอบเดียว ไม่ใช่ thread)
```

---

# 12. Engagement — Pick'em (FR-PK)

### E26 — `POST /matches/:id/prediction`
```ts
// Request: { predictedWinnerTeamId: number }

// Response 201 (หรือ 200 ถ้าทายซ้ำ — idempotent ผ่าน UNIQUE (user_id, match_id))
{ matchId: number; predictedWinnerTeamId: number }

// Error 409: { code: 'PREDICTION_CLOSED', message: 'ไม่สามารถทายผลได้ เพราะเลยเวลาเริ่มแข่งขันแล้ว' }
// ★ เช็คกับ matches.scheduled_time ไม่ใช่ status (ตอนที่ 2 หมายเหตุ E26)
```

### E27 — `GET /me/predictions`
```ts
// Response 200 (paginated)
{
  items: Array<{
    matchId: number; predictedWinnerTeamId: number;
    actualWinnerTeamId: number | null; isCorrect: boolean | null; pointsEarned: number | null;
  }>,
  pagination
}
```

### E28 — `GET /tournaments/:id/pickem-leaderboard`
```ts
// Response 200 (paginated)
{ items: Array<{ user: UserRef; correctPredictions: number; totalPoints: number; rank: number }>, pagination }
```

### E29 — `GET /me/points`
```ts
// Response 200: { totalPoints: number }
```

### E30 — `GET /me/points/transactions`
```ts
// Response 200 (paginated, read-only ledger)
{
  items: Array<{ amount: number; source: 'pickem' | 'achievement'; description: string; createdAt: ISODateTime }>,
  pagination
}
```

### E31 — `GET /rewards`
```ts
// Response 200
{ items: Array<{ id: number; name: string; iconUrl: string; pointCost: number; alreadyRedeemed: boolean }> }
```

### E32 — `POST /rewards/:id/redeem`
```ts
// Response 201: { rewardId: number; remainingPoints: number }

// Error 422: { code: 'INSUFFICIENT_POINTS', message: 'แต้มไม่เพียงพอสำหรับแลกรางวัลนี้' }
// ★ BR-15 — ห้ามมี endpoint หรือ field ใดที่เชื่อมกับระบบชำระเงินหรือแปลงแต้มเป็นเงินสด
```

### E34 — `POST /admin/rewards` (🆕 ใหม่ทั้งชุด รอบ 5)
```ts
// Request
{
  rewardType: 'badge' | 'achievement';
  name: string;
  description?: string;
  pointsRequired?: number;
  criteria?: Record<string, unknown>;
  iconKey?: string;
}

// Response 201: { id: number; name: string; isActive: true }
// Error 400: { code: 'REWARD_NAME_REQUIRED', message: 'กรุณาระบุชื่อรางวัล' }
```

### E35 — `PATCH /admin/rewards/:id` (🆕 ใหม่ทั้งชุด รอบ 5)
```ts
// Request (ทุกฟิลด์ optional)
{ name?: string; description?: string; pointsRequired?: number; criteria?: Record<string, unknown>; iconKey?: string }

// Response 200: { id: number; name: string; updatedAt: string }
// Error 404: { code: 'REWARD_NOT_FOUND', message: 'ไม่พบรางวัลนี้' }
```

### E36 — `DELETE /admin/rewards/:id` (🆕 ใหม่ทั้งชุด รอบ 5)
```ts
// Response 200 (★ ทาง A — ไม่ใช่ลบจริง แค่ปิดใช้งาน)
{ id: number; isActive: false }

// Error 404: { code: 'REWARD_NOT_FOUND' }
// Error 409: { code: 'REWARD_IN_USE', message: 'ไม่สามารถลบรางวัลนี้ได้ เพราะมีผู้ใช้แลกไปแล้ว' }
// ★ เช็คจาก SELECT COUNT(*) FROM user_rewards WHERE reward_id = ? ก่อนเสมอ — ถ้ามี ≥1 แถว ต้องปฏิเสธ
//   (นโยบายรอบนี้: ปิดใช้งานเสมอ ไม่มีทางลบแถวจริงออกจาก rewards เลยไม่ว่ากรณีใด)
```

---

# 13. Admin — Audit Log

### E33 — `GET /admin/audit-logs`
```ts
// Query: ?actionType=&userId=&page=&pageSize=
// Response 200 (paginated, read-only ตาม NF-SE-05)
{
  items: Array<{
    id: number; actionType: string; performedBy: UserRef;
    resourceType: string; resourceId: number;
    metadata: Record<string, unknown>; createdAt: ISODateTime;
  }>,
  pagination
}
```

---

# 14. หมายเหตุข้ามกลุ่มที่ต้องระวังตอนเขียนโค้ด

**E20/E21 ต้องเช็คซ้ำที่โค้ดเสมอ** ถึงแม้ `match_key` (generated column) จะกันซ้ำที่ DB ได้แล้ว (ข้อ 4.2/12.1) เพราะต้องตอบ 409 พร้อมข้อความภาษาไทยที่อ่านรู้เรื่อง ไม่ใช่ปล่อย SQL duplicate-key error ดิบออกไป

**E19 ไม่คืนตัวตนผู้ส่ง feedback** — ต่างจาก E14 (comment) ที่โชว์ชื่อผู้เขียนตามปกติ endpoint นี้ตั้งใจให้ไม่ระบุตัวตนเพื่อให้ผู้ใช้กล้าวิจารณ์ Organizer ตรงๆ

**E26 เช็คเวลาจาก `matches.scheduled_time` ไม่ใช่ `status`** — เหตุผลเดิมจากตอนที่ 2: แมตช์อาจเลยเวลาจริงแล้วแต่ยังไม่ถูกเปลี่ยนสถานะเป็น `in_progress` (เช่น Organizer ลืมเปิดเช็คอิน) ถ้าเช็คจาก status คนจะยังทายผลได้ทั้งที่ควรปิดไปแล้ว

**U10 ต้องคำนวณ `teams.readinessStatus` ใหม่ในทรานแซกชันเดียวกัน** ไม่ใช่แค่ตั้ง `is_suspended=true` เฉยๆ — ผู้ใช้ที่ถูกระงับต้องไม่ถูกนับเป็นสมาชิกทีมที่มีสิทธิ์ลงแข่ง (FR-UM-05) ถ้าทีมใดเหลือสมาชิกไม่ครบหลังตัดคนนี้ออก ต้องเปลี่ยนเป็น `Forming` ทันที

**S08 คือจุดเดียวใน endpoint ทั้งหมดที่ต้องเช็คเงื่อนไข "ผู้ชนะเปลี่ยนหรือไม่" ก่อนเริ่มทรานแซกชัน** — เป็น pre-check แยกต่างหาก ไม่ใช่ส่วนหนึ่งของ transaction หลัก เพราะถ้าติด error ต้องปฏิเสธทันทีโดยไม่แตะข้อมูลอะไรเลย

**T19/T20 แยกเป็น 2 ขั้นตอนโดยเจตนา** — T19 แค่สร้างคำขอ ยังไม่เปลี่ยน `leader_id` จริง ต้องรอ T20 (Admin อนุมัติ) ก่อนเท่านั้น ตาม BR-07 ห้ามมี endpoint ใดที่ข้ามขั้นตอนนี้ไปเปลี่ยน `leader_id` ตรงๆ

---

# 15. ลำดับถัดไป

| ตอน | เนื้อหา | สถานะ |
|---|---|---|
| 0–1 | Conventions + Resource Inventory | ✅ |
| 2 | Endpoint Matrix (146 endpoint) | ✅ |
| 3 | Schema (MVP — 93 endpoint) | ✅ |
| **3.1** | **Schema (Sprint #1/#2 — 53 endpoint)** | ✅ เอกสารนี้ |
| 4 | Error catalog รวม (ภาษาไทย) | ถัดไป |
| 5 | OpenAPI 3.1 YAML | |

**ครบทั้ง 146 endpoint แล้ว** ทั้ง 2 เอกสาร (ตอนที่ 3 + 3.1) — เพิ่มจาก 142 เป็น 146 ในรอบที่ 5 (R05 + E34-E36) — ขั้นต่อไปคือรวบ error code ทั้งหมดที่กระจายอยู่ในทั้งสองเอกสารเป็นบัญชีเดียวในตอนที่ 4 ก่อนแปลงเป็น OpenAPI YAML
