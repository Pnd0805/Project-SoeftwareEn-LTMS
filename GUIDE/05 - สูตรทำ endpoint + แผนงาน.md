# 05 — สูตรทำ endpoint + แผนงาน Step 2-10

> ส่วนที่ 1 = สูตร 8 ขั้น ใช้ซ้ำได้ทุก endpoint ที่เหลือ
> ส่วนที่ 2 = แผนงาน Step 2-10 พร้อมจุดที่ต้องระวังของแต่ละ Step

---

# 📍 สถานะปัจจุบัน — อัปเดต 31 ส.ค. 2569

> ทุกอย่างในบล็อกนี้**ยิงทดสอบจริงแล้ว** ไม่ใช่แค่ `typecheck` ผ่าน

```
MVP 93 endpoint  ████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  8 เสร็จ / เหลือ 85
```

| Step | สถานะ |
|---|---|
| **Step 1 — Auth** | ✅ ครบ · A01 · A02 · A03 · U01 · `requireAuth` (ผ่าน 8 เคส) |
| **Step 2 — Reference Data** | ✅ ครบ · R01 · R02 · R03 · R05 (ผ่าน 9 เคส) |
| **Step 3 — Users & Profile** | ⬜ ตัวถัดไป → 📄 [[08 - Step 3 · Users & Profile]] |

โครงสร้างที่วางเสร็จแล้ว: prefix `/api/v1` ตรงสเปก · `routes/index.ts` · `database/seed.sql` (8 คณะ / 30 ภาควิชา / 9 กีฬา / 23 สถิติ)

## ✅ ไม่มีของค้าง

**A5 แก้แล้ว (1 ก.ย. 2569)** — `register` ตรวจ `facultyId`/`departmentId` ก่อน INSERT
ตอบ `400 VALIDATION_FAILED` พร้อม `fields` ชี้ช่องที่ผิด · ทดสอบผ่าน 5 เคส
รวมเคส **ภาควิชาข้ามคณะ** ที่ FK จับไม่ได้ → [[07 - จุดที่ต้องยืนยันกับทีม]] A5

## 🧠 บทเรียนจาก Step 1-2 ที่ต้องจำ

- **`mysql` CLI ต้องมี `--default-character-set=utf8mb4` เสมอ** ไม่งั้นภาษาไทยพังเงียบๆ ไม่มี error
  (`CHAR_LENGTH` จะกลายเป็น 51 แทนที่จะเป็น 17)
- **`SELECT` ที่ต้องเรียงลำดับ ต้องมี `ORDER BY`** — MySQL ไม่รับประกันลำดับ
  เจอจริงที่ R05: `display_order` ออกมาเป็น `[3,4,1,2]`
- **controller ที่เรียก service แบบ `async` ต้อง `await`** — ลืมแล้วได้ `{}` เปล่า + `throw` หายไป
  (404 กลายเป็น 200) + unhandled rejection ทำ process ตาย
- **`router.use()` = ติดตั้ง router ย่อย · `router.get()/.post()` = endpoint ปลายทาง** — สลับกันแล้วได้ 404 เงียบๆ
- **`app.use()` path ต้องขึ้นต้นด้วย `/`** — `'api/v1'` ไม่แมตช์อะไรเลยและไม่มี error

---

**A04–A06 ไม่ต้องทำตอนนี้** — Part 2 จัดเป็น **Sprint #1** ไม่ใช่ MVP
(Auth มี 6 endpoint = MVP 3 ตัว คือ A01/A02/A03 เท่านั้น)

---

# ส่วนที่ 1 — สูตร 8 ขั้น

ทุกครั้งที่จะทำ endpoint ใหม่ ทำตาม 8 ขั้นนี้ตามลำดับ

### ขั้น 1 — เปิด [[06 - Endpoint Reference MVP 93]] หาแถวของ endpoint นั้น
ได้: path, method, ใครเรียกได้, ทำอะไร, รับ/ส่งอะไร, ไฟล์ที่ต้องแตะ

### ขั้น 2 — เปิด Part 3 ดู schema เต็ม
`API_Design/Part1-4/MD/LTMS_API_Design_Part3.md` — ค้นหาด้วยรหัส เช่น `### T01`
ได้: field ครบทุกตัวพร้อม type และ error ที่เป็นไปได้

### ขั้น 3 — เปิด Part 4 ดู error code
`API_Design/Part1-4/MD/LTMS_API_Design_Part4.md` — หาหัวข้อของกลุ่มนั้น
**อย่าตั้ง error code เอง** ถ้ามีในเอกสารอยู่แล้ว frontend เขียน logic รอไว้แล้ว

### ขั้น 4 — เขียน Zod schema (`schemas/`)
แปลง request จาก Part 3 → Zod พร้อมข้อความไทย

### ขั้น 5 — เขียน repository (`repositories/`)
คิดว่าต้องแตะกี่ตาราง → เขียนฟังก์ชัน SQL ให้ครบ
**ยังไม่ต้องคิดเรื่องกฎ** แค่ "ดึงข้อมูลนี้มา" / "เขียนข้อมูลนี้ลง"

### ขั้น 6 — เขียน service (`services/`)
1. ดึงข้อมูลที่ต้องใช้ตัดสิน
2. เช็คกฎทีละข้อ (ดูคอลัมน์ Guard/BR ในตาราง) → ไม่ผ่านก็ `throw AppError` พร้อม code จากขั้น 3
3. เขียนข้อมูล (ห่อ transaction ถ้าแตะหลายตาราง)
4. คืน object ที่ map แล้ว

### ขั้น 7 — เขียน controller + ต่อ route
controller 3-5 บรรทัด, route 1 บรรทัด พร้อม middleware ที่ต้องใช้

### ขั้น 8 — ทดสอบ 4 เคสเป็นอย่างน้อย
1. **happy path** — ทุกอย่างถูก
2. **validation ผิด** — ส่ง field ผิดรูปแบบ → 400
3. **ไม่มีสิทธิ์** — ล็อกอินเป็นคนอื่นแล้วลองเรียก → 403
4. **ผิดกฎธุรกิจ** — จงใจให้ผิด BR → 409/422

---

## เทมเพลตคำถามก่อนเขียนทุก endpoint

ตอบ 6 ข้อนี้ก่อนแตะคีย์บอร์ด แล้วจะไม่หลงทาง:

```
1. path + method อะไร?               → routes/____.routes.ts
2. ใครเรียกได้?                       → middleware ตัวไหน
3. รับอะไร?                          → schemas/____.schema.ts
4. ต้องเช็คกฎอะไรบ้าง?                → services/____.service.ts
5. แตะตารางไหนบ้าง? กี่ตาราง?          → repositories/  (>1 ตาราง = ต้อง transaction)
6. คืนอะไร? ต้องซ่อน field ไหน?        → mappers/____.mapper.ts
```

---

## แม่แบบตาม "ชนิด" ของ endpoint

endpoint 93 ตัวแบ่งได้เป็น 5 แบบ พอรู้แบบก็เดาโครงได้เลย

### แบบ A — GET รายการสาธารณะ (`GET /tournaments`, `GET /faculties`)
```
route: ไม่มี middleware สิทธิ์ (แต่มี validate ของ query)
service: อ่านอย่างเดียว + ★ บังคับ filter ความปลอดภัยที่ service ไม่ใช่ที่ client
repo: SELECT + LIMIT/OFFSET + SELECT COUNT(*) สำหรับ pagination
คืน: { items: [...], pagination: {...} }
```
> ⚠️ `GET /tournaments` (C06) **ต้อง hardcode `status='public'` ที่ service**
> ห้ามให้ client ส่ง `?status=private` มาแล้วเห็นทัวร์ที่ยังไม่เผยแพร่ (Part 0-1 §1.10)

### แบบ B — GET รายตัว (`GET /teams/:id`)
```
route: อาจมีหรือไม่มี requireAuth
service: หาไม่เจอ → throw 404 พร้อม code เฉพาะ (TEAM_NOT_FOUND ไม่ใช่ NOT_FOUND)
คืน: object ตรงๆ ไม่ห่อ data
```
> ⚠️ `GET /tournaments/:id` (C07) ถ้าเป็น `private` และคนเรียกไม่ใช่ ORG/ADM
> ต้องตอบ **404 `TOURNAMENT_NOT_FOUND`** ไม่ใช่ 403 — เพื่อไม่ยืนยันว่าทัวร์นี้มีอยู่จริง

### แบบ C — POST สร้าง (`POST /teams`, `POST /tournaments`)
```
route: validate + requireAuth (+ guard)
service: เช็คซ้ำ → เช็ค quota/BR → INSERT (transaction ถ้าหลายตาราง)
คืน: 201 + resource ที่สร้าง
```

### แบบ D — Action endpoint เปลี่ยนสถานะ (`POST /.../approve`)
**นี่คือแบบที่เยอะที่สุดในระบบ** (Part 0-1 §1.6)
```
route: requireXXX ที่ตรงกับ role ในตาราง
service: 1. โหลด resource
        2. ★ เช็คว่า "สถานะปัจจุบันเปลี่ยนไปสถานะใหม่ได้ไหม" → ไม่ได้ = 409
        3. UPDATE status + คอลัมน์ประกอบ (approved_by, approved_at, reason)
        4. INSERT audit_logs ในทรานแซกชันเดียวกัน (ถ้าเข้าข่าย NF-SE-05)
        5. INSERT notifications ให้คนที่เกี่ยวข้อง
คืน: { id, status: 'สถานะใหม่' }
```
> **ข้อ 2 คือหัวใจ** — `POST /tournaments/:id/approve` ต้องเช็คว่าสถานะปัจจุบันเป็น
> `pending_approval` จริงไหม ถ้ามันถูก approve ไปแล้วต้อง 409 ไม่ใช่ approve ซ้ำเงียบๆ
> **ห้ามรับ `status` จาก body เด็ดขาด** — สถานะปลายทางถูกกำหนดโดย endpoint ไม่ใช่โดย client

### แบบ E — PATCH แก้ไข (`PATCH /teams/:id`)
```
route: validate + guard
service: ★ allowlist ฝั่ง backend — รับเฉพาะ field ที่อนุญาต ตัดที่เหลือทิ้ง
        (Zod ทำให้แล้วถ้าเขียน schema ถูก)
```
> `PATCH /tournaments/:id` (C08) รับได้แค่ `venue`, `description`
> ถ้าส่ง `eventStartDate` มา → **เพิกเฉย ไม่ error** ต้องไปใช้ C09 (amendment request) แทน
> รายชื่อ field ที่ "สำคัญ" ต้อง hardcode ที่ backend **ห้ามให้ client บอก**

---

## กฎธุรกิจที่โผล่ซ้ำๆ (จำไว้จะได้ไม่ต้องเปิดหา)

| รหัส | กฎ | เช็คตรงไหน |
|---|---|---|
| **BR-01** | ห้ามมีทางสร้างทัวร์ที่ข้ามการอนุมัติ | C01 ต้อง INSERT ด้วย `status='pending_approval'` เท่านั้น |
| **BR-04** | ลำดับบังคับ Create → Invite → Confirm → Ready | ไม่มี endpoint ให้ตั้ง Ready เอง |
| **BR-05** | Unofficial ≤5 ทีม/คน, Official 1 ทีม/กีฬา | **T13 (รับคำเชิญ) และ T17 (อนุมัติ Official) ทั้งสองจุด** |
| **BR-08** | Hard Filter (เพศ/อายุ/ชั้นปี/คณะ) | P01 |
| **BR-09** | ทีมต้อง `Ready` ก่อนสมัคร | P01 |
| **BR-10** | ต้องมีกรรมการ `accepted` ก่อน publish | C13 |
| **BR-11** | on-site + บันทึกสถิติ ต้องมีกรรมการ ≥2 | S01, S06 |
| **BR-12** | ผู้ยืนยันผลต้องไม่ใช่ผู้ส่งผล | S02 |
| **BR-13** | ใครส่งผลได้ขึ้นกับ mode (onsite/online) | S01, S02 |
| **BR-14** | โต้แย้งได้ภายใน `dispute_window_hours` | S03 |

---

## Pagination — เขียนครั้งเดียวใช้ทุกที่

Part 0-1 §1.10: `?page=1&pageSize=20&sort=createdAt&order=desc`
- `page` เริ่มที่ 1, default 1
- `pageSize` default 20, **สูงสุด 100** (ต้องบังคับ ไม่งั้นคนส่ง `pageSize=999999` มาถล่ม DB)

`utils/pagination.ts` ควรมี:
- `parsePagination(query)` → `{ page, pageSize, limit, offset }`
- `buildPagination(page, pageSize, totalItems)` → `{ page, pageSize, totalItems, totalPages }`

**`sort` / `order` ต้องระวัง SQL Injection** — ใส่ column name เข้า SQL ตรงๆ ไม่ได้
ต้องมี allowlist: `const ALLOWED_SORT = ['created_at', 'name'] as const;` แล้วเทียบก่อนใช้

**endpoint ที่ไม่ต้อง paginate** (ตาม Part 3): T02 `/me/teams`, U06 `/users/search` (จำกัด 20 ตายตัว),
R01/R02/R03 (reference data), T06 members, F02 referees

---

# ส่วนที่ 2 — แผนงาน Step 2-10

---

## Step 2 — Reference Data (R01, R02, R03, R05) · ~1 วัน

**เป้าหมาย:** ฝึกมือกับ endpoint ที่ง่ายที่สุด ทุกตัวเป็น GET สาธารณะ อ่านอย่างเดียว

ไฟล์ที่สร้าง: `reference.routes.ts`, `reference.controller.ts`, `reference.service.ts`,
`faculty.repo.ts`, `sportType.repo.ts`, `reference.mapper.ts`

**สิ่งที่จะได้เรียนรู้:** โครงสร้าง `{ items: [...] }`, mapper แบบง่าย, การไม่ใส่ middleware สิทธิ์

**เตือน:** ไม่มี POST/PATCH ในกลุ่มนี้ ข้อมูล seed ผ่าน SQL (Part 0-1 §2.1)

**โบนัส:** Step นี้ปิดบั๊กที่ค้างจาก Step 1 ให้ด้วย — ตอนนี้ `POST /auth/register`
ที่ส่ง `facultyId` ซึ่งไม่มีจริง จะทะลุไปชน FK แล้วตอบ **500 `INTERNAL_ERROR`**
(ทดสอบยืนยันแล้ว) ทั้งที่เป็นความผิดฝั่ง client → ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ A5

---

## Step 3 — Users & Profile (U02, U03, U04, U06) · ~2 วัน

> 📄 **รายละเอียดเต็ม → [[08 - Step 3 · Users & Profile]]** (กับดักแต่ละ endpoint · เช็คลิสต์ทดสอบ · 4 เรื่องที่ต้องตัดสินใจ)

**สิ่งที่ยากขึ้น:**
- **U02 `PATCH /me`** — allowlist: รับได้แค่ `avatarUrl`, `contactInfo`, `address`
  **ห้ามรับ `email`, `password`, `facultyId`** เด็ดขาด
- **U03 vs U01** — mapper คนละตัว (ย้ำจาก Step 1)
- **U04 stats** — อ่านจาก `player_profile_stats` + คำนวณ `winRate` ตอน map
- **U06 search** — บังคับ `q` ยาว ≥3 ตัว (400 `QUERY_TOO_SHORT`) + `LIMIT 20` ตายตัว
  ไม่งั้นกลายเป็นช่องดึงรายชื่อผู้ใช้ทั้งระบบ (NF-SE-04)

---

## Step 4 — Teams (T01-T14) · ~4-5 วัน

**นี่คือ Step แรกที่มี state machine จริงๆ**

```
Forming ──(สมาชิกครบ min_members ตอน T13)──> Ready
Ready   ──(ถอดสมาชิกจนไม่ครบ ตอน T08)─────> Forming
```

**จุดที่ต้องเข้าใจก่อนเขียน:**

1. **ไม่มี endpoint ให้เปลี่ยนเป็น Ready** — มันเกิดข้างใน T13 อัตโนมัติ
   ถ้าทำเป็น endpoint แยก หัวหน้าทีมจะกดให้ทีมพร้อมได้ทั้งที่คนไม่ครบ ขัด BR-04

2. **T08 ต้องคำนวณย้อนกลับด้วย** — ถอดสมาชิกจนเหลือ < `min_members` ต้องกลับเป็น `Forming`
   ไม่งั้นทีมคนไม่ครบจะยังสมัครแข่งได้

3. **T13 คือจุดที่ BR-05 ต้องบังคับจริง** — เช็คก่อนรับคำเชิญว่าคนนี้มีทีม Unofficial ครบ 5 แล้วยัง

4. ⚠️ **`teams.readiness_status` ใน DB มีแค่ `Forming` / `Ready`** — ไม่มี `Inactive` ที่ Part 3 T02 เขียนไว้
   และ `official_status` มีแค่ `Unofficial` / `Official` — ไม่มี `pending`
   (สถานะ "รออนุมัติ" อยู่ที่ `team_admin_requests` ต้องให้ mapper คำนวณ — ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ B3/B4)

5. **T05 ลบทีม** — ถ้าทีมกำลังแข่งอยู่ ต้อง **409** พร้อมบอกทางออก:
   ```json
   { "error": { "code": "TEAM_IN_COMPETITION",
     "message": "ทีมนี้กำลังอยู่ระหว่างการแข่งขัน กรุณาใช้การถอนตัวแทนการลบทีม",
     "suggestedAction": "POST /applications/:applicationId/withdraw" } }
   ```
   และเป็น **soft delete** (`deleted_at`, `deleted_reason='leader_deleted'`) ไม่ใช่ `DELETE FROM`
   > **แปลว่าทุก query ที่ดึงทีม ต้องมี `WHERE deleted_at IS NULL` ต่อท้ายเสมอ** — จำให้ขึ้นใจ

6. **`/invitations/:id/accept` ไม่ได้ nest ใต้ `/teams`** — invitation id เป็น global unique
   ทำ `invitation.routes.ts` แยกออกมา

7. **T01 ต้องเป็น transaction** — INSERT `teams` แล้ว INSERT `team_members` (หัวหน้าเป็นสมาชิกด้วย)

**Middleware ใหม่ที่ต้องเขียน:** `requireTeamLeader`
> รับ id จาก `req.params` ตัวไหน? บาง route เป็น `:id` บางตัวเป็น `:teamId`
> ทำให้รับชื่อ param ได้: `requireTeamLeader('id')` จะยืดหยุ่นกว่า

---

## Step 5 — Tournaments (C01-C17) + Admin (T15-T18) · ~4-5 วัน

**เนื้อหาใหม่:** state machine ที่ซับซ้อนที่สุดในระบบ + role Admin

```
pending_approval ──C04 approve──> private ──C13 publish──> public
       │                             ▲                       │
       └──C05 reject──> rejected     └────C14 unpublish──────┘

registrationOpen: false ──C15──> true ──C16──> false   (แยกจาก status)
```

**จุดที่ต้องระวัง:**

1. **C01 สร้าง "คำขอ" ไม่ใช่ "ทัวร์นาเมนต์"** — เก็บในตาราง `tournaments` เดียวกัน
   แยกด้วย `status='pending_approval'` **ห้ามมี endpoint ไหนสร้างแถวด้วย status อื่น** (BR-01)

2. **C08 vs C09** — แก้ข้อมูลทั่วไป (ทันที) vs ข้อมูลสำคัญ (ต้องผ่าน Admin)
   allowlist ของ "ข้อมูลทั่วไป" ต้อง hardcode ที่ backend

3. **C11 ต้อง UPDATE tournaments จริง** ตอนอนุมัติ amendment ไม่ใช่แค่เปลี่ยนสถานะคำขอ
   (`requested_changes` เก็บเป็น JSON ต้องเอามา apply)

4. **C13 publish คือ guard ที่สำคัญที่สุดในกลุ่ม** — BR-10 บังคับว่าต้องมีกรรมการที่
   `invitation_status='accepted'` **ไม่ใช่แค่ถูกเชิญ**

5. **`requireOrganizer` ไม่ได้เช็คแค่ `requested_by_user_id`**
   ต้อง `AND status NOT IN ('pending_approval','rejected')` ด้วย (Part 0-1 §1.4)
   เพราะคนที่คำขอถูกปฏิเสธไม่ควรมีสิทธิ์ Organizer

6. **`requireAdmin(scope)`** — 2 แบบ `'faculty'` กับ `'university_wide'` จาก `admin_scopes`
   ต้องเช็คว่า scope ครอบคลุม resource นั้นจริง ไม่ใช่แค่ "เป็น admin"

7. **audit_logs เริ่มจำเป็นจริงจังที่ Step นี้** — C04, C05, T17, T18 ต้องเขียน log
   **ในทรานแซกชันเดียวกัน** ไม่ใช่ยิงทีหลัง (NF-SE-05)

> ✅ **ค่า `tournament_status` ยืนยันแล้ว:** `pending_approval`, `rejected`, `private`, `public`, `completed`, `auto_deleted`
> ⚠️ แต่ **`tournaments` ไม่มีคอลัมน์ `description`** ทั้งที่ C08 รับ field นี้ — ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ A2
> ⚠️ และชื่อคอลัมน์คือ **`tournament_status`** ไม่ใช่ `status` (ดู 07 ส่วน C)

---

## Step 6 — Referees (F01-F06, F11-F13) · ~2-3 วัน

**แนวคิดหลัก: กรรมการมี 2 ระดับ แยกกันชัดเจน**

```
tournament_referees  = แต่งตั้งระดับทัวร์ + สถานะตอบรับ   (ตอบรับครั้งเดียว)
match_referees       = มอบหมายรายแมตช์                    (มอบหมายกี่แมตช์ก็ได้)
```

F11 (มอบหมายเข้าแมตช์) ต้องมีแถวใน `tournament_referees` ที่ `accepted` อยู่ก่อน
ไม่งั้น 409 `REFEREE_NOT_ACCEPTED`

> ⚠️ **`tournament_referees` ไม่มี UNIQUE** — เชิญคนเดิมซ้ำได้ไม่จำกัด สร้างแถวใหม่ทุกครั้ง
> **ทุก query ตรวจสิทธิ์ต้อง `ORDER BY created_at DESC LIMIT 1`** ไม่งั้นจะเจอบั๊กแปลกๆ
> (Part 3 F01 ยังเขียน error `ALREADY_INVITED` อยู่ — ตัดออกได้ ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ C5)

**Middleware ใหม่:** `requireReferee` — ต้อง JOIN 2 ตาราง:
```
match_referees → tournament_referees
  WHERE user_id = ? AND invitation_status = 'accepted'
    AND (is_external = 0 OR external_approval_status = 'approved')
```
กรรมการภายนอกต้องผ่าน **2 ด่าน** คือตอบรับ **และ** Admin อนุมัติ (CO-06)

**F03 เป็น soft delete** (`removed_at`, `removed_by`) และต้องเช็ค BR-10 ใหม่หลังถอด

---

## Step 7 — Applications + Hard Filter (P01-P09) · ~3-4 วัน

**P01 คือ endpoint ที่ logic เยอะที่สุดใน Step นี้:**

```
1. ทีมนี้ Ready ไหม?                    → 409 TEAM_NOT_READY
2. ทัวร์นี้เปิดรับสมัครอยู่ไหม?          → 409 REGISTRATION_CLOSED
3. เคยสมัครแล้วหรือยัง?                 → 409 ALREADY_APPLIED (มี UNIQUE ที่ DB ด้วย)
4. ★ Hard Filter — วนสมาชิกทุกคน เทียบกับ tournament_eligibility_rules
   (เพศ / อายุ / ชั้นปี / คณะ)         → 422 HARD_FILTER_FAILED พร้อมรายชื่อคนที่ตก
5. INSERT + เก็บผล Hard Filter ลง hard_filter_details (JSON)
```

**สิ่งที่ต้องเข้าใจ:**
- **Hard Filter = ระบบตัดสินอัตโนมัติ** / **Soft Filter = Organizer ดูเอกสารแล้วใช้ดุลพินิจ** (P05/P06)
- `hard_filter_details` **เก็บตอนสมัคร ไม่คำนวณใหม่ตอนดู** — เพราะข้อมูลผู้ใช้อาจเปลี่ยนภายหลัง
- P03 (list) คืน S3 key ดิบ / P04 (detail) คืน presigned URL — **ต่างกันโดยเจตนา** เพื่อประหยัด
- `cancel` (ก่อนอนุมัติ) กับ `withdraw` (หลังอนุมัติ) **คนละความหมาย** ห้ามยุบรวม

> ✅ `cancelled` และ `withdrawn` มีใน DB แล้ว ทำ P07/P08 ได้เลย
> ⚠️ แต่ชื่อคอลัมน์คือ **`tournament_application_status`** ไม่ใช่ `status`

---

## Step 8 — Bracket + Matches + เช็คอิน (M01-M16) · ~5-6 วัน

**M01 สร้าง Bracket = endpoint ที่ซับซ้อนที่สุดที่ยังไม่ใช่ S02**

รองรับ 3 รูปแบบ ทำทีละอันได้:
1. `single_elimination` — ทำอันนี้ก่อน ง่ายสุด
2. `round_robin` — ทุกทีมเจอกันหมด **ไม่สร้าง `bracket_nodes` เลย** (nodeCount = 0)
3. `double_elimination` — ทำท้ายสุด มี winner/loser bracket

**สิ่งที่ M01 ต้องทำในทรานแซกชันเดียว:**
- คำนวณจำนวนรอบจากจำนวนทีม (+ bye ถ้าไม่ใช่กำลังของ 2)
- INSERT `matches` หลายสิบแถว
- INSERT `bracket_nodes` (ยกเว้น round robin)
- ตั้ง `next_match_id` / `loser_next_match_id` ให้ถูก ← **จุดที่พลาดง่ายสุด**

> `matches.next_match_id` คือ **source of truth ตัวเดียว** ของการเลื่อนสาย
> `bracket_nodes` เป็นแค่ข้อมูลสำหรับวาดผังบนหน้าเว็บ ห้ามมี "ตัวชี้" ซ้ำ 2 ที่

**M06 schedule ต้องเช็คทับซ้อน 3 มิติ:** ทีมเดียวกัน / สนามเดียวกัน / เวลาซ้อนกัน
→ 409 `SCHEDULE_CONFLICT` พร้อม `conflictingMatchId`

**M12 เช็คอินต้อง idempotent** (Part 0-1 §1.11) — กดซ้ำต้องตอบ **200 พร้อมข้อมูลเดิม ไม่ใช่ 409**
เพราะเน็ตหน้าสนามไม่ดี คนจะกดซ้ำแน่นอน มี `UNIQUE (match_id, user_id)` ที่ DB รองรับอยู่แล้ว

**M16 presign** — ถ้ายังไม่มี S3 จริง ทำ mock ไปก่อนได้ (คืน URL ปลอม) แล้วค่อยต่อของจริงทีหลัง

---

## Step 9 — ผลการแข่งขัน (S01-S07, S10-S12) · ~5-6 วัน ⭐⭐ ยากสุด

**S02 `POST /matches/:id/result/verify` = transaction 9 ขั้น** (Part 0-1 §1.15)

```
1. UPDATE match_results SET status='verified', verified_by_user_id, verified_at
2. UPDATE matches SET status='completed'
3. UPDATE matches ของ next_match_id — เลื่อนผู้ชนะเข้ารอบถัดไป
4. UPDATE matches ของ loser_next_match_id (ถ้า double elimination)
5. UPDATE tournament_standings
6. UPDATE player_profile_stats
7. คำนวณแต้ม Pick'em → INSERT point_transactions + UPDATE users.total_points
8. INSERT notifications ให้ผู้ติดตาม
9. INSERT audit_logs
```

**ถ้าขั้นใดพัง ต้อง rollback ทั้งหมด** ไม่งั้นตารางคะแนนจะไม่ตรงกับผลแข่ง

**วิธีทำให้ไม่ท้อ — ทำทีละขั้น:**
- รอบแรกทำแค่ขั้น 1-2 ให้ผ่านก่อน (ผลถูกยืนยัน แมตช์จบ)
- รอบสองเพิ่มขั้น 3-4 (เลื่อนสาย) แล้วทดสอบว่าทีมชนะโผล่รอบถัดไปจริง
- รอบสามเพิ่ม 5-6 (standings + stats)
- ขั้น 7-8 เป็น Sprint #1 (Pick'em/notification) ข้ามไปก่อนได้ **แต่ให้ที่ว่างไว้ในโค้ด**
- ขั้น 9 audit — ทำตั้งแต่รอบแรกเลย ง่ายและบังคับตาม NF-SE-05

**กฎที่ต้องเช็คใน S01/S02:**
- BR-13 ใครส่งผลได้ขึ้นกับ `matches.mode` (onsite → REF, online → TL) → 403 `WRONG_SUBMITTER_ROLE`
- BR-12 ผู้ยืนยันต้องไม่ใช่คนเดียวกับผู้ส่ง → 403 `SAME_PERSON_CANNOT_VERIFY`
- BR-11 on-site + บันทึกสถิติ ต้องมีกรรมการ ≥2 → 409 `INSUFFICIENT_REFEREES`

**S06 บันทึกสถิติ** — ต้องเช็คว่าทุก `statDefinitionId` ที่ส่งมาเป็นของกีฬานี้จริง
(ไล่ผ่าน `matches → tournaments → sport_type_id`) → 400 `UNKNOWN_STAT_DEFINITION`

---

## Step 10 — Announcement + Livestream (E08-E12) · ~1 วัน

ง่ายมาก เป็น CRUD ตรงๆ ปิดท้ายให้ MVP ครบ

> ⚠️ **E12 `PUT /matches/:id/livestream` ไม่มีคอลัมน์ใน `matches`** — และนี่ไม่ใช่ความผิดพลาด
> ต้นฉบับออกแบบให้ลิงก์ถ่ายทอดสดเป็น **ประกาศประเภทหนึ่ง** (`announcement_type='livestream'`)
> ต้องเลือกทางก่อนเขียน — ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ A3

---

## นิสัย 5 อย่างที่ควรสร้างตั้งแต่ตอนนี้

1. **ทำ endpoint ให้จบทีละตัว** — route → schema → repo → service → controller → ทดสอบ → ค่อยขึ้นตัวใหม่
   อย่าเขียน route ทั้ง 20 ตัวแล้วค่อยไล่เติมข้างใน จะหลงและ debug ไม่ออก

2. **`npm run typecheck` ทุกครั้งก่อนพัก** — `tsx` ไม่เช็ค type ให้

3. **จดสิ่งที่ตัดสินใจเอง** — ทุกครั้งที่เอกสารไม่ชัดแล้วคุณเดา ให้เขียนลง
   [[07 - จุดที่ต้องยืนยันกับทีม]] จะได้ไปถามทีมทีเดียว และตอบได้ตอน present

4. **เก็บ curl ที่ใช้ทดสอบไว้** — สร้างไฟล์ `backend/requests.http` (VS Code REST Client)
   หรือ collection ใน Postman จะได้ไม่ต้องพิมพ์ใหม่ทุกครั้ง

5. **commit บ่อยๆ ทีละ endpoint** — `feat: T01 create team` แล้วค่อยขึ้นตัวใหม่
   พังเมื่อไหร่ย้อนกลับได้

ต่อไป → [[06 - Endpoint Reference MVP 93]]
