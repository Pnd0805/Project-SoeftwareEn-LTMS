# 06 — Endpoint Reference (MVP 109 endpoint)

> **เปิดไฟล์นี้ค้างไว้ตอนเขียนโค้ด** — รวมทุกอย่างที่ต้องรู้ต่อ 1 endpoint ไว้ในบรรทัดเดียว
> ทุก path ละ prefix `/api/v1` ไว้ → `POST /teams` = `POST /api/v1/teams`
> ต้องการ schema ละเอียดกว่านี้ → เปิด `API_Design/Part1-4/MD/LTMS_API_Design_Part3.md` ค้นด้วยรหัส (เช่น `### T01`)

## ความหมายคอลัมน์ Auth

| สัญลักษณ์ | middleware ที่ต้องใส่ใน route                     |
| --------- | ------------------------------------------------- |
| `—`       | ไม่ต้องใส่อะไร (สาธารณะ)                          |
| `Auth`    | `requireAuth`                                     |
| `TL`      | `requireAuth` + `requireTeamLeader`               |
| `ORG`     | `requireAuth` + `requireOrganizer`                |
| `REF`     | `requireAuth` + `requireReferee`                  |
| `ADM-f`   | `requireAuth` + `requireAdmin('faculty')`         |
| `ADM-u`   | `requireAuth` + `requireAdmin('university_wide')` |
| `ADM`     | `requireAuth` + `requireAdmin` (C2) — รับแอดมินได้ทั้ง 3 ชั้น (`root`/`university_wide`/`faculty`) ที่ **ชั้น route** ต่างจาก `ADM-f`/`ADM-u` ที่ล็อกชั้นเดียวตั้งแต่ middleware · ด่านนี้แค่เช็คว่า "เป็นแอดมินไหม" แล้วปล่อยให้ **service เช็คเองว่า scope ไหนทำอะไรได้แค่ไหน** (ดูรายละเอียดจริงในช่อง "ทำอะไร" ของแต่ละแถว) |

**ทุก endpoint ที่มี request body ต้องใส่ `validate(xxxSchema)` นำหน้าเสมอ**

---

# 1. Auth — 7 endpoint

**ไฟล์:** `routes/auth.routes.ts` · `controllers/auth.controller.ts` · `services/auth.service.ts` · `services/mail.service.ts` · `config/mail.ts` · `repositories/user.repo.ts` · `repositories/passwordReset.repo.ts` · `repositories/emailVerification.repo.ts` · `schemas/auth.schema.ts`

⚠️ **รหัส A04/A05 ด้านล่างชนกับ A04/A05 ของหมวด 11 Admin** (ทั้งคู่ขึ้นต้นด้วย "A" คนละความหมาย: Auth vs Admin) — ชนกันอยู่ก่อนแล้วจากตอนที่ทำ B-item Admin ไม่ได้เกิดจากการเพิ่มนี้ ไม่ได้แก้ให้ในรอบนี้เพราะ A05 ของ Admin ถูกอ้างอิงไขว้จาก A06 แล้ว (เสี่ยงพังจุดอื่น) — ควรเลือกสคีมา ID ใหม่ทั้งไฟล์วันหลัง

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| A01 | `POST /auth/register` | — | สมัครสมาชิก · เช็คอีเมลซ้ำ · hash รหัสผ่าน · **4 ต.ค. · OD-53**: ออก OTP ยืนยันอีเมลแล้วส่งเมลให้ทันที — **สมัครสำเร็จไม่ขึ้นกับผลการส่งเมล** (เมลพังก็ยัง 201 แต่ `emailVerificationSent:false`) · `users.email_verified` เริ่มที่ `0` และ **ยังไม่คุมสิทธิ์อะไรเลย** ไม่ยืนยันก็ใช้งานได้ครบทุกอย่าง | `fullName, email, password, gender, birthDate, facultyId, departmentId, year` | **201** `{ id, fullName, email, emailVerificationSent }` |
| A02 | `POST /auth/login` | — | ล็อกอิน · เช็คสถานะระงับ **ที่คิดเวลาแล้ว** (`is_suspended` + `suspended_until`) · ออก JWT | `email, password` | **200** `{ accessToken, expiresIn, tokenType, user{id,fullName,userType} }` |
| A03 | `POST /auth/logout` | Auth | ไม่ทำอะไร (ไม่มี session ฝั่ง server) | — | **204** |
| A04 | `POST /auth/forgot-password` | — | ขอลิงก์ตั้งรหัสผ่านใหม่ · **ตอบ 200 เหมือนกันเป๊ะทุกกรณี** (มีอีเมล/ไม่มี/ถูกระงับ) กัน enumeration · อีเมลมีจริงและไม่ถูกระงับเท่านั้นถึงจะสร้าง token จริงและส่งเมล (SMTP ล่ม → log แล้วยังตอบ 200 เหมือนเดิม ไม่ throw ต่อ) · rate limit 3 ครั้ง/ชม./อีเมล (นับจาก `password_reset_tokens.expires_at` ย้อนกลับ ไม่มีคอลัมน์ `created_at`) · **4 ต.ค. · OD-54: เกินโควตาแล้วยังตอบ 200 เหมือนเดิม ไม่ใช่ 429 อีกแล้ว** — 429 เดิมโผล่เฉพาะกับอีเมลที่มีจริง ⇒ ยิง 4 ครั้งก็รู้ว่าอีเมลไหนมีในระบบ ซึ่งคือสิ่งที่ข้อ "ตอบ 200 เหมือนกันเป๊ะ" ตั้งใจปิด · **การกันยังอยู่ครบ** (ไม่ออก token ไม่ส่งเมล) แค่ไม่ประกาศ · ออก token ใหม่ = ล้าง token เก่าของคนนั้นทั้งหมดทันที (`used_at=NOW()`) · token ดิบ = `randomBytes(32).toString('hex')` เก็บลงฐานเป็น bcrypt hash เท่านั้น (ห้ามเก็บ/log ดิบ) อายุ 1 ชม. | `{ email }` | **200** `{ message }` **เท่านี้** (ไม่มี 429 แล้ว — OD-54) |
| A05 | `POST /auth/reset-password` | — | ใช้ token จากอีเมลตั้งรหัสผ่านใหม่ · รับแค่ token ดิบ (ไม่มี email/userId มาด้วย) → ต้องกวาดทุกแถวที่ `used_at IS NULL AND expires_at > NOW()` มา `verifyPassword` ทีละแถว (bcrypt hash ไม่เหมือนกันทุกครั้งแม้ปลอดภัยเทียบ plain เดียวกัน) · token ไม่มี/ผิด/ถูกใช้แล้ว/หมดอายุ/บัญชีถูกระงับ **รวมเป็นข้อความเดียวกันหมด** — ห้ามแยก ไม่งั้นบอกคนเดา token ว่าเดาใกล้แค่ไหน · สำเร็จ → hash รหัสใหม่ทับ `users.password_hash` + ล้าง token ที่เหลือของคนนั้นทั้งหมด (รวมใบที่เพิ่งใช้) · **ไม่คืน `accessToken`** ต้อง login ใหม่ | `{ token, newPassword }` | **200** `{ message }` / **400** `INVALID_RESET_TOKEN` / **400** `VALIDATION_FAILED` (รหัสใหม่ไม่ผ่านกฎ) |

| AV01 | `POST /auth/verify-email` | — | **4 ต.ค. · OD-53** ยืนยันอีเมลด้วย OTP 6 หลัก · **ไม่ต้องล็อกอิน** เพราะ A01 ไม่คืน `accessToken` — คนที่เพิ่งสมัครยังไม่มี token · รู้ `user_id` จากอีเมลที่ส่งมา ⇒ กวาดแค่ใบของคนนั้น (ต่างจาก A05 ที่ต้องกวาดทุกคน) · กรอกผิด = `attempt_count + 1` ที่ฐาน **ครบ 5 ครั้งใบนั้นตายถาวร** ต้องขอใหม่ (AV02) — ใบที่ตายแล้วถูกกรองออกใน SQL ไม่ใช่ที่ service · ไม่มีอีเมล/เลขผิด/หมดอายุ/ใช้แล้ว/ครบโควตา **รวมเป็นข้อความเดียวกันหมด** เหตุเดียวกับ A05 · สำเร็จ → `users.email_verified=1` + ปิดใบนั้น + ล้างใบที่เหลือ · **ยืนยันซ้ำ → 200 เหมือนเดิม** (idempotent) กดสองครั้ง/รีเฟรชหน้าไม่เห็น error | `{ email, code }` (`code` = **string** ไม่ใช่ number — `007431` ต้องใช้ได้) | **200** `{ message, emailVerified:true }` / **400** `INVALID_OTP` / **400** `VALIDATION_FAILED` (`code` ไม่ใช่ตัวเลข 6 หลัก) |
| AV02 | `POST /auth/resend-verification` | — | **4 ต.ค. · OD-53** ขอ OTP ใบใหม่ · **ตอบ 200 เหมือนกันทั้งเคสไม่มีอีเมล / ยืนยันไปแล้ว / ส่งสำเร็จ** · ออกใบใหม่ = ล้างใบเก่าทั้งหมดก่อนทันที ⇒ **ใบเก่าใช้ไม่ได้อีกเลย** · rate limit 3 ครั้ง/ชม./อีเมล นับจาก **`email_verification_otps.created_at`** ไม่ใช่ `expires_at` (ต่างจาก A04 เพราะ TTL 10 นาที ≠ หน้าต่าง 1 ชม.) **เกินโควตา → ก็ยังตอบ 200 ก้อนเดิม** ไม่ออกใบใหม่ ไม่ส่งเมล **ไม่บอกว่าถูกกัน** (🔴 แก้ 4 ต.ค. · OD-57 — เดิมตอบ 429) · ⚠️ **ใบที่ A01 ออกให้ตอนสมัครนับเป็นใบที่ 1** ⇒ เหลือขอใหม่ได้อีก 2 ครั้งในชั่วโมงแรก | `{ email }` | **200** `{ message }` เท่านั้น — ไม่มีทางอื่นเลย |

> ⚠️ **AV01/AV02 ใช้รหัส `AV` ไม่ใช่ `A06`/`A07` โดยเจตนา** — หมวด 11 Admin มี `A06`/`A07` อยู่แล้ว ถ้าใช้เลขต่อจาก A05 จะกลายเป็นเลขชนกัน 4 คู่แทน 2 คู่ตามคำเตือนข้างบน

> **OTP เป็นเลข 6 หลัก ไม่ใช่ลิงก์ในเมล โดยเจตนา** — ลิงก์ต้องมี route ฝั่ง FE รองรับ แต่ `feat/1` ยังไม่มีแม้หน้า `/reset-password`
> และมี `<Route path="*" element={<Navigate to="/" replace />} />` ที่จะเด้งลิงก์ในเมลไปหน้าแรกแบบเงียบ ๆ
> ⇒ **เลขกรอกบนหน้าเดิม ไม่พึ่ง `FRONTEND_URL` เลย** ไม่ต้องรอ FE ตอบว่า path อะไร (ต่างจาก A04/A05 ที่ยังรออยู่)

> **ตัวเลขที่เลือกไว้** — TTL **10 นาที** (สั้นกว่า reset token 1 ชม. เพราะของมีแค่ 6 หลัก = 1,000,000 แบบ เดาได้จริง)
> · กรอกผิดได้ **5 ครั้ง/ใบ** · ขอใหม่ **3 ครั้ง/ชม.** · เลขสุ่มด้วย `randomInt(0 , 1_000_000)` **ไม่ใช่ `randomBytes % 1000000`** (modulo bias) แล้ว `padStart(6,'0')`
> · เก็บลงฐานเป็น **bcrypt hash** เท่านั้น ห้ามเก็บ/log/คืนเลขดิบ — เลขอยู่ในเมลเท่านั้น เพราะนั่นคือสิ่งที่มันพิสูจน์

> 🔴 **ทั้ง A04 และ AV02 ไม่คืน 429 แล้ว** (A04 = OD-54 · AV02 = **OD-57** · ทั้งคู่ 4 ต.ค.)
> เอกสารฉบับก่อนเขียนว่า *"AV02 ยังคืน 429 และไม่ใช่ความไม่สอดคล้อง"* — **กลับมตินั้นแล้ว**
>
> เหตุผลเดิมคือ `A01 register` บอกอยู่แล้วว่าอีเมลไหนถูกใช้สมัคร (`EMAIL_ALREADY_REGISTERED`)
> ซึ่งจริง **แต่ไม่ครบ**: register ไม่ได้บอกว่าบัญชีนั้น**ยืนยันอีเมลแล้วหรือยัง**
> ⇒ 429 ของ AV02 ทำให้คัดกรอง "บัญชีที่มีจริงและยังไม่ยืนยัน" ได้ด้วย 3 request
> ซึ่งเป็นกลุ่มที่เจ้าตัวยังไม่ได้พิสูจน์ว่าคุมอีเมลอยู่จริง = กลุ่มเป้าหมายของการยึดบัญชี
>
> **ตรวจจริงบนเซิร์ฟเวอร์ที่รันอยู่** — บัญชีจริงได้ `200·200·429` อีเมลที่ไม่มีได้ `200` ทุกครั้ง
>
> 🔴 **ของที่ FE ต้องทำชดเชย** (ไม่มีทางทำที่ฝั่ง BE) — ตอนนี้ผู้ใช้ที่เกินโควตาได้ 200 แล้วรอเมลที่ไม่มา
> ① หน่วงปุ่ม "ขอรหัสใหม่" 60 วินาทีทุกครั้งที่กด
> ② เขียนกติกาข้างปุ่ม "ขอรหัสใหม่ได้ 3 ครั้งต่อชั่วโมง"
>
> ⚠️ **ข้อจำกัดที่ยังเหลือและไม่ได้แก้** — A04 ยังมีความต่างด้าน **เวลาตอบ** อยู่โดยธรรมชาติ
> อีเมลที่มีจริงต้องทำ `bcrypt` + ส่ง SMTP (หลายสิบ–ร้อย ms) อีเมลที่ไม่มีคืนทันที
> ⇒ คนที่วัดเวลาละเอียดยังแยกออกได้ · ปิดจริงต้องทำงานหลอก (dummy hash + หน่วงเวลา) ซึ่งเกินความจำเป็นของโปรเจกต์นี้
> **บันทึกไว้เพื่อไม่ให้เอกสารอ้างเกินจริงว่า "แยกไม่ออกทุกทาง"**

> **mailpit (dev)** — `docker compose up mailpit` แล้วเปิด `localhost:8025` ดูเมลที่ระบบส่งออกจริง (ไม่ต้องมี SMTP credential ใดๆ) · ค่า `SMTP_*`/`MAIL_FROM`/`FRONTEND_URL` ใน `config/env.ts` เป็น **optional ทั้งหมด** โดยเจตนา — ไม่ตั้งอะไรเลยก็ชี้ไป mailpit อัตโนมัติ เพื่อนที่ไม่ได้ทำเรื่องนี้ต้องรันโปรเจกต์ได้ปกติ

---

# 2. Users & Profile — 11 endpoint

**ไฟล์:** `routes/users.routes.ts` · `routes/me.routes.ts` · `user.controller.ts` · `user.service.ts` · `user.repo.ts` · `follow.repo.ts` · `career.repo.ts` · `playerStat.repo.ts` · mappers

| รหัส | Method + Path          | Auth | ทำอะไร                                            | รับ                                  | คืน                                                                                                                                                     |
| ---- | ---------------------- | ---- | ------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01  | `GET /me`              | Auth | โปรไฟล์ตัวเอง (มีข้อมูลส่วนตัว)                   | —                                    | `{ id, fullName, email, gender, birthDate, facultyId, departmentId, year, avatarUrl, contactInfo, address, totalPoints, notificationPrefs, **showProfileStats**, **emailVerified**, createdAt, adminScope }` · `showProfileStats` = ค่าสวิตช์ของตัวเอง (OD-46 · 1 ต.ค.) หน้าตั้งค่าอ่านจากช่องนี้ · `emailVerified` = ยืนยันอีเมลแล้วหรือยัง (OD-53 · 4 ต.ค.) **อยู่ใน /me เท่านั้น ไม่อยู่ในโปรไฟล์สาธารณะ** และ**ไม่ให้สิทธิ์อะไรเพิ่ม** ใช้ขึ้นแบนเนอร์ชวนยืนยันได้ |
| U02  | `PATCH /me`            | Auth | แก้โปรไฟล์ · **allowlist 4 field เท่านั้น** · **1 ต.ค.: `showProfileStats` (boolean)** = เปิด/ปิดการแสดงสถิติในหน้าโปรไฟล์ของตัวเอง (OD-46) คุม U04 · U14 · RW05 พร้อมกันทั้งสามเส้น ไม่แตะตารางคะแนน/ผลแมตช์/โหวต MVP · `avatarUrl` ต้องเป็น S3 key ที่ตัวเองอัปโหลดจริงผ่าน M16 (`purpose=avatar`) เท่านั้น ตรวจ 2 ชั้น (regex ownership + HeadObject มีไฟล์จริง) ไม่ผ่าน → **422** `AVATAR_KEY_INVALID`/`AVATAR_KEY_NOT_FOUND` · ส่ง `null` = ล้างรูป · response คืน `avatarUrl` เป็น **URL เปิดดูได้จริง** (public-read bucket ไม่ใช่ presign) ไม่ใช่ S3 key ดิบ (29 ก.ย.)      | `avatarUrl?, contactInfo?, address?` | เหมือน U01                                                                                                                                              |
| U03  | `GET /users/:id`       | Optional | โปรไฟล์สาธารณะ · **ไม่มี email/contact/address** · ถ้ามี token จะคืนสถานะ follow ของ viewer | — | `{ id, fullName, avatarUrl, facultyId, departmentId, teams[], followerCount, isFollowing, **statsHidden** }` · `statsHidden` (1 ต.ค. · OD-46) = เจ้าของปิดสถิติไว้และคนที่ดูอยู่ไม่ใช่เจ้าตัว/แอดมิน ⇒ FE ซ่อนแท็บสถิติ/ประวัติแมตช์ได้ตั้งแต่ request แรก ไม่ต้องยิงอีกสามเส้นแล้วค่อยพบว่าว่าง · ⚠️ ธงนี้หมายถึง**สถิติโปรไฟล์**เท่านั้น **ไม่ได้ห้ามแสดง RW06 (สถิติในทัวร์)** |
| U04  | `GET /users/:id/stats` | Optional | สถิตินักกีฬา + totals ของหน้า profile · **1 ต.ค.: เป็น Optional auth แล้ว** (เดิมไม่รับ token เลย) เพราะเจ้าของโปรไฟล์ที่ปิดสถิติไว้ต้องยังดูของตัวเองได้ · **ปิดไว้ → ทุกช่องเป็น `null` ไม่ใช่ 0** (0 อ่านได้ว่า "ลงแข่งแล้วไม่เคยชนะ" ซึ่งผิด) · เจ้าตัว + แอดมินทะลุได้ · ผู้จัด/กรรมการไม่ทะลุ (ดูของทัวร์ตัวเองได้อยู่แล้ว)  · **4 ต.ค.: เอา `pickemPoints` ออก** (OD-51) — แต้ม Pick'em มาจากการทายผล ไม่ใช่ผลงานกีฬา และที่นี่เป็นแต้ม**รวมทุกทัวร์** · ดูได้ที่ตารางอันดับในทัวร์ (E28) และ `GET /me/pickem` (E27) ของเจ้าตัว| — | `{ userId, statsHidden, overall{...}\|null, bySport[]\|null, mvpVotes\|null, followerCount\|null }` |
| U06  | `GET /users/search?q=` | Auth | ค้นคนเพื่อเชิญเข้าทีม · ชื่อ (บางส่วน) หรืออีเมล (ขึ้นต้น) · `q` ≥3 ตัว · **LIMIT 20** | `?q=` | `{ items: [{id, fullName, avatarUrl}] }` |
| U07  | `POST /users/:id/follow` | Auth | ติดตามผู้ใช้แบบ idempotent · ห้าม follow ตัวเอง | — | `{ userId, isFollowing:true, followerCount }` / **409** `CANNOT_FOLLOW_SELF` |
| U08  | `DELETE /users/:id/follow` | Auth | เลิกติดตามแบบ idempotent · ห้าม target ตัวเอง | — | `{ userId, isFollowing:false, followerCount }` / **409** `CANNOT_FOLLOW_SELF` |
| U09  | `GET /users/:id/followers` | — | รายชื่อผู้ติดตามโปรไฟล์นี้ | — | `{ items:[{id,fullName,avatarUrl}], count }` |
| U10  | `GET /users/:id/following` | — | รายชื่อผู้ใช้ที่โปรไฟล์นี้ติดตาม | — | `{ items:[{id,fullName,avatarUrl}], count }` |
| U13  | `GET /me/following` | Auth | รายชื่อผู้ใช้ที่ฉันติดตาม · C8 ยังไม่ทำ feed/notification | — | เหมือน U10 |
| RW01 | `GET /rewards` | — | รายการรางวัลทั้งระบบที่ยัง `is_active` · merge จาก `feat/rewards-match-history` 1 ต.ค. | — | `{ items:[...] }` |
| RW02 | `GET /users/:id/rewards` | — | รางวัลของผู้ใช้คนนั้น · **คืนเฉพาะที่เจ้าตัวเปิดให้เห็น** (`is_displayed = TRUE`) | — | `{ items:[...] }` |
| RW03 | `GET /me/rewards` | Auth | รางวัลของตัวเอง **ทั้งที่เปิดและปิด** | — | `{ items:[...] }` |
| RW04 | `PATCH /me/rewards/:id/display` | Auth | เปิด/ปิดการแสดงรางวัลเป็นรายชิ้น · **404** `USER_REWARD_NOT_FOUND` ถ้าไม่ใช่รางวัลในบัญชีตัวเอง | `{ isDisplayed }` | รางวัลที่อัปเดตแล้ว |
| RW05 | `GET /users/:id/match-history` | Optional | ประวัติแมตช์ที่ผล `verified` + สถิติรายแมตช์ของคนนี้ · **1 ต.ค.: ผูกสวิตช์ OD-46 เดียวกับ U04/U14** ปิดไว้ → `items: null` + `statsHidden: true` | — | `{ items:[{matchId, tournament, team, opponent, roundNumber, scheduledTime, startedAt, playedAt, venue, mode, scoreData, result, playerStats[]}]\|null, statsHidden }` |
| RW06 | `GET /tournaments/:id/players/:userId/stats` | — | **ใหม่ 2 ต.ค. (OD-47) · "โปรไฟล์ในทัวร์"** สถิติของผู้ใช้คนหนึ่ง **ในทัวร์นี้ทัวร์เดียว** · **ไม่ผูกกับสวิตช์ OD-46 โดยเจตนา** — เป็นข้อมูลการแข่งขัน ไม่ใช่ข้อมูลโปรไฟล์ (สายการแข่ง ผลแมตช์ รายชื่อลงสนาม และ M-stats ก็สาธารณะอยู่แล้ว ⇒ ไล่บวกเองได้ เส้นนี้แค่บวกให้) · ใช้ repo ชุดเดียวกับ U14/RW05 โดยกรอง `tournament_id` ⇒ ตัวเลขไม่ขัดกับหน้าโปรไฟล์ · `playerStats` เป็นยอดรวมในทัวร์นี้ · ช่องที่กรรมการไม่กรอกเป็น `null` ไม่ใช่ 0 · **นับใบที่ `withdrawn` ด้วย** (แก้ 2 ต.ค.) ⇒ คนของทีมที่ถอนตัวหลังแข่งไปแล้วยังดูได้ + ธง `withdrawn: true` ให้ FE ติดป้าย — กฎเดียวกับ M19 ที่แสดงรายชื่อผู้เล่นของทีมที่ถอน (มติ 26 ก.ย.) ไม่งั้นชื่อกดได้แต่กดไปเจอ 404 · ⚠️ U14/RW05 ยังนับแค่ใบที่ `approved` ⇒ **ตัวเลขสองหน้าไม่เท่ากันในเคสนี้** (ทางเลือก ข ของ OD-47 ยังไม่ตัดสิน) | — | `{ tournament{id,name,sportTypeId,status}, team{id,name}, played, wins, losses, champion, playerStats[], matches[] }` / **404** `PLAYER_NOT_IN_TOURNAMENT` (ไม่เคยอยู่ในรายชื่อของทัวร์นี้เลย · เส้นนี้สาธารณะและเดา URL ได้ ถ้าตอบ 200 + `played: 0` จะเท่ากับยืนยันว่าอยู่ในทัวร์ ซึ่งไม่จริง — สองกรณีที่**ไม่ใช่** 404: อยู่ในรายชื่อแต่ยังไม่ลงสนาม → 200 + `played: 0` · ทีมถอนตัวหลังแข่งแล้ว → 200 + `withdrawn: true`) \| `TOURNAMENT_NOT_FOUND` \| `USER_NOT_FOUND` |
| U14  | `GET /users/:id/career` | Optional | ประวัติแยก Tournament จาก **approved application** · **1 ต.ค.: ผูกสวิตช์ OD-46 เดียวกับ U04** ปิดไว้ → `items: null` + `statsHidden: true` (`null` ไม่ใช่ `[]` เพราะ `[]` อ่านได้ว่า "ไม่เคยลงแข่ง") · played/win/loss นับเฉพาะผล `verified` (walkover ไม่ถือว่าลงสนาม) | — | `{ items:[{tournament:{id,name,sportTypeId,status}, team:{id,name}, played,wins,losses,champion}]\|null, statsHidden }` |

> **U01 กับ U03 ห้ามใช้ mapper ตัวเดียวกัน** — พลาดครั้งเดียวอีเมลรั่วทั้งระบบ
> **U06** ถ้า `q` สั้นกว่า 3 → **400** `QUERY_TOO_SHORT`

> **U01 `adminScope`** (FE-viewer-admin-scope-unknown) — สิทธิ์แอดมินของ *ตัวผู้เรียกเอง*
> `{ id, scopeType: 'faculty'|'university_wide'|'root', facultyId }` · **คนทั่วไปได้ `null` ไม่ใช่คีย์หาย**
>
> ⚠️ **`adminScope.facultyId` ≠ `facultyId`** — ตัวบนคือคณะที่ **ดูแล** ตัวล่างคือคณะที่ **สังกัด**
> เป็นคนละค่ากันได้ (แอดมินคณะวิศวะที่สังกัดคณะวิทย์) · ฟอร์มสร้างทัวร์ต้องใช้ตัวบน
> เพราะ `autoApproveIfOwnScope` ทำให้ผลของการกด Send ต่างกันตามคนกด — จอต้องบอกล่วงหน้าได้ว่า
> จะได้ `private` ทันทีหรือเข้าคิวรออนุมัติ · `root` ได้ `facultyId: null` และ **ไม่ได้อนุมัติอะไรเอง** (OD-34)

---

# 3. Reference Data — 4 endpoint

**ไฟล์:** `routes/reference.routes.ts` · `reference.controller.ts` · `reference.service.ts` · `faculty.repo.ts`, `sportType.repo.ts`

| รหัส | Method + Path                           | Auth | ทำอะไร                                      | รับ | คืน                                                                             |
| ---- | --------------------------------------- | ---- | ------------------------------------------- | --- | ------------------------------------------------------------------------------- |
| R01  | `GET /faculties`                        | —    | รายชื่อคณะ                                  | —   | `{ items: [{id, name}] }`                                                       |
| R02  | `GET /faculties/:id/departments`        | —    | ภาควิชาในคณะ                                | —   | `{ items: [{id, name, facultyId}] }`                                            |
| R03  | `GET /sport-types`                      | —    | ประเภทกีฬา + จำนวนสมาชิกขั้นต่ำ/สูงสุด      | —   | `{ items: [{id, name, minMembers, maxMembers, defaultMode}] }`                  |
| R05  | `GET /sport-types/:id/stat-definitions` | —    | รายการสถิติที่กีฬานี้ต้องกรอก (ใช้ก่อน S06) | —   | `{ items: [{statDefinitionId, statKey, statLabelTh, dataType, displayOrder}] }` |
| R06  | `GET /suspension-categories`            | —    | ประเภทการระงับ + ถ้อยคำที่ผู้ใช้จะอ่านใน 403 (dropdown ของแอดมิน) | —   | `{ items: [{code, label}] }` |

> ข้อมูลกลุ่มนี้ **seed ผ่าน SQL ไม่ใช่ API** — ไม่มี POST/PATCH

---

# 4. Teams — 18 endpoint

**ไฟล์:** `routes/team.routes.ts` + `routes/invitation.routes.ts` + `routes/admin.routes.ts`
`team.controller.ts` · `team.service.ts` · `team.repo.ts`, `teamMember.repo.ts`, `teamInvitation.repo.ts`, `teamAdminRequest.repo.ts` · `team.mapper.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| T01 | `POST /teams` | Auth | สร้างทีม → `Forming` · **transaction** (teams + team_members) · BR-05 | `name, sportTypeId` | **201** `{ id, name, sportTypeId, readinessStatus:'Forming', leaderId }` |
| T02 | `GET /me/teams` | Auth | ทีมของฉัน (ไม่ paginate) | — | `{ items: [{id, name, sportTypeId, readinessStatus, officialStatus, memberCount, role}] }` |
| T03 | `GET /teams/:id` | — | **20 ก.ย.**: มี `visibility` (private/public) + `maxMembers` (เพดานตามกีฬา — แสดง `memberCount/maxMembers`) · ข้อมูลทีมสาธารณะ | — | `{ id, name, sportTypeId, readinessStatus, officialStatus, leader, memberCount, createdAt }` |
| T04 | `PATCH /teams/:id` | TL | เปลี่ยนชื่อทีม · **20 ก.ย.**: `visibility:'private'\|'public'` (default private = เข้าได้ทางคำเชิญเท่านั้น · public = ใครก็ขอเข้าได้ T20) · ถ้า official แล้วต้องบันทึกประวัติ + แจ้ง ORG · **29 ก.ย.**: `logoKey` ต้องเป็น key ที่หัวหน้าทีมอัปโหลดสำหรับทีมนี้จริงผ่าน M16 (`purpose=team_logo`) ตรวจ 2 ชั้นเหมือน avatar ไม่ผ่าน → **422** `TEAM_LOGO_KEY_INVALID`/`TEAM_LOGO_KEY_NOT_FOUND` · `null` = ล้างโลโก้ · response มี `logoUrl` เป็น URL เปิดดูได้จริง | `name?, logoKey?` | เหมือน T03 |
| T05 | `DELETE /teams/:id` | TL | **soft delete** · ล็อกถ้าทีมมีใบสมัคร **`approved`** หรือสร้างสายแล้ว (เงื่อนไขเดียวกับ T08 — Q2-ค, แก้ 21 ก.ย.) ต้องถอนทีม (P08) ก่อน · ใบสมัคร pending ที่เหลือถูกปลดผู้เล่นให้ | — | **204** / **409** `TEAM_LOCKED_IN_TOURNAMENT` `{tournaments:[{tournamentId,name}]}` |
| T06 | `GET /teams/:id/members` | Auth | รายชื่อสมาชิก (ไม่มี contactInfo) · **ORG/กรรมการของทัวร์ที่ทีมสมัคร**ดูได้ด้วย (เช็คอินด้วยมือ) | — | `{ items: [{userId, fullName, avatarUrl, position, joinedAt}] }` |
| ~~T07~~ | ~~`PATCH /teams/:id/members/:uid`~~ | — | **ถอดออก 19 ก.ย. (มติ ทีม = คลังผู้เล่น)** — ไม่มีตัวจริง/สำรองในทีม · ใครลงแข่งดูที่รายชื่อใน P01 (`playerIds`) / M21 | — | 404 |
| T08 | `DELETE /teams/:id/members/:uid` | TL | ถอดสมาชิก · **คำนวณ Ready→Forming ใหม่** · **Q2-ค (20 ก.ย.)**: คนที่มีชื่อในรายชื่อลงแข่งของใบสมัคร `approved` (หรือทัวร์สร้างสายแล้ว) → **409** `MEMBER_LOCKED_IN_TOURNAMENT` + `tournaments[]` ต้องถอนทีม (P08) ก่อน · ใบสมัคร `pending` → ลบได้ ชื่อหลุดจากรายชื่อ + แจ้งเตือนหัวหน้าถ้าเหลือไม่ถึง min · คนในคลังที่ไม่ได้ลงแข่ง → ลบได้เสมอ | — | **204** |
| T09 | `POST /teams/:id/invitations` | TL | เชิญเข้าทีม · **ทีม = คลังผู้เล่น**: เข้าคลังได้เสมอ ไม่ล็อก ไม่มีเพดาน (Q2-ค/Q3-ก) | `invitedUserId` | **201** `{ id, invitedUserId, status:'pending', expiresAt }` |
| T10 | `GET /teams/:id/invitations` | TL | ดูคำเชิญทั้งหมดของทีม | — | `{ items: [{id, invitedUser, status, createdAt}] }` |
| T11 | `DELETE /teams/:id/invitations/:iid` | TL | ยกเลิกคำเชิญที่ยังไม่ตอบ | — | **204** / **409** `INVITATION_ALREADY_ANSWERED` |
| T12 | `GET /me/invitations` | Auth | คำเชิญที่รอฉันตอบ | — | `{ items: [{id, team, invitedBy, expiresAt}] }` |
| T13 | `POST /invitations/:id/accept` | Auth | รับคำเชิญ · **ทีม = คลังผู้เล่น**: เข้าคลังได้เสมอ ไม่ล็อก ไม่มีเพดาน (Q2-ค/Q3-ก) | — | `{ teamId, teamReadinessStatus }` |
| T14 | `POST /invitations/:id/decline` | Auth | ปฏิเสธคำเชิญ | — | **204** |
| T15 | `POST /teams/:id/official-request` | TL | ขอเป็นทีม Official → `pending` | `supportingDocs: string[]` (S3 key) | **201** `{ id, status:'pending' }` |
| T16 | `GET /admin/team-requests` | ADM-u | คิวคำร้องรออนุมัติ · **แก้ 27 ก.ย.** เพิ่ม `supportingDocs` — เอกสารที่หัวหน้าทีมยื่น (บังคับกรอก) ไม่เคยถูก SELECT มา แอดมินจึงตัดสินโดยไม่เห็นเอกสารที่เป็นเหตุผลทั้งหมดของคำขอ · คืนเป็น **presigned URL** เสมอ ไม่ส่ง S3 key ดิบ · ต้องรัน **migration 029** ก่อน (คอลัมน์อยู่ใน schema.sql แต่ไม่เคยมี migration — ฐานที่เดินด้วย migrate ไม่มีคอลัมน์นี้ และการยื่นคำขอล้มทั้งฟีเจอร์) | `?page&pageSize` | `{ items: [{id, team, requestedBy, status, supportingDocs, createdAt}], pagination }` |
| T17 | `POST /admin/team-requests/:id/approve` | ADM-u | อนุมัติ Official · **เช็ค BR-05 ทุกสมาชิก** · transaction + audit | — | `{ teamId, officialStatus:'official' }` / **422** `MEMBER_CONFLICT` |
| T18 | `POST /admin/team-requests/:id/reject` | ADM-u | ปฏิเสธ · **`reason` บังคับ** | `reason` | `{ status:'rejected', reason }` |
| T19 | `GET /teams` | — | **ค้นหาทีม (20 ก.ย.)** · ทีมที่ลบ/Inactive ไม่โชว์ (ดูผ่านทัวร์เก่าเท่านั้น) · ไม่คืน roster · ทุกแถวมี `memberCount` + `maxMembers` (= ขนาดรายชื่อลงแข่งสูงสุดของกีฬา — คลังใหญ่กว่านี้ได้) | `?q=&sportTypeId=&visibility=private\|public&page&pageSize` | `{ items: [TeamDto เหมือน T03], pagination }` |
| T20 | `POST /teams/:id/join-requests` | Auth | **ขอเข้าร่วมทีม public** → `pending` รอหัวหน้าทีม · กฎเดียวกับ T13: CoI, โควตา 5 ทีม, ยังไม่เป็นสมาชิก · คลังไม่มีเพดาน (Q3-ก) | `{ message? }` | **201** `{ id, teamId, status:'pending' }` / **409** `TEAM_PRIVATE`, `ALREADY_MEMBER`, `JOIN_REQUEST_PENDING`, `TEAM_CONFLICT_OF_INTEREST` · **422** `TEAM_QUOTA_EXCEEDED` |
| T21 | `GET /teams/:id/join-requests` | TL | คำขอที่รอตอบ | — | `{ items: [{id, user, message, status, createdAt}] }` |
| T22 | `POST /teams/:id/join-requests/:rid/approve` | TL | อนุมัติ → เป็นสมาชิก (+อาจ Forming→Ready) · **เช็คกฎ T20 ซ้ำ ณ ตอนอนุมัติ** | — | `{ id, userId, status:'approved', teamReadinessStatus }` / **404** `JOIN_REQUEST_NOT_FOUND` · **409** `JOIN_REQUEST_ALREADY_ANSWERED` |
| T23 | `POST /teams/:id/join-requests/:rid/reject` | TL | ปฏิเสธ | `{ reason? }` | `{ id, status:'rejected' }` |
| T24 | `GET /me/join-requests` | Auth | คำขอที่ฉันส่ง ทุกสถานะ ล่าสุดก่อน | — | `{ items: [{id, team:{id,name,sportTypeId}, message, status, rejectReason, createdAt, respondedAt}] }` |
| T25 | `DELETE /me/join-requests/:rid` | Auth | ยกเลิกคำขอของตัวเอง (เฉพาะ pending) | — | **204** / **409** `JOIN_REQUEST_ALREADY_ANSWERED` |

**ไม่มี endpoint (ระบบทำเอง):** `Forming → Ready` (เกิดใน T13) · soft delete จากไม่ใช้งาน (TM-07 — lazy sweep ตอนอ่าน T02/T03 ไม่ใช่ scheduled job)

### โอนหัวหน้าทีม (C3 — FR-TM-08)

**ปัญหาที่แก้**: หัวหน้าทีมลาออก/จบการศึกษา → ทีมค้าง ไม่มีใครเชิญคน/สมัครทัวร์/ส่งผลได้ นอกจากลบทีม
แก้ด้วย 2 เส้นทาง — หัวหน้ากดโอนเองก่อนออก (T26→T28) หรือแอดมินโอนแทนตอนหัวหน้าหายไปเฉยๆ (T30)

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| T26 | `POST /teams/:id/transfer-leader` | TL | หัวหน้าทีมเริ่มคำขอโอนหัวหน้า · **ทีม Unofficial ใช้ไม่ได้เลย** → **403** `NOT_OFFICIAL_TEAM` (BR-07 บังคับผ่าน admin อนุมัติ ไม่ใช่ open ให้ทุกทีม) · ผู้รับต้องเป็นสมาชิกทีมอยู่แล้ว → **422** `NOT_A_TEAM_MEMBER` · **ไม่เปลี่ยน `leader_id` ทันที** สร้างคำขอรอแอดมินอนุมัติเท่านั้น (กันหัวหน้ายกให้ใครก็ได้โดยไม่มีใครตรวจสอบ) | `{ newLeaderId }` | **201** `{ id, status:'pending', currentLeaderId, proposedLeaderId }` |
| T27 | `GET /admin/team-requests/transfers` | ADM-u | ดูคิวคำขอโอนหัวหน้าทีมที่รออนุมัติ | `?page&pageSize` | `{ items: [{id, team, currentLeader, proposedLeader, status, createdAt}], pagination }` |
| T28 | `POST /admin/team-requests/:id/approve-transfer` | ADM-u | อนุมัติ → **endpoint นี้เท่านั้นที่ `UPDATE teams SET leader_id` จริง** · คำขอต้องยัง `pending` → **409** `ALREADY_DECIDED` ถ้าพิจารณาไปแล้ว | `—` | **200** `{ teamId, newLeaderId }` |
| T29 | `POST /admin/team-requests/:id/reject-transfer` | ADM-u | ปฏิเสธคำขอ · ไม่แตะ `leader_id` เลย | `{ reason }` | **200** `{ status:'rejected', reason }` |
| T30 | `POST /admin/teams/:id/transfer-leader` | ADM-u | **แอดมินโอนหัวหน้าทีมแทนทันที** ไม่ผ่านคิว — ใช้ตอนหัวหน้าเดิมหายไปเฉยๆ ไม่มากดโอนเอง (T26) · **ใช้ได้ทั้งทีม Official และ Unofficial** (ต่าง T26 ที่เฉพาะ Official) เพราะทีม Unofficial ไม่มีทางโอนหัวหน้าได้ทางอื่นเลยถ้าไม่มีช่องนี้ · ผู้รับต้องเป็นสมาชิกทีมอยู่แล้ว → **422** `NOT_A_TEAM_MEMBER` · ยังบันทึกลง `team_admin_requests` ด้วย (สถานะ `approved` ทันที) เพื่อมี audit trail ร่วมกับ T26→T28 | `{ newLeaderId }` | **200** `{ teamId, newLeaderId }` |

> **ทำไม T26 ต้องผ่านคิวแต่ T30 ไม่ต้อง** — T26 เป็นหัวหน้าทีม**กดเอง** ต้องมีคนนอกตรวจสอบก่อนมีผลจริง (BR-07)
> ส่วน T30 **แอดมินเป็นคนกดเอง** อยู่แล้ว ไม่ต้องมีคิวให้ตัวเองอนุมัติตัวเองซ้ำ — เหมือนหลักการเดียวกับ A10 ที่อนุมัติ=ลงมือจริงทันที

---

# 5. Tournaments — 17 endpoint

**ไฟล์:** `routes/tournament.routes.ts` + `routes/admin.routes.ts`
`tournament.controller.ts` · `tournament.service.ts` · `tournament.repo.ts`, `amendmentRequest.repo.ts`, `auditLog.repo.ts` · `tournament.mapper.ts`

| รหัส | Method + Path                              | Auth  | ทำอะไร                                                                                                            | รับ                                                                                                                                                                                                     | คืน                                                                                                                            |
| ---- | ------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| C01  | `POST /tournaments`                        | Auth  | สร้าง**คำขอ**จัดทัวร์ → `pending_approval` (BR-01) · **admin ในขอบเขตตัวเอง → `private` ทันที** (university_wide ทุกทัวร์ · admin คณะ = คณะตัวเองจัด **และ** กฎคณะจำกัดเฉพาะคณะตัวเอง — มติ 20 ก.ย. Q2-ข) · body รับ `eligibilityRules: [{type:'faculty'\|'year', value}]` (ไม่ส่ง = ไม่จำกัด · คณะต้องมีจริง · ปี 1–8 · ตัดซ้ำ) เก็บลง `tournament_eligibility_rules` ในทรานแซกชันเดียว · `entryNotes?` เป็นข้อความแนะนำผู้สมัคร ≤2000 ตัวอักษร (informational only) · รับ datetime ทั้ง `Z`/offset (แก้ 20 ก.ย. — `Z` เคย 500) · วันต้องไม่เป็นอดีต (**400** `TOURNAMENT_DATES_IN_PAST`) · ⚠️ `bracketFormat` ใช้ชื่อเต็ม `single_elimination` | `name, sportTypeId, bracketFormat, scopeType, organizingFacultyId, organizingDepartmentId, registrationStart/End, eventStartDate/EndDate, maxTeams, minTeams, venue, entryNotes?, genderRequirement, minAge, maxAge, disputeWindowHours?` (**ข้อ 9 · 25 ก.ย.** ระยะเวลาโต้แย้งผลหลัง verify · จำนวนเต็ม 6–72 ชม. · ไม่ส่ง = 24 ชม.) | **201** `{ id, status:'pending_approval'\|'private', name, autoApproved }`                                                                              |
| C02  | `GET /me/tournament-requests`              | Auth  | คำขอของฉัน + สถานะ                                                                                                | `?page&pageSize`                                                                                                                                                                                        | `{ items: [{id, name, status, rejectionReason, createdAt}], pagination }`                                                      |
| C02b | `GET /me/tournaments`                      | Auth  | **20 ก.ย.** ทัวร์ที่ฉันจัด **ทุกสถานะ** การ์ดเต็ม (แก้ N+1 ที่ FE ต้องยิง C07 ทีละอัน) | `?status=pending_approval\|rejected\|private\|public\|completed&page&pageSize` | `{ items: [{...การ์ดเดียวกับ C06, status, rejectionReason, createdAt}], pagination }` |
| C03  | `GET /admin/tournament-requests`           | ADM-f | คิวรอพิจารณา (`pending_approval`) · **แก้ 27 ก.ย.** ทุกแถวมี `canDecide` + `cannotDecideReason` — คิวกรองด้วย `organizing_faculty_id` เงื่อนไขเดียว แต่ด่านอนุมัติเช็ค `adminCoversEligibility` เพิ่ม สองกฎไม่ตรงกันโดยโครงสร้าง และค่า default ของฟอร์มคือ "ทุกคณะ" (= ไม่มีกฎคณะ) ⇒ คำขอที่กรอกตามปกติที่สุดโผล่ในคิวแอดมินคณะแล้วกดไม่ได้ทุกแถว (FE-admin-queue-shows-undecidable-rows) · **เลือกคืนแถวพร้อมเหตุผล ไม่กรองออก** เพื่อให้แอดมินคณะยังเห็นว่าคณะตัวเองมีคำขอค้าง · `ADM-u` ได้ `canDecide: true` ทุกแถว  | `?page&pageSize`                                                                                                                                                                                        | `{ items: [{id, name, requestedBy, sportTypeId, eventStartDate, createdAt, canDecide, cannotDecideReason}], pagination }` · `cannotDecideReason` = `'ELIGIBILITY_OUT_OF_SCOPE'` หรือ `null` (code เดียวกับที่ด่านโยน FE ใช้ข้อความเดิมได้) |
| C04  | `POST /tournaments/:id/approve`            | ADM-f | อนุมัติ → `private` + audit · **Q2-ข**: admin คณะอนุมัติได้เฉพาะทัวร์ที่กฎคณะจำกัดเฉพาะคณะตัวเอง ไม่งั้น **403** `ELIGIBILITY_OUT_OF_SCOPE` (ให้ university_wide)                                                                                       | —                                                                                                                                                                                                       | `{ id, status:'private', organizerId }`                                                                                        |
| C05  | `POST /tournaments/:id/reject`             | ADM-f | ปฏิเสธ → `rejected` · **`reason` บังคับ** · **แก้ 27 ก.ย.** เช็ค `adminCoversEligibility` เหมือน C04 แล้ว — เดิมแอดมินคณะ "ปฏิเสธ" คำขอที่ตัวเอง "อนุมัติ" ไม่ได้ (FE-reject-skips-eligibility-scope) และ `rejected` เป็น**ปลายทางถาวร** ไม่มี route ไหนตั้งกลับเป็น `pending_approval` ผู้จัดต้องลบทิ้งแล้วกรอกใหม่ทั้งใบ ⇒ **403** `ELIGIBILITY_OUT_OF_SCOPE` เหมือน C04  | `reason`                                                                                                                                                                                                | `{ id, status:'rejected', reason }`                                                                                            |
| C06  | `GET /tournaments`                         | —     | ค้นหาทัวร์ · **บังคับ `status='public'` ที่ service**                                                             | `?sportTypeId&facultyId&q&page&pageSize&status` (`status`: `public` default · `completed` = ทัวร์ที่จบแล้ว — B1 21 ก.ย.) | `{ items: [{id, name, sportTypeId, eventStartDate, eventEndDate, registrationOpen, venue, organizingFacultyId}], pagination }` |
| C07  | `GET /tournaments/:id`                     | —     | รายละเอียด · `completed` เห็นได้ทุกคนเหมือน `public` (B1 3-ก) + คืน `championTeamId`, `completedAt`, `entryNotes` · `entryNotes` เป็นข้อความแนะนำ ไม่ใช่ Hard Filter · สถานะอื่น → เห็นได้เฉพาะ**ผู้ยื่นคำขอ** (ทุกสถานะรวม `pending_approval`/`rejected`/`completed` — แก้ 20 ก.ย. FE-c17b) และ ADM ในขอบเขต ไม่งั้น **404** · **แก้ 27 ก.ย.** เพิ่ม **กรรมการที่ถูกเชิญ** เข้ารายชื่อผู้อ่าน — มีแถวใน `tournament_referees` ที่ `removed_at IS NULL` อ่านได้ทุกสถานะทัวร์ (ยกเว้น `auto_deleted`) และ**ทุกสถานะคำเชิญ** รวม `pending` ที่ยังไม่ตอบ · ลำดับของสินค้าคือ approve → แต่งตั้งกรรมการ → publish คำเชิญจึงมาถึงตอนทัวร์ยัง `private` เกือบทุกครั้ง เดิมแจ้งเตือนลิงก์ไปให้แล้วได้ 404 (FE-referee-cannot-read-invited-tournament)  | —                                                                                                                                                                                                       | `{ ...ข้อมูลเต็ม, entryNotes:string|null, organizer, approvedTeamCount, hasOpenComplaints }` · **ใหม่ (OD-26 ข้อ 8)** `hasOpenComplaints` = ยังมีเรื่องร้องเรียนผลแมตช์ที่ไม่ได้ข้อยุติ — ไม่บล็อกการปิดทัวร์ แต่ต้องมองเห็นได้                                                                              |
| C08  | `PATCH /tournaments/:id`                   | ORG   | แก้ข้อมูลทั่วไป · **allowlist** · `entryNotes` แก้ตรงได้ ไม่ต้องผ่าน amendment; ส่ง `null` เพื่อล้าง                                                                                   | `venue?, description?, entryNotes?: string|null` (`entryNotes` ≤2000)                                                                                                                                                                                  | เหมือน C07                                                                                                                     |
| C09  | `POST /tournaments/:id/amendment-requests` | ORG   | ขอแก้ข้อมูลสำคัญ → `pending` · รับ `eligibilityRules` ด้วย (ทางเดียวที่แก้กฎหลังผ่านอนุมัติ) — ได้เฉพาะยังไม่เปิดรับสมัครและยังไม่มีใบสมัคร ไม่งั้น **409** `ELIGIBILITY_LOCKED` · **`reason` บังคับ** (20 ก.ย. FE-change-request-has-nowhere — เหตุผลของผู้ขอ ≤1000 ตัวอักษร) | `requestedChanges` (JSON), `reason`                                                                                                                                                                               | **201** `{ id, status:'pending' }`                                                                                             |
| C09b | `GET /tournaments/:id/amendment-requests`  | ผู้ยื่นคำขอ | คำขอแก้ไขทั้งหมดของทัวร์ (ทุกสถานะ ล่าสุดก่อน) — ORG ดูว่า pending/approved/rejected และเหตุผลที่แอดมินปฏิเสธ (FE-organizer-see-their-own 21 ก.ย.) · guard `requireRequester` (เห็นได้แม้ทัวร์ยัง `pending_approval`) | — | `{ items: [{id, requestedChanges, reason, status, requestedAt, reviewedAt, reviewedBy:{id,name}\|null, rejectionReason}] }` |
| C10  | `GET /admin/amendment-requests`            | ADM-f | คิวคำขอแก้ไข                                                                                                      | `?page&pageSize`                                                                                                                                                                                        | `{ items: [{id, tournamentId, tournamentName, requestedBy, requestedChanges, reason, status, requestedAt}], pagination }` (`reason` null = คำขอก่อน migration 020)                                                                                                        |
| C11  | `POST /amendment-requests/:id/approve`     | ADM-f | อนุมัติ · ถ้ามี `eligibilityRules` → REPLACE ตารางกฎ + เช็ค Q2-ข/`ELIGIBILITY_LOCKED` ซ้ำตอนอนุมัติ · **ต้อง UPDATE tournaments จริงในทรานแซกชันเดียว**                                                       | —                                                                                                                                                                                                       | `{ id, status:'approved' }`                                                                                                    |
| C12  | `POST /amendment-requests/:id/reject`      | ADM-f | ปฏิเสธ · `reason` บังคับ                                                                                          | `reason`                                                                                                                                                                                                | `{ id, status:'rejected', reason }`                                                                                            |
| C13  | `POST /tournaments/:id/publish`            | ORG   | `private → public` · **BR-10 ด่าน 1: pool active ≥ กรรมการที่ 1 แมตช์ต้องใช้** (1 / 2 ถ้า on-site+stat ตาม `default_mode` ของกีฬา) · ด่าน 2 เช็คตอน M10                                                               | —                                                                                                                                                                                                       | `{ id, status:'public' }` / **409** `REFEREES_INCOMPLETE`                                                                      |
| C14  | `POST /tournaments/:id/unpublish`          | ORG   | `public → private`                                                                                                | —                                                                                                                                                                                                       | `{ id, status:'private' }`                                                                                                     |
| C14b | `POST /tournaments/:id/complete`           | ORG   | **ปิดทัวร์** (B1 มติ 21 ก.ย. 1-ข) `public\|private → completed` · ต้องมีแมตช์และ**ทุกแมตช์ `completed`** ไม่งั้น **409** `MATCHES_UNFINISHED` `{matches:[{id,status}]}` / `NO_MATCHES` · ทำในทรานแซกชัน (2-ง): เก็บแชมป์ (elimination = ผู้ชนะรอบชิง · round robin = อันดับ 1 ตาราง; เสมออันดับ 1 หรือรอบชิงแพ้ทั้งคู่ → `null` ไม่บวกแชมป์) · `championships +1` ให้รายชื่อลงแข่งของทีมแชมป์ · `teams.last_competed_at` ทุกทีม approved · **หลังปิด ทุก write ใต้ `/tournaments/:id/*` และ `/matches/:id/*` (ยกเว้น announcements) และ P08 ถอนตัว → 409 `TOURNAMENT_COMPLETED`** | — | `{ id, status:'completed', championTeamId \| null }` |
| C15  | `POST /tournaments/:id/open-registration`  | ORG   | เปิดรับสมัคร                                                                                                      | —                                                                                                                                                                                                       | `{ id, registrationOpen: true }`                                                                                               |
| C16  | `POST /tournaments/:id/close-registration` | ORG   | ปิดรับสมัคร (คำขอค้างยังพิจารณาได้)                                                                               | —                                                                                                                                                                                                       | `{ id, registrationOpen: false }`                                                                                              |
| C17  | `GET /tournaments/:id/eligibility-rules`   | —     | เงื่อนไขคุณสมบัติ · การมองเห็นตาม C07 (ผู้ยื่นคำขออ่านได้ตั้งแต่ `pending_approval`) · **แก้ 27 ก.ย.** เพิ่ม **กรรมการที่ถูกเชิญ** เข้ารายชื่อผู้อ่าน — มีแถวใน `tournament_referees` ที่ `removed_at IS NULL` อ่านได้ทุกสถานะทัวร์ (ยกเว้น `auto_deleted`) และ**ทุกสถานะคำเชิญ** รวม `pending` ที่ยังไม่ตอบ · ลำดับของสินค้าคือ approve → แต่งตั้งกรรมการ → publish คำเชิญจึงมาถึงตอนทัวร์ยัง `private` เกือบทุกครั้ง เดิมแจ้งเตือนลิงก์ไปให้แล้วได้ 404 (FE-referee-cannot-read-invited-tournament)  | —                                                                                                                                                                                                       | `{ items: [{ruleType, ruleValue}] }`                                                                                           |
| C17b | `PUT /tournaments/:id/eligibility-rules`   | ผู้ยื่นคำขอ | **แทนที่กฎคุณสมบัติทั้งชุด** (20 ก.ย. Q1-ค) · guard `requireRequester` ไม่ใช่ `requireOrganizer` (ORG ยังไม่มีตอน pending — แก้ 20 ก.ย. FE-c17b) · เฉพาะ `pending_approval` — ผ่านอนุมัติแล้ว **409** `USE_AMENDMENT_REQUEST` (ไป C09) · เปิดรับ/มีใบสมัครแล้ว **409** `ELIGIBILITY_LOCKED` | `{ rules: [{type:'faculty'\|'year', value}] }` (ว่าง = ไม่จำกัด) | `{ items: [{ruleType, ruleValue}] }` |
| C18  | `DELETE /tournaments/:id`                   | ผู้ยื่นคำขอ | **soft delete** · ใช้ได้กับ `pending_approval`, `rejected`, หรือ `private` ที่ยังไม่มี application/match · `public` ต้อง C14 unpublish ก่อน · `completed` ลบไม่ได้ · หลังลบ parent และ `/tournaments/:id/*` / `/matches/:id/*` ของทัวร์นั้นตอบ 404 | — | **204** / **409** `TOURNAMENT_MUST_BE_UNPUBLISHED` \| `TOURNAMENT_HAS_ACTIVITY` \| `TOURNAMENT_COMPLETED` |

---

# 6. Referees — 23 endpoint

> ปรับตามมติทีม 2026-09-13 (`GUIDE/11`): เชิญพร้อมแมตช์ · ref เลือกรับบางแมตช์ · เปลี่ยนภายหลังผ่าน "คำขอ" (FR01–FR08)
> BR-10 = **ทุกแมตช์มีกรรมการครบ** (ดู F14) ไม่ใช่นับหัวรวม · F11 ถูกตัดออก ใช้ FR02 แทน

**ไฟล์:** `routes/referee.routes.ts`, `routes/refereeRequest.routes.ts`
`referee.controller.ts` · `referee.service.ts` · `tournamentReferee.repo.ts`, `matchReferee.repo.ts`
`refereeRequest.controller.ts` · `refereeRequest.service.ts` · `refereeChangeRequest.repo.ts`

## 6.1 คำเชิญ + แมตช์

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| F01 | `POST /tournaments/:id/referees` | ORG | เชิญเป็นกรรมการ · แนบแมตช์ที่เสนอให้คุมได้ (ไม่แนบ = เข้า pool) · แมตช์ต้องอยู่ทัวร์นี้ มีเวลาเริ่ม/จบ ไม่ซ้อนกันเอง · **CoI**: ORG เอง / คนที่มีชื่อในทีมที่สมัครทัวร์นี้ เป็นกรรมการไม่ได้ | `userId, isExternal, matchIds?` | **201** `{ id, userId, invitationStatus:'pending', isExternal, matchIds }` / **404** `MATCH_NOT_FOUND` / **409** `ORGANIZER_CANNOT_BE_REFEREE`, `REFEREE_CONFLICT_OF_INTEREST` + `teamId`, `MATCH_NOT_SCHEDULED`, `REFEREE_TIME_CONFLICT`, `REFEREE_INVITATION_PENDING`, `REFEREE_ALREADY_ACCEPTED` |
| F02b | `GET /tournaments/:id/referees/assignable` | Auth · **ผู้จัด หรือ กรรมการที่ใช้งานได้จริงของทัวร์นี้** | 🆕 **4 ต.ค. · OD-59** รายชื่อปลายทางสำหรับคำขอโอน/แลกแมตช์ (FR01/FR03) — F02 ติด `requireOrganizer` หน้าของกรรมการจึงเรียกไม่ได้ และการไปรวบรวมปลายทางจาก F12 ทำให้ **กรรมการที่ยังไม่ได้รับแมตช์เลยไม่โผล่** ซึ่งเป็นคนที่ว่างที่สุด · กรองสถานะ **ในSQL** ให้เหลือเฉพาะแถวที่ใช้งานได้ (นิยามเดียวกับ UNIQUE ของ migration 036) ⇒ คนที่รอตอบ/ถูกปฏิเสธ/ถูกถอดไม่หลุดออกไปเลย · **ตัดตัวผู้เรียกเองออก** · `id` คือ `tournamentRefereeId` ที่ POST ต้องใช้ ไม่ใช่ `userId` · `upcomingMatchCount` = แมตช์ของทัวร์นี้ที่ยัง `scheduled` และเขาถืออยู่ (เรียงจากว่างสุด) · **ไม่คืน** `isExternal`/`externalApprovalStatus`/`invitationStatus` — เรื่องเอกสารตัวตนไม่ใช่ของที่กรรมการอีกคนต้องรู้ | — | `{ items:[{ id, user:UserRef, upcomingMatchCount }] }` / **403** `NOT_TOURNAMENT_REFEREE` |
| F02 | `GET /tournaments/:id/referees` | ORG | กรรมการทั้งหมด (แถวล่าสุดต่อคน ยังไม่ถูกถอด) + `status` รวม | — | `{ items: [{id, user, invitationStatus, isExternal, externalApprovalStatus, status}], acceptedCount }` |
| F03 | `DELETE /tournaments/:id/referees/:rid` | ORG | ถอดกรรมการ · soft delete ทุกแถวของ user นั้น · **ถอดได้เสมอ** แต่บอกว่าแมตช์ไหนจะขาดคน (Q4) | — | **200** `{ removed:true, uncoveredMatches:[matchId] }` / **404** `REFEREE_NOT_FOUND` |
| F04 | `GET /me/referee-invitations` | Auth | คำเชิญที่รอฉันตอบ พร้อมแมตช์ที่เสนอมา | — | `{ items: [{id, tournament, isExternal, matches:[{id, roundNumber, scheduledTime, scheduledEndTime, venue, mode, matchStatus, assignmentStatus}], createdAt}] }` |
| F04b | `GET /me/referee-matches` | Auth | **B7 (19 ก.ย.)** แมตช์ที่ฉันเป็นกรรมการ — รับแมตช์แล้ว (`accepted`) และยัง active ในทัวร์นั้น (ถูกถอด/external ยังไม่อนุมัติ = ไม่แสดง) ทุกทัวร์ เรียงตามเวลาแข่ง | `?status=scheduled\|checkin_open\|in_progress\|completed` · `?upcoming=true` (ตัด completed) | `{ items: [{id, tournament:{id,name,sportTypeId}, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, mode, status}] }` |
| F05 | `POST /referee-invitations/:id/accept` | Auth | ตอบรับ + **เลือกรับบางแมตช์ได้** (Q1) · เลือกได้เฉพาะที่เสนอมา · `[]`/ไม่ส่ง body = เข้าทัวร์แบบ pool · เช็คซ้อนเวลาอีกรอบ · คนนอก → ตามสถานะยืนยันตัวตนของคน (§6.3): approved ≤ 1 ปี → active ทันที · มีการตรวจค้าง → ร่วมการตรวจเดิม · ไม่มี → pending ต้องส่ง docs | `matchIds?, docs?` | `{ id, invitationStatus:'accepted', requiresAdminApproval, acceptedMatchIds, declinedMatchIds }` / **400** `MATCH_NOT_IN_INVITATION` / **409** `INVITATION_ALREADY_ANSWERED`, `REFEREE_TIME_CONFLICT`  · **409** `REFEREE_ALREADY_ACTIVE` (2 ต.ค. · OD-48) — เป็นกรรมการของทัวร์นี้อยู่แล้ว เกิดได้เมื่อคำเชิญสองใบถูกส่งพร้อมกันจนผ่านด่านทั้งคู่ แล้วมาชน UNIQUE ตอนกดรับ (เดิมจะเป็น 500 จาก ER_DUP_ENTRY ดิบ) |
| F06 | `POST /referee-invitations/:id/decline` | Auth | ปฏิเสธทั้งคำเชิญ (แมตช์ที่เสนอมา → `declined`) | — | **204** |
| F12 | `GET /matches/:id/referees` | — | กรรมการที่คุมแมตช์นี้ = รับแมตช์แล้ว **และ** `status === 'active'` (คนนอกที่ admin ยังไม่อนุมัติไม่โชว์) · `acceptedCount` = active เท่านั้น (คนนอกรอ admin ไม่นับ) · `awaitingAdminCount` | — | `{ items: [{tournamentRefereeId, referee}] }` |
| F13 | `DELETE /matches/:id/referees/:rid` | ORG | ถอดออกจากแมตช์นี้ทันที (ไม่ต้องขอ) · hard delete | — | **204** / **404** `REFEREE_NOT_ASSIGNED` |
| F14 | `GET /tournaments/:id/referees/coverage` | ORG | **BR-10 ใหม่** — แมตช์ที่ยังขาดกรรมการ (`needed` = 2 ถ้า on-site + กีฬามี stat, อื่น 1) + กรรมการที่รับแมตช์ซ้อนเวลา (Q6 เตือน ไม่ block) · C13 publish ควรเรียกตัวนี้ | — | `{ matchesTotal, matchesCovered, uncovered:[{matchId, roundNumber, scheduledTime, needed, assigned}], conflicts:[{tournamentRefereeId, userId, matchIds:[a,b]}] }` |

`status` ของกรรมการ (คำนวณจาก 4 คอลัมน์ ไม่มีใน DB): `pending` · `pending_admin` · `active` · `declined` · `rejected_by_admin` · `removed`

## 6.2 คำขอเปลี่ยนแปลงหลังเชิญ (`referee_change_requests`)

ทุกคำขอ: ผู้เกี่ยวข้องต้อง `active` · แมตช์ต้อง `scheduled` และยังไม่ถึงเวลา · ตารางของแต่ละคน**หลังเปลี่ยน**ต้องไม่ซ้อน · คู่ (match, referee) มีคำขอ open ได้ทีละใบ · ตอน apply เช็คทุกอย่างใหม่ ไม่ผ่าน → `cancelled` + **409** `REQUEST_NO_LONGER_VALID` · ORG แค่รับแจ้ง ไม่ต้องอนุมัติ (Q3)

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| FR01 | `POST /referee-requests` | REF | ขอ**โอน** (`theirMatchId` ไม่ส่ง) หรือ**แลก** (ส่ง) แมตช์กับกรรมการอีกคนในทัวร์เดียวกัน · ผู้ขอถือว่า accept แล้ว รออีกฝ่าย | `myMatchId, toTournamentRefereeId, theirMatchId?` | **201** RequestDto / **403** `NOT_TOURNAMENT_REFEREE` / **400** `SAME_REFEREE`, `SAME_MATCH` / **409** `REFEREE_NOT_ASSIGNED`, `REFEREE_NOT_ACTIVE`, `MATCH_NOT_CHANGEABLE`, `REFEREE_TIME_CONFLICT`, `REQUEST_ALREADY_OPEN` |
| FR02 | `POST /tournaments/:id/referee-requests/add-match` | ORG | ขอให้กรรมการรับแมตช์เพิ่ม (แทน F11) · รอกรรมการตอบ · **แก้ 27 ก.ย.** เชิญกรรมการหลายคนเข้าแมตช์เดียวกัน**พร้อมกัน**ได้แล้ว — เดิมตอน apply คำขอหนึ่ง ระบบยกเลิกคำขอ open ทุกชนิดที่อ้างแมตช์เดียวกัน ใบของกรรมการคนที่สองจึงกลายเป็น `cancelled` และกดรับไม่ได้ ⇒ แมตช์ onsite ที่ต้องมีกรรมการ 2 คนตาม BR-10 **หาคนที่สองไม่ได้เลยและแข่งไม่ได้** (F11 ที่เคยใส่ตรง ๆ ถูกถอดไปแล้ว) · ตอนนี้ยกเลิกเฉพาะ `ref_transfer`/`ref_swap`/`org_swap` ที่ย้ายคนจริง (FE-second-referee-request-cancelled) | `tournamentRefereeId, matchId` | **201** RequestDto / **409** `REFEREE_ALREADY_ASSIGNED` + ชุดเดียวกับ FR01 |
| FR03 | `POST /tournaments/:id/referee-requests/swap` | ORG | ขอสลับแมตช์ระหว่างกรรมการ 2 คน · **ทั้งคู่ต้อง accept** | `refereeAId, matchAId, refereeBId, matchBId` | **201** RequestDto |
| FR04 | `GET /me/referee-requests` | Auth | `incoming` = รอฉันตอบ (ซ่อนที่แมตช์ผ่านไปแล้ว) · `outgoing` = ที่ฉันส่ง (ทุกสถานะ) | — | `{ incoming:[RequestDto], outgoing:[RequestDto] }` |
| FR05 | `GET /tournaments/:id/referee-requests` | ORG | คำขอทั้งหมดของทัวร์ · `?status=open` ซ่อนที่แมตช์ผ่านไปแล้ว | `?status=open` · `applied` · `declined` · `cancelled` | `{ items:[RequestDto] }` |
| FR06 | `POST /referee-requests/:id/accept` | Auth | ตอบรับฝั่งของตน · ครบทุกฝ่าย → apply ทันที (ทรานแซกชัน + ยกเลิกคำขอ open อื่นบนแมตช์เดียวกัน) | — | RequestDto (`status:'applied'` หรือยัง `open` ถ้ารออีกฝ่าย) / **403** `NOT_YOUR_REQUEST` / **409** `REQUEST_CLOSED`, `REQUEST_NO_LONGER_VALID` |
| FR07 | `POST /referee-requests/:id/decline` | Auth | ปฏิเสธ → คำขอปิดเป็น `declined` | — | RequestDto |
| FR08 | `DELETE /referee-requests/:id` | ผู้สร้าง | ยกเลิกคำขอที่ยัง open | — | **204** / **403** `NOT_YOUR_REQUEST` / **409** `REQUEST_CLOSED` |

## 6.3 ยืนยันตัวตนกรรมการภายนอก — คิดเป็น "ต่อคน" (GUIDE/10 §8 F-16/F-17)

สถานะของคน: `none` → (accept + docs) → `pending` → admin: `approved` (1 ปี ทุกทัวร์) / `needs_docs` (ขอใหม่ ทัวร์ยังรอ) / `rejected` (final ทุกทัวร์) · ส่ง docs = ทุกทัวร์ที่รอกลับเข้าคิวพร้อมกัน

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| U11 | `GET /me/referee-identity` | Auth | สถานะยืนยันตัวตนของฉัน + ข้อความ admin + ทัวร์ที่รอ — **FE ทำ banner จากตรงนี้** (ไม่มี notification) | — | `{ status, approvedAt, expiresAt, adminMessage, docsSubmitted, docsRequired, tournaments:[{id,name,tournamentRefereeId,externalApprovalStatus}] }` |
| U12 | `PUT /me/referee-identity/docs` | Auth | ส่ง/ส่งใหม่ เอกสาร (S3 key 1–5) → ทุกทัวร์ที่ `pending/needs_docs` กลับเป็น `pending` | `docs: string[]` | `{ status:'pending', docsCount, tournamentsUpdated }` / **409** `DOCS_NOT_EXPECTED` |
| AR01 | `GET /admin/referee-requests` | ADM-u | คิว **1 รายการ = 1 คน** พร้อม `docs` และ `tournaments[]` ที่รอ | — | `{ items:[{userId, user:{…,email}, docs[], tournaments[], submittedAt}] }` |
| AR02 | `POST /admin/referee-requests/:userId/approve` | ADM-u | ผ่าน → ทุกทัวร์ที่รอ approved · ล้าง docs (PDPA) · ใช้ได้ 1 ปี | — | `{ userId, identityStatus:'approved', tournamentsUpdated }` / **409** `NOT_PENDING_REVIEW`  · **409** `REFEREE_DUPLICATE_ROWS` (2 ต.ค. · OD-48) — ผู้ใช้มีคำเชิญค้างซ้อนกันในทัวร์เดียวกัน อนุมัติทีเดียวทุกแถวจะทำให้ทั้งคู่ใช้งานได้พร้อมกันและชน UNIQUE ⇒ ให้ผู้จัดถอดใบที่เกินก่อน |
| AR04 | `POST /admin/referee-requests/:userId/request-docs` | ADM-u | **ขอเอกสารใหม่** (ไม่ใช่ reject) → `needs_docs` + ข้อความ · ทัวร์ยังรอ · ล้าง docs เดิม | `reason` | `{ userId, identityStatus:'needs_docs', reason, tournamentsUpdated }` |
| AR03 | `POST /admin/referee-requests/:userId/reject` | ADM-u | **ไม่ผ่านจริง** (pending/needs_docs) หรือ **ถอนอนุมัติ** (approved · F-10) → ทุกแถวของคนนั้นทุกทัวร์ (รวมที่ถูกถอดแล้ว) `rejected` · แมตช์ที่รับไว้คงอยู่แต่ไม่นับ → F14 `uncovered` · ORG เชิญซ้ำได้ (F01 ยอมให้เชิญทับ `rejected_by_admin`) | `reason` | `{ userId, identityStatus:'rejected', reason, tournamentsUpdated }` |

**RequestDto** = `{ id, tournamentId, type:'org_add_match'|'ref_transfer'|'ref_swap'|'org_swap', requestedBy, refereeA:{tournamentRefereeId, user, status}, refereeB|null, matchA:{id, roundNumber, scheduledTime, scheduledEndTime}, matchB|null, status:'open'|'applied'|'declined'|'cancelled', createdAt, resolvedAt }`
— `refereeX.status` = `not_required` · `pending` · `accepted` · `declined` (ฝั่งนั้นต้องตอบไหม/ตอบว่าอะไร)

**ยังไม่มี:** notification push (ORG ดูจาก FR05/F14) · buffer ก่อนแข่ง (เปลี่ยนได้จนถึงเวลาเริ่ม) · auto-expire (คำขอค้างจะถูก cancel ตอนมีคนกดตอบ)

---

# 7. Applications — 9 endpoint

**ไฟล์:** `routes/application.routes.ts` · `application.controller.ts` · `application.service.ts` · `application.repo.ts` · `application.mapper.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| P01 | `POST /tournaments/:id/applications` | TL | สมัครแข่ง · **Hard Filter อัตโนมัติ** · BR-04/08/09 · ต้อง ORG เปิดรับสมัคร (C15) **และ** อยู่ใน `registrationStart–registrationEnd` · ทีมต้องกีฬาเดียวกับทัวร์ · **CoI**: สมาชิกทีมเป็น ORG/กรรมการของทัวร์นี้ไม่ได้ · `softFilterDocuments` เป็น object keys จาก M16 ของ **user คนนี้ + tournament นี้เท่านั้น** และ backend ตรวจว่า object ถูกอัปโหลดจริงก่อนบันทึก · cancel/withdraw แล้วสมัครใหม่ได้ | `teamId, playerIds, softFilterDocuments?` (สูงสุด 10 keys) | **201** `{ id, status:'pending', hardFilterPassed:true, playerIds }` / **409** `REGISTRATION_CLOSED`, `SPORT_TYPE_MISMATCH`, `TEAM_CONFLICT_OF_INTEREST` / **422** `HARD_FILTER_FAILED`, `SOFT_FILTER_DOCUMENT_INVALID`, `SOFT_FILTER_DOCUMENT_NOT_FOUND` |
| P02 | `GET /me/applications` | Auth | ใบสมัครของฉัน + เหตุผลถ้าถูกปฏิเสธ | `?page&pageSize` | `{ items: [{id, tournament, team, status, rejectionReason, appliedAt}], pagination }` |
| P03 | `GET /tournaments/:id/applications` | ORG | ใบสมัครทั้งหมด · `softFilterDocuments` = **S3 key ดิบ** | `?page&pageSize` | `{ items: [{id, team, status, hardFilterPassed, softFilterDocuments, appliedAt}], pagination }` |
| P04 | `GET /applications/:id` | ORG/TL | รายละเอียด · `softFilterDocuments` = **presigned URL** | — | `{ id, tournamentId, team, status, hardFilterDetails[], softFilterDocuments[] }` |
| P05 | `POST /applications/:id/approve` | ORG | อนุมัติ (Soft Filter ดุลพินิจ) | — | `{ id, status:'approved' }` |
| P06 | `POST /applications/:id/reject` | ORG | ปฏิเสธ · `reason` บังคับ | `reason` | `{ id, status:'rejected', reason }` |
| P07 | `POST /applications/:id/cancel` | TL | **ยกเลิกก่อนอนุมัติ** (ต้องเป็น `pending`) | — | `{ id, status:'cancelled' }` / **409** `ALREADY_DECIDED` |
| P08 | `POST /applications/:id/withdraw` | TL | **ถอนตัวหลังอนุมัติ** · คืนช่องว่าง + แจ้ง ORG · **1 ต.ค.: แจ้งสมาชิกทุกคนของทีมที่ถอนด้วย** (`application_withdrawn` · ไม่ส่งหาหัวหน้าทีมที่กดเอง) — เดิมมีแต่ ORG ที่ได้รู้ ทั้งที่คนเสียสิทธิ์ลงแข่งคือสมาชิกทีม · ส่งถึงสมาชิกทุกคนไม่ใช่แค่คนในรายชื่อลงแข่ง · ทัวร์ที่ยังไม่จัดสายนี่เป็นทางเดียวที่ทีมได้รู้ (ไม่มีแมตช์ให้ยิง `match_walkover`) · **มีสายแล้ว → แมตช์ที่ยังไม่เริ่มของทีมนี้ อีกฝั่งชนะบาย** (walkover, ลูกโซ่ถึงสายล่าง; คู่ที่ยังไม่มาจะบายตอนคู่มาถึง) · ถอนกลางแมตช์ไม่ได้ | — | `{ id, status:'withdrawn', bracketExists, walkovers: [{matchId, winnerTeamId, loserTeamId}] }` / **409** `MATCH_IN_PROGRESS` |
| P09 | `GET /tournaments/:id/teams` | — | ทีมที่อนุมัติแล้ว (สาธารณะ) | — | `{ items: TeamRef[] }` |

---

# 8. Brackets & Matches — 13 endpoint

**ไฟล์:** `routes/match.routes.ts` · `match.controller.ts` · `match.service.ts`, `bracket.service.ts` · `match.repo.ts`, `bracketNode.repo.ts`, `matchCheckin.repo.ts` · `match.mapper.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| M01 | `POST /tournaments/:id/bracket` | ORG | **สร้างสายทั้งทัวร์** · INSERT matches หลายสิบแถว + bracket_nodes · transaction · **`replace: true` (21 ก.ย.)** = ลบสายเดิม (matches/nodes/นัดหมาย/กรรมการรายแมตช์/standings — คงใบสมัครและ pool กรรมการ) แล้วจับใหม่จากทีม approved ปัจจุบันในทรานแซกชันเดียว · ได้เฉพาะทุกแมตช์ยัง `scheduled` และไม่มีเช็คอิน/ผล ไม่งั้น **409** `BRACKET_IN_USE` `{matches:[{id,status,checkins,results}]}` · ไม่ส่ง replace แต่มีสาย → **409** `BRACKET_ALREADY_EXISTS` · ตอบ `replaced: true\|false` · **ด่านจำนวนทีม (แก้ 27 ก.ย. · OD-33)** ทีม approved ต้องถึง `max(4, min_teams)` เมื่อ `bracket_format = 'double_elimination'` และ `max(2, min_teams)` รูปแบบอื่น ไม่งั้น **422** `TEAM_COUNT_MISMATCH` + `extra {bracketFormat, required, approved}` · ใช้กับทั้ง `random`/`manual` และ `replace: true` · ★ ด่านนี้อยู่**ก่อน**เปิดทรานแซกชัน ปฏิเสธแล้วสายเดิมยังอยู่ครบ | `seedingMethod:'random'\|'manual', manualSeeds?, replace?` | **201** `{ matchCount, bracketFormat, nodeCount }` / **422** `TEAM_COUNT_MISMATCH` |
| M02 | `GET /tournaments/:id/bracket` | — | ผังสาย (round robin คืน `nodes: []`) · **19 ก.ย.**: `teamA/teamB` ของรอบถัดไปถูกเติมทันทีที่ผลออก (verify / walkover / bye ทุกแบบ sync `bracket_nodes` จาก `matches` — migration 014 backfill ของเก่า) FE ไม่ต้องเอา M01 มาซ้อนแล้ว | — | `{ bracketFormat, nodes: [{nodeId, bracketType, round, matchNumber, teamA, teamB, matchId, matchStatus, advancesToNodeId}] }` |
| M04 | `GET /tournaments/:id/matches` | — | ตารางแข่ง · **19 ก.ย. (B5)**: ทุกแถวมีผลสรุปในตัว FE ไม่ต้องยิง S05/M02 ซ้ำ — `resultStatus` = สถานะใบผลล่าสุด (null ยังไม่ส่ง / submitted / disputed / rejected / verified / walkover) · `score` เฉพาะ verified/walkover (ใบผลที่ยังไม่ยืนยันดูผ่าน S05 ตามสิทธิ์เดิม) · `outcome` เฉพาะแมตช์ `completed`: `played` แข่งจริง · `walkover` คู่ถอน/ไม่มา (แสดง W/O) · `bye` ช่องอีกฝั่งว่างถาวร ทีมเดียวผ่าน (แสดง "BYE" แทนช่องว่าง) · `void` ไม่มีใครผ่าน — แพ้ทั้งคู่/ถอนทั้งคู่/แมตช์ตาย (แสดง "ไม่มีการแข่ง") · ช่องว่างที่ `outcome=null` = ยังรอผลรอบก่อน · **แก้ 27 ก.ย.** เพิ่ม `livestreamUrl` — E12 เขียนคอลัมน์นี้ตั้งแต่ schema แรกแต่ไม่มี route ไหนอ่านกลับ ลิงก์จึงหายทุกครั้งที่โหลดหน้าใหม่ (FE-replay-link-write-only) · **สาธารณะ** ต่างจาก `roomCode` ที่จำกัดผู้ดู | `?teamId&status&round&page&pageSize` | `{ items: [{id, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, status, nextMatchId, loserNextMatchId, resultStatus, score, outcome: {kind, winnerTeamId, loserTeamId}\|null}], pagination }` |
| M05 | `GET /matches/:id` | — | รายละเอียดแมตช์ · ฟิลด์ผลสรุปชุดเดียวกับ M04 · **B8**: `roomCode` (แมตช์ online) เห็นเฉพาะผู้เล่นในรายชื่อลงแข่ง/กรรมการของแมตช์/ORG (ส่ง token) ไม่งั้น null · **แก้ 27 ก.ย.** เพิ่ม `livestreamUrl` — E12 เขียนคอลัมน์นี้ตั้งแต่ schema แรกแต่ไม่มี route ไหนอ่านกลับ ลิงก์จึงหายทุกครั้งที่โหลดหน้าใหม่ (FE-replay-link-write-only) · **สาธารณะ** ต่างจาก `roomCode` ที่จำกัดผู้ดู | — | `{ id, tournamentId, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, checkinOpenAt, status, mode, nextMatchId, loserNextMatchId, resultStatus, score, outcome, roomCode }` |
| M05b | `PUT /matches/:id/room-code` | REF ของแมตช์ / ORG | **B8 (20 ก.ย.)** ตั้ง/ล้างรหัสห้องเกมของแมตช์ online (migration 016) · แมตช์จบแล้วแก้ไม่ได้ | `{ roomCode: string\|null }` (≤50) | `{ matchId, roomCode }` / **409** `MATCH_NOT_ONLINE`, `MATCH_NOT_CHANGEABLE` · **403** `NOT_MATCH_STAFF` |
| M05c | `GET /me/matches` | Auth | **20 ก.ย.** แมตช์ของฉันทั้ง 2 บทบาท — ผู้เล่น (ฉัน**มีชื่อลงแข่ง** ใน application_players — Q5-ก) + กรรมการ (รับแมตช์แล้ว) **เฉพาะที่ยังไม่จบ** (มติ 20 ก.ย. — ประวัติดู M04 `?teamId=`) เรียงตามเวลา | `?role=player\|referee` | `{ items: [{id, role, myTeamId, tournament:{id,name,sportTypeId}, round, teamA, teamB, scheduledTime, scheduledEndTime, venue, mode, status}] }` |
| M06 | `PATCH /matches/:id/schedule` | ORG | ตั้ง/เลื่อนเวลา+สนาม · เฉพาะ `scheduled` · อยู่ในวันทัวร์ (ขยายวันผ่าน C09) · **ตรวจทับซ้อนเป็นช่วงเวลา** ทีม/สนาม (แมตช์ที่จบแล้วไม่นับ) · ไม่พังลำดับสาย (`next_match_id` สองทิศ) · กรรมการซ้อน**ไม่ block** ดู F14 (GUIDE/11 Q6) | **B9 (19 ก.ย.): ทุกฟิลด์ optional ส่งเฉพาะที่จะแก้** (แค่ `venue` หรือแค่เวลา — ที่เหลือคงเดิม) · ครั้งแรกที่ยังไม่เคยตั้งต้องครบ 3 ไม่งั้น **400** `SCHEDULE_INCOMPLETE` + `missing[]` · จบ > เริ่ม (เทียบกับค่าเดิมด้วย) · รับทั้ง `Z` และ `+07:00` | เหมือน M05 / **409** `MATCH_NOT_CHANGEABLE`, `OUTSIDE_TOURNAMENT_DATES`, `SCHEDULE_CONFLICT` + `conflictingMatchId`, `SCHEDULE_BREAKS_BRACKET` + `blockingMatchId` |
| M09 | `POST /matches/:id/open-checkin` | **REF ของแมตช์ / ORG** | **ด่านตาราง (แก้ 27 ก.ย.)** ต้องมี `scheduled_time` + `scheduled_end_time` + `venue` ครบ ไม่งั้น **409** `SCHEDULE_INCOMPLETE` + `extra.missing[]` (code/รูปร่างเดียวกับ M06 แต่เป็น 409 เพราะไม่มี payload — เป็นปัญหาสถานะ) · **แก้ 27 ก.ย.** เดิม ORG เท่านั้น — กรรมการของแมตช์กดได้ด้วย (`checkin_open` เป็นทางออกทางเดียวของ `scheduled` คนที่ยืนหน้าโต๊ะคือกรรมการ และคุมทุกอย่างข้างในหน้าต่างนี้อยู่แล้ว) · คนอื่น **403** `NOT_MATCH_PARTICIPANT` · `scheduled → checkin_open` (สถานะอื่นเปิดไม่ได้) · **ข้อ 1 (26 ก.ย.)** ห้ามเปิดทับแมตช์ต้นทางที่ยังไม่สรุป: ทีมไม่ครบ 2 ฝั่ง → **409** `MATCH_TEAMS_INCOMPLETE` · ทีมครบแต่ต้นทางยัง `disputed` → **409** `PREDECESSOR_DISPUTED` (ถ้าปล่อยผ่าน ORG จะเสียสิทธิ์แก้ผลต้นทางทันที) · ทั้งสองกรณีแนบ `extra.blockedBy:[{matchId,status,reason}]` ให้ FE ลิงก์ไปแมตช์ที่ติดได้ | — | `{ id, status:'checkin_open', checkinOpenAt }` / **409** `INVALID_STATUS_TRANSITION` |
| M10 | `POST /matches/:id/start` | REF ของแมตช์ | **ด่านตาราง (แก้ 27 ก.ย.)** ต้องมี `scheduled_time` + `scheduled_end_time` + `venue` ครบ ไม่งั้น **409** `SCHEDULE_INCOMPLETE` + `extra.missing[]` (code/รูปร่างเดียวกับ M06 แต่เป็น 409 เพราะไม่มี payload — เป็นปัญหาสถานะ) · ★ ตรวจ**ก่อน**การตัดสินไม่มาตามนัด ทีมจึงไม่ถูกปรับแพ้บายในแมตช์ที่ไม่ควรเริ่ม · `checkin_open → in_progress` · **BR-10 ด่าน 2: กรรมการ active ครบ (on-site+stat 2 / อื่น 1) → 409 `INSUFFICIENT_REFEREES`** · **ทีมต้องเช็คอิน ≥ `sport_types.min_members`** — ฝั่งที่ไม่ถึงแพ้บาย (walkover) ทันที · ไม่ถึงทั้งคู่ → 409 ให้ ORG เลื่อน | — | `{ id, status:'in_progress' }` **หรือ** `{ id, status:'completed', walkover:{ matchId, winnerTeamId, loserTeamId, reason:'insufficient_checkins', minMembers, checkedIn } }` / **409** `CHECKIN_NOT_OPEN` \| `MATCH_TEAMS_INCOMPLETE` \| `INSUFFICIENT_REFEREES` \| `INSUFFICIENT_CHECKINS` (+`minMembers, checkedIn`) |
| M10b | `POST /matches/:id/finish` | **REF ของแมตช์ หรือ ORG** | **ใหม่ (OD-26 ข้อ 4)** `in_progress → finished` พร้อมบันทึก **เวลาจบจริง** · ต้องกดก่อนถึงส่งผลได้ (S01) · ตารางแข่งบอกได้แค่เวลาที่วางแผนไว้ กีฬาจบเร็ว/ช้ากว่าได้ ค่านี้คือเวลาที่คนหน้างานกดจริง · ผู้จัดกดแทนได้เผื่อกรรมการหายไป | — | `{ id, status:'finished', actualEndTime }` / **403** `NOT_MATCH_PARTICIPANT` / **409** `MATCH_NOT_IN_PROGRESS` (+`status`) |
| M10c | `POST /matches/:id/abandon` | **REF ของแมตช์ หรือ ORG** | **ใหม่ (27 ก.ย.)** แมตช์เริ่มแล้วแต่แข่งไม่จบ (ฝนตก ไฟดับ คนเจ็บหนัก สนามถูกยึด) · `in_progress → scheduled` เพื่อให้ตั้งเวลาใหม่ด้วย M06 · **ล้างเช็คอิน + เวลาเริ่ม/จบจริง + สถิติผู้เล่นของรอบที่ยกเลิก** (ไม่งั้นถูกนับซ้ำตอนแข่งใหม่) · `reason` **บังคับ** ≤500 ลง audit `match_abandoned` · ⚠️ ถ้าแข่งเกือบจบแล้วผลใช้ได้ **ไม่ต้องใช้เส้นนี้** — กดจบ (M10b) แล้วส่งผลตามปกติ | `reason` | `{ id, status:'scheduled', checkinOpenAt:null }` / **403** `NOT_MATCH_PARTICIPANT` / **409** `MATCH_NOT_IN_PROGRESS` (+`status`) |
| M11 | `GET /matches/:id/checkin-qr` | ORG / REF ของแมตช์ | QR สำหรับ on-site · ขอได้เฉพาะแมตช์ `checkin_open` | — | `{ qrPayload, expiresAt }` / **409** `CHECKIN_NOT_OPEN` |
| M12 | `POST /matches/:id/checkins` | Auth | เช็คอิน · **idempotent (กดซ้ำ = 200 แม้แมตช์เริ่มแล้ว)** · เช็คอินใหม่ได้เฉพาะแมตช์ `checkin_open` (ไม่งั้น **409** `CHECKIN_NOT_OPEN`) · **21 ก.ย.**: ถ้าถูกกรรมการ reject (M15) ไปแล้ว กดอีกครั้ง = เช็คอินใหม่ทับแถวเดิม (id เดิม, **201**) ต้อง `checkin_open` เหมือนครั้งแรก · **วิธีต้องตรง `mode` ของแมตช์** — `onsite` รับเฉพาะ `qr_onsite`, `online` รับเฉพาะ `photo_online` ไม่งั้น **400** `CHECKIN_METHOD_MISMATCH` `{mode, expectedMethod}` | on-site: `method:'qr_onsite', qrPayload` · online: `method:'photo_online', documentType, documentS3Key` ⚠️ | **201/200** `{ id, status, checkedInAt }` / **403** `NOT_IN_APPROVED_ROSTER` |
| M13 | `GET /matches/:id/checkins` | ORG / REF ของแมตช์ | รายชื่อผู้เช็คอิน · **19 ก.ย.**: มี `note` (เหตุผลที่กรรมการอนุโลมเช็คอินให้ใน M19) · `id` ใช้เป็น `:cid` ของ M14/M15 · **`documentUrl` (presigned 20 นาที) ให้เฉพาะกรรมการของแมตช์** ORG ได้ `null` (PDPA NF-SE-03) · **แก้ 27 ก.ย.** เพิ่ม `rejectionReason` — M15 บังคับให้กรอกและ M20 คืนให้เจ้าตัวอยู่แล้ว แต่แถวนี้ไม่เคยคืน กรรมการจึงไม่เห็นเหตุผลของแถวไหนเลย รวมถึงที่ตัวเองเพิ่งพิมพ์ (FE-checkin-reject-reason-not-listed) · คนละคอลัมน์กับ `note` ที่เป็นเหตุผลการอนุโลมให้ผ่าน | — | `{ items: [{id, userId, fullName, method, status, documentType, documentUrl, checkedInAt}] }` |
| M14 | `POST /matches/:id/checkins/:cid/verify` | REF ของแมตช์ | ตรวจเอกสารผ่าน (online) · เฉพาะเช็คอินที่ `pending` · แมตช์ต้อง `checkin_open` หรือ `in_progress` | — | `{ id, status:'verified' }` / **409** `ALREADY_DECIDED` (success/exception) \| `ALREADY_REJECTED` \| `MATCH_NOT_CHANGEABLE` |
| M15 | `POST /matches/:id/checkins/:cid/reject` | REF ของแมตช์ | ตรวจไม่ผ่าน / **เพิกถอน** · `reason` บังคับ · **21 ก.ย. (FE-check-has-gone-through)**: รับทั้ง `pending` และที่ผ่านไปแล้ว (`success` จาก QR/รูป · `exception` จาก M19) — QR/manual ไม่มีใครตรวจก่อน กรรมการจึงถอนทีหลังได้ · แมตช์ต้อง `checkin_open` หรือ `in_progress` · ถอนหลังกด start **ไม่ย้อนผล M10** แค่บันทึกว่าคนนี้ไม่ได้มา · ผู้เล่นที่ถูกถอนเช็คอินใหม่ได้ (M12/M19) ขณะ `checkin_open` | `reason` | `{ id, status:'rejected', reason }` / **409** `ALREADY_REJECTED` \| `MATCH_NOT_CHANGEABLE` |
| M17 | `POST /matches/:id/forfeit` | ORG | **ตัดสินทีมไม่มาตามนัด** · เฉพาะ `checkin_open` · ฝั่งที่เช็คอิน < `min_members` แพ้บาย · ไม่ถึงทั้งคู่ = **แพ้ทั้งคู่** (ไม่มีใครเดินสาย ช่องว่างรอบถัดไปให้ทีมที่รอบายผ่าน) · ครบทั้งคู่ → 409 ให้กรรมการ M10 | — | `{ id, status:'completed', kind:'walkover'\|'double_forfeit', minMembers, checkedIn, walkovers:[{matchId, winnerTeamId, loserTeamId}] }` / **409** `CHECKIN_NOT_OPEN` \| `MATCH_TEAMS_INCOMPLETE` \| `TEAMS_PRESENT` |
| M18 | `POST /matches/:id/close-checkin` | **REF ของแมตช์ (เฉพาะยังไม่มีใครเช็คอิน) / ORG** | **ปิดเช็คอินกลับเป็น `scheduled`** (เหตุสุดวิสัย เช่น ฝนตก) · ล้าง `match_checkins` ของรอบนี้ · แล้วไปเลื่อนด้วย M06 · **นี่คือการถอน M09 กลับ ไม่ใช่ขั้นถัดไป** — ขั้นถัดไปคือ M10 เริ่มแมตช์ · **แก้ 27 ก.ย.** กรรมการของแมตช์ปิดได้ **เฉพาะเมื่อยังไม่มีใครเช็คอิน** (ถอนความพลาดของตัวเองได้ตั้งแต่เปิดเช็คอินเองได้ที่ M09 แต่ไม่ได้อำนาจล้างรายการของผู้เล่นคนอื่น) · มีคนเช็คอินแล้ว → **409** `CHECKIN_NOT_EMPTY` (+`extra.checkins`) ให้ไปหา ORG · เขียน audit `match_checkin_closed` พร้อมจำนวนแถวที่ถูกลบทุกครั้ง | — | `{ id, status:'scheduled', checkinOpenAt:null }` / **409** `INVALID_STATUS_TRANSITION` / **403** `NOT_MATCH_PARTICIPANT` |
| M19 | `POST /matches/:id/checkins/manual` | REF ของแมตช์ | **21 ก.ย.**: ผู้เล่นที่ถูก reject (M15) แล้วกดให้ใหม่ได้ (ทับแถวเดิม) · **เช็คอินแทนผู้เล่น** (คนในรายชื่อลงแข่งเท่านั้น — `NOT_IN_APPROVED_ROSTER`) · `note` เก็บคอลัมน์ `match_checkins.note` (migration 015 — ไม่ใช่ `rejectionReason` แล้ว) (กล้อง/เน็ต/QR ใช้ไม่ได้) → `manual_by_referee` / `exception` = นับว่าเช็คอินแล้ว · แมตช์ต้อง `checkin_open` · ผู้เล่นต้องอยู่ roster | `userId, note?` | **201** `{ id, userId, method, status:'checked_in', checkedInAt }` / **403** `NOT_IN_APPROVED_ROSTER` / **409** `CHECKIN_NOT_OPEN` \| `ALREADY_CHECKED_IN` |
| M20 | `GET /matches/:id/checkins/me` | Auth | สถานะเช็คอินของตัวเองในแมตช์นี้ | — | `{ checkin: null \| { id, method, status, rejectionReason (เฉพาะ rejected), note (เฉพาะ M19), checkedInAt, verifiedAt } }` |
| M21 | `GET /matches/:id/lineups` | — | **รายชื่อผู้เล่นที่ทีมส่งลงแข่ง** ของ 2 ทีม + สถานะเช็คอิน (มติ 19 ก.ย. ทีม = คลังผู้เล่น · จาก `application_players`) สาธารณะเหมือน M04 · (shokun เรียก M19 ในโค้ด — เลขชนกับ manual checkin) | — | `{ matchId, teamA:{teamId, players:[{userId, fullName, avatarUrl, checkinStatus}]}\|null, teamB }` |
| M16 | `POST /uploads/presign` | Auth | ขอ URL อัปโหลดไฟล์ขึ้น S3 โดยตรง · `purpose`: `checkin_document` (+matchId · ต้องอยู่ในทีมของแมตช์ + แมตช์ `checkin_open` กฎเดียวกับ M12) · `soft_filter_document` (+tournamentId · key ผูกทั้ง tournament + uploader เป็น `soft_filter_document/{tournamentId}/{userId}/{uuid}.{jpg|png}`; P01 ตรวจ ownership + object existence อีกครั้ง) · `referee_identity` (ผูก user เอง) · **29 ก.ย.**: `avatar` (ผูก `entityId=userId` จาก token เสมอ ไม่รับจาก body) · **1 ต.ค.**: `report_evidence` (หลักฐานแนบคำร้องขอระงับผู้ใช้ C2 · ผูก `entityId=userId` จาก token · key เป็น `report_evidence/{userId}/{uuid}.{jpg|png}` และตอนยื่นคำร้อง backend ตรวจอีกครั้งว่า key เป็นของผู้แจ้งเอง — อ่านกลับเป็น presigned URL เสมอ) · `team_logo` (+teamId บังคับ · ต้องเป็นหัวหน้าทีมนั้น ไม่งั้น **403** `NOT_TEAM_LEADER`) — ทั้งสอง purpose นี้เก็บใน bucket prefix ที่ตั้ง public-read ไว้ (`avatar/`, `team_logo/`) ต่างจาก purpose อื่นที่ต้อง presign เพื่ออ่านเสมอ | `purpose, contentType, matchId?, tournamentId?, teamId?` | `{ uploadUrl, objectKey, expiresIn }` / **400** `UNSUPPORTED_FILE_TYPE` / **403** `NOT_IN_APPROVED_ROSTER` / **409** `CHECKIN_NOT_OPEN` |

> **"REF ของแมตช์"** (M10, M11, M13, M14, M15) = กรรมการที่ active ในทัวร์ **และ** รับมอบหมายแมตช์นั้นแล้ว (`match_referees.assignment_status='accepted'`)
> ผ่าน `isRefereeOfMatch` — กฎเดียวกับ F12 / S01–S03 · กรรมการของทัวร์ที่ไม่ได้รับแมตช์นั้นได้ 403

> ⚠️ **M12 ค่า enum ใน Part 3 ไม่ตรงกับ DB** — DB ใช้ `method`: `qr_onsite`/`photo_online`/`manual_by_referee`
> และ `match_checkin_status`: `success`/`rejected`/`exception`/`pending` — ยึดค่า DB ตามกฎ Part 0-1 §1.2 แล้วแปลงเป็นคำของ Part 3 ตอนตอบ
> (B2 ตัดสินแล้ว 15 ก.ย. — migration 009):
> `pending` (photo_online รอกรรมการตรวจ) → `pending_verification` · `success` (QR ผ่าน/กรรมการตรวจผ่าน) → `checked_in` ·
> `exception` (กรรมการอนุโลมเช็คอินให้ แบบ `manual_by_referee`) → `checked_in` · `rejected` → `rejected`
>
> **M12 idempotent** — มี `UNIQUE(match_id, user_id)` จริงแล้ว (migration 008) กดซ้ำ/ยิงพร้อมกันได้ 200 พร้อมแถวเดิม
>
> **M01 สายแพ้คัดออก** — จำนวนทีมไม่ต้องเป็นเลขยกกำลัง 2 · ช่องที่ขาดเติมเป็น bye โดย bye จับคู่กับทีมจริงเสมอ
> (random = สุ่มคู่ที่ได้ bye · manual = seed ลำดับต้นได้ bye ก่อน) · double elimination เริ่มได้ตั้งแต่ 2 ทีม ·
> นัดชิง double elimination = แชมป์สายบนเจอแชมป์สายล่าง **นัดเดียวจบ** (ไม่มี bracket reset)
>
> **M01 `TEAM_COUNT_MISMATCH`** — ทีมที่ approved น้อยกว่า `max(ขั้นต่ำของรูปแบบ, min_teams)` ของทัวร์ (**แก้ 27 ก.ย. · OD-33** — เดิมใช้กฎเดียวกันทุก format ตามที่ตกลงกับทีม 15 ก.ย.)
> — ขั้นต่ำของรูปแบบ: `double_elimination` = **4** (น้อยกว่านี้สายแพ้ไม่มีของจริงให้เดิน) · `single_elimination` / `round_robin` / ยังไม่ตั้ง = **2** เหมือนเดิม
> — เช็ค < 2 ไว้ด้วยเพราะ DB ไม่ได้บังคับ `min_teams ≥ 2` ถ้ามีทัวร์ตั้ง 0/1 ไว้ก็ยังสร้างสาย 1 ทีมไม่ได้
> — ตอบ `extra {bracketFormat, required, approved}` ทุกกรณี (ทั้งเคสรูปแบบและเคส `min_teams` เดิม) FE จึงบอกได้ว่าขาดอีกกี่ทีม
>
> **อายุลิงก์/QR** — M11 QR หมดอายุ **20 นาที** (response มี `expiresAt` ให้หน้าจอกรรมการขอใหม่ก่อนหมด) ·
> M16 ลิงก์อัปโหลด และลิงก์ดูเอกสาร soft filter ใน P04 หมดอายุ **20 นาที** (`expiresIn` = 1200)
>
> **M11 QR เซ็นด้วย `CHECKIN_QR_SECRET`** — ไม่ใส่ใน `.env` = ใช้ `JWT_SECRET` แทน (มี `type:'checkin_qr'` ในตัว QR กันเอาไปใช้แทน token login อยู่แล้ว) · production ควรตั้งแยก

> **M16 คือทางเดียวที่ระบบรับไฟล์** — ห้ามส่งไฟล์ผ่าน API server (CO-02 งบจำกัด)
> Flow: client ขอ presign → PUT ไฟล์ขึ้น S3 เอง → ส่งแค่ `objectKey` กลับมาที่ endpoint จริง

---

# 9. Match Results — 11 endpoint

**ไฟล์:** `routes/result.routes.ts` · `result.controller.ts` · `result.service.ts` (★ ไฟล์ที่ซับซ้อนที่สุด) · `matchResult.repo.ts`, `playerMatchStat.repo.ts`, `standings.repo.ts`, `playerProfileStat.repo.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| S01 | `POST /matches/:id/result` | TL/REF ตาม **BR-13** | ส่งผล → `submitted` · **OD-26 ข้อ 6**: โหมด online พ้น 24 ชม.หลังแมตช์จบแล้วยังไม่มีใครส่ง **กรรมการของแมตช์ส่งแทนได้** · **ต้องกดจบการแข่งขัน (M10b) ก่อน** ไม่งั้น **409** `MATCH_NOT_FINISHED` (+`status`) — `result_rejected` ส่งใหม่ได้โดยไม่ต้องกดจบซ้ำ · idempotent (ส่งซ้ำ = UPDATE) · **scoreData (19 ก.ย.)**: key ต้องเป็นรหัส 2 ทีมของแมตช์ครบทั้งคู่ · คะแนน ≥ 0 · `winnerTeamId` ต้องคะแนนมากกว่า (เสมอยังไม่รองรับ) ไม่งั้น **400** `VALIDATION_FAILED` + `expectedKeys` — กฎเดียวกับ S04 amend · **B4**: ส่งซ้ำได้เฉพาะตอน `submitted`/`rejected` (ส่งใหม่หลัง reject = สถานะกลับเป็น submitted) · ผลที่ verified/disputed → **409** `MATCH_RESULT_ALREADY_VERIFIED` | `winnerTeamId, scoreData` | **201** `{ id, matchId, status:'submitted', submittedBy }` / **403** `WRONG_SUBMITTER_ROLE` / **409** `INSUFFICIENT_REFEREES` |
| S02 | `POST /matches/:id/result/verify` | **ฝ่ายที่ไม่ได้เขียนผล** (BR-13) — 🔴 **เปลี่ยน 4 ต.ค. · OD-55**: โหมด online ไม่ได้บังคับ "ต้องเป็นกรรมการ" อีกแล้ว · `submitted_role='team_leader'` → **กรรมการของแมตช์** ยืนยัน (เหมือนเดิม) · `submitted_role='referee'` (จาก S02b หรือบันไดข้อ 6) → **หัวหน้าทีมฝ่ายไหนก็ได้** ยืนยัน · onsite ยังเป็น **หัวหน้าทีมที่ชนะ** เท่านั้น (ไม่เปลี่ยน) | ⭐ **transaction 9 ขั้น** — verified + เลื่อนสาย + standings + stats + แต้ม + แจ้งเตือน + audit | — | `{ matchId, status:'verified', winnerTeamId, nextMatchId }` / **403** `SAME_PERSON_CANNOT_VERIFY` |
| S02b | `POST /matches/:id/result/override` | **REF ของแมตช์ · online เท่านั้น** | **ใหม่ 4 ต.ค. · OD-55** กรรมการเขียนผลทับของที่หัวหน้าทีมส่งมา · ★ **ลงที่ `submitted` ไม่ใช่ `verified`** — ถ้า verified ทันทีคนเดียวจะเป็นทั้งคนเขียนและคนรับรอง ซึ่งเป็นสิ่งเดียวที่ `SAME_PERSON_CANNOT_VERIFY` กันอยู่ · ลงที่ `submitted` แล้วเส้นทางเท่ากับโหมด onsite เป๊ะ (กรรมการเขียน → ทีมค้านได้ → เงียบ → auto-verify ซึ่งกรอง `submitted_role='referee'` อยู่แล้ว) · **onsite → 409 `OVERRIDE_ONSITE_NOT_ALLOWED`** (ที่นั่นกรรมการส่งผลเองตั้งแต่ต้น แก้ด้วยการส่งใหม่ทับได้เลยผ่าน S01) · **ผลที่ไม่ใช่ `submitted` → 409 `RESULT_NOT_OVERRIDABLE`** (verified/disputed/rejected/walkover) — เส้นนี้ **ไม่มีกลไกถอนผลออกจากสาย/ตารางคะแนน** (ไม่มี `undoOutcomeTx`) จึงห้ามแตะของที่ขยับไปแล้ว ต้องใช้ S03/S04 · ไม่ใช่กรรมการของแมตช์ → 403 `WRONG_SUBMITTER_ROLE` · `reason` **บังคับ** และถูกส่งต่อไปในข้อความแจ้งเตือน · ทับซ้ำได้ตราบที่ยัง `submitted` · นาฬิกา auto-verify **เริ่มนับใหม่** ทุกครั้งที่ทับ (`submitted_at = NOW()`) · ไม่แตะ `matches.match_status` | `{ winnerTeamId, scoreData, reason }` | **200** `{ id, matchId, status:'submitted', submittedBy }` / **409** / **403** / **400** `VALIDATION_FAILED` |
| S03 | `POST /matches/:id/result/dispute` | TL/REF | โต้แย้งผล · **BR-14 มี 2 จังหวะ**: ก่อน verify (ฝ่ายที่ต้องยืนยันเลือกโต้แย้งแทน — ไม่มีกำหนดเวลา) หรือหลัง verify ภายใน `dispute_window_hours` · active ได้ครั้งละ 1 · ผลที่ `rejected` โต้แย้งไม่ได้ (**409** `RESULT_REJECTED`) | `reason` (บังคับ 1–1000), `claimedWinnerTeamId?`, `claimedScoreData?` (เสนอผลที่ถูกต้อง — ผู้จัดกด amend ต่อได้เลย), `evidenceKeys?` (≤5 ไฟล์ · อัปผ่าน M16 purpose `dispute_evidence`) | `{ matchId, status:'disputed' }` / **409** `DISPUTE_WINDOW_CLOSED` \| `DISPUTE_ALREADY_ACTIVE` \| `RESULT_IS_WALKOVER` · **26 ก.ย.**: `reason` บังคับ 1–1000 ตัวอักษร (เดิมสตริงว่างก็ผ่าน) · เสนอผลที่ถูกต้องมาด้วยได้ `claimedWinnerTeamId` + `claimedScoreData` · แนบหลักฐาน `evidenceKeys` ≤ 5 ไฟล์ (M16 purpose `dispute_evidence`) |
| S04 | `POST /matches/:id/result/resolve` | ORG · **แอดมิน ADM-u เมื่อพ้น 48 ชม.** (OD-26 ข้อ 10 — เพิ่มคนที่กดได้ ไม่ใช่โอนอำนาจ · ก่อนหน้านั้น **403** `ORGANIZER_STILL_HAS_TIME` +`availableAt` · 🆕 **4 ต.ค. OD-58: แอดมินคนเดียวกันนี้อ่าน S03b/S05 ได้แล้ว** เดิมกดได้แต่อ่านไม่ได้) | ตัดสินข้อโต้แย้ง · **B4 (19 ก.ย.)**: `uphold` ปิดเรื่อง · `reject` **ถอนผลที่ verify ไปแล้วทั้งหมด** (เอาทีมออกจากรอบถัดไป + bracket_nodes, standings −1, player stats −1) แมตช์ → `result_rejected` รอส่งใหม่ S01→S02 · `amend` ORG ใส่ผู้ชนะ/สกอร์ที่ถูกเอง → ถอนผลเดิม+ใส่ผลใหม่ verified ทันที (`isAmended`) · reject/amend ได้เฉพาะเมื่อแมตช์ถัดไปยัง `scheduled` · **โต้แย้งก่อน verify**: uphold = verify ให้เลย (เดินสาย/standings ตอนนี้) · reject ไม่มีอะไรต้องถอน | `resolution:'uphold'\|'reject'\|'amend', resolutionNote` · amend เพิ่ม `winnerTeamId, scoreData` | `{ matchId, status:'verified'\|'rejected', isAmended }` / **409** `NO_ACTIVE_DISPUTE`, `NEXT_MATCH_STARTED` + `nextMatchId` · **400** winnerTeamId ไม่ใช่ทีมในแมตช์ |
| S03b | `GET /matches/:id/result/dispute` | ORG / REF ของแมตช์ / หัวหน้า 2 ทีม / **แอดมิน ADM-u เมื่อพ้น 48 ชม.** (🆕 4 ต.ค. · OD-58) | **ใหม่ (26 ก.ย.)** รายละเอียดข้อโต้แย้งไว้ใช้ตัดสิน — เดิมเก็บลงฐานข้อมูลแต่ไม่มี endpoint ไหนคืนออกมา ผู้จัดเห็นแค่ข้อความในแจ้งเตือน · หลักฐานคืนเป็น **presigned URL** เสมอ | — | `{ matchId, status, reason, raisedBy, raisedAt, claimedWinnerTeamId, claimedScoreData, evidence[], resolution, resolvedAt }` / **404** `NO_ACTIVE_DISPUTE` |
| S06b | `POST /matches/:id/result/organizer` | ORG ของแมตช์ | **ใหม่ (OD-26 ข้อ 6)** ผู้จัดตัดสินแมตช์ที่แข่งจบแล้วแต่**ไม่มีใครส่งผลเลย** — วันนี้เคสนี้ไม่มีทางออกใด ๆ ในระบบ ทัวร์ปิดไม่ได้ตลอดกาล · ใช้ได้เมื่อพ้น **24 ชม.** หลังเวลาจบจริงและยังไม่มีผล · `reason` **บังคับ** ลง audit `match_decided_by_organizer` · `result` = กรอกผล (ติดป้าย `submittedRole:'organizer'`) · `double_forfeit` = แพ้ทั้งคู่ ไม่มีใครผ่านรอบ (ช่องว่างในสายใช้ dead_slot/dead_match เดิม) **— ใช้ได้เฉพาะโหมด online** · onsite มีกรรมการที่ผู้จัดแต่งตั้งอยู่หน้างาน การไม่มีผลส่งเป็นความบกพร่องของฝั่งผู้จัด จะปรับแพ้ทั้งสองทีมไม่ได้ → **409** `FORFEIT_NOT_ALLOWED_ONSITE` | `outcome:'result'\|'double_forfeit', reason, winnerTeamId?, scoreData?` | `{ matchId, outcome, decidedBy:'organizer' }` / **409** `MATCH_NOT_FINISHED` \| `ESCALATION_NOT_OPEN` (+`availableAt`) \| `MATCH_RESULT_EXISTS` |
> 🔴 **ใครยืนยันผล — ดูที่ `submitted_role` ไม่ใช่ที่โหมด** (OD-55 · 4 ต.ค.)
>
> | โหมด | `submitted_role` | ใครยืนยัน (S02) |
> |---|---|---|
> | onsite | `referee` | **หัวหน้าทีมที่ชนะ** เท่านั้น |
> | online | `team_leader` | **กรรมการของแมตช์** |
> | online | `referee` | **หัวหน้าทีมฝ่ายไหนก็ได้** ← ใหม่ |
>
> หลักเดียวทั้งสามแถว: **ใครเขียน อีกฝ่ายรับรอง** · `SAME_PERSON_CANNOT_VERIFY` ตรวจก่อนทุกครั้ง
>
> `submitted_role = 'referee'` ในโหมด online เกิดจาก 2 ทาง — **S02b** (กรรมการเขียนทับ) และ
> **บันไดข้อ 6** (กรรมการส่งแทนเมื่อทั้งสองทีมเงียบพ้นกำหนด) · ก่อน 4 ต.ค. ทั้งสองเคสนี้
> **ไม่มีใครกดยืนยันได้เลย** เพราะด่านบังคับกรรมการ แต่กรรมการคนที่ส่งติด `SAME_PERSON` และ
> online ต้องการกรรมการแค่ 1 คน ⇒ ผลค้างรอ `auto-verify` อย่างเดียว ปิดเร็วไม่ได้แม้ทั้งสองทีมเห็นด้วย
>
> ★ **ถ้าไม่มีใครกด `auto-verify` ยังปิดให้เหมือนเดิม** (กรอง `submitted_role='referee'`)
> เส้นตาย = อันไหนถึงก่อนระหว่าง *24 ชม. หลังส่งผล* กับ *15 นาทีก่อนแมตช์ถัดไปเริ่ม*
> แต่ **ไม่มี scheduler** — ยิงตอนเปิดเช็คอินแมตช์ถัดไป หรือตอนปิดทัวร์เท่านั้น

| S05 | `GET /matches/:id/result` | — | ผลแข่ง (คืนเฉพาะ `verified` หรือ `walkover` ไม่งั้น 404) · ผลที่ยัง `submitted/disputed/rejected` เห็นได้เฉพาะ ORG/กรรมการแมตช์/หัวหน้า 2 ทีม (ส่ง token) · มี `status` · **ข้อ 3 (25 ก.ย.)** เพิ่ม `disputeClosesAt` = `verified_at + dispute_window_hours` (**null** = ยังไม่ verify ค้านได้ไม่จำกัดเวลา หรือค้านไม่ได้เลยเพราะเป็นบาย/ถูกปฏิเสธ) และ `resultChangeable` = ค้านแล้ว**แก้ผลได้จริง**ไหม (false เมื่อแมตช์ถัดไปพ้น `scheduled` — ยื่นได้แต่เป็นการร้องเรียนที่ไม่เปลี่ยนผล) **FE ต้องเปลี่ยนคำบนปุ่มตามค่านี้** · **แก้ 27 ก.ย.** เพิ่ม 6 ฟิลด์ข้อโต้แย้ง — **แยกสองชั้น (มติ 30 ก.ย.)**
เดิมกั้นทั้งหกเป็นก้อนเดียว ผู้เล่นจึงไม่เคยได้อ่านคำวินิจฉัยที่ migration 020 บังคับเขียนไว้ให้เขาอ่าน (FE-dispute-ruling-hidden-from-players)<br>• **คำวินิจฉัย** `disputeResolution`/`disputeResolvedBy`/`disputeResolvedAt` → ORG / REF ของแมตช์ / หัวหน้า 2 ทีม **+ ผู้เล่นทุกคนในรายชื่อลงแข่งของสองทีม**<br>• **ตัวคำค้าน** `disputeReason`/`disputeRaisedBy`/`disputeRaisedAt` → ORG / REF ของแมตช์ / หัวหน้า 2 ทีม **เท่าเดิม** — เป็นคำของคู่กรณี อาจกล่าวหาผู้เล่นตรง ๆ และ `disputeRaisedBy` บอกว่าหัวหน้าทีมไหนค้าน<br>คนที่ไม่มีสิทธิ์**ไม่มีคีย์เหล่านั้นเลย** ไม่ใช่ได้ `null` (null แปลว่า "ไม่มีข้อโต้แย้ง" คนละความหมาย)| — | `{ matchId, winnerTeamId, scoreData, isAmended, amendedAt, amendReason, isWalkover, verifiedAt, disputeClosesAt, resultChangeable, submittedRole, isAutoVerified }` · `submittedRole:'organizer'` = **ผู้จัดกรอกผลเอง** (ป้ายที่ทุกคนเห็น) · `isAutoVerified` = ระบบยืนยันให้เพราะไม่มีผู้โต้แย้ง |
| S06 | `POST /matches/:id/stats` | REF | บันทึกสถิติรายบุคคล · **BR-11** · ผู้เล่นต้องอยู่ใน**รายชื่อลงแข่ง** (`application_players`) ไม่ใช่แค่คลังทีม — OD-17 (แก้ 20 ก.ย.) ไม่งั้น **404** `USER_NOT_IN_MATCH` · `value` **จำนวนเต็มเท่านั้น** และ**บวกสะสม**เมื่อส่งซ้ำ (`data_type` เหลือแค่ `integer` — migration 020, OD-18) | `playerStats: [{userId, values:[{statDefinitionId, value:int}]}]` | **201** `{ matchId, recordedCount }` / **400** `UNKNOWN_STAT_DEFINITION` |
| S07 | `GET /matches/:id/stats` | — | สถิติพร้อม label ไทย · รายชื่อ = ผู้เล่นที่ทีมส่งลงแข่ง (`application_players`) ไม่ใช่ทั้งคลังทีม (แก้ 20 ก.ย.) | — | `{ items: [{userId, fullName, stats:[{statKey, statLabelTh, value}]}] }` |
| S10 | `GET /tournaments/:id/winner` | — | ผู้ชนะ (เฉพาะทัวร์ที่ `completed` — ORG ปิดผ่าน C14b) · อ่านจาก `champion_team_id` ที่เก็บตอนปิด · round robin: แชมป์/รองแชมป์ = อันดับ 1/2 ของตาราง, `finalScore` null · รอบชิงแพ้ทั้งคู่ (M17) หรือ RR เสมออันดับ 1 → `championTeam: null` · รอบชิงบาย → `summary.isWalkover` · `completedAt` = เวลาที่ปิด | — | `{ championTeam \| null, runnerUpTeam \| null, summary:{ finalScore, isWalkover, completedAt } }` |
| S11 | `GET /tournaments/:id/dashboard` | — | ภาพรวมตัวเลข | — | `{ teamCount, playerCount, matchCount, matchesCompleted }` |
| S12 | `GET /tournaments/:id/standings` | — | ตารางคะแนน (**read-only**) · **B3 (21 ก.ย.)** ระบบไม่มีผลเสมอ (OD-20) · เรียง **แต้ม → ผลต่างประตู → ประตูได้ → ชนะ → ชื่อ** · ทีมที่เท่ากันทุกเกณฑ์ได้ `rank` เท่ากัน (1,1,3) · ประตูจาก `scoreData` ของผลที่ verified/walkover (walkover ใช้ `sport_types.walkover_score`) | — | `{ items: [{team, played, wins, losses, points, goalsFor, goalsAgainst, goalDiff, rank}], isProvisional, pendingMatches:[{id,status}] }` · **ข้อ 1 (26 ก.ย.)** `isProvisional: true` = ยังมีแมตช์ไม่สรุป อันดับเปลี่ยนได้ (round robin ทุกแมตช์ป้อนตารางเดียวกัน) · เป็น `false` เองเมื่อไม่เหลือแมตช์ค้าง = อันดับเป็นทางการ |

| S13 | `POST /matches/:id/result/complaints` | หัวหน้า 2 ทีม / REF ของแมตช์ | **ใหม่ (OD-26 ข้อ 8)** ร้องเรียนผลที่**พ้นเวลาโต้แย้งไปแล้ว** — เปิดเฉพาะเมื่อประตู S03 ปิดสนิท (ผลบายเปิดได้เสมอเพราะ S03 ค้านไม่ได้เลย) · **ไม่แตะ `match_status`** สายเดินต่อและปิดทัวร์ได้ · **ยื่นได้เฉพาะก่อนปิดทัวร์** (route อยู่ใต้ `/matches/:id` → `lockCompletedTournament` ปิดเอง) · 1 คน 1 เรื่องต่อผล ยื่นซ้ำ = แก้ของเดิม · หลักฐานใช้ purpose `dispute_evidence` เดิม | `reason, claimedWinnerTeamId?, claimedScoreData?, evidenceKeys?[]` | **201** `{ complaintId, matchId, status:'open', stage, escalatesAt, ... }` / **409** `USE_DISPUTE_INSTEAD` \| `RESULT_NOT_FINAL` \| `COMPLAINT_ALREADY_DECIDED` / **403** `NOT_COMPLAINT_PARTY` |
| S13b | `GET /matches/:id/result/complaints` | ORG / แอดมิน / หัวหน้า 2 ทีม / REF ของแมตช์ | เรื่องทั้งหมดของแมตช์ · **ไม่ใช่ของสาธารณะ** (พกข้อกล่าวหาถึงตัวบุคคล) · `canAmendResult` บอกผู้ตัดสินล่วงหน้าว่าแก้ผลได้จริงไหม | — | `{ matchId, canAmendResult, amendBlockedBy, complaints[] }` / **403** `NOT_COMPLAINT_PARTY` |
| S13c | `GET /match-result-complaints/:id` | สิทธิ์ชุดเดียวกับ S13b | รายละเอียดเรื่องเดียว · หลักฐานคืนเป็น **presigned URL** เสมอ | — | `{ complaintId, status, stage, escalatesAt, filedBy, reason, claimed*, evidence[], organizerStatement, decision, filerFlagged, canAmendResult }` |
| S13d | `PUT /match-result-complaints/:id/statement` | ORG ของทัวร์ | ผู้จัด**แนบความเห็น** — **ไม่มี route ให้ปัดตกโดยเจตนา** (ผู้จัดอาจเป็นคู่กรณีเอง) · prefix อยู่**นอก** `/matches/:id` จึงทำได้**แม้ทัวร์ปิดแล้ว** · เขียนช้ากว่า 48 ชม.ได้ แต่ติดป้าย `organizerStatement.late` | `statement` | `{ ...complaint }` / **409** `COMPLAINT_ALREADY_DECIDED` |
| S13e | `POST /match-result-complaints/:id/decision` | แอดมิน `university_wide` | วินิจฉัย — ได้เมื่อพ้น **48 ชม.** นับจากเวลายื่น (`created_at`) ไม่ว่าผู้จัดจะเขียนหรือไม่ · `upheld`+`record_only` = มีมูล บันทึกไว้ไม่แก้ผล · `upheld`+`amend_result` = แก้ผู้ชนะ/สกอร์ผ่านเส้นทาง amend เดิม (ต้อง `canAmendResult`) · `no_merit` = ไม่มีมูล ติด `filerFlagged` **เฉพาะผู้ยื่น** | `outcome:'upheld'\|'no_merit', remedy:'record_only'\|'amend_result', note, winnerTeamId?, scoreData?` | `{ ...complaint }` / **403** `ORGANIZER_STILL_HAS_TIME` (+`availableAt`) / **409** `RESULT_NOT_CHANGEABLE` (+`blockedBy`) \| `COMPLAINT_ALREADY_DECIDED` |

> 🆕 **S05 คืน `submittedBy` / `submittedAt` แบบมีเงื่อนไข** (4 ต.ค. · OD-59)
>
> ```
> ORG / กรรมการของแมตช์ / หัวหน้า 2 ทีม / แอดมินที่ถึงคิวตัดสิน (OD-58)
>     submittedBy : UserRef | null      submittedAt : ISO | null
> คนนอก / ไม่ล็อกอิน
>     **ไม่มีสองคีย์นี้เลย** — เห็นแค่ submittedRole เหมือนเดิม
> ```
>
> S05 เป็น endpoint สาธารณะเมื่อผลเป็น `verified`/`walkover` ⇒ ใส่ชื่อแบบไม่มีเงื่อนไขเท่ากับเปิด
> "กรรมการคนไหนตัดสินแมตช์นี้" และ "หัวหน้าทีมคนไหนกรอกผล" ให้คนนอกทุกคน · `submittedRole`
> ยังสาธารณะเหมือนเดิมเพราะเป็นป้ายบทบาท ไม่ใช่ตัวคน
>
> 🔴 **ไม่มีคีย์ ≠ ได้ `null`** — `submittedBy: null` สงวนไว้แปลว่า **บัญชีผู้ส่งถูกลบไปแล้ว**
> (ตอนนั้น `submittedAt` ยังมีค่า — คนหาย ไม่ใช่เวลาหาย) · ถ้า FE เอา `null` ไปแปลว่า
> "ไม่มีสิทธิ์" จะแยกสองเคสนี้ไม่ออก
>
> ★ กลุ่มที่เห็นคือกลุ่มเดียวกับ **ตัวคำค้าน** ไม่ใช่กลุ่มของ **คำวินิจฉัย** — คำวินิจฉัยขยายถึง
> ผู้เล่นทุกคนเพราะเป็นข้อความที่เขียนให้ผู้เล่นอ่าน ส่วนชื่อคนกรอกผลไม่ใช่

> **`isAmended` / `amendedAt` / `amendReason` ต้องมีในทุก response ที่คืนผลแข่ง**
> คำนวณจาก `amended_at IS NOT NULL` **ไม่ใช่ค่าใน enum** (NF-SE-05)

---

# 10. Engagement — ประกาศ · รีวิว/โหวต MVP · ความเห็นต่อทัวร์ · Pick'em

## 10.1 ประกาศ + ถ่ายทอดสด (MVP) — 5 endpoint

**ไฟล์:** `routes/announcement.routes.ts` · `announcement.controller.ts` · `announcement.service.ts` · `announcement.repo.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| E08 | `POST /tournaments/:id/announcements` | ORG | **1 ต.ค.: ยิงแจ้งเตือนแล้ว** (`tournament_announcement`) → ผู้เล่นในรายชื่อลงแข่ง + หัวหน้าทีม **+ กรรมการของทัวร์** ไม่ส่งกลับหาผู้จัดที่โพสต์เอง · หัวข้อขึ้นคำนำหน้าตาม `type` (`ประกาศจากผู้จัด:` / `เปลี่ยนกำหนดการแข่ง:` / `เปลี่ยนสนามแข่ง:` / `ประกาศผลการแข่งขัน:` / `ถ่ายทอดสด:`) · เดิมบันทึกลงฐานแล้วจบ ไม่มีใครรู้จนกว่าจะเข้าไปเปิดดูเอง · **แก้ 27 ก.ย.** เพิ่ม `type` — `announcements.announcement_type` มี 5 ค่า NOT NULL มาตั้งแต่ schema แรก แต่ INSERT ฮาร์ดโค้ด `'general'` และไม่มี response ไหนคืนออกมา คอลัมน์จึงไม่ได้ทำอะไรเลย · ค่า: `general` \| `schedule_change` \| `venue_change` \| `result` \| `livestream` · ไม่ส่งมา = `general` (ของเก่าไม่พัง) · ประกาศ + แจ้งเตือนผู้เกี่ยวข้อง | `title, body, type?` | **201** `{ id, type, title, body, createdAt }` |
| E09 | `GET /tournaments/:id/announcements` | — | รายการประกาศ · ทุกแถวมี `type` แล้ว (แก้ 27 ก.ย.) FE ติดป้ายชนิดประกาศได้ | `?page&pageSize` | `{ items: [{id, type, title, body, createdAt}], pagination }` |
| E10 | `PATCH /announcements/:id` | ORG | แก้ประกาศ · แก้ `type` ได้ด้วย (แก้ 27 ก.ย.) · **ไม่ยิงแจ้งเตือนซ้ำโดยเจตนา** (1 ต.ค.) — แก้คำผิดคำเดียวจะกลายเป็นยิงใหม่ทั้งทัวร์ ถ้าสำคัญพอให้คนรู้อีกครั้ง ผู้จัดโพสต์ใหม่ได้ · E11 ที่ลบก็ไม่ยิง | `title?, body?, type?` | `{ id, type, title, body, createdAt }` |
| E11 | `DELETE /announcements/:id` | ORG | **soft delete** | — | **204** |
| E12 | `PUT /matches/:id/livestream` | ORG | ตั้งลิงก์ถ่ายทอดสด · validate YouTube URL · `youtubeUrl: null` = ล้างลิงก์ | `youtubeUrl` | `{ matchId, youtubeUrl }` / **400** `INVALID_YOUTUBE_URL` |

> ⚠️ E12 — ต้นฉบับ DB ออกแบบให้ลิงก์ถ่ายทอดสดเป็นประกาศ (`announcement_type='livestream'`) ไม่ใช่ field ของแมตช์ ต้องเลือกทางก่อนเขียน ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ A3

---

## 10.2 รีวิวจากผู้ลงแข่ง + โหวต MVP รายแมตช์ (C6 · OD-23) — 7 endpoint

**ไฟล์:** `routes/feedback.routes.ts` · `feedback.controller.ts` · `feedback.service.ts` · `feedback.repo.ts` · ตาราง `tournament_feedback` (ไม่มี migration)

> **ชื่อเรียก (ตกลง 23 ก.ย.)** — ตารางเดียวเก็บ 3 เรื่อง อย่าเรียกปนกัน
> `organizer_feedback` = **รีวิวจากผู้ลงแข่ง** (คนลงแข่งให้คะแนนการจัดงาน · ข้อความเห็นแค่ผู้จัด) ·
> `mvp_vote` = **โหวต MVP** (เฉพาะคนที่ไม่ได้ลงแข่ง) ·
> `comment` = **ความเห็นต่อทัวร์** (ใครก็เขียนได้ ทุกคนเห็น — อยู่ข้อ 10.3)

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| E18 | `POST /tournaments/:id/feedback` | ผู้เล่นในรายชื่อ / หัวหน้าทีมที่ approved | ให้คะแนนการจัดงาน · **ส่งซ้ำ = แก้** · เปิดตั้งแต่ทัวร์เริ่มถึง 7 วันหลังปิดทัวร์ | `rating 1–5, content?` | **201** ครั้งแรก / **200** แก้ · `{ id, rating, content, createdAt }` |
| E19 | `GET /tournaments/:id/feedback` | — (ล็อกอินได้ข้อมูลตัวเองเพิ่ม) | ค่าเฉลี่ย/การกระจาย + `status` (`not_started`/`open`/`closed`) + `opensAt`/`closesAt` · ผู้จัดเห็น `items` ไม่เห็นชื่อ · แอดมิน `university_wide` เห็นชื่อ | `—` | `{ summary, status, opensAt, closesAt, mine, canSubmit, items }` |
| E20 | `POST /matches/:id/mvp-votes` | Auth · **ไม่ใช่สมาชิกของสองทีมในแมตช์** | โหวต MVP ของแมตช์ (มติ 26 ก.ย. — ย้ายจากระดับทัวร์) · เปิดทันทีที่แมตช์จบ (`actual_end_time`) ปิด +24 ชม. (`MVP_VOTING_HOURS`) · ส่งซ้ำ = เปลี่ยนคนที่โหวต | `userId` | **201** ครั้งแรก / **200** เปลี่ยน · `{ matchId, votedForUserId, changed }` |
| E22 | `GET /matches/:id/mvp-votes` | — (ล็อกอินได้ `mine`/`canVote`) | ผู้ถูกโหวต (คนที่เช็คอินสำเร็จ) + สถิติของเขาในแมตช์นั้น · **★ ระหว่างเปิดโหวตไม่มีจำนวนโหวตในคำตอบเลย** ทั้ง `candidates[].votes` และ `totalVotes` (OD-23 ข้อ 10) · ปิดโหวตแล้วจึงมีคะแนน + `winners` | `—` | `{ matchId, window, candidates, winners, (totalVotes หลังปิดโหวต), mine, canVote }` |
| E15 | `POST /feedback/:id/report` | Auth | รายงานข้อความ (กดซ้ำได้ผลเดิม) · รีวิว report ได้เฉพาะผู้จัด · ความเห็นต่อทัวร์ report ได้ทุกคนยกเว้นเจ้าของ · **ความเห็นต่อทัวร์ → แจ้งเตือนผู้จัด** (`comment_reported`, ครั้งแรกครั้งเดียว) · **อันที่ผู้จัดตรวจแล้วปล่อยผ่าน (E17d) กดอีกจะไม่ขึ้นอีก** (มติ 30 ก.ย.) — ธงไม่ขึ้น ไม่แจ้งผู้จัด กลับรายงานได้อีกเมื่อเจ้าของแก้ข้อความ | `—` | `{ id, isReported: true }` — **คืนค่านี้เสมอ แม้เรื่องจะไม่ขึ้น** (หมายว่า "รับเรื่องแล้ว" ไม่ใช่ "ธงขึ้นแล้ว") |
| E17 | `DELETE /admin/feedback/:id` | ADM-u | ลบ (soft delete) + audit `feedback_removed` · **แจ้งเจ้าของพร้อมเหตุผล** (`feedback_removed_by_admin`) · ลบของตัวเองไม่แจ้ง | **`reason` บังคับ** 1–500 ตัวอักษร (แก้ 30 ก.ย. — เดิม optional) | **204** · ไม่ส่ง → **400** `VALIDATION_FAILED` |
| E17b | `POST /admin/feedback/:id/restore` | ADM-u | **คืนของที่ถูกลบ** + audit `feedback_restored` · ล้างธง report ด้วย (มติ 23 ก.ย. 6.3.3 — เผื่อเจ้าของอุทธรณ์ว่าผู้จัดลบคำวิจารณ์) · **แจ้งเจ้าของ** (`feedback_restored`) · **แจ้งผู้ที่ลบไว้ด้วย** (`feedback_restore_overridden`) — คำตัดสินของเขาถูกกลับ และธง report ที่ล้างทำให้เขาหาจากคิวเองไม่ได้ | `—` | **200** `{ id, restored: true }` |

## 10.3 ความเห็นต่อทัวร์ (C7 · OD-24) — 5 endpoint

> ย้ายจาก "คอมเมนต์ใต้แมตช์" มาเป็นระดับทัวร์ (มติ 22 ก.ย.) · **คนละ 1 อันต่อทัวร์ ส่งซ้ำ = แก้** · ทุกคนอ่านได้ · ทัวร์ต้อง `public`/`completed`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| E13 | `POST /tournaments/:id/comments` | Auth | เขียน/แก้ความเห็นของตัวเอง · ≤ 500 ตัวอักษร · **ไม่มี rate limit** (1 อันต่อคน) · ถูก**ผู้จัด**ลบไปแล้วเขียนใหม่ได้ (ใช้แถวเดิม) · ถูก**แอดมิน**ลบ → 409 `COMMENT_REMOVED` · **แก้ข้อความแล้วกลับเป็น "ยังไม่ตรวจ"** (มติ 30 ก.ย.) — รายงานข้อความใหม่ได้อีก · ธง `is_reported` เดิมไม่หาย · **เขียนใหม่หลังที่ผู้จัดลบ → แจ้งผู้จัด** (`comment_rewritten_after_removal`, มติ 1 ต.ค.) — ครั้งเดียวต่อการลบหนึ่งครั้ง · ถ้าธงเก่ายังค้าง ข้อความจะบอกด้วยว่าแถวนี้อยู่ในคิว | `content` | **201** ครั้งแรก / **200** แก้ · `{ id, tournamentId, author, content, createdAt, isMine }` |
| E14 | `GET /tournaments/:id/comments` | — (ล็อกอินได้ `mine`/`canComment`) | รายการความเห็น ใหม่สุดก่อน · ไม่โชว์ที่ถูกลบ · ทัวร์ private คนนอกได้ 404 · **`?reported=true` = คิวที่ถูกรายงาน** (ORG ของทัวร์/แอดมินเท่านั้น คนอื่น 403 `NOT_ORGANIZER`) · `isReported` และ **`reportCleared`** (ตรวจแล้วปล่อยผ่านหรือยัง · มติ 30 ก.ย.) ในแต่ละ item โผล่เฉพาะสองคนนี้ (`canModerate: true`) | `?page&pageSize&reported` | `{ items, mine, canComment, canModerate, pagination }` |
| E14b | `DELETE /tournaments/:id/comments/me` | Auth | เจ้าของลบของตัวเอง (ลบจริง → เขียนใหม่ได้) | `—` | **204** |
| E17c | `DELETE /tournaments/:id/comments/:cid` | ORG ของทัวร์นั้น | **ผู้จัดลบความเห็นของคนอื่น** (มติ 23 ก.ย. ข้อ 6) · ได้เฉพาะ `comment` · `reason` **บังคับ** 1–255 · audit `comment_removed_by_organizer` (`details: reason, tournamentId, authorUserId`) · แจ้งเจ้าของ (`comment_removed`) · **ไม่ใช่การแบน** — เจ้าของเขียนใหม่ได้ (ต่างจากแอดมินลบ) | `reason` | **204** |
| E17d | `POST /tournaments/:id/comments/:cid/dismiss-report` | ORG ของทัวร์นั้น **หรือ ADM-u** | **ผู้จัดตรวจแล้วปล่อยผ่าน** (มติ 30 ก.ย.) — ล้างธง `is_reported` ให้หลุดจากคิว `?reported=true` · **จำว่าตรวจแล้ว** (`report_cleared_at`) ⇒ มีคนกด report อีกกี่คนก็ไม่ขึ้น จนกว่าเจ้าของแก้ข้อความ · audit `comment_report_dismissed` (`details: tournamentId, authorUserId`) · **ไม่แจ้งเจ้าของ** (เจ้าของไม่เคยรู้ว่าถูกรายงาน) · ได้เฉพาะ `comment` · ไม่ได้ถูกรายงาน/ปล่อยซ้ำ → 409 `FEEDBACK_NOT_REPORTED` · ลบไปแล้ว → 409 `FEEDBACK_ALREADY_REMOVED` | `—` (ไม่มี body) | **200** `{ id, isReported: false }` |

## 10.4 Pick'em ทายผล (C7 · OD-24) — 6 endpoint

**ไฟล์:** `routes/engagement.routes.ts` · `engagement.controller.ts` · `pickem.service.ts` · `pickem.repo.ts` · ตาราง `pickem_predictions` (มีอยู่แล้ว)

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| E26 | `POST /matches/:id/predictions` | Auth (**คนนอกทัวร์เท่านั้น**) | 🔴 **เปลี่ยนสัญญา 4 ต.ค. · OD-56: ทายเป็น `scoreData` ไม่ใช่ `teamId` อีกแล้ว** — ผู้ชนะที่ทาย = **ฝั่งที่แต้มมากกว่า ระบบอนุมานให้เอง** ไม่รับ `teamId` จาก request (ส่งมาก็ถูกทิ้ง) · ปิดเมื่อเปิดเช็คอินหรือถึงเวลาแข่ง · key ต้องเป็นรหัสทีมสองทีมของแมตช์นั้นเท่านั้น → **422** `PICK_TEAM_NOT_IN_MATCH` · **ทายเสมอไม่ได้** → **422** `PICK_SCORE_TIE` (ระบบไม่รองรับผลเสมอ ⇒ อนุมานผู้ชนะไม่ได้) · `changed` นับทั้ง **เปลี่ยนฝั่ง และ เปลี่ยนแค่สกอร์** (ของเดิมดูแค่ฝั่ง) · ★ **response ยังมี `teamId` เหมือนเดิม** = ผู้ชนะที่อนุมานได้ ⇒ FE แก้แค่ขาส่ง | `{ scoreData: { "<teamId>": n, "<teamId>": n } }` | **201** ครั้งแรก / **200** เปลี่ยน · `{ matchId, teamId, scoreData, changed }` |
| E26b | `DELETE /matches/:id/predictions/me` | Auth | ยกเลิกการทาย (ก่อนปิด) | `—` | **204** |
| E26c | `GET /matches/:id/predictions/summary` | — (ล็อกอินได้ `mine`/`canPredict`) | สรุป % ของสองทีม + สถานะเปิด/ปิด | `—` | `{ matchId, isOpen, closedReason, closesAt, total, teams, mine, canPredict }` |
| E26d | `GET /matches/:id/predictions/me` | Auth | การทายของตัวเองในแมตช์นี้ | `—` | `{ matchId, teamId, pointsEarned, status }` / `null` |
| E27 | `GET /me/pickem` | Auth | ประวัติการทาย + แต้มรวม (`users.total_points`) | `—` | `{ totalPoints, correct, settled, items }` |
| E28 | `GET /tournaments/:id/pickem-leaderboard` | — | อันดับในทัวร์ · แต้มเท่ากันได้อันดับเดียวกัน (1,1,3) · เรียง แต้มมาก → ทายถูกมาก → ชื่อ · นับเฉพาะการทายที่**ตัดสินแล้ว** (`points_earned IS NOT NULL`) ⇒ คนที่ทายไว้แต่แมตช์ยังไม่จบ **ไม่อยู่ในลิสต์** ไม่ใช่อยู่ด้วยแต้ม 0 · **4 ต.ค. (OD-51): นี่เป็นที่เดียวที่แต้ม Pick'em ของคนอื่นถูกแสดง** — โปรไฟล์ไม่โชว์แล้ว · ไม่ขึ้นกับ `show_profile_stats` (OD-46) เพราะเป็นข้อมูลของทัวร์ ไม่ใช่สถิติรวมของคน (หลักเดียวกับ OD-47) | `—` | `{ items: [{ rank, user, points, correct, settled }] }` |
| E29 | `GET /tournaments/:id/me/pickem` | Auth | **แต้ม + อันดับของตัวเองในทัวร์นี้ ก้อนเดียว** (4 ต.ค. · OD-51) — มีเพราะ E28 คืนมาทั้งทัวร์และไม่มี pagination · กฎอันดับเหมือน E28 เป๊ะ (เสมอ = แต้มและทายถูกเท่ากัน) · **ยังไม่มีการทายที่ตัดสินแล้ว → `points` เป็น `0` แต่ `rank` เป็น `null`** ไม่ใช่เลขท้ายตาราง เพราะคนนั้นยังไม่อยู่ในตารางอันดับเลย · ทัวร์ไม่มีจริง → **404** `TOURNAMENT_NOT_FOUND` · ไม่เช็คว่าทัวร์ public ไหม (กฎเดียวกับ E28) | `—` | **200** `{ tournamentId, points, correct, settled, rank\|null }` |

> 🔴 **OD-56 (4 ต.ค.) — Pick'em ทายเป็นสกอร์แล้ว · `scoreData` โผล่ในทุกเส้นที่คืนการทาย**
>
> ```
> POST  /matches/:id/predictions            request  { scoreData }   ← เปลี่ยน (ไม่มี teamId)
>                                           response { matchId, teamId, scoreData, changed }
> GET   /matches/:id/predictions/me         + scoreData
> GET   /matches/:id/predictions/summary    mine.scoreData
> GET   /me/pickem                          items[].scoreData
> ```
>
> ★ `scoreData` เป็น **`null` ได้** — แถวที่ทายไว้ก่อน `migration 038` ไม่มีสกอร์เก็บไว้
> (ทายแค่ฝั่ง) · ของใหม่บังคับมีสกอร์เสมอ ⇒ `null` มีได้แค่ในข้อมูลเก่า **FE ต้องรับมือ**
>
> **แต้ม 3 ชั้น (OD-56 · 4 ต.ค.)** — `utils/pickemScore.ts` · ตัวเลขที่ `config/scoring.ts`
>
> | ชั้น | เงื่อนไข | แต้ม |
> |---|---|---|
> | `spot_on` | ฝั่งถูก + **ทุกฝั่งคลาด ≤ `pickem_tolerance_exact`** | **10** |
> | `close` | ฝั่งถูก + **ทุกฝั่งคลาด ≤ `pickem_tolerance_close`** | **7** |
> | `side_only` | ฝั่งถูก | **4** |
> | `wrong_side` | **ฝั่งผิด — 0 เสมอ ไม่ว่าสกอร์จะใกล้แค่ไหน** | **0** |
>
> ★ **ความคลาดวัด "ต่อฝั่ง" และยึดฝั่งที่แย่กว่า** ไม่ใช่ผลรวมสองฝั่ง (migration 040)
> ```
> บาส ผลจริง 52-45 · ทาย 50-39   คลาด 2 กับ 6  →  ยึด 6  →  เส้น (5,10) → close
> ```
> เหตุผลที่ไม่บวกกัน: การบวกลงโทษกีฬาแต้มสูงสองเท่า (สองฝั่งคลาดพร้อมกัน) และทำให้
> "ทาย 2-1 ได้จริง 3-2" (อ่านผลต่างถูกเป๊ะ) แย่กว่า "ทาย 2-1 ได้จริง 3-1" (ผลต่างผิด) — กลับหัวกลับหาง
>
> ★ **เส้นต่างกันตามกีฬา** (`sport_types.pickem_tolerance_exact / _close` · migration 040)
> เพราะ 5 กีฬานับสกอร์คนละหน่วย — ฟุตบอล/บาสนับ**แต้มจริง** · แบด/RoV/VALORANT นับ**เกมที่ชนะ**
> ```
> แบดมินตัน · RoV · VALORANT   (0 , 0)   ชั้น close ไม่ยิงเลย (ชั้นเต็มง่ายอยู่แล้ว เหลือ 2 ทางเลือก)
> ฟุตบอล                       (0 , 1)   ชั้นเต็มยังหมายถึง "เป๊ะ" · คลาดฝั่งละ 1 ประตู = ชั้นกลาง
> บาสเกตบอล                    (5 , 10)  ไม่มีแถบนี้ เพดานจริงของคนทายบาสคือ 7 ตลอดชีวิต
> ```
> ฐานบังคับ `close >= exact` (`chk_sport_pickem_tolerance`) — ถ้า close แคบกว่า ชั้นกลางจะหายเงียบ ๆ
>
> ★ **`points_earned > 0` แปลว่า "ทายฝั่งถูก" ได้ตรง ๆ** (เพราะฝั่งผิด = 0 เสมอ)
> ⇒ **E28/E29 ช่อง `correct` และ `status` won/lost ถูกต้องอยู่แล้ว ไม่ต้องแก้**
> 🔴 ถ้าวันหนึ่งกติกาเปลี่ยนให้ฝั่งผิดได้แต้ม **ต้องกลับไปแก้สองที่นั้นพร้อมกัน**
>
> ★ **ผู้จัด amend สกอร์ (S04) → แต้ม Pick'em ถูกคิดใหม่ทั้งแมตช์** แม้ผู้ชนะไม่เปลี่ยน
> (ก่อน OD-56 ไม่ต้องคิดใหม่เพราะแต้มไม่ขึ้นกับสกอร์) · `users.total_points` ปรับตามให้ครบ


> **แต้ม**: ทายถูก 10 · ผิด 0 · ชนะบาย/ปรับแพ้/ไม่มีการแข่ง = void (ไม่ได้ไม่เสีย) · ให้/คืนแต้มในทรานแซกชันเดียวกับผลแมตช์ จึงถูกต้องทั้งตอน verify, โต้แย้ง, แก้ผล · **ไม่มีแจ้งเตือนผลทาย** (ดูที่ E27)

---

# 11. Admin — กำกับดูแล (C2)

**ลำดับชั้นแอดมิน (มติ 22 ก.ย. 2569 · OD-34)** — 3 ชั้น `root` / `university_wide` / `faculty` แต่ละชั้นแต่งตั้งได้แค่ชั้นถัดลงมา
ห้ามแต่งตั้งชั้นเดียวกับตัวเอง (`root`→`university_wide`→`faculty`→จบ) · `root` มีคนเดียวในระบบเสมอ ไม่ทำงานประจำวันเลย
(แต่งตั้ง/ถอน `university_wide` + ดู `audit_logs`/`admin_scopes`/`oversight` เท่านั้น) · ดูเหตุผลเต็มที่ `GUIDE/13`

**ไฟล์:** `routes/adminScope.routes.ts` · `adminScope.controller.ts` · `adminScope.service.ts` · `adminScope.repo.ts` ·
`user.repo.ts` (`searchUsersAdmin`, `suspendUser`) · `userReport.repo.ts`/`userReport.mapper.ts` ·
`auditLog.repo.ts` · `middlewares/requireAdmin.ts` · `oversight.service.ts` · `oversight.repo.ts`

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| A01 | `GET /admin/oversight/stalled` | Auth + **root หรือ university_wide** (faculty → 403) | มีอะไรค้างจนต้องมีคนเข้ามาปลดล็อกไหม · **อ่านอย่างเดียว** | `—` | `{ thresholdHours, disputesPastDeadline, complaintsAwaitingAdmin, universityAdmins, needsAttention }` |
| A02 | `GET /admin/users` | `ADM` | ค้นหา/กรองผู้ใช้ · **`root` → 403** `ROOT_NO_DAILY_OPERATIONS` (ไม่ใช่งานของ root) · **แอดมินคณะถูกบังคับ `facultyId` เป็นคณะตัวเองเสมอ** ไม่ว่า query จะส่งอะไรมาก็ตาม (เขียนทับ ไม่ใช่แค่กรองเพิ่ม) · `university_wide` เห็นได้ตามที่ขอ (ไม่กรองเลยถ้าไม่ส่ง) · แต่ละแถวมี `adminScope` ติดมาถ้า user นั้นเป็นแอดมินอยู่แล้ว | `?q&facultyId&suspended&page&pageSize` | `{ items: [{id, fullName, email, userType, facultyId, isSuspended, suspendedReason, adminScope\|null}], pagination }` |
| A03 | `PATCH /admin/users/:id/suspend` | `ADM` | ระงับ/เลิกระงับ · **`root` → 403** · ระงับตัวเอง → **403** `CANNOT_SUSPEND_SELF` · แอดมินคณะแตะแอดมิน (ทุกชั้น รวมคณะเดียวกัน) ไม่ได้เลย → **403** `INSUFFICIENT_ADMIN_SCOPE` · แอดมินคณะแตะคนนอกคณะตัวเอง → **403** เดียวกัน · `reason`+`category` **บังคับทั้งคู่** ตอน `suspended:true` (ไม่ส่ง → **400** `SUSPEND_REASON_REQUIRED`/`SUSPEND_CATEGORY_REQUIRED`) · `days` 1–90 เลือกได้ ไม่ส่ง = ถาวร · ห้ามระงับคนมีทัวร์ `public`/ใบสมัคร `approved` ค้างอยู่ → **409** `USER_HAS_ACTIVE_OBLIGATIONS` · ห้ามระงับ `university_wide` คนสุดท้ายที่ใช้งานได้ → **409** `LAST_UNIVERSITY_ADMIN` · ระงับแอดมินคณะคนสุดท้ายของคณะนั้นได้ แต่ response มี `warning` เตือนมาด้วย | `{ suspended, reason?, days?, category? }` | **200** `AdminUserDto & { warning: string\|null }` |
| A04 | `GET /admin/scopes` | `ADM` | ดูรายชื่อแอดมินทั้งหมด · แอดมินคณะเห็นแค่คณะตัวเอง (บังคับ `facultyId` แบบเดียวกับ A02) · `root`/`university_wide` เห็นหมด — **`root` ไม่โดนบล็อกตรงนี้** เพราะดูรายชื่อแอดมินเป็นงานของ root โดยตรง (ต้องรู้ว่าใครเป็นแอดมินอยู่ก่อนจะแต่งตั้ง/ถอน) | `?facultyId&page&pageSize` | `{ items: [{id, user, scopeType, facultyId, createdAt}], pagination }` |
| A05 | `POST /admin/scopes` | `ADM` | แต่งตั้งแอดมิน · **ลำดับชั้นบังคับ**: `root`→`university_wide` เท่านั้น, `university_wide`→`faculty` เท่านั้น, `faculty`→แต่งตั้งใครไม่ได้เลย — ข้ามกฎข้อไหนก็ **403** `INSUFFICIENT_ADMIN_SCOPE` · `scopeType:'faculty'` ต้องมี `facultyId` (ไม่มี → **400**) · `scopeType:'university_wide'` ต้องไม่มี `facultyId` (มี → **400**) · `facultyId` ต้องมีจริง → **404** `FACULTY_NOT_FOUND` · มีสิทธิ์แอดมินอยู่แล้วแต่งตั้งซ้ำไม่ได้ → **409** `ADMIN_SCOPE_ALREADY_EXISTS` · **ไม่มีทางส่ง `scopeType:'root'` เข้ามาได้เลย** (schema ไม่รับเป็นตัวเลือก) — root ตั้งได้แค่ผ่าน seed/DB bootstrap | `{ userId, scopeType:'faculty'\|'university_wide', facultyId? }` | **201** `{ id, user, scopeType, facultyId, createdAt }` |
| A06 | `DELETE /admin/scopes/:id` | `ADM` | ถอนสิทธิ์แอดมิน · ลำดับชั้นเดียวกับ A05 กลับทิศ · **ถอน `root` ผ่าน API ไม่ได้เด็ดขาด ไม่ว่าใครขอ** → **403** `CANNOT_REVOKE_ROOT_SCOPE` (กู้คืนได้ทางเดียวคือแก้ฐานข้อมูลตรง) · ถอนสิทธิ์ของตัวเอง → **403** `CANNOT_REVOKE_OWN_SCOPE` · ถอน `university_wide` คนสุดท้าย → **409** `LAST_UNIVERSITY_ADMIN` | `—` | **200** `{ id }` |
| A07 | `GET /admin/audit-logs` | `ADM` (**`faculty` → 403** `INSUFFICIENT_ADMIN_SCOPE` จาก service — เหลือแค่ `root`/`university_wide`) | ดูประวัติการกระทำทั้งระบบ · `audit_logs` มีการเขียนมานานแล้ว (`tournament.repo.ts`, `walkover.repo.ts`, `matchResult.repo.ts`) แต่ไม่มี endpoint อ่านเลยก่อนหน้านี้ · join ชื่อผู้กระทำมาให้ | `?entityType&entityId&userId&actionType&page&pageSize` | `{ items: [{id, actor:{id,fullName}, actionType, entityType, entityId, details, createdAt}], pagination }` |
| A08 | `POST /users/:id/report` | `Auth` (**ไม่ใช่ `ADM`** — user ธรรมดายื่นได้) | แจ้งเรื่องขอระงับ user/แอดมินคนอื่น (เส้นทางคำร้องดู A09) · แจ้งตัวเอง → **400** `CANNOT_REPORT_SELF` · `reason` บังคับเสมอ `evidence` ไม่บังคับ · **1 ต.ค. · OD-44**: `evidence` ต้องเป็น key จาก **M16 purpose `report_evidence`** ของบัญชีตัวเอง — ทุก key ต้องขึ้นต้น `report_evidence/{userId ของผู้แจ้ง}/` ไม่งั้น **400** `VALIDATION_FAILED` (`fields.evidence`) · **เพดาน 5 ไฟล์** เกิน → 400 · key ยาวได้ ≤ 512 ตัวอักษร ห้ามสตริงว่าง · `evidence` ที่คืนมาเป็น **presigned URL** ไม่ใช่ key ดิบ | `{ reason, evidence? : string[] }` | **201** `userReportDto` (ดูรูปร่างที่ A09) |
| A09 | `GET /admin/user-reports` | `ADM` (**`root` → 403**) | ดูคิวคำร้องที่มีคนแจ้งเข้ามา · **routing อัตโนมัติ ไม่ต้องเลือกเอง**: เป้าหมายเป็น user ธรรมดา → แอดมินคณะที่ `target.facultyId` ตรงกับแอดมินเห็น (+ `university_wide` เห็นทุกคำร้องอยู่แล้ว) · เป้าหมายเป็นแอดมิน (ทุกชั้น) → แอดมินคณะไม่เห็นเลย เห็นแค่ `university_wide` (เพราะแตะแอดมินไม่ได้อยู่แล้ว) · `evidence` เป็น **presigned URL เสมอ** ไม่ใช่ S3 key ดิบ (แก้ 1 ต.ค. — เดิมหลุดเป็น key ดิบ) | `?page&pageSize` | `{ items: [{id, reporter, target:{...,isAdmin}, reason, evidence:string[], status, createdAt, reviewedBy, reviewedByName, reviewedAt, rejectionReason}], pagination }` |
| A10 | `POST /admin/user-reports/:id/approve` | `ADM` (**`root` → 403**) | **★ อนุมัติ = ระงับบัญชีทันที ไม่ใช่แค่ "รับเรื่อง"** — เรียกกลไกเดียวกับ A03 เป๊ะ (`performSuspend`) เช็คกฎเดียวกันหมด (ภาระค้าง/`LAST_UNIVERSITY_ADMIN`/แอดมินคณะแตะแอดมินไม่ได้) · แอดมินที่ถูกแจ้งอนุมัติคำร้องเรื่องตัวเองไม่ได้ → **403** `CANNOT_REVIEW_OWN_REPORT` · คำร้องถูกพิจารณาไปแล้ว → **409** `ALREADY_DECIDED` · **ไม่หยิบ `reason` ที่ผู้แจ้งพิมพ์มาเป็น `category` อัตโนมัติ** — คำของผู้แจ้งไม่ใช่คำวินิจฉัยของแอดมิน ต้องเลือก `category` เอง | `{ days?, category? }` (ไม่ใส่ `category` = **400** `SUSPEND_CATEGORY_REQUIRED` เหมือน A03) | **200** `AdminUserDto & { warning: string\|null }` |
| A11 | `POST /admin/user-reports/:id/reject` | `ADM` (**`root` → 403**) | ปฏิเสธคำร้อง (ไม่ระงับใคร) · เช็คสิทธิ์แบบเดียวกับ A10 (แตะคนนอกคณะ/แอดมินคนอื่นไม่ได้, พิจารณาคำร้องเรื่องตัวเองไม่ได้) แต่ไม่เรียก `performSuspend` | `{ reason }` | **200** `{ id, status:'rejected', reason }` |

> ⚠️ **A08 `evidence` — ช่องอัปโหลดยังไม่มีจริง** เช็คแล้วว่า `presignUploadSchema` (`upload.schema.ts`) ยังไม่มี `purpose`
> สำหรับหลักฐานแจ้งผู้ใช้เลย (มีแค่ `checkin_document`/`soft_filter_document`/`referee_identity`/`dispute_evidence`/`avatar`/`team_logo`)
> ⇒ **ตอนนี้ไม่มีทางขอ presigned upload URL เพื่อส่ง `evidence` ได้จริงในทางปฏิบัติ** ฝั่งอ่าน (A09, presign download) แก้แล้ว
> แต่ฝั่งเขียน (ขอ URL อัปโหลด) ยังไม่มีคนทำ — ต้องเพิ่ม purpose ใหม่ก่อนฟีเจอร์นี้ใช้ได้ครบวงจรจริง (ยังไม่อยู่ในสโคป B1-B4 รอบนี้)

> **คืนแค่ตัวเลขกับ id โดยเจตนา** — ไม่มีเหตุผลของข้อโต้แย้ง ไม่มีหลักฐาน ไม่มีชื่อคู่กรณี (OD-34)
> root เป็นคนตรวจไม่ใช่คนตัดสิน · ต้องรู้แค่ว่า "มีของค้าง เท่าไร ที่ไหน" พอให้ตัดสินใจว่าต้องแต่งตั้ง
> University Admin คนใหม่ไหม · ใครจะ **กด** ต้องผ่าน `requireAdmin_U` / `requireCanResolveDispute` ตามเดิม
> ซึ่ง **root ไม่ผ่านทั้งคู่** — เป็นด่านคนละตัวกัน ไม่ใช่ความซ้ำซ้อน (A01 เท่านั้นที่ย่อหน้านี้อธิบาย)

```jsonc
{
  "thresholdHours": 48,                                        // = ORG_RESOLVE_HOURS
  "disputesPastDeadline":    { "count": 3, "matchIds": [88, 91, 102] },
  "complaintsAwaitingAdmin": { "count": 1, "complaintIds": [7] },
  "universityAdmins":        { "total": 2, "active": 0 },
  "needsAttention": true                                       // มีของค้าง + ไม่มีแอดมินที่ใช้งานได้เลย
}
```

> **คืนแค่ตัวเลขกับ id โดยเจตนา** — ไม่มีเหตุผลของข้อโต้แย้ง ไม่มีหลักฐาน ไม่มีชื่อคู่กรณี (OD-34)
> root เป็นคนตรวจไม่ใช่คนตัดสิน · ต้องรู้แค่ว่า "มีของค้าง เท่าไร ที่ไหน" พอให้ตัดสินใจว่าต้องแต่งตั้ง
> University Admin คนใหม่ไหม · ใครจะ **กด** ต้องผ่าน `requireAdmin_U` / `requireCanResolveDispute` ตามเดิม
> ซึ่ง **root ไม่ผ่านทั้งคู่** — เป็นด่านคนละตัวกัน ไม่ใช่ความซ้ำซ้อน

> **`needsAttention` คืออะไร** — `LAST_UNIVERSITY_ADMIN` รับประกันว่า *มี* แอดมินมหาวิทยาลัยเหลือ
> แต่ไม่ได้รับประกันว่าคนนั้น *ใช้งานได้* · `active: 0` ทั้งที่มีของค้าง = ไม่มีใครกดได้เลย
> **ทางแก้คือ root แต่งตั้งคนใหม่ ไม่ใช่ root กดแทน** · และต้องตั้งคนใหม่ *ก่อน* ถอนคนเดิม
> เพราะ `LAST_UNIVERSITY_ADMIN` ไม่ยกเว้น root

---

## 10.5 ตั้งค่าแจ้งเตือนรายหมวด (C1 · OD-43) — 2 endpoint

**ไฟล์:** `routes/notification.routes.ts` · `notification.controller.ts` · `notification.service.ts` · `config/notificationCategories.ts`

> กล่องจดหมายเอง (`GET /me/notifications`, `PATCH /me/notifications/:id/read`, `POST /me/notifications/read-all`)
> **ยังไม่เคยถูกบันทึกในไฟล์นี้** — ช่องว่างเดิม ไม่ได้เกิดจาก OD-43 · สัญญาของสามตัวนั้นอยู่ที่ `API_Design` E04–E06

| รหัส | Method + Path | Auth | ทำอะไร | รับ | คืน |
|---|---|---|---|---|---|
| E37 | `GET /me/notification-prefs` | Auth | หมวดแจ้งเตือนทั้งหมดของตัวเอง · คืน **ทุกหมวดรวม `critical`** พร้อมธง `locked` — FE ไม่ต้อง hardcode รายชื่อหมวด เพิ่มหมวดใหม่แล้วหน้าตั้งค่าโผล่เอง | `—` | **200** `{ categories: [{ key, enabled, locked }] }` |
| E38 | `PATCH /me/notification-prefs` | Auth | เปิด/ปิดหมวด · ส่งเฉพาะหมวดที่เปลี่ยน ที่ไม่ส่งมาคงค่าเดิม | `{ team?, tournament?, match?, referee?, result?, community? }` ทุกตัวเป็น boolean | **200** รูปเดียวกับ E37 / **400** `VALIDATION_ERROR` |

> **หมวดมี 7 — ปิดได้ 6** · `critical` ปิดไม่ได้ เกณฑ์คือ **"มีเส้นตายที่วัดได้ ไม่รู้แล้วเสียสิทธิ์ถาวร"**
> (`team_invitations.expires_at` · `dispute_window_hours` 6–72 ชม. · `ORG_RESOLVE_HOURS` 48 ชม. · `AUTO_VERIFY_HOURS` · ช่วงรับสมัคร · เวลาแข่ง · หน้าต่างเช็คอิน)
> รายชื่อ **20 ชนิด**ที่บังคับและเหตุผลรายตัวอยู่ใน `config/notificationCategories.ts` · มติทั้งหมดอยู่ใน OD-43

> **เติมหมวดครบแล้ว 3 ต.ค. (OD-49)** — ชนิดที่เกิดขึ้นระหว่างที่งานนี้ยังอยู่บนสาขาอื่นจึงตกจากตาราง
> `team_deleted` → **`critical`** (ทีมถูกกวาดอัตโนมัติโดยไม่มีใครกด ถ้าปิดได้ทีมจะหายเงียบ 100% · เส้นตายคือช่วงรับสมัครของทัวร์ที่ใบสมัครค้างอยู่)
> `comment_rewritten_after_removal` → `community`

> ### 🔴 ประกาศของผู้จัด (E08) ยิงเป็น **สองชนิด** ไม่ใช่ชนิดเดียว — FE ที่เลือกไอคอนจาก `type` ต้องรู้
>
> | `announcement_type` ที่ผู้จัดเลือก | ชนิดแจ้งเตือนที่ยิง | หมวด |
> |---|---|---|
> | `schedule_change` · `venue_change` | `tournament_announcement_urgent` | **`critical`** ปิดไม่ได้ |
> | `general` · `result` · `livestream` | `tournament_announcement` | `tournament` ปิดได้ |
>
> **ปิดหมวด `tournament` แล้วข่าวเลื่อนเวลา/เปลี่ยนสนามยังมาถึง** — นี่คือเหตุผลทั้งหมดของการแยก
> ครอบกรรมการด้วย เพราะกรรมการได้ประกาศก้อนเดียวกับผู้เล่นแต่เข้าทางหมวด `tournament` ไม่ใช่ `referee`
> ⇒ ถ้าไม่แยก กรรมการที่ปิด `tournament` จะพลาดสนามที่ย้ายของแมตช์ที่ตัวเองต้องไปตัดสิน
>
> ⚠️ **ประกาศที่ยิงก่อน 3 ต.ค. เก็บเป็น `tournament_announcement` ทั้งหมด รวมของที่เลื่อนเวลา**
> (ตั้งใจไม่ backfill — ดู OD-49) ⇒ ของเก่ากลุ่มนั้นปิดได้ย้อนหลัง

> **E38 ส่ง `critical` หรือชื่อหมวดที่ไม่รู้จักมา → 400** ไม่ปล่อยผ่านเงียบ ๆ (คนที่กดปิดแล้วยังได้รับอยู่จะคิดว่าระบบพัง)
> · object ว่างก็ 400 · ค่าที่ไม่ใช่ boolean ก็ 400

> **ผลต่อ `GET /me/notifications` (OD-43)** — หมวดที่ปิดไว้ **ไม่โผล่ในกล่องและไม่ถูกนับใน `unreadCount`**
> แต่ **แถวยังอยู่ในฐานครบ** (สเปค 08 §3 ห้ามลบ history) · `?includeMuted=true` เปิดดูย้อนหลังได้
> ★ `unreadCount` ใช้ลิสต์ที่ปิดไว้ **เสมอ ไม่ขึ้นกับ `includeMuted`** — กระดิ่งคือ "ของที่คุณสนใจและยังไม่อ่าน" ไม่ใช่เลขที่กระพริบตาม query
> ★ กรอง **ตอนอ่าน** ไม่ใช่ตอนเขียน → เปลี่ยนค่าแล้วมีผลย้อนหลังกับของเก่าในกล่องด้วย และเปิดกลับแล้วของเก่ากลับมาครบ

---

# ภาคผนวก — Error code ที่ใช้ได้ทุก endpoint

| code | HTTP | message ไทย | โยนจากไหน |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่ | `validate` middleware (มากับ `fields` เสมอ) |
| `NO_TOKEN` | 401 | กรุณาเข้าสู่ระบบก่อนใช้งาน | `requireAuth` |
| `TOKEN_EXPIRED` | 401 | เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ | `requireAuth` |
| `ACCOUNT_SUSPENDED` | 403 | บัญชีนี้ถูกระงับการใช้งาน**เนื่องจาก<ประเภท>** กรุณาติดต่อผู้ดูแลระบบ | `requireAuth` · A02 — `extra` = `{ suspendedUntil , suspendedCategory , suspendedCategoryLabel }` · `null` ทั้งสาม = ถาวร + ไม่ระบุประเภท (แถวก่อน migration 034) |
| `NOT_TEAM_LEADER` | 403 | คุณไม่ใช่หัวหน้าทีมนี้ | `requireTeamLeader` |
| `NOT_ORGANIZER` | 403 | คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้ | `requireOrganizer` |
| `NOT_REFEREE` | 403 | คุณไม่ได้เป็นกรรมการของแมตช์นี้ | `requireReferee` |
| `INSUFFICIENT_ADMIN_SCOPE` | 403 | สิทธิ์ผู้ดูแลระบบของคุณไม่ครอบคลุมขอบเขตนี้ | `requireAdmin` |
| `INVALID_OTP` | 400 | รหัสยืนยันไม่ถูกต้องหรือหมดอายุ กรุณากดขอรหัสใหม่ | AV01 — **ก้อนเดียวสำหรับ 5 เคส** (ไม่มีอีเมล/เลขผิด/หมดอายุ/ใช้แล้ว/กรอกผิดครบ 5 ครั้ง) · ข้อความบอกวิธีแก้ไว้แล้ว FE ไม่ต้องแยก code |
| `PICK_SCORE_TIE` | 422 | ทายผลเสมอไม่ได้ — ต้องมีฝ่ายที่คะแนนมากกว่า | E26 · OD-56 |
| `OVERRIDE_ONSITE_NOT_ALLOWED` | 409 | โหมด on-site กรรมการเป็นผู้ส่งผลเองอยู่แล้ว ถ้าผลยังไม่ถูกยืนยันให้ส่งผลใหม่ทับได้เลย | S02b · `extra` = `{ mode }` |
| `RESULT_NOT_OVERRIDABLE` | 409 | แก้ผลทับได้เฉพาะผลที่ยังรอการยืนยัน — ผลที่ยืนยันแล้วต้องใช้การโต้แย้ง (S03) | S02b · `extra` = `{ status }` |
| `USER_NOT_FOUND` | 404 | ไม่พบผู้ใช้นี้ในระบบ | service |
| `TEAM_NOT_FOUND` | 404 | ไม่พบทีมนี้ | service |
| `TOURNAMENT_NOT_FOUND` | 404 | ไม่พบทัวร์นาเมนต์นี้ | service |
| `MATCH_NOT_FOUND` | 404 | ไม่พบแมตช์นี้ | service |
| `APPLICATION_NOT_FOUND` | 404 | ไม่พบใบสมัครนี้ | service |
| `INVITATION_NOT_FOUND` | 404 | ไม่พบคำเชิญนี้ | service |
| `CHECKIN_NOT_FOUND` | 404 | ไม่พบรายการเช็คอินนี้ | service (M14, M15) |
| `APPLICATION_ACCESS_DENIED` | 403 | คุณไม่มีสิทธิ์ดูใบสมัครนี้ | service (P04) |
| `NOT_ORGANIZER_OR_REFEREE` | 403 | M11: คุณไม่มีสิทธิ์ขอ QR เช็คอินของแมตช์นี้ · M13: คุณไม่มีสิทธิ์ดูรายการเช็คอินนี้ | service (M11, M13) — auth แบบ "ORG หรือ REF คนใดคนหนึ่งก็ได้" ไม่มี middleware สำเร็จรูปสำหรับ route ที่ระบุ matchId |
| `CANNOT_FOLLOW_SELF` | 409 | ไม่สามารถติดตามหรือเลิกติดตามตัวเองได้ | service (U07/U08) |
| `APPLICATION_NOT_APPROVED` | 409 | ใบสมัครนี้ยังไม่ได้รับการอนุมัติ จึงไม่สามารถถอนตัวได้ | service (P08) |
| `CHECKIN_NOT_OPEN` | 409 | ต้องเปิดเช็คอินก่อนถึงจะเริ่มแข่งได้ | service (M10) — ตั้งตาม pattern `VOTING_NOT_OPEN` (E20) · เดิมชื่อ `MATCH_NOT_CHECKIN_OPEN` |
| `BRACKET_ALREADY_EXISTS` | 409 | ทัวร์นาเมนต์นี้สร้างสายการแข่งขันไปแล้ว | service (M01) — คู่กับ `BRACKET_ALREADY_STARTED` (M03) |
| `MANUAL_SEEDS_MISMATCH` | 422 | manualSeeds ต้องมีทีมครบทุกทีมที่ได้รับอนุมัติ ไม่ซ้ำและไม่ขาด | service (M01) — คู่กับ `TEAM_COUNT_MISMATCH` |
| `TEAM_COUNT_MISMATCH` | 422 | ทีมที่อนุมัติแล้วไม่ถึงขั้นต่ำของรูปแบบสาย — extra `{bracketFormat, required, approved}` | service (M01) — `required` = `max(4, min_teams)` สำหรับ `double_elimination` · `max(2, min_teams)` รูปแบบอื่น (OD-33) |
| `BRACKET_FORMAT_NOT_SET` | 422 | ทัวร์นาเมนต์นี้ยังไม่ได้ตั้งรูปแบบการแข่งขัน กรุณาตั้งรูปแบบการแข่งขันก่อนสร้างสาย | service (M01) — `bracket_format` เป็น NULL · เดิมชื่อ `BRACKET_FORMAT_NOT_SUPPORTED` 400 (ชื่อเดิมไม่บอกสาเหตุจริงแล้ว เพราะรองรับครบ 3 รูปแบบ) |
| `SOFT_FILTER_DOCUMENT_INVALID` | 422 | key ของเอกสารไม่ได้เป็นของ user/tournament นี้ หรือชนิดไฟล์ที่เก็บไม่ใช่ JPEG/PNG | service (P01) |
| `SOFT_FILTER_DOCUMENT_NOT_FOUND` | 422 | key ถูกต้องแต่ object ยังไม่มีใน storage (เช่น upload ไม่สำเร็จ/หมด flow) | service (P01) |
| `STORAGE_UNAVAILABLE` | 503 | storage ตรวจสอบ object ไม่ได้ชั่วคราว | upload/application service |
| `APPLICATION_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ปฏิเสธใบสมัคร | `validate(schema, rejectApplicationErrorCodes)` (P06) มากับ `fields` |
| `CHECKIN_REJECT_REASON_REQUIRED` | 400 | กรุณาระบุเหตุผลที่ปฏิเสธการยืนยันตัวตน | `validate(schema, rejectCheckinErrorCodes)` (M15) มากับ `fields` |
| `CHECKIN_METHOD_MISMATCH` | 400 | M12: วิธีเช็คอินไม่ตรงโหมดแมตช์ (onsite→qr_onsite · online→photo_online) — extra `{mode, expectedMethod}` |
| `BRACKET_IN_USE` | 409 | M01 replace: สายเดิมมีแมตช์ที่เริ่ม/เช็คอิน/มีผลแล้ว จับฉลากใหม่ไม่ได้ — extra `{matches}` |
| `TOURNAMENT_COMPLETED` | 409 | ทัวร์ปิดแล้ว (C14b) — write ใต้ /tournaments/:id, /matches/:id, P08 ทำไม่ได้อีก · extra `{tournamentId, completedAt}` |
| `MATCHES_UNFINISHED` | 409 | C14b: ยังมีแมตช์ไม่จบ — extra `{matches:[{id,status}]}` |
| `NO_MATCHES` | 409 | C14b: ยังไม่สร้างสาย ปิดไม่ได้ |
| `ALREADY_REJECTED` | 409 | M14/M15: รายการนี้ถูกปฏิเสธไปแล้ว — ให้ผู้เล่นเช็คอินใหม่ (M12) หรือกรรมการกดให้ (M19) |
| `ALREADY_DECIDED` | 409 | M14: รายการนี้ผ่านไปแล้ว (success/exception) ยืนยันซ้ำไม่ได้ — ถอนได้ทาง M15 |
| `FEEDBACK_NOT_REMOVABLE_BY_ORGANIZER` | 403 | E17c: ผู้จัดลบได้เฉพาะ "ความเห็นต่อทัวร์" — รีวิวจากผู้ลงแข่ง/โหวต MVP ลบไม่ได้ (เป็นการประเมินตัวผู้จัดเอง) |
| `FEEDBACK_NOT_REMOVED` | 409 | E17b: กด restore ทั้งที่ความเห็นนี้ไม่ได้ถูกลบอยู่ |
| `MVP_VOTING_NOT_OPEN` | 409 | E20: แมตช์ยังไม่จบ (`actual_end_time` ยังว่าง) ยังโหวตไม่ได้ |
| `MVP_VOTING_CLOSED` | 409 | E20: พ้น 24 ชม. หลังแมตช์จบ — extra `{closesAt}` |
| `MVP_NOT_AVAILABLE` | 409 | E20: แมตช์ตัดสินโดยไม่มีการแข่งจริง (ชนะบาย/ปรับแพ้) จึงไม่มีการโหวต |
| `TOURNAMENT_NOT_PUBLIC` | 409 | E20: ทัวร์ไม่ได้เปิดเผยแพร่ (private / ถูกลบ) — ใช้ร่วมกับความเห็นต่อทัวร์และ Pick'em |
| `MVP_VOTER_NOT_ELIGIBLE` | 403 | E20: ผู้โหวตเป็นสมาชิกของทีมใดทีมหนึ่งในแมตช์นั้น (กันทั้งทีม ไม่ใช่แค่คนที่ลงสนาม) |
| `MVP_CANDIDATE_NOT_ELIGIBLE` | 422 | E20: คนที่โหวตให้ไม่ได้เช็คอินสำเร็จในแมตช์นี้ |
| `PREDECESSOR_DISPUTED` | 409 | M09: แมตช์ต้นทางยังมีข้อโต้แย้งที่ยังไม่ตัดสิน เปิดเช็คอินแมตช์ถัดไปไม่ได้ (`extra.blockedBy`) |
| `MATCH_NOT_FINISHED` | 409 | S01: ยังไม่กดจบการแข่งขัน ส่งผลไม่ได้ (`extra.status`) |
| `MATCH_NOT_IN_PROGRESS` | 409 | M10b: กดจบได้เฉพาะแมตช์ที่กำลังแข่งอยู่ (`extra.status`) |
| `CHECKIN_NOT_EMPTY` | 409 | M18: กรรมการปิดเช็คอินไม่ได้เพราะมีผู้เล่นเช็คอินแล้ว (`extra.checkins`) — ปิดจะลบทั้งหมด ต้องให้ ORG กด |
| `SCHEDULE_INCOMPLETE` | 409 | M09/M10: แมตช์ยังไม่มีเวลาแข่งหรือสนาม เปิดเช็คอิน/เริ่มแข่งไม่ได้ (`extra.missing[]`) — ตั้งด้วย M06 ก่อน · **400** ที่ M06 คือเคสส่ง payload ไม่ครบ คนละเรื่อง |
| `NOT_MATCH_PARTICIPANT` | 403 | M10b: ไม่ใช่กรรมการของแมตช์นี้และไม่ใช่ผู้จัด |
| `ESCALATION_NOT_OPEN` | 409 | S06b: ยังไม่ถึง 24 ชม.หลังแมตช์จบ ผู้จัดยังตัดสินเองไม่ได้ (`extra.availableAt`) |
| `MATCH_RESULT_EXISTS` | 409 | S06b: แมตช์นี้มีผลอยู่แล้ว ให้ใช้การยืนยัน/โต้แย้งแทน |
| `FORFEIT_NOT_ALLOWED_ONSITE` | 409 | S06b: แมตช์หน้างานปรับแพ้ทั้งคู่ไม่ได้ ต้องบันทึกผลตามที่แข่งจริง |
| `ORGANIZER_STILL_HAS_TIME` | 403 | S04: แอดมินกดเร็วไป ผู้จัดยังมีเวลาตัดสินถึง `extra.availableAt` · 🆕 4 ต.ค. (OD-58) ก่อนถึงเวลานี้ S03b ตอบ **403** และ S05 ของผลที่ยังไม่ final ตอบ **404** ให้แอดมินเหมือนคนนอก — ด่านอ่านกับด่านกดใช้เส้นเวลาเดียวกัน (`utils/disputeTakeover.ts`) |
| `USE_DISPUTE_INSTEAD` | 409 | S13: ยังอยู่ในเวลาโต้แย้งตามปกติ ให้ใช้ S03 ไม่ใช่การร้องเรียน |
| `RESULT_NOT_FINAL` | 409 | S13: ร้องเรียนได้เฉพาะผลที่ยืนยันแล้ว/ผลบาย (`extra.status`) |
| `NOT_COMPLAINT_PARTY` | 403 | S13/S13b/S13c: ไม่ใช่คู่กรณี ผู้จัด หรือแอดมินของเรื่องนี้ |
| `COMPLAINT_NOT_FOUND` | 404 | S13c–S13e: ไม่พบเรื่องร้องเรียนนี้ |
| `COMPLAINT_ALREADY_DECIDED` | 409 | S13/S13d/S13e: เรื่องนี้ได้ข้อยุติแล้ว แก้/แนบ/ตัดสินซ้ำไม่ได้ (`extra.status`) |
| `RESULT_NOT_CHANGEABLE` | 409 | S13e: แก้ผลจริงไม่ได้อีกแล้ว ตัดสินได้แต่ต้องเลือก `record_only` (`extra.blockedBy` = `NEXT_MATCH_STARTED` \| `TOURNAMENT_COMPLETED` \| `RESULT_NOT_AMENDABLE`) |

> **code เฉพาะต่อ field:** `validate(schema, { field: { code, message } })` — ถ้า field นั้นไม่ผ่านจะตอบ code ที่ระบุแทน `VALIDATION_FAILED` (ยังมี `fields` ครบ)
> ไม่ส่งอาร์กิวเมนต์ที่ 2 = ทำงานเหมือนเดิมทุกอย่าง · endpoint อื่นที่ Part 4 มี `*_REASON_REQUIRED` (U10, T18, C05, S03, S08) ใช้วิธีเดียวกันได้
| ~~`RATE_LIMITED`~~ | ~~429~~ | — | 🔴 **ไม่มี endpoint ไหนโยน code นี้แล้วตั้งแต่ 4 ต.ค.** · A04 เลิกโยน (OD-54) · AV02 เลิกโยน (OD-57) · ไม่มี middleware `rateLimit` อยู่จริงใน `src/middlewares/` (เอกสารเคยระบุไว้ผิด) · **การกัน rate limit ยังทำงานอยู่ทั้งสองที่ แค่ไม่ประกาศ** ⇒ ถ้า FE ยัง handle code นี้อยู่ ลบออกได้ |
| `INTERNAL_ERROR` | 500 | เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง | `errorHandler` (**ห้ามใส่ stack trace**) |

**กฎตั้งชื่อ code ใหม่** (Part 4 §13):
1. บอก**สาเหตุ** ไม่ใช่ผลลัพธ์ — `TEAM_QUOTA_EXCEEDED` ✅ / `CANNOT_CREATE_TEAM` ❌
2. ค้นตารางเดิมก่อนตั้งใหม่เสมอ
3. ระบุ resource ถ้ากำกวม — `INVITATION_EXPIRED` ✅ / `EXPIRED` ❌
4. `message` ต้องบอกวิธีแก้เมื่อทำได้

**Pattern ที่ใช้ซ้ำ:** `*_NOT_FOUND` (404) · `*_REASON_REQUIRED` (400) · `*_ALREADY_*` (409) · `*_CLOSED`/`*_LOCKED` (409) · `NOT_*` (403)

---

# ภาคผนวก — Rate Limiting (Part 0-1 §1.16)

| endpoint | ขีดจำกัด |
|---|---|
| `POST /auth/login` | 10 ครั้ง / 15 นาที ต่อ IP |
| `POST /auth/register` | 5 ครั้ง / ชั่วโมง ต่อ IP |
| `POST /auth/forgot-password` | 3 ครั้ง / ชั่วโมง ต่ออีเมล |

> **ความเห็นต่อทัวร์ (E13) ไม่มี rate limit** — OD-24 (22 ก.ย.) กำหนดให้เขียนได้คนละ 1 อันต่อทัวร์ ส่งซ้ำคือแก้ของเดิม ไม่เพิ่มแถว จึงถล่มรายการไม่ได้อยู่แล้ว (เดิมกำหนดไว้ 10 ครั้ง/นาที ตอนที่ออกแบบให้โพสต์ได้หลายอัน)

# ภาคผนวก — Endpoint ที่ต้อง Idempotent (Part 0-1 §1.11)

| endpoint | ตัวป้องกัน | กดซ้ำต้องได้ |
|---|---|---|
| `POST /matches/:id/checkins` | `UNIQUE (match_id, user_id)` | **200 พร้อมข้อมูลเดิม ไม่ใช่ 409** |
| `POST /matches/:id/result` | `match_results.match_id` UNIQUE | UPDATE แถวเดิม |
| `POST /tournaments/:id/applications` | `UNIQUE (tournament_id, team_id)` | 409 `ALREADY_APPLIED` (อันนี้ error ได้) |

---

ต่อไป → [[07 - จุดที่ต้องยืนยันกับทีม]]
