# 08 — Step 3 · Users & Profile (U02, U03, U04, U06)

> ต่อจาก [[04 - Step 1 · Auth]] และ Step 2 (Reference Data)
> สูตร 8 ขั้นอยู่ที่ [[05 - สูตรทำ endpoint + แผนงาน]] · ตารางสรุปทุก endpoint อยู่ที่ [[06 - Endpoint Reference MVP 93]]

**เวลาโดยประมาณ:** ~2 วัน · **4 endpoint** (U01 เสร็จไปแล้วตั้งแต่ Step 1)

---

## ทำไม Step นี้ถึงเป็นตัวถัดไป

Step 2 เป็น `SELECT` ล้วน ไม่มีอะไรให้ตัดสิน — Step 3 เริ่มมีของจริง 4 อย่างที่จะใช้ซ้ำไปจนจบโปรเจกต์:

| ของใหม่ | โผล่ครั้งแรกที่ | จะใช้ซ้ำที่ |
|---|---|---|
| **`UPDATE` แบบ partial** (ส่งมาบาง field) | U02 | T04 แก้ทีม · C08 แก้ทัวร์นาเมนต์ |
| **`JOIN` ข้ามตาราง** | U03, U04 | เกือบทุก endpoint ตั้งแต่ Step 4 |
| **validate query string** | U06 | C06 ค้นหาทัวร์ · ทุก list ที่มี filter |
| **DTO สาธารณะ vs DTO เจ้าของ** | U03 vs U01 | ทุกที่ที่ "คนอื่นดู" ≠ "เจ้าตัวดู" |

---

# 📋 ใบงาน Step 3 — ทำอะไร รับอะไร ส่งอะไร เช็คที่ไหน

> ตารางนี้ใช้ทำงานจริง · รายละเอียด/กับดักของแต่ละตัวอยู่ในหัวข้อถัดๆ ไป

## ✅ ทำไปแล้ว (ระหว่างเตรียม U03)

| ไฟล์ | สถานะ |
|---|---|
| `types/db.ts` → `TeamRow` | ✅ 11 คอลัมน์ตรง DDL |
| `repositories/teams.repo.ts` → `findTeamsByUser` | ✅ JOIN + `deleted_at IS NULL` · ทดสอบผ่าน 4 เคส |
| `mappers/team.mapper.ts` → `TeamRef` + `toTeamRef` | ✅ ตรง Part 3 |
| `database/seed-test.sql` | ✅ ผู้ใช้ 3 คน · ทีม 4 ทีม · สถิติ 3 แถว |

---

## U03 — `GET /users/:id` · สาธารณะ

|            |                                                                                   |
| ---------- | --------------------------------------------------------------------------------- |
| **ทำอะไร** | ดูโปรไฟล์สาธารณะของผู้ใช้คนหนึ่ง + ทีมที่เขาอยู่                                  |
| **รับ**    | `:id` (path param) — **ไม่มี body ไม่มี query**                                   |
| **ส่ง**    | `{ id, fullName, avatarUrl, facultyId, departmentId, teams: TeamRef[] }`          |
| **สิทธิ์** | ไม่ต้อง login (`Auth: —` ใน Part 2)                                               |
| **error**  | `400 VALIDATION_FAILED` (id ไม่ใช่จำนวนเต็มบวก) · `404 USER_NOT_FOUND`            |
| **เอกสาร** | Part 3 `### U03` · Part 4 §2.1 (`USER_NOT_FOUND`) · Part 2 แถว U03 (คอลัมน์ Auth) |

**✅ เขียนครบ 4 ไฟล์แล้ว — ทดสอบผ่าน 8 เคส**
```
mappers/user.mapper.ts    ✅ PublicUserDto + toPublicUserDto(row, teams)
services/user.service.ts  ✅ getUserById — findById → 404 → findTeamsByUser
                             → .map(toTeamRef) → toPublicUserDto
controllers/user.controller.ts  ✅ getUserById
routes/users.routes.ts    ✅ + ต่อใน routes/index.ts (mount '/users')
```
ผลทดสอบ: 9001 → 2 ทีม · 9002 → avatarUrl null · 9003 → `teams: []` ·
999999 → 404 · `abc`/`0` → 400 · ของเดิม (`/me`, `/faculties`) ไม่พัง

🔴 **เหลือแก้ 2 จุดเล็กใน `user.controller.ts`:**
- `fields` key ต้องเป็น**ชื่อช่อง** (`id`) ไม่ใช่ `message` — frontend ใช้ key หาว่าช่องไหนผิด
- ข้อความตกสระ: `กรอกใหม` → `กรอกใหม่` (copy จาก Part 4 ปลอดภัยกว่าพิมพ์เอง)

**กฎที่ต้องเช็ค:** ห้ามส่ง `email`/`contactInfo`/`address`/`totalPoints` ออก (Part 3 เขียนกำกับไว้ในหัวข้อ U03 เอง)

---

## U04 — `GET /users/:id/stats` · สาธารณะ

|            |                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **ทำอะไร** | สถิติการแข่งของผู้ใช้ — รวมทุกกีฬา + แยกรายกีฬา                                                                                                |
| **รับ**    | `:id`                                                                                                                                          |
| **ส่ง**    | `{ userId, overall: {matchesPlayed, wins, losses, winRate, championCount}, bySport: [{sportTypeId, sportName, matchesPlayed, wins, losses}] }` |
| **สิทธิ์** | ไม่ต้อง login                                                                                                                                  |
| **error**  | `400` · `404 USER_NOT_FOUND`                                                                                                                   |
| **เอกสาร** | Part 3 `### U04` · Part 4 §2.1 (`USER_NOT_FOUND`) · DDL `player_profile_stats`                                                                 |

**ต้องเขียน 5 ไฟล์:**
```
types/db.ts               เพิ่ม PlayerProfileStatRow
                            user_id · sport_type_id · matches_played · wins
                            losses · championships · updated_at

repositories/playerStat.repo.ts  🆕
  findStatsByUser(userId)   SELECT s.sport_type_id, s.matches_played, s.wins,
                                   s.losses, s.championships, st.name AS sport_name
                            FROM player_profile_stats s
                            JOIN sport_types st ON st.sport_type_id = s.sport_type_id
                            WHERE s.user_id = ?  ORDER BY st.sport_type_id
                            ★ sport_name ไม่มีในตาราง ต้อง JOIN เอา

mappers/stat.mapper.ts     🆕
  UserStatsDto  { userId, overall{...}, bySport[] }
  toSportStatDto(row)      1 แถว → 1 ชิ้น  → ใช้ .map()
  toUserStatsDto(userId, rows)   รวม overall เอง → เรียกตรงๆ ครั้งเดียว
                            ★ pattern เดียวกับ toPublicUserDto

services/user.service.ts   เพิ่ม getUserStats(userId)
                            findById → null ⇒ 404 USER_NOT_FOUND   (เช็คก่อนเสมอ)
                            findStatsByUser → map → ประกอบ

controllers/user.controller.ts  เพิ่ม getUserStats (เช็ค :id เหมือน getUserById)
routes/users.routes.ts     router.get('/:id/stats', User.getUserStats)
```

**กฎที่ต้องคิดเอง (สเปกไม่ได้บอก):**
- `winRate` เมื่อ `matchesPlayed = 0` → ต้องเป็น `0` ไม่ใช่ `NaN`
- `winRate` เป็นทศนิยม `0.7` หรือเปอร์เซ็นต์ `70`
- ไม่เคยแข่งเลย → `overall` เป็น 0 ทั้งหมด + `bySport: []` **ไม่ใช่ 404**

**ข้อมูลทดสอบที่มีอยู่แล้ว:** 9001 มี 2 กีฬา (10 นัด ชนะ 7 · 4 นัด ชนะ 1) · **9002 มี 1 แถวแต่ `matches_played = 0`** ← เคสหารด้วยศูนย์ · 9003 ไม่มีแถวเลย

---

## U06 — `GET /users/search?q=` · ต้อง login

| | |
|---|---|
| **ทำอะไร** | ค้นหาผู้ใช้จากชื่อ (ไว้เชิญเข้าทีมใน Step 4) |
| **รับ** | `?q=` (query string) — **ไม่ใช่ body** |
| **ส่ง** | `{ items: UserRefDto[] }` — ไม่มี `pagination` |
| **สิทธิ์** | `requireAuth` |
| **error** | `400 QUERY_TOO_SHORT` · `401 NO_TOKEN` |
| **เอกสาร** | Part 3 `### U06` · Part 4 §4 (`QUERY_TOO_SHORT`) · NF-SE-04 |

**ต้องเขียน 4 ไฟล์ (ไม่ต้องมี mapper ใหม่):**
```
repositories/user.repo.ts   เพิ่ม searchByName(q)
                              SELECT user_id, full_name, profile_image_key
                              FROM users
                              WHERE full_name LIKE ? AND is_suspended = 0
                              ORDER BY full_name  LIMIT 20
                              ★ LIMIT 20 ตายตัว ห้ามให้ client กำหนด
                              ★ คืน Pick<UserRow,'user_id'|'full_name'|'profile_image_key'>[]
                                ให้ตรงกับที่ toUserRef รับพอดี

services/user.service.ts    เพิ่ม searchUsers(q)
                              q.length < 3 ⇒ throw 400 QUERY_TOO_SHORT
                              searchByName → .map(toUserRef) → { items }

controllers/user.controller.ts  เพิ่ม searchUsers
                              อ่าน req.query['q'] (เป็น string | undefined | array!)
                              ★ ไม่ใช่ req.body — validate() ที่มีอยู่ใช้ไม่ได้

routes/users.routes.ts      router.get('/search', requireAuth, User.searchUsers)
                              ★★ ต้องอยู่ "บรรทัดบน" /:id
```

**mapper ใช้ `toUserRef` ที่เขียนค้างไว้ตั้งแต่ Step 1 ได้เลย** — ตรงกับ response ของ U06 พอดี

**🪤 กับดักเฉพาะตัวนี้:**
- `req.query['q']` มี type เป็น `string | string[] | ParsedQs | undefined` — ไม่ใช่ `string` เฉยๆ
  (`?q=a&q=b` ทำให้กลายเป็น array ได้) → ต้องเช็ค `typeof q !== 'string'` ก่อน
- `%` และ `_` ใน `q` เป็น wildcard ของ `LIKE` → ผู้ใช้พิมพ์ `%` จะเห็นทุกคน **ต้อง escape**
- ค้นจาก `full_name` เท่านั้น **ห้ามค้น email**

**ตัดสินใจ:** ทำ `validateQuery()` middleware หรือเช็คใน controller —
ตัวแรกของโปรเจกต์ และ C06/`GET /tournaments` กับอีกหลายสิบ endpoint จะลอกแบบนี้ต่อ

---

## U02 — `PATCH /me` · ต้อง login (ทำท้ายสุด)

| | |
|---|---|
| **ทำอะไร** | แก้โปรไฟล์ตัวเอง |
| **รับ** | body `{ avatarUrl?, contactInfo?, address? }` — **ทุกช่อง optional** |
| **ส่ง** | `MeDto` (เหมือน U01) หลังแก้แล้ว |
| **สิทธิ์** | `requireAuth` — แก้ได้เฉพาะตัวเอง ไม่มี `:id` |
| **error** | `400 VALIDATION_FAILED` · `401` |
| **เอกสาร** | Part 3 `### U02` · Part 4 §2 |

**ต้องเขียน 5 ไฟล์:**
```
schemas/user.schema.ts     🆕 updateMeSchema
                             avatarUrl / contactInfo / address — ทุกช่อง .optional()
                             ★ ประกาศแค่ 3 ช่องนี้ Zod กรองที่เหลือทิ้งเอง
                             export type UpdateMeInput = z.infer<typeof updateMeSchema>

repositories/user.repo.ts  เพิ่ม update(userId, data)
                             ประกอบ SET ตอนรัน (ส่ง 1 ช่องก็ SET 1 ช่อง)
                             ★ ต่อ string เฉพาะ "ชื่อคอลัมน์" — ค่าต้องผ่าน ? เสมอ
                             ★ ต้องมี updated_at = NOW() ทุกครั้ง (DB ไม่ทำให้)

services/user.service.ts   เพิ่ม updateMe(userId, input)
                             update → findById อีกครั้ง → toMeDto
                             ★ ต้อง SELECT ใหม่ เพราะต้องคืน MeDto เต็มใบ

controllers/user.controller.ts  เพิ่ม patchMe — req.user!.user_id + req.body
routes/me.routes.ts        router.patch('/', requireAuth, validate(updateMeSchema), patchMe)
                             ★ validate() ที่มีอยู่ใช้ได้เลย เพราะเป็น body
```

**กฎที่ต้องเช็ค:**
- allowlist 3 ช่อง — **ห้ามรับ `email` / `password` / `facultyId`** (Part 3 เขียนกำกับไว้เอง)
- `updated_at = NOW()` เอง — DDL ไม่มี `ON UPDATE CURRENT_TIMESTAMP` ([[07 - จุดที่ต้องยืนยันกับทีม]] C4)
- body ว่าง `{}` → ต้องตัดสินใจ (400 หรือ no-op) ไม่งั้น SQL พัง

**ทดสอบสำคัญ:** ส่ง `{ "email": "hack@x.com" }` ไปแล้ว `email` ใน DB ต้องไม่เปลี่ยน

---

## 🔁 pattern ที่ซ้ำกันทั้ง 4 ตัว (เขียนตัวแรกให้ดี ที่เหลือลอกได้)

```
controller  แปลง :id / อ่าน query → เช็ครูปแบบ → 400 ถ้าผิด → เรียก service → res.json()
service     เรียก repo → ถ้าไม่มีของ → throw 404 → map → ประกอบ response
repo        SELECT เฉพาะคอลัมน์ที่ใช้ → คืน Row[] หรือ Row | null
mapper      Row (snake_case) → Dto (camelCase) ทีละ field
```

**"ต้องส่งไปไหนไหม"** — ทั้ง 4 endpoint นี้**ไม่ต้องส่งอะไรออกนอกระบบเลย** ไม่มีอีเมล ไม่มี webhook
มีแค่ U02 ที่**เขียนลง DB** (`UPDATE users`) นอกนั้นอ่านอย่างเดียว

---

# U02 — `PATCH /me`

```ts
// Request — ทุก field optional ส่งเฉพาะที่จะแก้
{ avatarUrl?: string; contactInfo?: string; address?: string }
// Response 200 — MeDto เหมือน U01 เป๊ะ (คืนข้อมูลหลังแก้)
```
Auth: `requireAuth`

### ★ กฎเหล็ก — allowlist ไม่ใช่ blocklist

Part 3 เขียนกำกับไว้ว่า **ห้ามรับ `email`, `password`, `facultyId`** ผ่าน endpoint นี้

- `email` / `password` → กระทบการ login ต้องมี flow ยืนยันตัวตนของตัวเอง (A06)
- `facultyId` / `departmentId` / `year` → **Hard Filter (BR-08) ใช้ตัดสินสิทธิ์สมัครแข่ง**
  ถ้าแก้ได้อิสระ = คนย้ายคณะไปมาเพื่อสมัครทัวร์ที่ตัวเองไม่มีสิทธิ์

**Zod ช่วยเราอยู่แล้ว** — `z.object()` กรอง key แปลกปลอมทิ้งเสมอ (ทดสอบยืนยันตั้งแต่ Step 1)
ดังนั้นแค่**ไม่ประกาศ** field พวกนั้นใน schema ก็ปลอดภัยแล้ว ไม่ต้องเขียนโค้ดไล่ลบ

### 🪤 กับดัก 3 ข้อ

**1. `updated_at` ไม่ auto-update**
```sql
updated_at DATETIME NULL     -- ไม่มี ON UPDATE CURRENT_TIMESTAMP
```
→ **ต้อง `SET updated_at = NOW()` เองทุกครั้ง** (ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ C4)
นี่คือ `UPDATE` ตัวแรกของโปรเจกต์ — ถ้าลืมตรงนี้ จะลืมทุกที่ที่เหลือ

**2. body ว่าง `{}` จะทำยังไง**
`.partial()` ยอมให้ `{}` ผ่าน → SQL กลายเป็น `UPDATE users SET WHERE ...` = **syntax error**
เลือกทางใดทางหนึ่ง:
- ตอบ `400 VALIDATION_FAILED` ว่า "ต้องระบุอย่างน้อย 1 ช่อง" (Zod ทำได้ด้วย `.refine()`)
- หรือถ้าไม่มี field ไหนถูกส่งมา ก็ข้าม `UPDATE` ไปเลย แล้วคืน MeDto เดิม
> ยังไม่ได้ตัดสินใจ — เลือกแล้วจดลง [[07 - จุดที่ต้องยืนยันกับทีม]]

**3. SQL ต้องสร้างแบบไดนามิก**
ส่งมา 1 field ก็ `SET` 1 ช่อง ส่ง 3 ก็ `SET` 3 ช่อง → ต้องประกอบ `SET` ตอนรัน
**ห้ามต่อ string ค่าเข้าไปตรงๆ เด็ดขาด** — ประกอบเฉพาะ *ชื่อคอลัมน์* (ซึ่งมาจาก allowlist ของเราเอง)
ส่วน *ค่า* ต้องผ่าน `?` placeholder เสมอ

### ไฟล์ที่แตะ
```
schemas/user.schema.ts        🆕 updateMeSchema
repositories/user.repo.ts     ✏️ เพิ่ม update()
services/user.service.ts      🆕 updateMe()
controllers/user.controller.ts ✏️ เพิ่ม patchMe()
routes/user.routes.ts         ✏️ router.patch('/', requireAuth, validate(updateMeSchema), patchMe)
```

---

# U03 — `GET /users/:id`

```ts
// Response 200 — สาธารณะ (Auth: —)
{
  id: number; fullName: string; avatarUrl: string | null;
  facultyId: number; departmentId: number;
  teams: TeamRef[];              // TeamRef = { id, name, sportTypeId }
}
// Error 404 USER_NOT_FOUND
```

### ★ จุดสำคัญ — DTO คนละตัวกับ U01

| | `MeDto` (U01) | `PublicUserDto` (U03) |
|---|---|---|
| email · contactInfo · address | ✅ มี | ❌ **ไม่มี** |
| totalPoints · notificationPrefs · createdAt | ✅ มี | ❌ ไม่มี |
| teams | ❌ ไม่มี | ✅ มี |

**นี่คือเหตุผลที่ mapper ต้องเขียนทีละ field ห้าม `{ ...row }`** — ใช้ Row เดียวกันแต่ส่งออกคนละชุด

`UserRefDto` ที่เขียนไว้ตั้งแต่ Step 1 **ยังไม่ใช่ตัวนี้** (มีแค่ 3 field ไม่มี faculty/teams) — U03 ต้องมี DTO ของตัวเอง ส่วน `UserRefDto` จะได้ใช้จริงตอน U06 และ Step 4

### 🪤 กับดัก
- **`teams` ต้อง JOIN** `team_members` → `teams` และ **ต้องกรอง `deleted_at IS NULL`** ไม่งั้นทีมที่ถูกลบไปแล้วจะโผล่
- **ผู้ใช้ที่ถูกระงับ (`is_suspended = 1`) ควรเห็นไหม?** — สเปกไม่ได้เขียนไว้
  → ตัดสินใจแล้วจดลง [[07 - จุดที่ต้องยืนยันกับทีม]]
- `:id` ต้องเช็ค `Number.isInteger(id) || id < 1` แบบเดียวกับ R02/R05

---

# U04 — `GET /users/:id/stats`

```ts
// Response 200
{
  userId: number;
  overall: { matchesPlayed; wins; losses; winRate; championCount };
  bySport: Array<{ sportTypeId; sportName; matchesPlayed; wins; losses }>;
}
```

อ่านจากตาราง `player_profile_stats` (1 แถวต่อ user ต่อกีฬา):
```sql
user_id · sport_type_id · matches_played · wins · losses · championships
UNIQUE (user_id, sport_type_id)
```

### 🪤 กับดัก 3 ข้อ

**1. `overall` ไม่มีในตาราง ต้องรวมเอง** — `SUM()` ทุกแถวของ user คนนั้น
(`GROUP BY user_id` หรือรวมใน JS ก็ได้ — เลือกอย่างใดอย่างหนึ่งแล้วทำเหมือนกันทั้งโปรเจกต์)

**2. ⚠️ `winRate` หารด้วยศูนย์**
คนที่ยังไม่เคยแข่ง `matches_played = 0` → `wins / 0` = **`NaN`** หลุดไป JSON เป็น `null`
→ ต้องกำหนดเองว่า `matchesPlayed === 0` ⇒ `winRate = 0`
ตัดสินด้วยว่าเป็น **ทศนิยม 0–1** (`0.75`) หรือ **เปอร์เซ็นต์** (`75`) — สเปกไม่ได้บอก

**3. `sportName` ไม่ได้อยู่ใน `player_profile_stats`** → ต้อง JOIN `sport_types`

**4. คนที่ไม่เคยแข่งเลย** = ไม่มีแถวใน `player_profile_stats` เลยสักแถว
→ ต้องคืน `overall` ที่เป็น 0 ทั้งหมด + `bySport: []` **ไม่ใช่ 404**
(404 ใช้เฉพาะกรณี user ไม่มีจริง — ต้องเช็ค `findById` ก่อนเหมือน U03)

---

# U06 — `GET /users/search?q=`

```ts
// Query: q (string, ≥3 ตัวอักษร, บังคับ)
// Response 200 — ไม่ paginate จำกัด 20 รายการตายตัว
{ items: Array<{ id: number; fullName: string; avatarUrl: string | null }> }
// Error 400 QUERY_TOO_SHORT · "กรุณาพิมพ์อย่างน้อย 3 ตัวอักษร"
```
Auth: `requireAuth` (ต่างจาก U03/U04 ที่เป็นสาธารณะ)

**`items` ตรงกับ `UserRefDto` ที่เขียนค้างไว้ตั้งแต่ Step 1 พอดี** — `toUserRef` ได้ใช้งานจริงครั้งแรก

### ★ ทำไมต้องบังคับ ≥3 ตัวอักษร และ LIMIT 20

**NF-SE-04** — ถ้าปล่อยให้ค้นด้วย `q=a` หรือ `q=` เปล่า มันจะกลายเป็น
**ช่องดึงรายชื่อผู้ใช้ทั้งมหาวิทยาลัย** ทีละหน้า
ทั้งสองอย่างต้องบังคับที่ **service/schema ฝั่ง server** — ห้ามพึ่ง frontend

### 🪤 กับดัก
- **validate query ไม่ใช่ body** — `validate()` ที่มีอยู่อ่าน `req.body` เท่านั้น
  → ต้องเขียน `validateQuery()` เพิ่ม หรือเช็คใน controller ตรงๆ (**ตัวแรกของโปรเจกต์ ตัดสินใจให้ดี** เพราะ C06 กับอีกหลาย endpoint จะใช้ตาม)
- **`code` ที่ใช้คือ `QUERY_TOO_SHORT` ไม่ใช่ `VALIDATION_FAILED`** (Part 4 §4)
- **`%` และ `_` ใน `q`** เป็น wildcard ของ `LIKE` — ผู้ใช้พิมพ์ `%` มาจะ match ทุกคน
  placeholder `?` กัน SQL injection ได้ แต่**ไม่ได้กัน wildcard** → ต้อง escape เอง
- ค้นจาก `full_name` เท่านั้น **ห้ามค้นด้วย email** (จะกลายเป็นเครื่องมือยืนยันว่าอีเมลนี้มีในระบบ — หลักเดียวกับ `INVALID_CREDENTIALS`)

---

# ⚠️ 2 เรื่องโครงสร้างที่ต้องตัดสินใจก่อนเขียน U03

## 1. ลำดับ route — `/users/search` ต้องมาก่อน `/users/:id`

U03 ใช้ `/users/:id` และ U06 ใช้ `/users/search` — **อยู่ prefix เดียวกัน**
Express อ่าน route จากบนลงล่าง ตัวไหนแมตช์ก่อนชนะ → ถ้าประกาศ `/:id` ก่อน
คำว่า `search` จะถูกจับเป็น `id` ทันที (ทดสอบยืนยันแล้ว):

```
ประกาศ /:id ก่อน     → GET /users/search  ได้ {"matched":"/:id","id":"search"}  ❌
ประกาศ /search ก่อน  → GET /users/search  ได้ {"matched":"/search"}             ✅
                       GET /users/7       ได้ {"matched":"/:id","id":"7"}       ✅ ทั้งสองแบบ
```

**กฎ: path ตายตัวต้องมาก่อน path ที่มีตัวแปรเสมอ** — ไม่มี error ไม่มี warning ถ้าเรียงผิด
(จะเจอซ้ำอีกที่ `/tournaments/:id` vs `/tournaments/search` ใน Step 5)

## 2. ชื่อไฟล์ router ชนกัน

ตอนนี้ `routes/user.routes.ts` ถูก mount ที่ **`/me`** — พอ U03 ต้องมี `/users` อีกกลุ่ม
ชื่อไฟล์จะสับสนทันที เลือกทางใดทางหนึ่งก่อนเริ่ม:

- **ก.** เปลี่ยนชื่อไฟล์เดิมเป็น `me.routes.ts` แล้วสร้าง `users.routes.ts` ใหม่ ← ชัดเจนกว่า
- **ข.** ยัด `/users` ไว้ในไฟล์เดิม แล้วประกาศ path เต็มแบบ `reference.routes.ts`

> `/me` (17 endpoint) กับ `/users` (6 endpoint) เป็นคนละกลุ่มใน Part 2 และคนละสิทธิ์
> (`/me` = เจ้าตัว ต้อง login · `/users/:id` = สาธารณะ) → **แนะนำ ก.**

---

# ลำดับที่แนะนำ

```
1. U03  ← ง่ายสุด ได้ฝึก JOIN + DTO สาธารณะ ไม่มีการเขียนข้อมูล
2. U04  ← JOIN + คำนวณ ต่อยอดจาก U03
3. U06  ← ต้องตัดสินใจเรื่อง validate query (คิดให้จบ จะใช้ยาว)
4. U02  ← ยากสุด: UPDATE ไดนามิก + allowlist + updated_at
```

> ทำทีละตัวให้จบทั้งเส้น (repo → mapper → service → controller → route → ทดสอบ)
> อย่าเขียน route ทั้ง 4 ตัวแล้วค่อยไล่เติมข้างใน

---

# เช็คลิสต์ทดสอบ

```
U02  □ PATCH /me { contactInfo }        → 200 · MeDto อัปเดตแล้ว
     □ PATCH /me { email: 'x@y.z' }     → email ใน DB ต้องไม่เปลี่ยน (Zod กรองทิ้ง)
     □ PATCH /me { facultyId: 9 }       → faculty_id ต้องไม่เปลี่ยน
     □ PATCH /me {}                     → ตามที่ตัดสินใจไว้
     □ ไม่มี token                       → 401 NO_TOKEN
     □ updated_at ใน DB เปลี่ยนจริงไหม

U03  □ GET /users/1                     → 200 · ไม่มี email/contactInfo/address
     □ GET /users/999                   → 404 USER_NOT_FOUND
     □ GET /users/abc                   → 400 VALIDATION_FAILED
     □ ไม่ส่ง Authorization              → 200 (สาธารณะ)

U04  □ GET /users/1/stats               → 200
     □ user ที่ยังไม่เคยแข่ง             → overall เป็น 0 · bySport [] · winRate ไม่ใช่ NaN
     □ GET /users/999/stats             → 404

U06  □ GET /users/search?q=สม           → 400 QUERY_TOO_SHORT (2 ตัว)
     □ GET /users/search                → 400 (ไม่ส่ง q)
     □ GET /users/search?q=สมชาย         → 200 · ไม่เกิน 20 รายการ
     □ GET /users/search?q=%            → ต้องไม่คืนทุกคน
     □ ไม่มี token                       → 401
```

> ต้องมีข้อมูลผู้ใช้ในระบบก่อนถึงจะทดสอบ U03/U04/U06 ได้ —
> สมัครสมาชิกผ่าน A01 หลายๆ คน หรือเพิ่มไฟล์ seed แยกสำหรับข้อมูลทดสอบ
> (**อย่าใส่ลงใน `database/seed.sql`** — นั่นคือข้อมูลจริงที่จะขึ้น production)

---

# สิ่งที่ต้องตัดสินใจใน Step นี้ (จดลง [[07 - จุดที่ต้องยืนยันกับทีม]])

1. U02 body ว่าง `{}` → 400 หรือ no-op
2. U03 ผู้ใช้ที่ถูกระงับ ควรแสดงต่อสาธารณะไหม
3. U04 `winRate` เป็นทศนิยม 0–1 หรือเปอร์เซ็นต์ 0–100
4. วิธี validate query string — เขียน `validateQuery()` middleware หรือเช็คใน controller

ต่อไป → **Step 4 Teams (18 endpoint)** ซึ่งเป็นก้อนแรกที่มีกฎธุรกิจเต็มรูปแบบ
⚠️ ก่อนเริ่ม Step 4 ต้องได้คำตอบข้อ **A1** ใน [[07 - จุดที่ต้องยืนยันกับทีม]] ก่อน (`team_invitations` ไม่มี `expires_at`)
