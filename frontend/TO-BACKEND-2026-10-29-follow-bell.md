# ถึง BE — สิ่งที่ FE รอสำหรับกระดิ่งติดตามนักกีฬา

วันที่: 29 ต.ค. 2569 · branch: `ui-polish-s34` · ตรวจ checkout ที่ `8cf826a`
อ้างอิงงาน `TASK-FE-2026-10-29-follow-bell.md` / `TASK-BE-2026-10-29-follower-notifications.md`

**FE ทำส่วนหลักแล้ว แต่ยังเปิดกระดิ่งในโหมดจริงไม่ได้ จนกว่า BE จะส่ง route และฟิลด์ด้านล่าง**
จาก checkout นี้ `backend/src/routes/users.routes.ts` ยังมีเฉพาะ POST/DELETE follow;
service, repository และ mapper ยังไม่ส่ง `notifyEnabled` และไม่พบชนิดแจ้งเตือนผู้ติดตามใหม่ใน source/migrations ที่ตรวจ
หากทำไว้แล้วใน branch อื่น ขอ commit/branch ที่รวมเข้า `ui-polish-s34` และวิธี migrate เพื่อทดสอบร่วมกัน
การตรวจรอบนี้อ่านไฟล์ BE เท่านั้น ไม่มีการแก้ backend หรือฐานข้อมูล

## 1. ต้องส่งพร้อมกัน: PATCH กระดิ่งและฟิลด์อ่านสถานะ

ทุก path ด้านล่างอยู่ใต้ `/api/v1`

```http
PATCH /users/42/follow
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "notifyEnabled": true }
```

```json
{ "userId": 42, "isFollowing": true, "notifyEnabled": true }
```

- รับ `true` และ `false` เป็น boolean เพื่อเปิด/ปิดกระดิ่งของผู้ที่ล็อกอินต่อผู้เล่นเป้าหมาย
- `userId` ใน response เป็น number ของผู้เล่นเป้าหมาย; FE ตรวจว่าเป็นคนเดียวกับคำขอ
- ยังไม่ติดตาม → `404 NOT_FOLLOWING`; PATCH ต้องไม่สร้าง follow ให้เอง
- เป้าหมายเป็นตัวเอง → `409 CANNOT_FOLLOW_SELF`
- ใช้ error envelope เดิม `{ "error": { "code": "...", "message": "..." } }`
- บันทึก preference ให้โหลดกลับมาได้หลัง refresh และยังคงฟิลด์เดิมของ API ที่มีอยู่

| เส้นเดิม | ฟิลด์ที่ขอเพิ่มตาม handoff |
| --- | --- |
| `GET /me/following` | `notifyEnabled: boolean` ในแต่ละ item |
| `GET /users/:id/following` | `notifyEnabled: boolean` ในแต่ละ item |
| `GET /users/:id` | `notifyEnabled: boolean` ข้าง `isFollowing`; เป็น false เมื่อ guest/ยังไม่ติดตาม |
| `POST /users/:id/follow` | การติดตามใหม่คืน `notifyEnabled: false` เพื่อให้ FE วาดกระดิ่งได้ทันที |

ค่าเริ่มต้นของ follow ใหม่และ follow เก่าก่อน migration ต้องเป็น **ปิด** ตามมติ opt-in
เลิกติดตามแล้วติดตามใหม่ให้เริ่มปิดเช่นกัน ไม่ใช้ `null` หรือ string แทน boolean

**เหตุผลที่ต้องส่ง route กับฟิลด์พร้อมกัน:** FE ใช้ boolean จาก `/me/following` หรือ POST follow เป็นหลักฐานว่า backend รองรับกระดิ่ง
ถ้าฟิลด์ยังขาด ปุ่มจะแสดง `Notifications unavailable` และไม่ยิง PATCH ไปยังเส้นที่ยังไม่ส่งมอบ
เมื่อ BE ส่งครบและโหลดข้อมูล Following ใหม่ จะใช้เส้นจริงได้โดยไม่เปลี่ยนสวิตช์ frontend

## 2. แจ้งเตือนตามเหตุการณ์และหมวดเดิม

ตาม handoff ขอให้ยืนยันผลทดสอบ BE สำหรับ:

- `followed_player_match_started`: ส่งเมื่อเริ่มแข่งจริง
- `followed_player_result_verified`: ส่งเมื่อยืนยันผล ทั้งด้วยมือและอัตโนมัติ
- ผู้รับต้องเปิดกระดิ่งของผู้เล่น และเปิดหมวด `community`; ปิดหมวดแล้วไม่ส่งแม้กระดิ่งเปิด
- นัดเวลา/เปลี่ยนเวลา/ย้ายสนามและแพ้บายที่ไม่ได้แข่งจริงไม่ทำให้ส่งแจ้งเตือนผู้ติดตาม
- ติดตามหลายคนในแมตช์เดียวได้แจ้งเตือนฉบับเดียวต่อเหตุการณ์
- ผู้รับที่มีแจ้งเตือนในฐานะผู้เล่นอยู่แล้วไม่รับฉบับผู้ติดตามซ้ำ

เพื่อให้ Inbox เดิมแสดงและกดไปหน้าแมตช์ได้ ขอให้ใช้ `title`/`message` และ
`relatedEntityType: "match"`, `relatedEntityId` เป็น number ของแมตช์
FE อ่านฟิลด์เหล่านี้อยู่แล้ว จึงไม่ต้องเพิ่มหน้าแจ้งเตือนหรือหมวดตั้งค่าใหม่

## 3. ฝั่ง FE พร้อมส่วนใดแล้ว

- ใช้ปุ่มชุดเดียวกันบนโปรไฟล์นักกีฬาทั้ง real/mock; ซ่อนสำหรับ guest และเจ้าของโปรไฟล์
- เลือกทางซ่อนกระดิ่งก่อนติดตาม; ติดตามสำเร็จแล้วอธิบายว่าต้องกดกระดิ่งเพิ่ม
- มีสถานะ On/Off, ป้องกันกดซ้ำ และเปลี่ยนสถานะหลัง server ยืนยันสำเร็จเท่านั้น
- บันทึกไม่สำเร็จยังคงสถานะเดิมและกดใหม่ได้; `NOT_FOLLOWING` จะล้างความสัมพันธ์ค้างและโหลดรายการใหม่
- เตือนว่าหมวด Community ใน notification settings ต้องเปิดด้วย โดยไม่แก้ preference หมวดให้ผู้ใช้เอง
- Mock จดจำกระดิ่ง, แยกตามผู้ใช้, และเริ่มปิดเมื่อติดตามใหม่
- กระดิ่งในรายการ Following ของหน้า account เป็นงานตัวเลือก ยังไม่รวมในรอบนี้

## 4. ขอหลักฐานส่งมอบเพื่อทดสอบต่อ

- Commit/branch และ migration ที่ต้องใช้ รวมถึงผล migrate ของฐานทดสอบ
- ตัวอย่าง response ของ GET following, POST follow และ PATCH เปิด/ปิดกระดิ่ง
- บัญชี/ผู้เล่น/แมตช์เดโมสำหรับทดสอบเหตุการณ์เริ่มแข่งและยืนยันผล
- ผลทดสอบกรณี Community ปิด, หลายผู้เล่นในแมตช์เดียว, ผู้รับเป็นผู้เล่นอยู่แล้ว และยืนยันผลอัตโนมัติ

เมื่อได้ชุดนี้ FE จะทดสอบ flow จริง: follow → กระดิ่งปิด → เปิด → refresh แล้วยังเปิด → ปิด → ตรวจแจ้งเตือนและลิงก์ Inbox
ปัจจุบันยืนยันเฉพาะ frontend/mock/contract tests ยังไม่อ้างผล end-to-end ของฟีเจอร์นี้

## หลักฐาน FE

- ชุดทดสอบทั้ง frontend: **155 ไฟล์ / 1,163 tests ผ่าน**
- TypeScript, lint, production build และ `git diff --check` ผ่าน
- [รายงาน QA](docs/QA-FOLLOW-BELL-2026-10-29.md)
- [แผนและขอบเขตงาน](docs/superpowers/plans/2026-10-29-follow-bell.md)
- Contract tests: `src/api/engagement.contract.test.ts`
- Flow tests: `src/features/player/PlayerFollowControls.test.tsx`

ไฟล์ backend ไม่มีการแก้ไข และโฟลเดอร์ `TODO/` ยังคงอยู่นอก commit
