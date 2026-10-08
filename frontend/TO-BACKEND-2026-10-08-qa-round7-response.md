# FE → BE: Round 7 integration response — 8 ต.ค. 2026

อ่าน `FE-Notice/TO-FE-2026-10-08-breaking-changes-round7.md` แล้ว ตรวจ ls-remote/fetch ครั้งแรกที่ `BE_KN@ce5f79fb1c4c86f89db27c8be1b039834f943084` และตรวจท้ายงานพบ fixture commit ใหม่ จึง fetch/อ่านต่อที่ **`000d9ec798b0774e304abee228ab1172ff1edb51`** ฐาน FE `b5aee15`, branch `feat/1` แก้เฉพาะ frontend ตามคำสั่งเดิมไม่ทำ browser/manual QA

ข้อความ “ยังไม่ push / รอ FE เลือก A/B / รอส่งสคริปต์” ใน notice ถูกแทนด้วย source ที่ BE push แล้ว รอบนี้ FE ไม่ต้องรอการ push ของ Round 7

## งาน FE ที่ปิด implementation แล้ว

1. **Pick'em leaderboard:** ส่ง `page`/`pageSize=20`, อ่าน `pagination`, มี Previous/Next/Refresh และจำนวนผู้เล่น เก็บ cache ของแต่ละหน้าแยกกัน แสดง `rank` จาก BE โดยตรง ไม่คำนวณใหม่จาก index กรณี loading/error/response เก่าไม่มี pagination ไม่แสดงเป็นรายการครบหรือ empty success แสดงข้อความว่าผลใหม่ตามหลังได้สูงสุด 5 วินาที รับ cache 5 วินาทีตามที่เสนอ ไม่ขอ bypass cache ในรอบนี้
2. **Register:** KU แบบ exact domain/case-insensitive ใช้ข้อมูลส่วนตัวขั้นแรก แล้วคณะ/ภาควิชา/ชั้นปีขั้นสอง; POST ครั้งเดียวเมื่อครบ External ส่งเฉพาะ `fullName,email,password,gender,birthDate` ไม่ส่ง null/0/default หรือ academic draft เก่าหลัง Back กรณี optional academic values ไม่ถูกต้อง schema ของ BE ยังปฏิเสธได้ จึง omit ไปทั้งหมด อีเมล Gmail/subdomain/notku.th ไม่ถือเป็นคนใน มีข้อความเตือนใช้อีเมล KU เพื่อรับสิทธิ์ภายในและเปลี่ยนอีเมลหลังสมัครไม่ได้ DTO `/me`/public profile รองรับ academic null; หน้า Profile ไม่แสดง `#null` หรือชั้นปี null ผลสำเร็จไป OTP เหมือนเดิม ไม่มี account ขั้นกลาง ไม่มี FE ส่ง userType
3. **Notifications:** `tournament_auto_delete_warning` ใช้ Critical alerts/ไอคอนเตือน/fallback title; `tournament_auto_deleted` ใช้ Tournament updates/ไอคอนทัวร์ ทั้งคู่เปิดด้วย `relatedEntityId` ตามเดิม หมวด critical ปิดไม่ได้แม้ไม่มี locked flag; tournament ปิดได้ตาม preferences API
4. **Jobs / BR-03:** รับทราบ cleanup รายชั่วโมง, warning 7 วันก่อนเริ่ม, private tournament ปิด `auto_deleted` เมื่อถึงวันเริ่ม/ปิดรับสมัคร และ hard purge หลัง 4 ปี ไม่เพิ่ม client timer ที่อ้างว่าปิดทันที รับทราบ migration 052: staff เป็นผู้ถือ admin/root scope; permission FE ยังตรวจ adminScope ไม่ใช้ userType เป็น authorization
5. **FE-39 เลือก A และต่อแล้ว:** `GET /admin/amendment-requests/:requestId/impact` ยิงเฉพาะเมื่อเปิด confirmation ไม่ยิงทุกแถว cache แยก actor/scope/request, refresh ทุกครั้งที่เปิด ใช้ `requestedChanges,reason,selfRequested` จาก impact ปัจจุบัน ปิด Confirm ระหว่าง loading/refresh/error/403/404, response ไม่ตรง request, blockers หรือ alreadyDecided/status ไม่ pending แสดง code/message และ affected teams/players/count ที่ BE ส่งใน `AMENDMENT_BREAKS_APPROVED_TEAMS` ไม่แต่ง count=0 เมื่อไม่มี field คำขอที่ตัดสินแล้วอ่าน 200 แต่ไม่อนุมัติซ้ำ POST approve เดิมยังตรวจซ้ำฝั่ง BE; ถ้า POST ล้มเหลว FE อ่าน impact ใหม่เพื่อรับมือ race

Original FE-01–FE-43 เป็น **42 implemented / 1 partial**: FE-10 browser timing ยัง partial ส่วน FE-39 ปิด implementation ได้แล้ว ตัวเลขนี้ไม่ใช่ live QA/sign-off และไม่ใช่ประกาศพร้อม deploy ทั้งระบบ

## Fixture 9054: BE ส่งครบแล้ว เหลือ apply/acceptance

ขอบคุณสำหรับ `database/qa-fixture-9054.sql` + README + baseline ที่ `000d9ec` ตรวจ baseline แล้วมี canonical keys ของ 9053/9054 และไม่มี legacy `referee-identity/9053-id-card.jpg` รายการ “ขอ BE ส่ง focused script/แก้ baseline” ใน Round 6 **ปิดได้**

สำหรับฐานที่มีข้อมูลเดิม ให้ผู้ดูแลใช้ focused script **หลัง migrate** ตาม README ไม่ restore/reseed ทั้งก้อน สคริปต์อ้าง tournament จากแถว 9053 และอาจไม่สร้าง invitation ถ้าไม่มีแถวนั้น จึงต้องอ่านผลตรวจท้ายสคริปต์ด้วย หลัง pull ให้รัน minio-init ซ้ำและตรวจ object 9054 จริง; **ห้ามเติม object 9053** ซึ่งยังเป็น intentional 404

Environment ที่ FE เคยตอบใน Round 6: DB `ltms` ไม่ใช่ `ltms_test`; BE บน host ใช้ MySQL `127.0.0.1:3307` (container 3306); BE HTTP 8000; MinIO ของ compose `BE_KN/backend` ตัวเดียวกัน endpoint `http://127.0.0.1:9000`, bucket `ltms-uploads` รอบนี้อ้างอิง environment เดิม ไม่อ้างว่าได้ตรวจ container/DB runtime ใหม่

FE ไม่ได้รัน script/migration หรือเปลี่ยน DB/MinIO รอบนี้ คำยืนยัน migration ของเจ้าของงานก่อนหน้านี้ไม่ใช่หลักฐานว่า migrations **051/052** ที่เพิ่งส่งได้ apply แล้ว ผู้ดูแลต้องตรวจ/apply migrations ล่าสุดก่อนทดสอบ รวมถึงยืนยันลิงก์ 9054 เปิดได้และ expiry/recovery ผ่าน authenticated flow

## งานที่ยังต้องการจาก BE

- **Real SMTP:** เจ้าของงานยืนยันว่ารอ BE merge SMTP จริงแทน mail จำลอง ขอส่ง commit/config contract ที่พร้อมใช้และผลส่ง/ยืนยัน OTP หลัง merge
- **OTP enforcement:** ที่ fetched `000d9ec`, login ยัง sign token หลังตรวจ password/suspension โดยไม่ตรวจ `email_verified` SMTP สำเร็จอย่างเดียวไม่แก้ bypass ขอ gate login (`403 EMAIL_NOT_VERIFIED` ตาม FE recovery เดิม) และ protected access ของ token ที่ออกก่อน verify รวม behavior หลัง verify แล้ว ดู [หลักฐานเดิม/รายการแก้ OTP bypass](TO-BACKEND-2026-10-06-otp-login-bypass.md) FE ไม่สามารถปิดช่องนี้ด้วยซ่อนปุ่มอย่างเดียว
- ยืนยัน runtime migrations/fixture และ authenticated API/browser/device acceptance หลัง setup จริง งานนี้เป็น integration acceptance ที่ยังไม่ได้ทำในรอบนี้

ไม่มี contract เพิ่มที่ FE ต้องรอสำหรับ pagination/register/closure notifications/FE-39 และไม่ต้องส่ง option A/B ซ้ำ

## Developer verification

- Full suite **101 files / 681 tests passed** (`--maxWorkers=2`), lint, TypeScript/production build และ diff check ผ่าน
- Build มี warning ขนาด chunk เดิม: main **952.83 kB**
- Focused pass รอบแรกมี 1 test ของ retry ใหม่ไม่ผ่านเพราะใช้ Error ที่ถูก automatic retry แก้ test ให้ใช้ delivered non-retryable 404 แล้ว test นั้นและชุดเต็มผ่าน ไม่เปลี่ยน retry policy ของระบบ
- Isolated Vite **5197**: `/register` และ RegisterPage/PickemLeaderboardPanel/AmendmentApprovalDialog/InboxPage modules ตอบ HTTP 200 นี่เป็น developer HTTP smoke ไม่ใช่ browser acceptance
- ไม่ทำ browser/manual QA ไม่แก้ BE/DB ไม่ restore/reseed และยังไม่ push FE ในคำสั่งนี้

Implementation commit: **`6f6f658`** (`feat: integrate Round 7 signup, leaderboard and amendment impact`). เอกสารนี้และ checklist commit แยกจาก code

หยุดเฉพาะ task-owned Vite PID 1824 แล้ว ไฟล์ notice และการลบ handover ที่มีอยู่ก่อนงานนี้ไม่ได้รวมใน commit
