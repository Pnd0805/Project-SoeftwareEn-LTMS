# database/migrations

การเปลี่ยน schema ทุกครั้งเก็บเป็นไฟล์ SQL ที่นี่ แล้วทุกคนรัน `npm run migrate` (ในโฟลเดอร์ `backend/`) หลัง `git pull`

## กติกา

1. **แก้ schema = ต้องมีไฟล์ migration** — เขียน `NNN_สิ่งที่ทำ.sql` เลขต่อจากไฟล์ล่าสุด **และ** อัปเดต `schema.sql` ให้ตรงกัน (schema.sql ใช้สร้าง DB ใหม่ทั้งก้อน)
2. **ห้ามแก้/ลบไฟล์ที่ push ไปแล้ว** — เครื่องอื่นรันไปแล้ว ถ้าจะเปลี่ยนใจให้เขียนไฟล์ใหม่
3. 1 ไฟล์ = 1 การเปลี่ยนแปลงเล็ก ๆ — MySQL rollback DDL ไม่ได้ ถ้าพังกลางไฟล์ต้องแก้มือ
4. เพิ่ม migration ใหม่ทุกครั้ง ให้เติมชื่อไฟล์ท้าย `schema.sql` (บล็อก `INSERT INTO schema_migrations`) ด้วย เพื่อให้ DB ที่สร้างใหม่จาก schema.sql ไม่รันซ้ำ

## คำสั่ง

```bash
npm run migrate            # รันไฟล์ที่ยังไม่เคยรันในเครื่องนี้
npm run migrate -- --fake  # บันทึกว่ารันแล้วโดยไม่รันจริง
```

## DB เก่าที่เคย ALTER มือไปแล้ว (ทำครั้งเดียว)

ถ้าเครื่องคุณรัน `scheduled_end_time` / `assignment_status` ด้วยมือไปแล้วก่อนมีระบบนี้:

```bash
npm run migrate -- --fake
```

จากนั้นใช้ `npm run migrate` ตามปกติ
