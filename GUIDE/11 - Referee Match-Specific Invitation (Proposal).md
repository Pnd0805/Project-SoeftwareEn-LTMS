# 11 · ข้อเสนอเปลี่ยนรูปแบบการเชิญกรรมการ (Match-Specific Invitation)

> สถานะ: **มีมติแล้ว (2026-09-13) — รอ implement** ดู §8 และ §10
> วันที่: 2026-09-13
> เกี่ยวข้องกับ: `GUIDE/10 - Step 6 · Referees (F01-F13).md`, `API_Design/06 - Endpoint Reference MVP 93.md`

---

## 1. โจทย์จากทีม (Prompt)

> ทางทีมตกลงกันว่าแทนที่จะหากรรมการขั้นต่ำจะเปลี่ยนเป็นเชิญกรรมการโดยเมื่อเชิญจะแนบแมชต์และเวลาที่ ORG เลือกให้กรรมการคนนั้น หากกรรมการกดยอมรับจะเพิ่มชื่อกรรมการลงแมชต์เลย แต่การเชิญแบบเจาะจงเลยมันเลยเสียความยืดหยุ่นแบบ Ref pool ไป เลยคิดว่ายังจะสามารถให้ทั้ง Ref และ ORG สามารถปรับเปลี่ยนภายหลังได้แบบหาก REF ต้องการแลกกับ REF อีกคนจะส่งคำขอไปโดยระบุว่าต้องการแลกแมชต์ไหนกับแมชต์ไหน หากตกลงระบบจะไปแจ้ง ORG อีกที (หรือหากคิดว่าควรแจ้ง ORG ตั้งแต่ขอแลก) ส่วนฝั่ง ORG เพิ่มแมชต์ที่ ref ต้องรับผิดชอบ (เพิ่มไปในแมชต์ที่ ref ยังขาดอยู่) จะส่งคำขอไปยัง ref คนนั้น ส่วนกรณีที่จะสลับตำแหน่งระหว่าง 2 REF ก็เหมือนเดิมส่งคำขอไปที่ทั้งคู่จะสลับต่อเมื่อกดยอมรับทั้งคู่ หากทำตามนี้จะมีปัญหาที่ต้องแก้ตามมาอะไรบ้าง

สรุปโฟลว์ที่เสนอ:

1. ORG เชิญกรรมการ **พร้อมแนบแมตช์** ที่ต้องรับผิดชอบ
2. กรรมการกดยอมรับ → ระบบใส่ชื่อลง `match_referees` ทันที
3. ปรับเปลี่ยนภายหลังได้ 3 ทาง (ทุกทางเป็น "คำขอ" ต้องมีคนตอบรับ)
   - **REF → REF** ขอแลกแมตช์ ระบุแมตช์ไหนกับแมตช์ไหน ตกลงแล้วระบบแจ้ง ORG
   - **ORG → REF** ขอเพิ่มแมตช์ให้กรรมการ (ลงแมตช์ที่ยังขาดคน)
   - **ORG → REF ×2** ขอสลับตำแหน่งสองคน สลับต่อเมื่อยอมรับทั้งคู่

---

## 2. ภาพรวมผลกระทบ

โฟลว์นี้เปลี่ยน "หน่วยของงาน" จาก **กรรมการ 1 คนต่อทัวร์** เป็น **กรรมการ 1 คนต่อแมตช์** ซึ่งกระทบเกือบทุกจุดที่เขียนไปใน Step 6 แบ่งปัญหาเป็น 4 กลุ่มตามความหนัก

---

## 3. ปัญหาเชิงข้อมูล (ต้องแก้ schema)

| ปัญหา | ตอนนี้ | ต้องมี |
|---|---|---|
| คำเชิญไม่มีที่เก็บ "แมตช์ที่แนบมา" | `tournament_referees` มีแค่ tournament + user | ต้องเก็บ match ต่อคำเชิญ |
| `match_referees` แปลว่า "ถูก assign แล้ว" เท่านั้น | ไม่มีสถานะ | ต้องแยก *เสนอ* / *ตอบรับ* / *ปฏิเสธ* |
| คำขอแลก/เพิ่มแมตช์ไม่มีตาราง | — | ตารางใหม่ + state machine หลายฝ่าย |

### 3.1 ทางที่กระทบน้อยสุด — ให้ `match_referees` เป็นตัวเก็บคำเชิญเอง

ไม่สร้างตารางคำเชิญใหม่ แค่เพิ่มสถานะ:

```sql
ALTER TABLE match_referees
  ADD COLUMN assignment_status ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  ADD COLUMN responded_at DATETIME NULL;
```

- **F01 เชิญ** = สร้าง `tournament_referees` 1 แถว + `match_referees` N แถว (`pending`)
- **F05 accept** = flip `tournament_referees` → `accepted` **และ** `match_referees` ทุกแถวของคนนั้น → `accepted`
- `UNIQUE(match_id, tournament_referee_id)` ที่มีอยู่แล้วกันเสนอแมตช์เดิมซ้ำให้ฟรี

### 3.2 ตารางคำขอเปลี่ยนแปลง (ต้องมีจริง)

```sql
CREATE TABLE referee_change_requests (
  request_id        INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id     INT NOT NULL,
  request_type      ENUM('ref_swap','org_add_match','org_swap') NOT NULL,
  requested_by      INT NOT NULL,          -- user_id ผู้สร้างคำขอ
  referee_a_id      INT NOT NULL,          -- tournament_referee_id
  referee_b_id      INT NULL,
  match_a_id        INT NOT NULL,          -- แมตช์ที่ A จะให้ / รับ
  match_b_id        INT NULL,              -- แมตช์ที่ B จะให้ (กรณีแลกเปลี่ยน) — NULL = โอนทางเดียว
  a_status          ENUM('pending','accepted','declined') NOT NULL,
  b_status          ENUM('not_required','pending','accepted','declined') NOT NULL,
  request_status    ENUM('open','applied','declined','cancelled','expired') NOT NULL DEFAULT 'open',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at       DATETIME NULL
);
```

| request_type | ผู้สร้าง | ต้องตอบรับ | apply เมื่อ |
|---|---|---|---|
| `ref_swap` | REF A | REF B (A ถือว่า accepted ตั้งแต่สร้าง) | B accept |
| `org_add_match` | ORG | REF A | A accept |
| `org_swap` | ORG | REF A และ REF B | ทั้งคู่ accept |

---

## 4. กฎธุรกิจใหม่ที่เกิดขึ้นทันที (ก่อนหน้านี้ไม่ต้องมี)

### 4.1 กรรมการห้ามซ้อนเวลา (double-booking)

ตอนเป็น pool ไม่ต้องเช็ค เพราะยังไม่ผูกแมตช์ แต่พอเชิญแบบเจาะจง ต้องเช็คทุกจุดที่ "ใส่แมตช์ให้กรรมการ":

- F01 เชิญ — แมตช์ในชุดเดียวกันซ้อนกันเองก็ไม่ได้
- ORG ขอเพิ่มแมตช์
- แลก/สลับ — ต้องเช็ค **ทั้งสองคนหลังแลก** ไม่ใช่ก่อนแลก
- **M06 แก้เวลาแมตช์** ← จุดที่คนลืม: ORG เลื่อนเวลาแมตช์ทีหลัง ทำให้กรรมการที่เคยไม่ซ้อนกลายเป็นซ้อน ทีม Matches ต้องเช็คด้วย หรือยอมรับว่าซ้อนได้แต่ระบบเตือน

query เช็คซ้อนใช้ `scheduled_end_time` ที่เพิ่งเพิ่ม — เงื่อนไขเดียวกับ `findMaxConcurrentRefereeNeed`:

```sql
-- แมตช์ที่กรรมการ (tournament_referee_id = ?) รับผิดชอบอยู่ ซ้อนเวลากับแมตช์ ? ไหม
SELECT m.match_id
FROM match_referees mr
JOIN matches m  ON m.match_id = mr.match_id
JOIN matches t  ON t.match_id = ?              -- แมตช์ที่กำลังจะเพิ่ม
WHERE mr.tournament_referee_id = ?
  AND mr.assignment_status IN ('pending','accepted')
  AND m.scheduled_time < t.scheduled_end_time
  AND t.scheduled_time < m.scheduled_end_time;
```

### 4.2 BR-10 เปลี่ยนความหมาย

จาก "จำนวนกรรมการ ≥ ที่ต้องการ" เป็น **"ทุกแมตช์มีกรรมการครบ"** (onsite + มี stat = 2, อื่น = 1, นับเฉพาะ accepted และ status = active)

- `requiredRefereeCount` / `findMaxConcurrentRefereeNeed` (commit `f7017d9`) **กลายเป็นของเก่า** → เปลี่ยนเป็น query หา "แมตช์ที่ยังขาด"
- **F03 ถอดกรรมการ**: จาก "ถอดแล้วต่ำกว่าขั้นต่ำไหม" เป็น "ถอดแล้วแมตช์ X, Y จะไม่มีคน" — ต้องตัดสินใจว่า **ห้าม** หรือ **ยอมแต่แจ้ง**
- จุด publish / เปิดทัวร์ของทีม Tournaments ต้องเรียก coverage check ตัวใหม่
- `acceptedCount` / `effectiveCount` ใน F02 มีความหมายน้อยลง ควรเปลี่ยนเป็น `matchesCovered / matchesTotal`
- สไลด์หน้า 3 (BR-10 formula) ต้องแก้ตาม

### 4.3 กรรมการภายนอกชนกับ "accept แล้วลงแมตช์เลย"

external accept → `pending_admin` → ยังลงแมตช์ไม่ได้ ดังนั้น "accept แล้วเพิ่มชื่อลงแมตช์เลย" ใช้กับ external ตรง ๆ ไม่ได้ ต้องเลือก:

- **(ก) แนะนำ** — ลง `match_referees` เป็น `accepted` ทันที แต่ F12 / coverage ยังกรองด้วย `toRefereeStatus() === 'active'` เหมือนเดิม → gate 2 ชั้นที่ทำไว้ยังใช้ได้ ไม่ต้องแตะอะไร
- (ข) รอ admin approve ค่อยลงแมตช์ → ต้องเพิ่ม hook ในฝั่ง admin

---

## 5. ปัญหาของระบบคำขอ (ส่วนที่ใหญ่ที่สุด)

### 5.1 คำขอชนกัน

ตัวอย่าง: A ขอแลกแมตช์ 5 กับ B, ขณะเดียวกัน ORG ขอเพิ่มแมตช์ 5 ให้ C, และ ORG ถอด A ออกจากทัวร์ — ทั้งสามคำขอ `open` พร้อมกัน

- ตอน apply คำขอใดคำขอหนึ่ง ต้อง **re-validate ทั้งหมดใหม่** (A ยังอยู่ในแมตช์ 5 ไหม, B ยังไม่ซ้อนไหม, แมตช์ยังไม่เริ่มไหม) ไม่ใช่เชื่อข้อมูลตอนสร้างคำขอ
- คำขออื่นที่อ้างแมตช์/กรรมการเดียวกันควร **auto-cancel** เมื่อคำขอหนึ่งถูก apply หรือเมื่อ F03/F13 ถอดคน
- ต้องใช้ **transaction + `SELECT ... FOR UPDATE`** ตอน apply — โค้ด referee ตอนนี้ยังไม่มี transaction เลย (ใช้ `pool.query` ตรง ๆ) ต้องเปลี่ยนเป็น `pool.getConnection()` สำหรับจุดนี้

### 5.2 กติกาของ "แลก" ยังคลุมเครือ — ต้องนิยามก่อนเขียน

- แลก = **แลกเปลี่ยน** (A ให้ X, รับ Y จาก B) หรือ **โอน** (A ให้ X แก่ B เฉย ๆ)? กรณีใช้บ่อยน่าจะโอน ("ฉันติดธุระ ช่วยรับแทนที") ควรรองรับทั้งสองแบบ — `match_b_id = NULL` = โอน
- ORG ต้อง **อนุมัติ** หรือแค่ **รับแจ้ง**? ถ้าอนุมัติ = 3 ฝ่าย ช้าและมีโอกาสค้าง
  **แนะนำ**: สองกรรมการตกลง → apply ทันที → แจ้ง ORG → ORG มีสิทธิ์ยกเลิกด้วย F13 อยู่แล้ว ไม่ต้องเพิ่ม gate
- ต้อง reject: แลกกับตัวเอง / แลกแมตช์เดียวกัน / B ยังไม่ accept คำเชิญ / B เป็น external ที่ยัง `pending_admin` / มีคำขอ open ซ้ำคู่เดิม

### 5.3 เวลา

- คำขอต้องปฏิเสธถ้าแมตช์ **เริ่มไปแล้ว / จบแล้ว / ยกเลิก** และควรมี buffer (เช่น ห้ามแลกก่อนแข่ง < 1 ชม.)
- คำเชิญและคำขอที่ **ไม่มีใครตอบ** จนถึงเวลาแข่ง จะค้างเป็น `open` ตลอดกาล ต้องมีจุด expire — ไม่มี cron ในโปรเจกต์ ทำง่ายสุดคือ expire ตอนอ่าน (lazy) หรือเช็คตอน start match

### 5.4 การแจ้งเตือน

ทุกก้าวของโฟลว์นี้พึ่ง "ระบบจะไปแจ้ง ORG/REF" ตอนนี้ยังไม่มีตาราง/endpoint notification (ต้องเช็คใน 06 ว่าอยู่ sprint ไหน) ถ้าไม่มี อย่างน้อยต้องมี inbox แบบ pull (`GET /me/referee-requests`) ไม่งั้นคำขอส่งไปแล้วไม่มีใครเห็น

---

## 6. กระทบ endpoint ที่ทำไปแล้ว (Step 6)

| Endpoint | เปลี่ยนเป็น |
|---|---|
| F01 invite | body เพิ่ม `matchIds: number[]` + เช็คแมตช์อยู่ทัวร์นี้ + ไม่ซ้อนเวลา |
| F02 list | เพิ่ม `matches[]` ต่อคน + `matchesCovered / matchesTotal` |
| F03 remove | เปลี่ยนเช็ค BR-10 → cascade คำขอ open ของคนนั้น |
| F04 my invitations | ต้องแสดงแมตช์ที่แนบมา (ไม่งั้นกรรมการตัดสินใจไม่ได้) |
| F05 accept | เขียน `match_referees` ด้วย + ตกลง **all-or-nothing** (accept บางแมตช์ไม่ได้) |
| F06 decline | `match_referees` ของคนนั้น → `declined` |
| F11 assign | **หายไป** — ORG เพิ่มแมตช์ต้องผ่านคำขอ ไม่ใช่ assign ตรง |
| F12 list by match | filter เพิ่ม `assignment_status = 'accepted'` |
| F13 unassign | คงไว้ (ORG ถอดได้ทันที ไม่ต้องขอ) แต่ cascade คำขอ |

### Endpoint ใหม่ที่ต้องเพิ่ม (ประมาณ)

| # | Method | Path | ผู้ใช้ |
|---|---|---|---|
| R01 | POST | `/referee-requests/swap` | REF — ขอแลก/โอนกับ REF อื่น |
| R02 | POST | `/tournaments/:id/referee-requests/add-match` | ORG — ขอเพิ่มแมตช์ให้ REF |
| R03 | POST | `/tournaments/:id/referee-requests/swap` | ORG — ขอสลับ 2 REF |
| R04 | GET | `/me/referee-requests` | REF — คำขอที่รอฉันตอบ |
| R05 | GET | `/tournaments/:id/referee-requests` | ORG — คำขอทั้งหมดในทัวร์ |
| R06 | POST | `/referee-requests/:id/accept` | REF |
| R07 | POST | `/referee-requests/:id/decline` | REF |
| R08 | DELETE | `/referee-requests/:id` | ผู้สร้าง — ยกเลิกคำขอ |

รวม ≈ 8 endpoint → **ใหญ่เท่า Step 6 ทั้งก้อน**

---

## 7. ข้อเสนอเพื่อไม่เสียความยืดหยุ่นแบบ pool

ทำ `matchIds` เป็น **optional** ใน F01:

- ส่ง `matchIds: [1, 2, 3]` → เชิญแบบเจาะจง accept แล้วลงแมตช์เลย
- ส่ง `[]` หรือไม่ส่ง → เชิญเข้า pool เหมือนเดิม เป็นกรรมการสำรองที่ ORG ค่อยส่งคำขอเพิ่มแมตช์ให้ทีหลัง (R02)

ได้ทั้งสองโลกด้วยโค้ดเพิ่มน้อยที่สุด และโฟลว์ "ORG เพิ่มแมตช์" ที่ทีมอยากได้อยู่แล้วก็รองรับ pool ไปในตัว

---

## 8. มติทีม (2026-09-13)

| # | คำถาม | มติ | หมายเหตุ |
|---|---|---|---|
| Q1 | accept คำเชิญ | **เลือกได้บางแมตช์** — REF เลือกเองว่ารับแมตช์ไหน ไม่ต้องรับทั้งหมด | สะดวกกับ REF กว่า → ดู §10.1 |
| Q2 | "แลก" คือ | **ทั้งสอง** — REF ขอ *โอน* หรือ *แลก* กับ REF คนอื่นในทัวร์ได้ | `match_b_id` NULL = โอน |
| Q3 | ORG ในคำขอแลก | **แค่รับแจ้ง** | สองฝ่ายตกลง → apply ทันที → แจ้ง ORG; ORG ยกเลิกได้ด้วย F13 |
| Q4 | ถอดกรรมการแล้วแมตช์ว่าง | **ยอมแต่เตือน** ปล่อยให้ ORG จัดการเอง | F03 ไม่ block อีกต่อไป → ดู §10.2 |
| Q5 | external referee ลงแมตช์ | **ตอน accept + กรองด้วย `toRefereeStatus()` เดิม** | แถวใน `match_referees` = จอง, `active` = ใช้ได้จริง; admin ไม่ต้องแตะ `match_referees` |
| Q6 | M06 เลื่อนเวลาแล้วกรรมการซ้อน | **เตือน** — แสดงสัญลักษณ์ที่แมตช์นั้นให้ ORG เห็นว่าเวลา REF ทับกัน | ไม่ block → ดู §10.3 |
| Q7 | ระบบคำขอ R01–R08 | **Sprint นี้** | ขอบเขต Step 6 ขยายเป็น ~17 endpoint |

---

## 9. ความคืบหน้า

| ขั้น | สถานะ | commit |
|---|---|---|
| ALTER `match_referees` + F01/F04/F05/F06/F12 | ✅ | `d8e77d5` |
| ระบบ migration (`npm run migrate`) | ✅ | `f7218a2` |
| F03 ยอมแต่เตือน + `GET /tournaments/:id/referees/coverage` (F14) + ตัด BR-10 เก่า | ✅ | — |
| ตัด F11 (แทนด้วย R02) | ⏳ รอ R01–R08 | |
| R01–R08 ระบบคำขอ (+ `referee_change_requests`) | ⏳ | |
| อัปเดต `06 - Endpoint Reference` + สไลด์หน้า 3 | ⏳ | |
| ทีม Tournaments เรียก coverage ตอน publish (§10.2) | ⏳ ต้องคุย | |

### F14 · `GET /tournaments/:id/referees/coverage` (ORG)

```json
{
  "matchesTotal": 3,
  "matchesCovered": 2,
  "uncovered": [{ "matchId": 1, "roundNumber": 1, "scheduledTime": "...", "needed": 2, "assigned": 1 }],
  "conflicts": [{ "tournamentRefereeId": 18, "userId": 9003, "matchIds": [2, 3] }]
}
```

- `needed` = 2 ถ้า on-site และกีฬามี stat definition (BR-11) นอกนั้น 1 — นับเฉพาะกรรมการ `active`
- `conflicts` = กรรมการที่รับแมตช์ซ้อนเวลากัน (เกิดจาก ORG เลื่อนเวลาทีหลัง) — Q6: เตือน ไม่ block
- F03 คืน `200 { removed: true, uncoveredMatches: [...] }` แทน 204 — Q4
- ตัดออก: `requiredRefereeCount`, `findMaxConcurrentRefereeNeed`, `env.REFEREE_MINIMUM`, `WOULD_BREAK_REFEREE_MINIMUM`

---

## 10. ผลที่ตามมาจากมติ (ต้องออกแบบเพิ่ม)

### 10.1 Q1 — accept บางแมตช์ เปลี่ยน F05 มากกว่าที่คิด

`POST /referee-invitations/:id/accept` ต้องรับ body:

```json
{ "matchIds": [12, 15] }
```

กติกาที่ต้องตกลงเพิ่ม (ผมเสนอค่า default ไว้ให้ ถ้าไม่ค้านจะทำตามนี้):

| กรณี | เสนอ |
|---|---|
| `matchIds` ไม่อยู่ในชุดที่เชิญ | 400 `MATCH_NOT_IN_INVITATION` |
| `matchIds` ซ้อนเวลากันเอง | 409 `REFEREE_TIME_CONFLICT` (ตอนเชิญเช็คแล้ว แต่ ORG อาจเลื่อนเวลาระหว่างรอตอบ) |
| `matchIds: []` หรือไม่ส่ง | = **รับเข้าทัวร์แบบ pool** ไม่รับแมตช์ใดเลย → `tournament_referees.accepted`, `match_referees` ทั้งหมด → `declined` |
| แมตช์ที่ไม่ได้เลือก | `match_referees.assignment_status = 'declined'` (เก็บไว้ให้ ORG เห็นว่า REF ไม่รับอันไหน) |
| ตอบแล้วเปลี่ยนใจ | ไม่มี "แก้คำตอบ" — ใช้ R01/R02 (ขอเพิ่ม/โอน) แทน |

ผลข้างเคียง:

- **F06 decline** = ปฏิเสธทั้งคำเชิญ (ไม่รับเข้าทัวร์เลย) ต่างจาก accept แบบ `[]` ที่ยังอยู่ในทัวร์
- **F02** ต้องแสดงต่อกรรมการ: `matchesInvited / matchesAccepted` และรายการแมตช์ที่ REF ปฏิเสธ เพื่อ ORG ไปหาคนอื่นมาแทน
- **F04** ต้องส่งรายละเอียดแมตช์ (เวลา, สนาม, mode) ให้ REF ตัดสินใจได้
- `acceptRefereeInvitation` ใน service ต้องใช้ **transaction** (update `tournament_referees` + N แถว `match_referees` ให้จบพร้อมกัน) — จุดแรกที่ referee code ใช้ transaction

### 10.2 Q4 — F03 ไม่ block แล้ว → ต้องมีที่ให้ "เตือน"

- ตัด `WOULD_BREAK_REFEREE_MINIMUM` (409) ออกจาก F03 และตัด `requiredRefereeCount` / `findMaxConcurrentRefereeNeed` / `env.REFEREE_MINIMUM`
- F03 response เปลี่ยนจาก 204 เป็น **200** พร้อม body บอกแมตช์ที่กลายเป็นว่าง:

  ```json
  { "removed": true, "uncoveredMatches": [12, 15] }
  ```
- เพิ่ม `GET /tournaments/:id/referees/coverage` (หรือใส่ใน F02) คืน `matchesTotal / matchesCovered / uncovered: [...]` ให้หน้า ORG แสดงเตือน
- **ตอน publish ทัวร์** (ทีม Tournaments) ยังต้องเช็ค coverage — มติคือ "ยอมแต่เตือน" ตอนถอด แต่ตอน publish ควร block ไหม? **ต้องถามทีม Tournaments** ถ้าไม่ block เลย BR-10 จะหายไปทั้งข้อ

### 10.3 Q6 — สัญลักษณ์เตือนซ้อนเวลา ต้องมี field ให้ FE

- แมตช์ต้องมี field คำนวณ เช่น `refereeConflicts: [{ tournamentRefereeId, conflictingMatchId }]` — อยู่ใน response ของ M04/M05 (list/get match) ซึ่งเป็นของทีม Matches
- ทางที่ไม่ต้องแตะโค้ดทีม Matches: ใส่ใน F12 (`GET /matches/:id/referees`) แต่ละ item มี `conflictsWith: [matchId]` และใน coverage endpoint (§10.2) มี `conflicts: [...]` รวมทั้งทัวร์ → FE แสดงไอคอนจากตรงนี้ **แนะนำทางนี้**
- query ใช้ SQL self-join เดียวกับ §4.1 แต่ไม่มีเงื่อนไข `t.match_id = ?` → หา REF ที่มี 2 แมตช์ทับกันทั้งทัวร์

### 10.4 Q2/Q3 — กติกาคำขอ REF ↔ REF ที่ต้อง lock

- REF B ต้อง `toRefereeStatus() === 'active'` (external ที่ยัง `pending_admin` รับโอนไม่ได้)
- B ต้องไม่ซ้อนเวลาหลังรับ; ถ้าเป็นแลก A ก็ต้องไม่ซ้อนหลังรับ Y ด้วย
- ห้ามมีคำขอ `open` ซ้ำสำหรับ (match_a, referee_a) เดียวกัน
- apply ใน transaction: `SELECT ... FOR UPDATE` แถว `match_referees` ที่เกี่ยวข้อง → re-validate → UPDATE `tournament_referee_id` (แลก) หรือ DELETE + INSERT (โอน) → auto-cancel คำขอ open อื่นที่อ้างแมตช์เดียวกัน → บันทึก notification ให้ ORG
