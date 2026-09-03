# 01 — Backend ทำงานยังไง

> อ่านครั้งเดียวให้เข้าใจ แล้วทุกอย่างที่เหลือจะง่ายขึ้นมาก
> ถ้าคุณเข้าใจบทนี้ คุณจะเขียน endpoint ที่ 50 ได้เร็วพอๆ กับ endpoint ที่ 5

---

## 1. Backend คืออะไรจริงๆ

Backend ของคุณคือ **โปรแกรมที่นั่งรอฟังคำขอ แล้วตอบกลับเป็น JSON**

```
[หน้าเว็บ/มือถือ]  ──HTTP request──>  [Node.js + Express]  ──SQL──>  [MySQL ใน Docker]
                   <──JSON response──                      <──rows──
```

แค่นั้นจริงๆ ที่เหลือคือรายละเอียดว่า *ระหว่างรับกับตอบ* คุณทำอะไรบ้าง

---

## 2. ทำไมต้องแบ่งเป็น layer (นี่คือคำถามที่สำคัญที่สุด)

ลองดูโค้ดแบบที่มือใหม่ส่วนใหญ่เขียนก่อน — เอาทุกอย่างยัดไว้ที่เดียว:

```ts
// ❌ แบบที่ไม่ควรทำ
app.post('/api/v1/teams', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const payload = jwt.verify(token, secret);
  if (!req.body.name || req.body.name.length < 2) return res.status(400).json({...});
  const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [payload.sub]);
  if (users[0].is_suspended) return res.status(403).json({...});
  const [dup] = await pool.query('SELECT * FROM teams WHERE name = ? AND sport_type_id = ?', [...]);
  if (dup.length) return res.status(409).json({...});
  const [count] = await pool.query('SELECT COUNT(*) FROM team_members WHERE ...');
  if (count >= 5) return res.status(422).json({...});
  const [result] = await pool.query('INSERT INTO teams ...');
  res.status(201).json({ team_id: result.insertId, ... });  // ← ส่ง snake_case ออกไปด้วย
});
```

มันทำงานได้ แต่:

- โค้ด 5 บรรทัดแรก (เช็ค token + suspended) **ต้องก็อปไปวางอีก 92 ครั้ง** ในทุก endpoint ที่ต้องล็อกอิน
- อยากเปลี่ยนจาก MySQL เป็นอย่างอื่น → ต้องแก้ทุกไฟล์
- อยากเทสว่า "กฎ BR-05 ทำงานถูกไหม" → ต้องยิง HTTP จริงถึงจะเทสได้
- ลืมกรอง `password_hash` ครั้งเดียว = ข้อมูลรั่วทั้งระบบ
- ไฟล์เดียวยาว 3000 บรรทัด หาอะไรไม่เจอ

**การแบ่ง layer คือการตอบคำถามว่า "โค้ดบรรทัดนี้ควรอยู่ที่ไหน"** — แค่นั้นเอง ไม่มีอะไรลึกลับ

---

## 3. 6 ชั้นที่โปรเจกต์นี้ใช้

```
   HTTP request เข้ามา
        │
   ┌────▼──────────────────────────────────────────────┐
   │ 1. ROUTE        "path นี้ ใครดูแล"                 │  routes/team.routes.ts
   │                 บอกแค่ว่า POST /teams → ไปที่ไหน   │
   └────┬──────────────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────────────┐
   │ 2. MIDDLEWARE   "ผ่านด่านก่อน"                     │  middlewares/*.ts
   │                 - validate: body ถูกรูปแบบไหม      │
   │                 - requireAuth: ล็อกอินหรือยัง       │
   │                 - requireTeamLeader: เป็นหัวหน้าไหม │
   └────┬──────────────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────────────┐
   │ 3. CONTROLLER   "แปลง HTTP ↔ ข้อมูล"               │  controllers/team.controller.ts
   │                 - หยิบค่าจาก req                    │
   │                 - เรียก service                     │
   │                 - เลือก status code + res.json()    │
   │                 ❌ ห้ามมี SQL  ❌ ห้ามมี business rule│
   └────┬──────────────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────────────┐
   │ 4. SERVICE      "สมองของระบบ"                      │  services/team.service.ts
   │                 - กฎธุรกิจทั้งหมด (BR-01 ถึง BR-15) │
   │                 - transaction                       │
   │                 - เรียก repository หลายตัวมาประกอบ  │
   │                 ❌ ไม่รู้จัก req/res เลย            │
   └────┬──────────────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────────────┐
   │ 5. REPOSITORY   "คุยกับ MySQL"                     │  repositories/team.repo.ts
   │                 - SQL ทุกบรรทัดอยู่ที่นี่ที่เดียว    │
   │                 - คืน row ดิบ (snake_case)          │
   │                 ❌ ไม่ตัดสินใจอะไรเลย               │
   └────┬──────────────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────────────┐
   │ 6. MAPPER       "แปลง row → JSON ที่ปลอดภัย"       │  mappers/team.mapper.ts
   │                 snake_case → camelCase              │
   │                 ตัดฟิลด์ที่ห้ามเปิดเผยทิ้ง          │
   └───────────────────────────────────────────────────┘
        │
   JSON response ออกไป
```

### กฎการไหลของข้อมูล — จำแค่ 3 ข้อ

1. **ไหลลงเท่านั้น** — route เรียก controller, controller เรียก service, service เรียก repository
   ❌ repository ห้ามเรียก service ย้อนกลับ
2. **`req` / `res` หยุดที่ controller** — service กับ repository ต้องไม่รู้ด้วยซ้ำว่ามี HTTP อยู่
   (ถ้า service ต้องรู้ว่าใครเป็นคนเรียก → รับ `userId: number` เป็น parameter ไม่ใช่รับ `req`)
3. **SQL หยุดที่ repository** — ถ้าคุณเห็นคำว่า `SELECT` นอกโฟลเดอร์ `repositories/` แปลว่าวางผิดที่

---

## 4. ตามรอย request จริง 1 ครั้ง

สมมติผู้ใช้กด "สร้างทีม" — `POST /api/v1/teams` body: `{ "name": "ทีมวิศวะ A", "sportTypeId": 3 }`

| # | ที่ไหน | ทำอะไร | ถ้าพัง ตอบอะไร |
|---|---|---|---|
| 1 | `app.ts` | `express.json()` แปลง body เป็น object | 400 |
| 2 | `routes/index.ts` | เห็น prefix `/api/v1` → ส่งต่อ | — |
| 3 | `routes/team.routes.ts` | `POST /teams` ตรงกัน → เรียก chain ต่อไป | 404 ถ้าไม่ตรง |
| 4 | `middlewares/validate.ts` | Zod เช็ค `name` เป็น string 2-100 ตัว, `sportTypeId` เป็น number | **400** `VALIDATION_FAILED` |
| 5 | `middlewares/requireAuth.ts` | อ่าน `Authorization: Bearer ...` → verify JWT → **query `users` ดู `is_suspended`** → ยัด `req.user` | **401** `NO_TOKEN` / **403** `ACCOUNT_SUSPENDED` |
| 6 | `controllers/team.controller.ts` | `teamService.createTeam(req.user.user_id, req.body)` | — |
| 7 | `services/team.service.ts` | เช็ค BR-05 (มีทีม Unofficial ครบ 5 แล้วหรือยัง) | **422** `TEAM_QUOTA_EXCEEDED` |
| 8 | `services/team.service.ts` | เช็คชื่อซ้ำในกีฬาเดียวกัน | **409** `TEAM_NAME_TAKEN` |
| 9 | `repositories/team.repo.ts` | `INSERT INTO teams ...` แล้ว `INSERT INTO team_members` (หัวหน้าเป็นสมาชิกด้วย) | 500 |
| 10 | `mappers/team.mapper.ts` | `{ team_id: 12, readiness_status: 'Forming' }` → `{ id: 12, readinessStatus: 'Forming' }` | — |
| 11 | `controllers/team.controller.ts` | `res.status(201).json(dto)` | — |

**ลองอ่านตารางนี้ซ้ำอีกรอบ** — ทุก endpoint ใน 93 ตัวเดินตาม 11 ขั้นนี้เหมือนกันหมด
ต่างกันแค่ middleware ตัวไหน, กฎอะไรใน service, SQL อะไรใน repository

---

## 5. error ไหลย้อนกลับยังไง

คุณ**ไม่ต้อง** `return res.status(422).json(...)` ในทุกที่ที่มีปัญหา — มันจะกระจัดกระจายมาก
ใช้วิธี **โยน error แล้วให้จุดเดียวจับ**:

```ts
// ใน service — แค่โยนทิ้ง
if (unofficialCount >= 5) {
  throw new AppError(422, 'TEAM_QUOTA_EXCEEDED', 'คุณมีทีม Unofficial ครบ 5 ทีมแล้ว');
}
```

```ts
// ใน middlewares/errorHandler.ts — จับที่เดียวจบ (ต่อท้ายสุดใน app.ts)
// ถ้าเป็น AppError → ตอบตาม status/code/message ที่โยนมา
// ถ้าเป็น error อื่น → log ไว้ แล้วตอบ 500 INTERNAL_ERROR (ห้ามส่ง stack trace ออกไป)
```

ข้อดี: service ไม่ต้องรู้จัก `res`, error format เหมือนกันทั้งระบบ 100%, อยากเปลี่ยน format แก้ไฟล์เดียว

> ⚠️ **Express 5 (ที่คุณใช้อยู่) จับ error จาก async function ให้อัตโนมัติแล้ว**
> ถ้าเป็น Express 4 ต้องห่อด้วย `asyncHandler` เอง — ของคุณไม่ต้อง ใช้ `async` ได้เลย

---

## 6. Middleware คืออะไรกันแน่

middleware คือ **ฟังก์ชันที่ขวางทางระหว่าง route กับ controller** หน้าตาแบบนี้:

```ts
function ชื่ออะไรก็ได้(req, res, next) {
  // ทำอะไรสักอย่าง
  next();        // ← ผ่าน ไปด่านถัดไป
  // หรือ
  next(error);   // ← ไม่ผ่าน กระโดดไป errorHandler
}
```

ต่อกันเป็นแถวได้ ทำงานเรียงจากซ้ายไปขวา:

```ts
router.post('/teams',
  validate(createTeamSchema),   // ด่าน 1
  requireAuth,                  // ด่าน 2
  teamController.create         // ปลายทาง
);
```

### middleware ที่โปรเจกต์นี้ต้องมี (Part 0-1 §1.4)

| ตัว | เช็คอะไร | ต้องมี `requireAuth` ก่อนไหม |
|---|---|---|
| `validate(schema)` | body/query ถูกรูปแบบตาม Zod | ไม่ |
| `requireAuth` | JWT ถูก + `is_suspended = false` | — |
| `requireTeamLeader` | `teams.leader_id = req.user.id` | ✅ ต้อง |
| `requireOrganizer` | `tournaments.requested_by_user_id = req.user.id` และ status ไม่ใช่ `pending_approval`/`rejected` | ✅ ต้อง |
| `requireReferee` | มีแถวใน `tournament_referees` ที่ `invitation_status='accepted'` (+ ถ้า `is_external` ต้อง `external_approval_status='approved'` ด้วย) | ✅ ต้อง |
| `requireAdmin(scope)` | มีแถวใน `admin_scopes` ที่ตรง scope | ✅ ต้อง |

**จุดที่มือใหม่พลาดบ่อย:** `requireTeamLeader` ต้อง query DB — มันไม่ใช่การอ่านจาก token
เพราะ token ไม่มี role อยู่เลย (ดูเหตุผลใน [[00 - เริ่มที่นี่]] หัวข้อ "จุดสำคัญ")

---

## 7. ทำไมต้องมี Mapper (อย่าข้ามชั้นนี้เด็ดขาด)

MySQL คืนมาแบบนี้:
```js
{ user_id: 42, full_name: 'สมชาย', password_hash: '$2b$10$...', is_suspended: 0, email: 'a@b.c' }
```

API ต้องส่งออกแบบนี้ (`GET /users/:id` — โปรไฟล์สาธารณะ):
```json
{ "id": 42, "fullName": "สมชาย", "avatarUrl": null, "facultyId": 1, "departmentId": 3 }
```

ต่างกัน 3 อย่าง:
1. **ชื่อฟิลด์** `user_id` → `id`, `full_name` → `fullName`
2. **ฟิลด์ที่ต้องหายไป** `password_hash` ❗, `is_suspended`, และ `email` (เพราะเป็นโปรไฟล์สาธารณะ)
3. **ฟิลด์ที่ต้องคำนวณเพิ่ม** `avatarUrl` = สร้าง presigned URL จาก `profile_image_key`

> **Part 2 §2 เตือนไว้ชัด:** `GET /me` กับ `GET /users/:id` คืนข้อมูลคนละชุด **ห้ามใช้ handler หรือ mapper ร่วมกัน**
> เพราะพลาดครั้งเดียว = อีเมลผู้ใช้ทุกคนรั่วให้คนที่ไม่ได้ล็อกอินเห็น
> ดังนั้น `user.mapper.ts` ต้องมี 2 ฟังก์ชันแยกกัน: `toMeDto()` และ `toPublicUserDto()`

---

## 8. Zod กับ validation 2 ชั้น

**ชั้นที่ 1 — Zod (`validate` middleware): "รูปแบบถูกไหม"**
`name` เป็น string ยาว 2-100 ตัวไหม, `sportTypeId` เป็นตัวเลขไหม, `reason` ส่งมาไหม
→ ตอบ **400** `VALIDATION_FAILED` พร้อม `fields`

**ชั้นที่ 2 — Service: "สมเหตุสมผลไหม"**
ชื่อทีมซ้ำหรือเปล่า, ทัวร์นี้ปิดรับสมัครไปแล้วหรือยัง, มีทีมครบ 5 แล้วหรือยัง
→ ตอบ **409** (ขัดกับ*สถานะ*) หรือ **422** (ขัดกับ*กฎเชิงปริมาณ/คุณสมบัติ*)

การแยก 409 vs 422 เป็นข้อตกลงของทีมคุณ อยู่ใน Part 0-1 §1.5:

| | 409 Conflict | 422 Unprocessable |
|---|---|---|
| ใช้เมื่อ | ขัดกับ **สถานะ** ของ resource | ขัดกับ **กฎเชิงปริมาณ/คุณสมบัติ** |
| ตัวอย่าง | สมัครทัวร์ที่ปิดรับสมัครแล้ว, ลบทีมที่กำลังแข่ง | มีทีม Unofficial ครบ 5 แล้ว (BR-05), Hard Filter ไม่ผ่าน (BR-08) |

---

## 9. Transaction — เมื่อไหร่ต้องใช้

**ใช้เมื่อ: "ถ้าทำสำเร็จครึ่งเดียวแล้วข้อมูลจะเพี้ยน"**

ตัวอย่างชัดๆ — สร้างทีม (T01) ต้อง INSERT 2 ตาราง:
```
INSERT INTO teams (...)          ✅ สำเร็จ
INSERT INTO team_members (...)   ❌ พัง
→ ผลลัพธ์: ทีมที่ไม่มีสมาชิกเลยแม้แต่หัวหน้า = ข้อมูลเสีย
```

ต้องห่อด้วย transaction:
```ts
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  // ... query หลายตัว โดยใช้ conn ไม่ใช่ pool
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();   // ← ลืมบรรทัดนี้ = connection หมด pool แล้วระบบค้าง
}
```

**จุดที่บังคับต้องเป็น transaction** (Part 0-1 §1.15):

| endpoint | ทำไม |
|---|---|
| `POST /teams` (T01) | teams + team_members |
| `POST /invitations/:id/accept` (T13) | invitation + team_members + อาจอัปเดต `readiness_status` |
| `POST /admin/team-requests/:id/approve` (T17) | teams + official_team_memberships + audit_logs |
| `POST /amendment-requests/:id/approve` (C11) | ต้อง **UPDATE tournaments จริง** ไม่ใช่แค่เปลี่ยนสถานะคำขอ |
| `POST /tournaments/:id/bracket` (M01) | INSERT matches หลายสิบแถว + bracket_nodes |
| **`POST /matches/:id/result/verify` (S02)** | **9 ขั้น** — ตัวยากที่สุดของระบบ |

---

## 10. สรุปบทนี้ — เช็คลิสต์ก่อนไปต่อ

ถ้าตอบได้ทุกข้อ ไปต่อได้เลย:

- [ ] Controller ห้ามมีอะไร? *(SQL และ business rule)*
- [ ] Service รู้จัก `req` ไหม? *(ไม่ — รับเป็น parameter ธรรมดา)*
- [ ] ทำไม JWT ถึงไม่เก็บ role? *(role ผูกกับบริบท คนเดียวเป็นได้หลายอย่างพร้อมกัน)*
- [ ] ทำไม `requireAuth` ต้อง query DB ทุก request? *(JWT เพิกถอนไม่ได้ ต้องเช็ค `is_suspended` สด)*
- [ ] ถ้าไม่มี mapper จะเกิดอะไรขึ้น? *(`password_hash` หลุดออก API)*
- [ ] 409 กับ 422 ต่างกันยังไง? *(สถานะ vs กฎเชิงปริมาณ)*

ต่อไป → [[02 - โครงสร้างโปรเจกต์]]
