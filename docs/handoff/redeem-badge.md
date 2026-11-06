# แลกแต้มซื้อ Badge

`POST /api/v1/me/rewards/:id/redeem` ต้องเข้าสู่ระบบ ไม่ต้องส่ง body ผู้ใช้ซื้อให้บัญชีของ token เท่านั้น

สำเร็จตอบ 200 พร้อม `{ rewardId, pointsSpent, totalPoints }` โดย `totalPoints` เป็นยอดหลังหักแต้ม

| HTTP | error.code | ความหมาย |
|---|---|---|
| 400 | `VALIDATION_FAILED` | id ไม่ใช่จำนวนเต็มบวก |
| 401 | `NO_TOKEN` | ยังไม่เข้าสู่ระบบ |
| 404 | `REWARD_NOT_FOUND` | ไม่พบรางวัลหรือปิดขายแล้ว |
| 409 | `REWARD_NOT_PURCHASABLE` | ไม่ใช่ Badge สำหรับขาย ราคาไม่เป็นจำนวนบวก หรือมีเกณฑ์แจกอัตโนมัติ |
| 409 | `REWARD_ALREADY_OWNED` | เป็นเจ้าของแล้ว |
| 409 | `INSUFFICIENT_POINTS` | แต้มไม่พอ มี `pointsRequired` และ `totalPoints` ใน `error` |

## ข้อมูลตั้งต้น

รัน `cd backend` แล้ว `npm run migrate` เพื่อโหลด `056_purchasable_badges.sql` มี Badge บรอนซ์ 30 แต้ม ซิลเวอร์ 100 แต้ม และโกลด์ 300 แต้ม
ใช้เลข 056 เพราะ 055 เป็นงานยืนยันอีเมลแล้ว ไม่เปลี่ยนชื่อ migration เดิม
ราคาต่างกันเพื่อให้มีเป้าหมายสะสมหลายระดับ เปลี่ยนราคาในอนาคตด้วย migration ใหม่ได้

## กฎแต้ม

หักยอดแบบมีเงื่อนไข ให้ Badge และลงบัญชี `reward_redeem` ด้วยจำนวนติดลบใน transaction เดียว
ถ้าซื้อซ้ำหรือเขียนบัญชีไม่สำเร็จ rollback ทั้งหมด
Badge ที่ขายมี `criteria = NULL` เพื่อไม่ให้ตัวประเมินเหรียญอัตโนมัติแจกฟรีหรือริบคืน
`users.total_points` เป็นยอดใช้จ่ายได้ ไม่ใช่ผลรวมแต้มจากคำทาย การคำนวณยอดใหม่จากคำทายจะคืนแต้มที่ใช้ซื้อไปแล้ว
การแก้ผลแมตช์ยังยึดแต้มเท่าที่เหลือและไม่ต่ำกว่า 0 ตามกฎเดิม ไม่ริบ Badge ที่ซื้อแล้ว

## ตรวจสอบ

จาก `backend` รัน `npm run typecheck`, `npm test` และ `npm run test:int`
เทสเฉพาะฟีเจอร์คือ `npx vitest run --config vitest.integration.config.ts src/__tests__/integration/rewardRedeem.int.test.ts`
Integration ต้องใช้ MySQL และ `.env.test` ที่ชี้ฐานชื่อท้าย `_test` เทสสร้างฐานนี้ใหม่และล้างข้อมูล ไม่ใช้ฐาน dev
