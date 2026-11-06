# FE → BE: QA Response Round 6 — 8 ต.ค. 2026

**อัปเดต Round 7:** FE-39 option A ส่งมอบแล้วที่ `ce5f79f` และ FE ต่อครบ; BE ส่ง focused fixture script/แก้ baseline ที่ `000d9ec` แล้ว รายการขอ route/script ด้านล่างเป็นประวัติ ดู [คำตอบล่าสุด Round 7](TO-BACKEND-2026-10-08-qa-round7-response.md) ส่วน DB/MinIO environment ที่เคยแจ้งยังอ้างอิงในคำตอบล่าสุด

อ่าน `FE-Notice/TO-FE-2026-10-08-qa-response-round6.md` และตรวจ remote/fetch พร้อม source ที่ `BE_KN@4b51af59850899fc999032f6d7632979b791ae0e` แล้ว ฐาน FE `dc59fb9`, branch `feat/1` แก้เฉพาะ frontend รอบนี้ตามคำสั่งเดิมไม่ทำ browser/manual QA

FE implementation commit: `1a7d519`.

## งาน FE ที่ปิด implementation แล้ว

1. **TEAM_CONFLICT_OF_INTEREST (409):** รับ metadata ที่กระจายอยู่ใน `error` ตรง ๆ ผ่าน `ApiError.extra` ครบสามเส้น: ส่งคำเชิญเข้าทีม, รับคำเชิญเข้าทีม และขอเข้าทีมเอง ไม่อ่านสถานะจากข้อความ server
   - pending: ให้ปฏิเสธคำเชิญ/ให้ผู้จัดยกเลิก หรือรอหมดอายุ แสดง `expiresAt` ที่ส่งมาเป็นเวลา Bangkok
   - accepted: ให้ผู้จัดจบบทบาทที่ขัดกัน หรือเลือกทีม/บุคคลที่เข้าได้ ระบุว่ารอคำเชิญหมดอายุไม่ช่วย ไม่แสดง deadline เก่าที่อาจค้างมา
   - organizer: อธิบายว่าเข้าทีมที่สมัครทัวร์ของตนไม่ได้ และให้เลือกทีม/บุคคลที่เข้าได้
   - เพิ่ม structured recovery ในหน้าขอเข้าทีม ซึ่งก่อนหน้านี้แสดงเพียงข้อความจาก server; หน้าเชิญและ Inbox ใช้ component กลางอยู่แล้ว ไม่แสดง success เมื่อ API ปฏิเสธ
2. **Fixture 9053:** เปลี่ยน key ใน tests เป็น `referee_identity/9053/00000000-0000-4000-8000-000000009053.jpg` เก็บเคสเปิดไฟล์ไม่ได้/refresh ไว้ และคง fixture 9054 PNG เป็นคนละเคส ไม่สร้าง parser หรือประกอบ key จาก user ID
3. **REFEREE_IDENTITY_KEY_INVALID (422):** แนะนำให้อัปโหลด JPEG/PNG ใหม่จากบัญชีตนเอง หน้า Profile เก็บไฟล์ที่เลือกให้ retry ได้; retry ขอ presign และ upload ใหม่ก่อนส่ง key ใหม่ ไม่วนส่ง key ที่ถูกปฏิเสธ และไม่แสดงรายการ objectKeys ในข้อความ recovery
   - เส้น upload ใช้ `purpose: referee_identity` และส่ง `objectKey` จาก `/uploads/presign` โดยไม่แก้ค่า
   - Inbox รับคำเชิญกรรมการโดยไม่แนบ docs; หาก API ส่ง 422 ก็แสดง shared recovery นี้ ไม่มี path ประกอบ key เอง
   - รับทราบว่า BE ตรวจรูป key/เจ้าของ ไม่ตรวจว่า object มีอยู่จริง จึงยังรักษา 9053 missing-file fixture ได้
4. **UTC / slow log / pool / keep-alive:** รับทราบการเปลี่ยนฝั่ง BE; FE ยังแสดง timestamp เป็น Bangkok และเก็บ calendar date ตามเดิม ยังไม่อ้างว่า 502/network error หายโดยไม่มี runtime evidence

## FE-39: เลือกทาง ก — อ่าน impact เมื่อเปิดรายละเอียดคำขอ

จอแอดมินปัจจุบันเปิดรายละเอียด/confirmation ของ amendment ทีละคำขอ และอ่าน tournament detail เมื่อเปิด modal อยู่แล้ว จึงเลือก **ทาง ก** ตามที่ BE เสนอ: route อ่าน impact ด้วย **request ID** ยิงเมื่อเปิดคำขอนั้น ไม่ต้องคำนวณทุกแถวในคิว

ขอ BE ส่ง route และ DTO ที่ยืนยันแล้ว ตัวอย่าง route ที่เสนอคือ `GET /admin/amendment-requests/:requestId/impact` (**เป็นข้อเสนอ ยังไม่ใช่ route ที่ส่งมอบ**):

- ใช้ stored amendment payload ของ request นั้น และคืนผลจากกฎปัจจุบันของ BE: อนุมัติได้หรือไม่, blockers, จำนวน/รายการทีมที่กระทบ พร้อมผู้เล่นและเหตุผลเมื่อมี รวมรายการผลกระทบอื่นตาม preview ที่ BE รองรับ
- ใช้สิทธิ์ reviewer ตาม queue: Faculty Admin ที่มี assigned faculty และ University Admin; Root/unassigned Faculty ต้อง 403 และตรวจ scope ของคำขอด้วย
- ระบุ 404 สำหรับ request ที่ไม่มีอยู่ พร้อม contract ของคำขอที่ไม่ pending แล้วและ error อื่น ๆ
- ตรวจเงื่อนไขซ้ำตอน approve จริงเพื่อรับมือข้อมูลเปลี่ยนหลัง preview; ผล preview ไม่ใช่ authorization token

FE จะต่อ loading/error/retry และ confirmation จากข้อมูลจริงหลังส่งมอบ contract นี้ ตอนนี้ **FE-39 ยัง partial** และไม่เรียก organizer-only preview แทนแอดมิน

## ตอบฐาน QA / MinIO ที่ BE ถาม

ตรวจค่าจาก `D:\Project-LTMS\BE_KN\backend\.env` และสถานะ container รอบนี้:

| รายการ | ค่าที่ใช้อยู่ |
|---|---|
| Database | `ltms` (ไม่ใช่ `ltms_test`) |
| Host / port เมื่อรัน BE บน host | `127.0.0.1:3307` |
| MySQL container | `ltms-mysql`, healthy; container port 3306 |
| BE HTTP | port `8000` |
| MinIO | ตัวเดียวกับ compose ของ `BE_KN/backend`, `ltms-minio` |
| S3 endpoint / bucket | `http://127.0.0.1:9000` / `ltms-uploads` |
| minio-init | `ltms-minio-init` จบด้วย `Exited (0)` |

ขอ BE ทำ **focused population** ของ user/invitation/identity-doc row สำหรับ 9054 ในฐานนี้ให้ตรงกับ `referee_identity/9054/00000000-0000-4000-8000-000000009054.png` และปรับ row ของ 9053 เป็น canonical key ใหม่ โดย **ไม่เติม object ของ 9053** เพื่อคง 404 ไม่ full reseed หรือ restore ทับข้อมูลที่ทำไว้

`minio-init` ที่จบปกติเป็นหลักฐานระดับ setup เท่านั้น ยังไม่ยืนยันภาพเปิดได้ผ่าน authenticated flow หรือว่า row ใน DB มีครบ ส่วน `database/qa-baseline.sql` ที่ตรวจยังมี key เก่าของ 9053 และไม่มี user 9054: restore baseline แล้ว migrate อย่างเดียวจึงไม่รับประกัน fixture Round 6 กรุณาระบุขั้นตอน focused fixture หลัง restore หรือปรับ baseline ที่ BE ดูแลด้วย

FE รอบนี้ไม่ได้แก้ BE, รัน migration, restore/reseed หรือ mutate DB/MinIO คำยืนยัน migration ที่เจ้าของงานแจ้งก่อนหน้านี้ยังใช้ตามเดิม ไม่สรุปว่า 049/050 ยังไม่รัน รับทราบ BE แก้รายการรอ FE รอบ 4 แล้ว (`d2755b5`)

## สถานะและ verification

Original FE-01–FE-43 ยังคง **41 implemented / 2 partial**: FE-10 browser timing และ FE-39 reviewer impact ช่องว่าง metadata ของ team conflict ปิด implementation ใน Round 6 แล้ว

SMTP/OTP สถานะล่าสุดจากเจ้าของงาน (8 ต.ค.): **รอ BE merge SMTP จริงแทน mail จำลอง** แล้วจึงทดสอบส่ง/ยืนยัน OTP และ enforcement ร่วมกัน ข้อความพักเพราะ Google 2FA ใน notice เป็นบริบทก่อนคำชี้แจงนี้; B2/B4/cancellation และมติทีมอื่นยังรอทีม รวมถึงวิธีบันทึก error codes ใน Part 4 ที่ BE แจ้งไว้ ไม่ใช่งานที่ FE ปิดเองได้

OTP follow-up (8 ต.ค.): เจ้าของงานยัง bypass ได้ ตรวจ remote/source ล่าสุด `BE_KN@240e9e6` แล้ว login ยังออก token โดยไม่ตรวจ email_verified และ loadUser ยังไม่มี gate เช่นกัน SMTP พร้อมอย่างเดียวไม่แก้จุดนี้ ต้องส่งมอบ server enforcement ก่อนปิด production acceptance ดู [หลักฐานและรายการแก้ OTP bypass](TO-BACKEND-2026-10-06-otp-login-bypass.md)

Developer verification: **98 files / 639 tests passed** (`--maxWorkers=2`), lint, TypeScript/production build และ diff check ผ่าน Focused Round 6: **9 files / 107 tests passed** Build มี warning ขนาด chunk เดิม (main **944.22 kB**)

ชุดเต็มครั้งแรกที่รันพร้อม lint/build มี QR camera test เดิม timeout 5 วินาที (638 passed / 1 timeout); รัน test นั้นเดี่ยวผ่าน และรันชุดเต็มใหม่ด้วย 2 workers ผ่านครบโดยไม่เปลี่ยนโค้ดหรือ timeout ของ QR test

Isolated Vite port **5195**: root และ JoinRequestsPanel, ContractErrorDetails, upload, ExternalIdentityPanel modules ตอบ HTTP 200; หยุดเฉพาะ server ที่เริ่มในรอบนี้แล้ว Authenticated API/browser, MinIO preview/expiry, performance timing และ real-device acceptance ไม่ได้ปิดในรอบนี้
