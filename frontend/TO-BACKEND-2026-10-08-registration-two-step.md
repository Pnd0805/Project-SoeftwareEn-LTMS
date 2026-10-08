# FE → BE: สมัครบัญชีสองขั้น — 8 ต.ค. 2026

เจ้าของงานขอให้แยกข้อมูลส่วนตัวออกจากข้อมูลนิสิต: หน้าแรกเก็บอีเมลและข้อมูลส่วนตัว ถ้าเป็นอีเมลภายในจึงไปหน้าข้อมูลนิสิต ส่วนอีเมลภายนอกไม่ต้องกรอกข้อมูลนิสิต

ตรวจ ls-remote/fetch และ source ปัจจุบันที่ `BE_KN@240e9e62ca5aa5c429e9e7159414692c2052ae45` แล้ว แก้เฉพาะ frontend ไม่มีการแก้ BE หรือ DB

FE implementation commit: `31d52f0`.

## FE ที่ทำแล้ว

- ขั้น 1: email, fullName, password, gender, birthDate ไม่มีคณะ สาขา หรือชั้นปี
- ขั้น 2 เฉพาะโดเมน `@ku.th` ตรงทั้งโดเมนและไม่สนตัวพิมพ์เล็กใหญ่ ตาม `utils/kuEmail.ts` ของ BE: facultyId, departmentId, year ใช้ข้อมูลอ้างอิงจริง ไม่มีการเลือก ID 1 ให้โดยอัตโนมัติ
- ขั้นแรก validate ข้อมูลส่วนตัวโดยยังไม่สร้างบัญชี ขั้นสองส่ง POST `/auth/register` ด้วย payload เดิมที่มีข้อมูลครบ แล้วไปหน้า OTP เดิม
- Back เก็บ draft ใน memory เท่านั้น ไม่เก็บ password ใน URL/localStorage เปลี่ยนคณะแล้วล้างสาขาเก่า มี loading/empty/error/retry และบล็อกส่งเมื่อข้อมูลอ้างอิงยังไม่พร้อม
- ถ้า BE ส่ง error ของข้อมูลส่วนตัวจากขั้นสอง FE กลับไปขั้นหนึ่งให้แก้ข้อมูลโดยไม่ล้าง draft
- FE ใช้โดเมนเพื่อเลือกหน้าฟอร์มเท่านั้น ไม่ส่ง/ตัดสิน `userType` แทน BE

## Blocker: ภายนอกสมัครด้วยข้อมูลส่วนตัวอย่างเดียวยังไม่ได้

BE schema `backend/src/schemas/auth.schema.ts` ยังบังคับ facultyId และ departmentId เป็น positive integer พร้อม year 1–8 สำหรับทุกอีเมล ส่วน `auth.service.register` อ่านคณะ/สาขาและตรวจความสัมพันธ์โดยไม่แยกประเภทอีเมลก่อน

ดังนั้น FE ปัจจุบันไม่ส่งคำขอสมัครภายนอกที่ไม่มีข้อมูลเหล่านี้ และไม่ส่ง ID/default นิสิตที่ผู้ใช้ไม่ได้กรอก จอแสดงว่าการสมัครภายนอกยังไม่เปิดใช้งาน นี่คือส่วนที่ยังไม่ครบตามคำขอจนกว่า BE ส่งมอบ contract ใหม่; ไม่ใช่การเปลี่ยนนโยบายโดเมนของระบบ

ขอ BE ปรับ **POST `/auth/register` เดิม** และยืนยัน contract:

1. `@ku.th`: ต้องมีข้อมูลส่วนตัว + facultyId/departmentId/year ตรวจคณะ-สาขาและ year เหมือนเดิม
2. ภายนอก: รับข้อมูลส่วนตัวอย่างเดียว โดยไม่บังคับคณะ/สาขา/ชั้นปี ให้ระบุว่าจะ omit หรือส่ง null และการจัดการ study fields ที่ client ส่งเกินมา
3. Service/repository เก็บประเภทบัญชีจาก email ตามกฎ BE และเก็บข้อมูลนิสิตที่ไม่มีเป็น null ตาม schema ที่รองรับ ไม่ใช้คณะ/สาขาของนิสิตอื่นหรือค่า 0/1 แทน
4. ยืนยัน nullable DTO ของ profile/search/qualification ที่เกี่ยวข้อง เพื่อ FE ปรับ types/adapters หลังส่งมอบจริง; ห้าม downstream แสดงคณะ/ชั้นปีที่ไม่มีเป็นข้อมูลจริง
5. ให้ validation/field errors และ response/OTP contract ที่ยืนยันแล้ว ทั้งอีเมลภายในและภายนอก

เมื่อส่งมอบ FE จะต่อ submit ภายนอกจากขั้นแรกและ regression ของ payload จริง โดยไม่ต้องแสดงขั้นข้อมูลนิสิตให้ภายนอก

SMTP จริงยังรอ BE merge ตามคำชี้แจงเจ้าของงาน; OTP delivery/enforcement และ live/browser acceptance ต้องทดสอบแยกหลังส่งมอบ ไม่ได้ปิดจากการเปลี่ยนหน้าฟอร์มนี้

## Developer verification

Final full suite **99 files / 659 tests passed**, lint, TypeScript/production build และ diff check ผ่าน Build มี chunk-size warning เดิม (main **949.00 kB**)

Isolated Vite port **5196**: `/register`, RegisterPage, useReference และ kuEmail modules ตอบ HTTP 200 แล้วหยุดเฉพาะ server ที่เริ่มในงานนี้ Browser/manual QA ไม่ทำตามขอบเขตเดิม; developer checks ไม่ใช่ acceptance ของ external signup หรือ SMTP/OTP จริง
