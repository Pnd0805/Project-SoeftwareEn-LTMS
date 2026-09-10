# 10 — Step 6 · Referees (9 endpoint MVP)

> ต่อจาก [[05 - สูตรทำ endpoint + แผนงาน]] · ใช้คู่กับ [[06 - Endpoint Reference MVP 93]] §6
> endpoint ที่ทำใน Step นี้: **F01 F02 F03 F04 F05 F06 F11 F12 F13**
> (F07–F10 = Sprint #1 ข้ามไปก่อน)

---

## ⚠️ ก่อนเริ่ม — ของที่กลุ่มนี้ต้องพึ่ง

Referees เป็นกลุ่มแรกที่ **ไม่ยืนอยู่คนเดียว** ต้องมี 3 อย่างนี้ก่อน

| ต้องมี | ใช้ที่ไหน | ถ้ายังไม่มีทำยังไง |
|---|---|---|
| ตาราง `tournaments` มีข้อมูลจริง | F01–F06 ทุกตัว | `INSERT` มือด้วย SQL (ดู §7) |
| ตาราง `matches` มีข้อมูลจริง | F11–F13 | `INSERT` มือด้วย SQL |
| middleware `requireOrganizer` | 5 ใน 9 ตัว | **เขียนใน Step นี้เลย** (§3) |

> ไม่ต้องรอ Step 5 (Tournaments C01–C17) เสร็จ — สองกลุ่มนี้เชื่อมกันแค่ผ่าน `tournament_id`
> seed 1 ทัวร์ + 1 แมตช์ด้วย SQL แล้วทำ Referees ได้เลย

---

## 1. เข้าใจโมเดลก่อนเขียน (สำคัญที่สุดในหน้านี้)

**2 ตาราง 2 ระดับ — คนละเรื่องกัน**

```
tournament_referees   = "คุณเป็นกรรมการของทัวร์นี้ไหม"   ← ตอบรับครั้งเดียว
        │                (invitation_status, is_external, removed_at)
        │ 1 : N
match_referees        = "วันนี้คุณคุมแมตช์ไหน"            ← มอบหมายกี่ครั้งก็ได้
                         (match_id, tournament_referee_id)  ไม่มีคอลัมน์สถานะ
```

**กฎที่ตามมา 4 ข้อ — จำให้ได้ก่อนแตะโค้ด**

1. **F05 ต้องมาก่อน F11 เสมอ** — จะมอบหมายเข้าแมตช์ได้ ต้องมีแถวใน `tournament_referees` ที่ `accepted` อยู่ก่อน ไม่งั้น **409 `REFEREE_NOT_ACCEPTED`**
2. **สถานะตอบรับอยู่ที่ `tournament_referees` ที่เดียว** — อยากรู้ว่าคนนี้มีสิทธิ์คุมแมตช์จริงไหม ต้อง JOIN กลับไปเสมอ
3. **ไม่มี `UNIQUE(tournament_id, user_id)`** — เชิญคนเดิมซ้ำได้ไม่จำกัด เกิดแถวใหม่ทุกครั้ง → **ทุก query ที่ตัดสินสิทธิ์ต้องใช้แถวล่าสุดเท่านั้น** ไม่งั้นอ่านเจอแถวเก่าที่ `rejected` ปนกับแถวใหม่ที่ `accepted`
4. **`removed_at IS NULL` ต้องอยู่ในทุก WHERE** — F03 เป็น soft delete ลืมเงื่อนไขนี้ = คนที่ถูกถอดแล้วยังคุมแมตช์ได้

**คนนอก (external) มี 2 ด่าน** — `invitation_status='accepted'` **และ** `external_approval_status='approved'`
ด่านที่ 2 คือ F07–F10 ซึ่งเป็น Sprint #1 → MVP นี้ให้เขียนเงื่อนไขเผื่อไว้ในฟังก์ชันเช็คสิทธิ์ตั้งแต่แรก จะได้ไม่ต้องไล่แก้ทีหลัง

---

## 1.5 วิธีรับมือ "แถวซ้ำ" — 4 มาตรการ

ปัญหา: ไม่มี `UNIQUE` แปลว่า user คนเดียวมีได้หลายแถวในทัวร์เดียว สถานะไม่ตรงกัน แก้ด้วย 4 อย่างนี้พร้อมกัน

**① รวมนิยาม "แถวที่มีผล" ไว้ที่ repo ฟังก์ชันเดียว — ห้ามเขียน SQL หาแถวกระจายในหลายที่**

```ts
// repositories/tournamentReferee.repo.ts
export async function findLatestByTournamentAndUser(tournamentId: number, userId: number) {
    const [rows] = await pool.query<(TournamentRefereeRow & RowDataPacket)[]>(
        `SELECT * FROM tournament_referees
         WHERE tournament_id = ? AND user_id = ?
         ORDER BY tournament_referee_id DESC LIMIT 1`, [tournamentId, userId]);
    return rows[0] ?? null;      // ★ ไม่กรอง removed_at ที่นี่ — ให้ service เป็นคนตัดสิน
}
```

**② เขียนฟังก์ชันตัดสินสิทธิ์ตัวเดียว ใช้ซ้ำทุกที่** (F11 วันนี้ · `requireReferee` ของ Step 8-9 พรุ่งนี้)

```ts
// services/referee.service.ts
export function isActiveReferee(tr: TournamentRefereeRow | null): boolean {
    if (!tr) return false;
    if (tr.removed_at !== null) return false;
    if (tr.invitation_status !== 'accepted') return false;
    if (tr.is_external && tr.external_approval_status !== 'approved') return false;   // ด่าน 2 ของคนนอก
    return true;
}
```

**③ F01 กันการเชิญทับสถานะ** — เชิญคนที่ `accepted` อยู่แล้วซ้ำ จะเกิดแถว `pending` ใหม่ที่กลายเป็นแถวล่าสุด
= **สิทธิ์ที่เขาตอบรับไปแล้วโดนลดกลับเป็นรอตอบเงียบๆ** (BR-10 พังทันที ทัวร์ที่ public อยู่กลายเป็นกรรมการไม่ครบ)

```
เชิญใหม่ได้ก็ต่อเมื่อ  ไม่มีแถวเดิม  หรือ  แถวล่าสุด rejected  หรือ  แถวล่าสุด removed แล้ว
แถวล่าสุดเป็น pending  → 409 REFEREE_INVITATION_PENDING  'ผู้ใช้นี้มีคำเชิญที่ยังไม่ได้ตอบอยู่แล้ว'
แถวล่าสุดเป็น accepted → 409 REFEREE_ALREADY_ACCEPTED   'ผู้ใช้นี้เป็นกรรมการของทัวร์นาเมนต์นี้อยู่แล้ว'
```
> เอกสารบอกว่า "เชิญซ้ำได้ไม่จำกัด" ซึ่งเจตนาจริงคือ **เชิญใหม่ได้หลังถูกปฏิเสธ/ถูกถอด** ไม่ใช่เชิญทับคนที่ตอบรับแล้ว
> → เป็นการตีความ ไม่ใช่ขัดสเปก แต่ต้องบันทึกลง [[07 - จุดที่ต้องยืนยันกับทีม]] (F-7)

**④ F03 ถอดทีเดียวให้หมดทุกแถวของคนนั้น** ไม่ใช่ถอดแค่ `:rid` แถวเดียว

```sql
UPDATE tournament_referees SET removed_at = NOW(), removed_by = ?
WHERE tournament_id = ? AND user_id = ? AND removed_at IS NULL
```
(อ่าน `user_id` มาจากแถว `:rid` ก่อน) — ถ้าถอดแค่แถวเดียว แถวเก่าที่ค้างอยู่จะโผล่มาแทนที่

---

## 2. ไฟล์ที่ต้องสร้าง

```
src/types/db.ts                             + TournamentRow, MatchRow, TournamentRefereeRow, MatchRefereeRow
src/middlewares/requireOrganizer.ts         ★ ใหม่
src/schemas/referee.schema.ts               ★ ใหม่  (F01, F11)
src/repositories/tournament.repo.ts         ★ ใหม่  (แค่ findById พอ)
src/repositories/match.repo.ts              ★ ใหม่  (แค่ findById พอ)
src/repositories/tournamentReferee.repo.ts  ★ ใหม่
src/repositories/matchReferee.repo.ts       ★ ใหม่
src/mappers/referee.mapper.ts               ★ ใหม่
src/services/referee.service.ts             ★ ใหม่
src/controllers/referee.controller.ts       ★ ใหม่
src/routes/tournament.routes.ts             ★ ใหม่  (F01 F02 F03)
src/routes/refereeInvitation.routes.ts      ★ ใหม่  (F05 F06)
src/routes/match.routes.ts                  ★ ใหม่  (F11 F12 F13)
src/routes/me.routes.ts                     + F04
src/routes/index.ts                         + 3 บรรทัด
```

### Row type ที่ต้องเพิ่มใน `types/db.ts`

ลอกจาก `database/schema.sql` ตรงๆ (ชั้นนี้ใช้ชื่อคอลัมน์ ห้ามแปลงเป็น camelCase — camelCase เกิดที่ mapper เท่านั้น)

```ts
export type TournamentRefereeRow = {
    tournament_referee_id : number,
    tournament_id : number,
    user_id : number,
    invited_by : number,
    invitation_status : 'pending' | 'accepted' | 'rejected',
    is_external : number,                    // ← MySQL BOOLEAN = TINYINT มาเป็น 0/1 ไม่ใช่ true/false
    external_approval_status : 'not_required' | 'pending' | 'approved' | 'rejected',
    approved_by : number | null,
    approved_at : Date | null,
    created_at : Date,
    removed_at : Date | null,
    removed_by : number | null
}
// MatchRefereeRow: match_referee_id, match_id, tournament_referee_id, created_at
// TournamentRow / MatchRow: เอาเท่าที่ใช้ก่อนก็ได้ แต่ลอกให้ครบเลยดีกว่า เดี๋ยว Step 5/8 ได้ใช้ต่อ
```

> ⚠️ `is_external` เป็น `number` (0/1) ไม่ใช่ `boolean` — ตอน map ออก DTO ต้อง `Boolean(row.is_external)`
> หลักเดียวกับ `is_suspended` ที่เจอมาแล้วใน `requireAuth`

---

## 3. middleware `requireOrganizer` — เขียนเป็นอันดับแรก

**Organizer คือใคร?** สคีมาไม่มีคอลัมน์ `organizer_id` — คนจัดคือ `tournaments.requested_by_user_id`
(C04 อนุมัติแล้วคืน `organizerId` = คนเดียวกันนี้)

**ปัญหาที่ต้องแก้:** middleware ตัวนี้ถูกใช้ 2 แบบ ที่มาของ `tournamentId` ไม่เหมือนกัน

| path | tournamentId มาจากไหน |
|---|---|
| `/tournaments/:id/referees` | `req.params.id` ตรงๆ |
| `/matches/:id/referees` | ต้อง `SELECT tournament_id FROM matches WHERE match_id = ?` ก่อน |

→ **เขียน 2 ตัว** อย่ายัดเงื่อนไขไว้ตัวเดียวแล้วเดาจาก path (อ่านยากและพลาดง่าย)

```ts
// middlewares/requireOrganizer.ts
export async function requireOrganizer(req, res, next) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const t = await TournamentRepo.findById(tournamentId);
    if (!t) return next(new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้'));
    if (t.requested_by_user_id !== req.user!.user_id)
        return next(new AppError(403, 'NOT_ORGANIZER', 'คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้'));

    req.tournament = t;      // ★ แปะไว้ให้ service ใช้ต่อ จะได้ไม่ query ซ้ำ
    next();
}

export async function requireOrganizerOfMatch(req, res, next) {
    // 1. parseId ของ matchId   2. หา match ไม่เจอ → 404 MATCH_NOT_FOUND
    // 3. หา tournament จาก match.tournament_id   4. เช็คเจ้าของเหมือนข้างบน
    // 5. req.match = m; req.tournament = t;
}
```

`req.tournament` / `req.match` ต้องประกาศเพิ่มใน `types/express.d.ts` แบบเดียวกับ `req.user`

> **ห้าม `throw` ตรงๆ ใน middleware ที่เป็น async** — ต้อง `next(err)` เสมอ
> (ต่างจาก controller ที่ Express 5 จับ throw จาก async ให้เอง)

---

## 4. ทำทีละ endpoint — ลำดับที่แนะนำ

ทดสอบตัวก่อนหน้าให้ผ่านค่อยขยับ เพราะตัวหลังใช้ข้อมูลที่ตัวหน้าสร้าง

```
F01 เชิญ → F02 ดูรายชื่อ → F04 กรรมการเห็นคำเชิญ → F05 ตอบรับ → F06 ปฏิเสธ
                                                      ↓
                                        F11 มอบหมายเข้าแมตช์ → F12 ดู → F13 ถอด
                                                      ↓
                                        F03 ถอดระดับทัวร์ (ยากสุด ทำท้ายสุด)
```

---

### F01 — `POST /tournaments/:id/referees` · ORG

| | |
|---|---|
| **รับ** | `{ userId: number, isExternal: boolean }` → `schemas/referee.schema.ts` |
| **เช็ค** | ① ORG (middleware) ② `userId` มีตัวตนจริง → 404 `USER_NOT_FOUND` |
| **เขียน** | `INSERT INTO tournament_referees (tournament_id, user_id, invited_by, is_external) VALUES (?,?,?,?)` |
| **คืน** | **201** `{ id, userId, invitationStatus:'pending', isExternal }` |

**ห้ามลืม:** `invited_by = req.user.user_id` (คน login ไม่ใช่คนถูกเชิญ)

> ⚠️ **เอกสารขัดกัน** — Part 3 มี error `ALREADY_INVITED` แต่ Part 4 (รอบ 4) **ยกเลิกไปแล้ว** เพราะตัด `UNIQUE` ออก
> **ยึด Part 4 → ไม่มี error นี้ เชิญซ้ำได้ เกิดแถวใหม่ทุกครั้ง** · บันทึกลง [[07 - จุดที่ต้องยืนยันกับทีม]]

---

### F02 — `GET /tournaments/:id/referees` · ORG

นี่คือจุดที่ "ไม่มี UNIQUE" กัดจริง — ถ้า SELECT ตรงๆ คนที่ถูกเชิญ 3 ครั้งจะโผล่ 3 แถว และ `acceptedCount` เพี้ยน

**ต้องเอาแถวล่าสุดของแต่ละคนเท่านั้น**
(`tournament_referee_id` เป็น AUTO_INCREMENT → `MAX(id)` = แถวล่าสุด ปลอดภัยกว่า `created_at` ที่ชนกันได้ในวินาทีเดียว)

```sql
SELECT tr.*, u.user_id, u.full_name, u.profile_image_key
FROM tournament_referees tr
JOIN ( SELECT user_id, MAX(tournament_referee_id) AS latest_id
       FROM tournament_referees
       WHERE tournament_id = ?
       GROUP BY user_id ) x  ON tr.tournament_referee_id = x.latest_id
JOIN users u ON u.user_id = tr.user_id
WHERE tr.removed_at IS NULL      -- ★ กรองหลังหาแถวล่าสุด ไม่ใช่ก่อน
ORDER BY tr.created_at DESC;
```

> ★ **ลำดับของ `removed_at IS NULL` สำคัญมาก** — ถ้าเอาไปไว้ใน subquery (กรองก่อนหา MAX)
> พอ ORG ถอดแถวล่าสุดทิ้ง แถวเก่าที่ยังไม่ถูกถอดจะ**เด้งกลับมาเป็นแถวล่าสุดแทน** = คนที่ถอดไปแล้วฟื้นคืนชีพ
> ต้อง "หาแถวล่าสุดก่อน แล้วค่อยดูว่าแถวนั้นถูกถอดหรือยัง" เสมอ

`acceptedCount` = นับจากผลชุดนี้ที่ `invitation_status = 'accepted'` — **คำนวณที่ service ไม่ใช่ยิง SQL แยกอีกรอบ**
(ต้องเป็นตัวเลขที่มาจากชุดข้อมูลเดียวกับที่ frontend เห็น ไม่งั้นสองค่าไม่ตรงกัน)

คืน `{ items: [...], acceptedCount }` · field `user` ใช้ `toUserRef` ที่มีอยู่แล้วใน `user.mapper.ts` **อย่าเขียนใหม่**

---

### F04 — `GET /me/referee-invitations` · Auth

ฝั่งกรรมการ — เอาเฉพาะที่ **รอฉันตอบ**

```sql
WHERE tr.user_id = ?  AND tr.invitation_status = 'pending'  AND tr.removed_at IS NULL
```

JOIN `tournaments` เอา `tournament_id, name` · คืน `{ items: [{ id, tournament:{id,name}, isExternal, createdAt }] }`

> route อยู่ `me.routes.ts` (`router.get('/referee-invitations', requireAuth, ...)`) แต่ controller/service อยู่ไฟล์ referee
> — **แบ่งไฟล์ตาม domain ไม่ใช่ตาม path** (เหมือน `GET /me` ที่ใช้ `user.controller.ts`)

---

### F05 — `POST /referee-invitations/:id/accept` · Auth

ลำดับการเช็ค (สลับลำดับ = รั่ว)

```
1. หาแถวด้วย tournament_referee_id            ไม่เจอ → 404 INVITATION_NOT_FOUND
2. row.user_id === req.user.user_id ?         ไม่ใช่ → 404 INVITATION_NOT_FOUND   ★ ไม่ใช่ 403
3. row.removed_at === null ?                  ไม่ใช่ → 404 INVITATION_NOT_FOUND
4. row.invitation_status === 'pending' ?      ไม่ใช่ → 409 INVITATION_ALREADY_ANSWERED
5. UPDATE ... SET invitation_status = 'accepted' WHERE tournament_referee_id = ?
6. คืน { id, invitationStatus:'accepted', requiresAdminApproval: Boolean(row.is_external) }
```

**ข้อ 2 ทำไม 404 ไม่ใช่ 403?** — คำเชิญของคนอื่นไม่ใช่ของคุณตั้งแต่แรก ถ้าตอบ 403 เท่ากับบอกว่า "id นี้มีอยู่จริงนะ แค่ไม่ใช่ของคุณ" = รั่วข้อมูล หลักเดียวกับ C07 ที่ทัวร์ private + ไม่ใช่ ORG ก็ตอบ 404

**`requiresAdminApproval`** = `is_external` เป็นจริง → ยังไม่ได้สิทธิ์จนกว่า Admin อนุมัติ (F09 Sprint #1)
ถ้า external ให้ `UPDATE external_approval_status = 'pending'` ในคำสั่งเดียวกันด้วย จะได้มีคิวรอไว้ให้ F08 อ่านตอน Sprint #1

---

### F06 — `POST /referee-invitations/:id/decline` · Auth

เหมือน F05 ทุกขั้น เปลี่ยนแค่ค่าที่ UPDATE และคืน **204**

> ⚠️ เอกสารเขียน `→ declined` แต่ **enum ใน DB มีแค่ `pending`/`accepted`/`rejected`**
> ยึดค่า DB ตามกฎ Part 0-1 §1.2 → ใช้ **`'rejected'`** · เพิ่มลง [[07 - จุดที่ต้องยืนยันกับทีม]]
>
> เขียน F05/F06 เป็น service ตัวเดียวรับพารามิเตอร์สถานะ ดีกว่าลอกโค้ด 2 รอบ — ขั้นตรวจ 4 ข้อเหมือนกันเป๊ะ

---

### F11 — `POST /matches/:id/referees` · ORG

| | |
|---|---|
| **รับ** | `{ tournamentRefereeId: number }` |
| **middleware** | `requireAuth` + `requireOrganizerOfMatch` + `validate` |

**เช็ค 3 ข้อ**

```
1. tournament_referee แถวนั้นมีจริง + removed_at IS NULL          → 404 REFEREE_NOT_FOUND
2. tr.tournament_id === match.tournament_id                      → 404 REFEREE_NOT_FOUND
   ★ สำคัญมาก: กันเอากรรมการของทัวร์อื่นมายัดใส่แมตช์นี้
3. tr.invitation_status === 'accepted'
   && (!tr.is_external || tr.external_approval_status === 'approved')
                                                                 → 409 REFEREE_NOT_ACCEPTED
4. INSERT INTO match_referees (match_id, tournament_referee_id) VALUES (?,?)
```

**มอบหมายซ้ำ** — มี `UNIQUE (match_id, tournament_referee_id)` อยู่แล้ว จับที่ error ของ mysql2 ไม่ใช่ SELECT เช็คก่อน (SELECT-แล้ว-INSERT มีช่องว่างให้ race condition)

```ts
catch (err: any) {
  if (err.code === 'ER_DUP_ENTRY')
    throw new AppError(409, 'REFEREE_ALREADY_ASSIGNED', 'กรรมการคนนี้ถูกมอบหมายให้แมตช์นี้แล้ว');
  throw err;
}
```

คืน **201** `{ matchId, tournamentRefereeId, referee: UserRef }`

---

### F12 — `GET /matches/:id/referees` · สาธารณะ

JOIN 3 ตาราง `match_referees → tournament_referees → users` และ **ต้องมี `tr.removed_at IS NULL`**
(คนถูกถอดระดับทัวร์แล้วห้ามโผล่ — นี่คือเหตุผลที่ F03 ไม่ต้องไปลบ `match_referees`)

คืน `{ items: [{ tournamentRefereeId, referee }] }`

---

### F13 — `DELETE /matches/:id/referees/:rid` · ORG

**`:rid` คือ id ตัวไหน?** เอกสารไม่ได้บอก — แต่ F12 คืนให้ frontend แค่ `tournamentRefereeId`
→ **`:rid` = `tournament_referee_id`** (frontend ไม่มี `match_referee_id` จะส่งมาไม่ได้) · บันทึกลง [[07]]

```sql
DELETE FROM match_referees WHERE match_id = ? AND tournament_referee_id = ?
```

`result.affectedRows === 0` → 404 `REFEREE_NOT_ASSIGNED` · สำเร็จ → **204**
ตัวนี้ **ลบจริงได้** (ต่างจาก F03) เพราะไม่กระทบสถานะตอบรับระดับทัวร์ แค่ตารางเวรของแมตช์เดียว

---

### F03 — `DELETE /tournaments/:id/referees/:rid` · ORG (ยากสุด ทำท้ายสุด)

**soft delete** ไม่ใช่ DELETE

```sql
UPDATE tournament_referees SET removed_at = NOW(), removed_by = ?
WHERE tournament_referee_id = ? AND tournament_id = ? AND removed_at IS NULL
```

`affectedRows === 0` → 404 `REFEREE_NOT_FOUND` (ครอบคลุมทั้งไม่มีจริง / ทัวร์ผิดตัว / ถอดไปแล้ว)

**ก่อน UPDATE ต้องเช็ค BR-10 ย้อนกลับ** — ถอดแล้วกรรมการยังครบไหม

```
ถ้า tournament_status === 'public'  และ  (acceptedCount - 1) < ขั้นต่ำ
   → 409 WOULD_BREAK_REFEREE_MINIMUM
     'ถอดกรรมการคนนี้จะทำให้จำนวนกรรมการไม่ครบเงื่อนไข กรุณาปิดการเผยแพร่ทัวร์นาเมนต์ก่อน'
```

ทัวร์ที่ยัง `private` ถอดได้อิสระ — ยังไม่มีใครเห็น

> ⚠️ **เอกสารขัดกัน 2 จุด ต้องเลือกก่อนเขียน**
>
> **(ก) ลบ `match_referees` ตามไหม?** Part 3 บอกลบในทรานแซกชันเดียว · Part 2 (รอบ 5 — ใหม่กว่า) บอก **ไม่ต้องลบ** เพราะทุก query เช็ค `removed_at IS NULL` อยู่แล้ว
> → **ยึด Part 2** ได้ 2 ข้อดี: เหลือร่องรอยไว้ตรวจสอบตอนมีข้อพิพาท และ **ไม่ต้องใช้ transaction เลย** (แตะตารางเดียว)
>
> **(ข) "ขั้นต่ำ" ของ BR-10 คือเท่าไหร่?** ไม่มีตัวเลขในเอกสาร — ที่พอเดาได้จาก BR-11 คือ **on-site ที่บันทึกสถิติ = 2 คน, นอกนั้น = 1 คน**
> → **ตั้งเป็นค่าคงที่ใน `config/` (`REFEREE_MINIMUM`) แล้วถามทีม** อย่า hardcode กระจายหลายไฟล์ เพราะ C13 (publish) ใช้ตัวเลขเดียวกันนี้ ต้องตรงกันเป๊ะ

---

## 5. ตารางสรุป route ทั้ง 9 ตัว

```ts
// routes/tournament.routes.ts   (mount ที่ '/tournaments')
router.post  ('/:id/referees',      requireAuth, requireOrganizer, validate(inviteRefereeSchema), Ref.invite);              // F01
router.get   ('/:id/referees',      requireAuth, requireOrganizer,                                Ref.listByTournament);   // F02
router.delete('/:id/referees/:rid', requireAuth, requireOrganizer,                                Ref.removeFromTournament); // F03

// routes/me.routes.ts
router.get('/referee-invitations', requireAuth, Ref.listMyInvitations);   // F04

// routes/refereeInvitation.routes.ts   (mount ที่ '/referee-invitations')
router.post('/:id/accept',  requireAuth, Ref.accept);    // F05
router.post('/:id/decline', requireAuth, Ref.decline);   // F06

// routes/match.routes.ts   (mount ที่ '/matches')
router.post  ('/:id/referees',      requireAuth, requireOrganizerOfMatch, validate(assignRefereeSchema), Ref.assign);   // F11
router.get   ('/:id/referees',                                                                          Ref.listByMatch); // F12
router.delete('/:id/referees/:rid', requireAuth, requireOrganizerOfMatch,                               Ref.unassign);   // F13
```

**หลุมที่ต้องระวัง**

- ถ้าแยก referee ออกเป็น router ย่อยซ้อนใต้ `/tournaments/:id` ต้อง `express.Router({ mergeParams: true })` ไม่งั้น `req.params.id` ของ parent **หายไปเงียบๆ เป็น undefined**
- F12 ไม่มี `requireAuth` (สาธารณะตามสเปก) — อย่าใส่เกิน
- `validate(...)` ต้องอยู่ **หลัง** middleware สิทธิ์เสมอ (ไม่มีสิทธิ์ควรได้ 403 ไม่ใช่ 400)
- `me.routes.ts` ปัจจุบัน mount `router.get('/')` ไว้แล้ว — เพิ่ม `/referee-invitations` ได้เลย ไม่ชนกัน

---

## 6. เช็คลิสต์ก่อนบอกว่าเสร็จ

- [ ] ทุก query ที่แตะ `tournament_referees` มี `removed_at IS NULL`
- [ ] F02 ใช้ subquery `MAX(tournament_referee_id)` ไม่ใช่ SELECT ตรงๆ
- [ ] `is_external` แปลงเป็น boolean ตอน map ออก DTO ทุกที่
- [ ] F11 เช็คว่ากรรมการอยู่ทัวร์เดียวกับแมตช์
- [ ] controller ทุกตัวที่เรียก service มี `await` (บทเรียนจาก Step 1-2)
- [ ] `SELECT` ที่เป็นรายการมี `ORDER BY`
- [ ] ไม่มี `email` / `contact_info` หลุดใน `UserRef` — ใช้ `toUserRef` ตัวเดิม

---

## 7. seed ข้อมูลทดสอบ (ยังไม่มี Step 5/8)

```sql
-- ทัวร์ 1 รายการ organizer = user 1 · สถานะ private (ถอดกรรมการได้อิสระตอนเทส F03)
INSERT INTO tournaments (name, sport_type_id, bracket_format, scope_type, organizing_faculty_id,
  requested_by_user_id, tournament_status, event_start_date, max_teams, min_teams, venue)
VALUES ('ทดสอบกรรมการ', 1, 'single_elimination', 'faculty', 1, 1, 'private', '2026-01-01', 8, 2, 'สนาม A');

INSERT INTO matches (tournament_id, round_number, mode)
VALUES (LAST_INSERT_ID(), 1, 'onsite');
```
> `mysql` CLI ต้องมี `--default-character-set=utf8mb4` เสมอ ไม่งั้นภาษาไทยพังเงียบๆ

**เคสทดสอบขั้นต่ำ 6 เคส**

| # | ยิงอะไร | คาดว่าได้ |
|---|---|---|
| 1 | F01 ด้วย token ของ organizer | 201 `pending` |
| 2 | F01 ด้วย token คนอื่น | 403 `NOT_ORGANIZER` |
| 3 | F11 ก่อน F05 | 409 `REFEREE_NOT_ACCEPTED` |
| 4 | F05 ด้วย token ของคนอื่น | 404 `INVITATION_NOT_FOUND` |
| 5 | F05 ซ้ำครั้งที่ 2 | 409 `INVITATION_ALREADY_ANSWERED` |
| 6 | F03 แล้วยิง F12 | รายชื่อคุมแมตช์หายไปเอง (โดยไม่ได้ลบ `match_referees`) |

---

## 8. ของที่ต้องเพิ่มลง [[07 - จุดที่ต้องยืนยันกับทีม]]

| # | เรื่อง | ที่เลือกไว้ |
|---|---|---|
| F-1 | `ALREADY_INVITED` — Part 3 มี / Part 4 ยกเลิก | ยึด Part 4 · ไม่มี error นี้ |
| F-2 | F03 ลบ `match_referees` ตามไหม | ไม่ลบ (Part 2 รอบ 5) |
| F-3 | enum `declined` vs DB `rejected` | ใช้ `rejected` |
| F-4 | BR-10 ขั้นต่ำกี่คน | **คำนวณจากตารางแข่ง** — `max(จำนวนแมตช์ที่เวลาทับกัน) × กรรมการต่อแมตช์` (ทีมยืนยัน 9 ก.ย. 2026) · ต้องได้ F-4a ก่อนถึงคำนวณได้จริง |
| F-5 | F13 `:rid` คือ id ตัวไหน | `tournament_referee_id` |
| F-6 | `external_approval_status` ตั้ง `pending` ตอนไหน | **ตอน F05 accept ถ้า `is_external`** — ทีมยืนยันแล้ว 9 ก.ย. 2026 (โค้ดปัจจุบันถูกอยู่แล้ว) |
| F-7 | เชิญซ้ำคนที่ `accepted` อยู่แล้วได้ไหม | **ไม่ได้** → 409 (กันสิทธิ์โดนลดเป็น pending เงียบๆ) |
| F-8 | BR-10 นับ `acceptedCount` หรือ `effectiveCount` | **`effectiveCount`** — กรรมการภายนอกที่ admin ยังไม่อนุมัติ ตอบรับแล้วก็คุมแมตช์ไม่ได้ · F02 คืนทั้งสองตัว |
| F-9 | มอบหมายกรรมการภายนอกที่ `accepted` แต่ admin ยังไม่อนุมัติ เข้าแมตช์ได้ไหม | **ไม่ได้** → 409 `REFEREE_EXTERNAL_APPROVAL_PENDING` (F11 ใช้ `isActiveReferee`) |
| F-10 | admin ถอนการอนุมัติกรรมการภายนอกภายหลังได้ไหม | **รอทีมตอบ** — ถ้าได้ ต้องกำหนดด้วยว่าแมตช์ที่เขาถูกมอบหมายไว้แล้วจะเป็นอย่างไร และทัวร์ที่ publish ไปแล้วต้องถูกดึงกลับหรือไม่ |
| F-11 | ลำดับการอนุมัติคนนอก | **ตกไป** — ทีมใช้ลำดับเดิม: ORG เชิญ → ref กดรับ → ส่งเอกสารให้ admin → admin ตรวจ |
| F-12 | สถานะ `Pending_Admin` เก็บยังไง | **อย่าเพิ่มค่าใน enum `invitation_status`** — ใช้คู่ (`accepted` + `external_approval_status='pending'`) ที่มีอยู่ แล้วให้ mapper คำนวณ `refereeStatus` ส่งออก |
| F-13 | เก็บเอกสารที่ ref ส่งให้ admin ไว้ที่ไหน | **ยังไม่มีที่เก็บ** — ต้องเพิ่ม `verification_docs JSON NULL` + `rejection_reason TEXT NULL` ใน `tournament_referees` (แก้ schema) |
| F-14 | "เอกสารที่ admin ระบุไว้" กำหนดที่ไหน | **รอทีมตอบ** — ค่าคงที่ทั้งระบบ / ตั้งต่อทัวร์ / admin ตั้งเอง |
| F-15 | admin ไม่อนุมัติคนนอก แล้วยังไงต่อ | **รอทีมตอบ** — แจ้ง ORG ให้หาคนแทนไหม · ORG เชิญคนเดิมซ้ำได้ไหม |
| F-4a | ระยะเวลาต่อแมตช์ (ใช้คำนวณเวลาทับซ้อน) | **ยังไม่มีที่เก็บ** — เสนอ `match_duration_minutes` ใน `sport_types` · **บล็อกทั้ง BR-10 แบบใหม่ และ M06 ตรวจทับซ้อน 3 มิติ** |

---

ต่อไป → Step 7 · Applications (P01–P09)
