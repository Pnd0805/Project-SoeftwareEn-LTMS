# LTMS — API Design ตอนที่ 4
## Error Catalog

**เวอร์ชัน:** 0.1 (ร่างแรก)
**วันที่:** 2 สิงหาคม 2569
**ต่อจาก:** `LTMS_API_Design_Part3.md` + `LTMS_API_Design_Part3-1.md` (Schema ครบ 142 endpoint)
**ที่มา:** รวบ error code ที่กระจายอยู่ในตอนที่ 0–1, 2, 3, 3.1 เป็นบัญชีเดียว + เพิ่ม generic error ที่ยังไม่เคยตั้งชื่อ
**ยังไม่รวม:** OpenAPI YAML (ตอนที่ 5)

---

# 1. รูปแบบ Error (ทบทวนจากตอนที่ 0–1 หัวข้อ 1.8)

```ts
type ErrorResponse = {
  error: {
    code: string;              // คงที่ ภาษาอังกฤษ ใช้เขียน logic — ห้าม frontend เทียบจาก message
    message: string;           // ภาษาไทย แสดงผลได้ทันที (NF-US-03)
    fields?: Record<string, string>;   // เฉพาะ validation error รายช่อง (FR-UM-01)
    [extra: string]: unknown;  // ฟิลด์เสริมเฉพาะ error บางตัว เช่น conflictingMatchId
  }
}
```

**กฎการเขียน `code`:** `SCREAMING_SNAKE_CASE`, ตั้งชื่อบอกสาเหตุไม่ใช่ผลลัพธ์ (`TEAM_QUOTA_EXCEEDED` ไม่ใช่ `CANNOT_JOIN_TEAM`), ไม่ผูกกับ HTTP status ในชื่อ (`NOT_FOUND` ทั่วไปเกินไป ต้องระบุว่าอะไรไม่พบ)

**กฎการเขียน `message`:** บอกสาเหตุ + แนวทางแก้ในประโยคเดียว ไม่ใช่แค่บอกว่าอะไรผิด — ดู 2.1 (Generic) เป็นตัวอย่างเทียบ

---

# 2. Generic Errors — ใช้ร่วมกันได้ทุก endpoint

ไม่ผูกกับ resource ใดเป็นการเฉพาะ ใช้เป็นค่า fallback หรือ error ระดับ middleware

| code | HTTP | message | เกิดที่ไหน |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่ | Zod validation ล้มเหลว — มากับ `fields` เสมอ |
| `NO_TOKEN` | 401 | กรุณาเข้าสู่ระบบก่อนใช้งาน | ไม่มี header `Authorization` |
| `TOKEN_EXPIRED` | 401 | เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ | JWT verify ล้มเหลว/หมดอายุ |
| `ACCOUNT_SUSPENDED` | 403 | บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ | `requireAuth` เจอ `is_suspended=true` |
| `FORBIDDEN` | 403 | คุณไม่มีสิทธิ์ทำรายการนี้ | middleware สิทธิ์ (`requireTeamLeader` ฯลฯ) ปฏิเสธ — ดู 2.2 สำหรับ code เฉพาะที่ควรใช้แทนถ้ามี |
| `NOT_FOUND` | 404 | ไม่พบข้อมูลที่ต้องการ | resource ไม่มีอยู่จริง — ดู 2.3 สำหรับ code เฉพาะ resource |
| `RATE_LIMITED` | 429 | ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ | rate limit ตามหัวข้อ 1.16 ของตอนที่ 0–1 |
| `INTERNAL_ERROR` | 500 | เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง | uncaught exception — **ห้าม** ใส่รายละเอียด stack trace ลง `message` |

> **หลักการเลือกใช้:** `FORBIDDEN`/`NOT_FOUND` เป็น fallback สุดท้ายเท่านั้น ถ้ามี code เฉพาะที่ตรงกว่า (เช่น `NOT_TEAM_LEADER`, `TOURNAMENT_NOT_FOUND`) ให้ใช้ตัวเฉพาะเสมอ เพราะ frontend จะเขียน logic แยกกรณีได้แม่นกว่า

## 2.1 Resource-not-found เฉพาะจุด (แทนที่ `NOT_FOUND` ทั่วไป)

| code | HTTP | message |
|---|---|---|
| `USER_NOT_FOUND` | 404 | ไม่พบผู้ใช้นี้ในระบบ |
| `TEAM_NOT_FOUND` | 404 | ไม่พบทีมนี้ |
| `TOURNAMENT_NOT_FOUND` | 404 | ไม่พบทัวร์นาเมนต์นี้ |
| `MATCH_NOT_FOUND` | 404 | ไม่พบแมตช์นี้ |
| `APPLICATION_NOT_FOUND` | 404 | ไม่พบใบสมัครนี้ |
| `INVITATION_NOT_FOUND` | 404 | ไม่พบคำเชิญนี้ |

> **`GET /tournaments/:id` ที่เป็น `private` และผู้เรียกไม่ใช่ ORG/ADM ต้องตอบ `TOURNAMENT_NOT_FOUND` (404) ไม่ใช่ `FORBIDDEN` (403)** — ตามหลักที่คุยกันในตอนที่ 3: ไม่ยืนยันว่าทัวร์นาเมนต์นี้มีอยู่จริงให้คนนอกรู้

## 2.2 Authorization เฉพาะบทบาท (แทนที่ `FORBIDDEN` ทั่วไป)

| code | HTTP | message |
|---|---|---|
| `NOT_TEAM_LEADER` | 403 | คุณไม่ใช่หัวหน้าทีมนี้ |
| `NOT_ORGANIZER` | 403 | คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้ |
| `NOT_REFEREE` | 403 | คุณไม่ได้เป็นกรรมการของแมตช์นี้ |
| `INSUFFICIENT_ADMIN_SCOPE` | 403 | สิทธิ์ผู้ดูแลระบบของคุณไม่ครอบคลุมขอบเขตนี้ |

---

# 3. Auth (A01–A06)

| code | HTTP | message | endpoint |
|---|---|---|---|
| `EMAIL_ALREADY_REGISTERED` | 400 | อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ | A01 (field: email) |
| `PASSWORD_TOO_WEAK` | 400 | รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีตัวเลขอย่างน้อย 1 ตัว | A01 (field: password) |
| `INVALID_CREDENTIALS` | 401 | อีเมลหรือรหัสผ่านไม่ถูกต้อง | A02 |
| `CURRENT_PASSWORD_INCORRECT` | 401 | รหัสผ่านเดิมไม่ถูกต้อง | A06 |
| `RESET_TOKEN_EXPIRED` | 410 | ลิงก์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่ | A05 |
| `RESET_TOKEN_ALREADY_USED` | 409 | ลิงก์นี้ถูกใช้ไปแล้ว | A05 |

> **`INVALID_CREDENTIALS` ใช้ข้อความเดียวกันทั้งกรณีอีเมลไม่มีในระบบและรหัสผ่านผิด** — ไม่แยกบอกว่าอันไหนผิด เพื่อไม่ให้เดารายชื่ออีเมลที่ลงทะเบียนไว้ได้ (หลักการเดียวกับ A04)

---

# 4. Users & Profile (U01–U11)

| code | HTTP | message | endpoint |
|---|---|---|---|
| `QUERY_TOO_SHORT` | 400 | กรุณาพิมพ์อย่างน้อย 3 ตัวอักษร | U06, U09 |
| `TOO_MANY_BADGES` | 422 | เลือก badge แสดงผลได้ไม่เกิน 5 อัน | U08 |
| `SUSPEND_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลในการระงับบัญชี | U10 (field: reason) |

---

# 5. Teams (T01–T20)

| code | HTTP | message | endpoint |
|---|---|---|---|
| `TEAM_NAME_TAKEN` | 409 | มีทีมชื่อนี้ในประเภทกีฬานี้แล้ว | T01 (field: name) |
| `TEAM_QUOTA_EXCEEDED` | 422 | คุณมีทีม Unofficial ครบ 5 ทีมแล้ว | T01, T13 (BR-05) |
| `TEAM_IN_COMPETITION` | 409 | ทีมนี้กำลังอยู่ระหว่างการแข่งขัน กรุณาใช้การถอนตัวแทนการลบทีม | T05 (FR-TM-05) |
| `ALREADY_MEMBER` | 409 | ผู้ใช้นี้อยู่ในทีมแล้ว | T09 |
| `INVITATION_ALREADY_ANSWERED` | 409 | คำเชิญนี้ถูกตอบรับ/ปฏิเสธไปแล้ว ยกเลิกไม่ได้ | T11 |
| `INVITATION_EXPIRED` | 410 | คำเชิญนี้หมดอายุแล้ว | T13 |
| `OFFICIAL_DOCS_REQUIRED` | 400 | กรุณาแนบเอกสารประกอบคำร้อง | T15 (field: supportingDocs) |
| `MEMBER_CONFLICT` | 422 | สมาชิกบางคนสังกัดทีม Official อื่นในกีฬาเดียวกันแล้ว | T17 (BR-05) — มากับ `conflictingMembers` |
| `TEAM_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ปฏิเสธคำร้อง | T18 (field: reason) |
| `NOT_OFFICIAL_TEAM` | 403 | การโอนย้ายสิทธิ์หัวหน้าทีมใช้ได้เฉพาะทีม Official | T19 (BR-07) |
| `NOT_A_TEAM_MEMBER` | 422 | ผู้ใช้ที่เลือกต้องเป็นสมาชิกของทีมนี้อยู่แล้ว | T19 |

---

# 6. Tournaments (C01–C18)

| code | HTTP | message | endpoint |
|---|---|---|---|
| `INVALID_DATE_RANGE` | 400 | วันแข่งขันต้องอยู่หลังวันปิดรับสมัคร | C01 (field: eventStartDate) |
| `TOURNAMENT_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ไม่อนุมัติ | C05 (field: reason) |
| `REFEREES_INCOMPLETE` | 409 | กรุณาแต่งตั้งกรรมการให้ครบก่อนเปิดเผยแพร่ | C13 (BR-10) — มากับ `refereesAccepted`/`refereesRequired` |
| `AMENDMENT_FIELD_NOT_ALLOWED` | 400 | ฟิลด์นี้ต้องแก้ผ่านการขออนุมัติเปลี่ยนแปลง ไม่ใช่แก้ตรงนี้ | C08 (FR-OM-01) |

---

# 7. Referees (F01–F13)

> **★ อัปเดต 2 ส.ค. 2569 (รอบที่ 4):** ลบ `ALREADY_INVITED` ออก เพราะ `tournament_referees` ตัด `UNIQUE(tournament_id, user_id)` ออกแล้ว (ข้อ 9 — เชิญกรรมการซ้ำได้ไม่จำกัดครั้ง) F01 จึงไม่มีทาง error แบบนี้อีกต่อไป — ทุก query ตรวจสิทธิ์ต้องดึงแถวล่าสุดด้วย `ORDER BY created_at DESC LIMIT 1` แทน

| code | HTTP | message | endpoint |
|---|---|---|---|
| `WOULD_BREAK_REFEREE_MINIMUM` | 409 | ถอดกรรมการคนนี้จะทำให้จำนวนกรรมการไม่ครบเงื่อนไข กรุณาปิดการเผยแพร่ทัวร์นาเมนต์ก่อน | F03 (BR-10) |
| `NOT_EXTERNAL` | 400 | กรรมการคนนี้ไม่ใช่บุคคลภายนอก ไม่ต้องขออนุมัติ | F07 |
| `REFEREE_NOT_ACCEPTED` | 409 | กรรมการคนนี้ยังไม่ได้ตอบรับเข้าร่วมทัวร์นาเมนต์ | F11 (ข้อ 12.1 — ลำดับบังคับ F05 ก่อน F11) |

---

# 8. Applications (P01–P09)

| code | HTTP | message | endpoint |
|---|---|---|---|
| `HARD_FILTER_FAILED` | 422 | สมาชิกบางคนไม่ผ่านเงื่อนไขการสมัคร | P01 (BR-08) — มากับ `details` รายบุคคล |
| `REGISTRATION_CLOSED` | 409 | ทัวร์นาเมนต์นี้ปิดรับสมัครแล้ว | P01 |
| `ALREADY_APPLIED` | 409 | ทีมนี้สมัครทัวร์นาเมนต์นี้ไปแล้ว | P01 |
| `TEAM_NOT_READY` | 409 | ทีมต้องมีสถานะ Ready ก่อนสมัครเข้าร่วม | P01 (BR-04) |
| `APPLICATION_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ปฏิเสธใบสมัคร | P06 (field: reason) |
| `ALREADY_DECIDED` | 409 | คำขอนี้ถูกพิจารณาไปแล้ว ยกเลิกไม่ได้ | P07 |

---

# 9. Brackets & Matches (M01–M16)

| code | HTTP | message | endpoint |
|---|---|---|---|
| `TEAM_COUNT_MISMATCH` | 422 | จำนวนทีมไม่สอดคล้องกับรูปแบบการแข่งขันที่เลือก | M01 |
| `BRACKET_ALREADY_STARTED` | 409 | ไม่สามารถจัดสายใหม่ได้ เพราะมีการแข่งขันเริ่มไปแล้ว | M03 |
| `SCHEDULE_CONFLICT` | 409 | ทีมหรือสนามนี้มีนัดแข่งในเวลาดังกล่าวแล้ว | M06 (FR-MM-02) — มากับ `conflictingMatchId` |
| `VENUE_CONFLICT` | 409 | สนามนี้ถูกใช้ในเวลาเดียวกันแล้ว | M07 |
| `MODE_LOCKED` | 409 | ไม่สามารถแก้โหมดการแข่งขันได้ เพราะเปิดเช็คอินไปแล้วหรือแมตช์เริ่มแล้ว | M08 |
| `INSUFFICIENT_CHECKINS` | 409 | ยังมีผู้เล่นเช็คอินไม่ครบ | M10 |
| `NOT_IN_APPROVED_ROSTER` | 403 | คุณไม่อยู่ในรายชื่อทีมที่ได้รับอนุมัติของแมตช์นี้ | M12 |
| `CHECKIN_QR_MISMATCH` | 400 | QR Code นี้ไม่ตรงกับแมตช์นี้ | M12 (method='qr') |
| `CHECKIN_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ปฏิเสธการยืนยันตัวตน | M15 (field: reason) |

---

# 10. Match Results (S01–S12)

| code | HTTP | message | endpoint |
|---|---|---|---|
| `WRONG_SUBMITTER_ROLE` | 403 | ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้ | S01 (BR-13) |
| `INSUFFICIENT_REFEREES` | 409 | ต้องมีกรรมการยืนยันแล้วอย่างน้อย 2 คนสำหรับการแข่งแบบ on-site ที่บันทึกสถิติ | S01 (BR-11) |
| `SAME_PERSON_CANNOT_VERIFY` | 403 | ผู้ยืนยันต้องไม่ใช่คนเดียวกับผู้ส่งผล | S02 (BR-12) |
| `DISPUTE_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลในการโต้แย้งผล | S03 (field: reason) |
| `DISPUTE_WINDOW_CLOSED` | 409 | พ้นระยะเวลาที่เปิดให้โต้แย้งผลแล้ว | S03 (`dispute_window_hours`) |
| `DISPUTE_ALREADY_ACTIVE` | 409 | มีข้อโต้แย้งที่ยังไม่ได้ข้อยุติอยู่แล้ว | S03 (BR-14) |
| `AMEND_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลในการแก้ไขผลย้อนหลัง | S08 (field: amendReason) |
| `CANNOT_AMEND_WINNER` | 409 | แก้ผู้ชนะไม่ได้ เพราะแมตช์รอบถัดไปเริ่มไปแล้ว กรุณาติดต่อผู้จัดการแข่งขัน | S08 (ข้อ 12.2 — ต้องเช็คก่อนเริ่มทรานแซกชัน) |

---

# 11. Engagement (E01–E33)

| code | HTTP | message | endpoint |
|---|---|---|---|
| `COMMENT_RATE_LIMITED` | 429 | ส่งความคิดเห็นถี่เกินไป กรุณารอสักครู่ | E13 (10 ครั้ง/นาที) |
| `ORGANIZER_FEEDBACK_ALREADY_SUBMITTED` | 409 | คุณส่ง Feedback ให้ทัวร์นาเมนต์นี้ไปแล้ว | E18 |
| `PLAYER_CANNOT_VOTE` | 403 | ผู้ที่ลงแข่งขันในรายการนี้ไม่สามารถโหวตได้ | E20, E21 (FR-CM-03) |
| `VOTING_NOT_OPEN` | 409 | ยังไม่เปิดโหวต MVP หรือปิดโหวตไปแล้ว | E20 |
| `VOTING_CLOSED` | 409 | พ้นระยะเวลาที่เปิดให้โหวตแล้ว | E21 (`dispute_window_hours`) |
| `QUESTION_ALREADY_ANSWERED` | 409 | คำถามนี้ถูกตอบไปแล้ว | E25 |
| `PREDICTION_CLOSED` | 409 | ไม่สามารถทายผลได้ เพราะเลยเวลาเริ่มแข่งขันแล้ว | E26 (เช็คจาก `scheduled_time`) |
| `INSUFFICIENT_POINTS` | 422 | แต้มไม่เพียงพอสำหรับแลกรางวัลนี้ | E32 (BR-15) |

> **★ อัปเดต 2 ส.ค. 2569 (รอบที่ 4):** เพิ่ม error สำหรับ `/admin/rewards` (CRUD) ที่ยังไม่มี endpoint จริงมาก่อน — ตารางนี้เขียนล่วงหน้าไว้ก่อน endpoint จะถูกเพิ่มจริงในตอนที่ 2/3.1 (ดูข้อ 3 ของแผนแก้ไข)

| code | HTTP | message | endpoint |
|---|---|---|---|
| `REWARD_NOT_FOUND` | 404 | ไม่พบรางวัลนี้ | `PATCH/DELETE /admin/rewards/:id` |
| `REWARD_NAME_REQUIRED` | 400 | กรุณาระบุชื่อรางวัล | `POST /admin/rewards` (field: name) |
| `REWARD_IN_USE` | 409 | ไม่สามารถลบรางวัลนี้ได้ เพราะมีผู้ใช้แลกไปแล้ว | `DELETE /admin/rewards/:id` (มี `user_rewards` อ้างอิงอยู่) |

---

# 12. Upload (M16)

| code | HTTP | message |
|---|---|---|
| `UNSUPPORTED_FILE_TYPE` | 400 | รองรับเฉพาะไฟล์ JPEG และ PNG เท่านั้น |
| `FILE_TOO_LARGE` | 400 | ขนาดไฟล์เกินกำหนด |
| `INVALID_YOUTUBE_URL` | 400 | ลิงก์ YouTube ไม่ถูกต้อง |

---

# 13. หลักการตั้งชื่อ error code — สรุปเพื่ออ้างอิงตอนเพิ่ม endpoint ใหม่

เมื่อต้องเพิ่ม error code ใหม่ที่ไม่มีในตารางนี้ ให้ยึดกฎ 4 ข้อ:

1. **บอกสาเหตุ ไม่ใช่ผลลัพธ์** — `TEAM_QUOTA_EXCEEDED` (สาเหตุ) ไม่ใช่ `CANNOT_CREATE_TEAM` (ผลลัพธ์ที่คลุมเครือ ใช้ได้กับหลายสาเหตุ)
2. **ค้นหาในตารางนี้ก่อนตั้งชื่อใหม่เสมอ** — ถ้ามี pattern ใกล้เคียงอยู่แล้ว (เช่น `*_REASON_REQUIRED` สำหรับ endpoint ที่บังคับเหตุผล) ให้ใช้ pattern เดิม
3. **ระบุ resource ในชื่อถ้าอาจกำกวม** — `INVITATION_EXPIRED` ชัดกว่า `EXPIRED` เฉยๆ เพราะระบบมีทั้งคำเชิญเข้าทีมและ token รีเซ็ตรหัสผ่านที่หมดอายุได้เหมือนกัน
4. **`message` ต้องบอกวิธีแก้เมื่อเป็นไปได้** — เทียบ `TEAM_IN_COMPETITION` ("...กรุณาใช้การถอนตัวแทนการลบทีม") กับการบอกแค่ "ทำรายการไม่ได้" เฉยๆ

**Pattern ที่ใช้ซ้ำได้บ่อย:**
- `*_NOT_FOUND` (404) — resource ไม่มีอยู่จริง
- `*_REASON_REQUIRED` (400) — endpoint ที่บังคับ `reason`/`amendReason` ต้องมี field นี้
- `*_ALREADY_*` (409) — พยายามทำซ้ำสิ่งที่ทำไปแล้ว (แต่อย่าลืมเช็คว่าเข้าเงื่อนไข idempotent หรือไม่ก่อน — บาง endpoint ต้องตอบ 200 ไม่ใช่ error ตามหัวข้อ 1.11 ของตอนที่ 0–1)
- `*_CLOSED`/`*_LOCKED` (409) — พ้นช่วงเวลาหรือเงื่อนไขที่อนุญาตให้ทำ
- `NOT_*` (403) — ไม่ใช่บทบาทที่ต้องมี

---

# 14. ลำดับถัดไป

| ตอน | เนื้อหา | สถานะ |
|---|---|---|
| 0–1 | Conventions + Resource Inventory | ✅ |
| 2 | Endpoint Matrix (142 endpoint) | ✅ |
| 3 | Schema (MVP — 92 endpoint) | ✅ |
| 3.1 | Schema (Sprint #1/#2 — 50 endpoint) | ✅ |
| **4** | **Error Catalog** | ✅ เอกสารนี้ |
| 5 | OpenAPI 3.1 YAML | ถัดไป |

**สำหรับตอนที่ 5** — แปลง endpoint matrix + schema + error catalog ทั้งหมดเป็น OpenAPI 3.1 YAML ไฟล์เดียว จะได้ใช้เปิดใน Swagger UI และ generate TypeScript type ให้ frontend ได้ ขนาดไฟล์จะใหญ่ (142 endpoint) เสนอให้แบ่งเป็นไฟล์ตาม tag/กลุ่ม แทนที่จะเป็นไฟล์เดียวยาว 3000+ บรรทัด
