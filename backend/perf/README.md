# Performance & Load Test (SRS 3.2 — PF-01 … PF-06)

```bash
cp .env.perf.example .env.perf      # ใส่ DB_PASSWORD ให้ตรงกับ .env  (DB_NAME ต้องลงท้าย _perf)
npm run perf                        # build → สร้างฐาน ltms_perf ใหม่ → seed → เปิดเซิร์ฟเวอร์ → วัดทุกข้อ (~12 นาที)
npm run perf:quick                  # รอบลองสคริปต์ ย่อเวลาทุกช่วงลง 5 เท่า (~4 นาที) — ไม่ใช่ผลทางการ
npx tsx perf/run.ts pf01 pf05       # เลือกบางข้อ (ยัง seed ใหม่ทุกครั้ง · ไม่ build ให้)
```

ติดตั้งครั้งแรก (ไม่ต้องลง package เพิ่ม — ใช้ tsx / mysql2 / jsonwebtoken ที่มีอยู่แล้ว):

```jsonc
// package.json → "scripts"
"perf": "npm run build && tsx perf/run.ts",
"perf:quick": "npm run build && PERF_QUICK=1 tsx perf/run.ts"
```
```gitignore
# .gitignore
.env.perf
perf/results/
```

ผลลัพธ์: `perf/results/report.md` (สรุป + ตาราง) · `results.json` (ข้อมูลดิบ) · `server.log` (stdout/stderr ของ API ระหว่างวัด)
exit code 0 = ผ่านทุกข้อ · 1 = มีข้อไม่ผ่าน · 2 = สคริปต์ล้ม

## ต้องมี

- MySQL ตัวเดียวกับ dev (docker compose พอร์ต 3307) — **ต้องรันเป็น UTC** (`--default-time-zone=+00:00`) สคริปต์เช็คให้และจะไม่ยอมรันถ้าไม่ใช่
- `max_connections` ≥ 200 (ค่าตั้งต้นของ MySQL 8 = 151 ก็พอ — API ใช้ pool 10 การเชื่อมต่อ)
- ไม่ต้องมี MinIO / mailpit — ไม่มีเส้นไหนในชุดวัดที่แตะ S3 หรือส่งเมล (ถ้ามี จะโผล่ใน server.log)

## สคริปต์ทำอะไร

| ขั้น | ทำอะไร | ผ่าน |
|---|---|---|
| ฐาน | DROP/CREATE `ltms_perf` → `database/schema.sql` → migration ที่เหลือ | SQL ตรง |
| seed | ผู้ใช้ 30,000 · ทัวร์ 60 · ทีม 1,034 (2–15 คน) · ใบสมัคร approved + รายชื่อลงแข่ง | bulk INSERT |
| เตรียม | สร้างสายทุกทัวร์ · ทาย pick'em 128,000 ใบ (4,000 คน × 32 แมตช์) · ส่งผล+ยืนยัน 16 แมตช์ (ตัดสิน 64,000 ใบ) | **API จริง** (ยกเว้นการทายที่ seed ตรง) |
| PF-03 | `POST /tournaments/:id/bracket` 3 รูปแบบ × 8/16/32/64 ทีม × 3 ครั้ง (ครั้ง 2–3 = จับใหม่ replace) | API |
| เพดาน | 50 VU ยิงไม่หยุด 30 วิ — หา req/s สูงสุด (ข้อมูลประกอบ) | API |
| PF-01 | 100 VU อ่าน 11 endpoint ตามน้ำหนัก 75 วิ · p95 < 1.5 วิ | API |
| PF-04 | ระหว่างโหลด 100 VU: ส่งผล → ยืนยัน → poll สาย/ตารางอันดับ pick'em/ตารางคะแนน ทุก 250 ms จนเห็นผล · ≤ 10 วิ | API |
| PF-05 | กรรมการขอ QR → 30 ผู้เล่นสแกน **พร้อมกัน** · 3 สภาวะ (ว่าง / 100 VU / 500 VU) · ทุกคน < 3 วิ | API |
| PF-06 | ไล่ขั้น 100 → 250 → 500 VU (+1,000 สำรวจ) ไม่หยุดเซิร์ฟเวอร์ · อ่าน 92% + ทาย 8% · error ≤ 1% + ตรวจ log | API |

PF-02 (หน้าเว็บแสดงเนื้อหาแรก < 2.5 วิบน 4G) เป็นงาน frontend — วัดด้วย Lighthouse (throttling "Slow 4G") ไม่อยู่ในนี้

## สมมติฐานที่ต้องรู้ก่อนอ่านผล

- **ผู้ใช้เสมือน (VU) มีเวลาคิด 1–3 วินาที** ระหว่างคำขอ — SRS พูดถึง "ผู้ใช้พร้อมกัน" ไม่ใช่ "คำขอพร้อมกัน"
  500 VU ≈ 250 คำขอ/วินาที ถ้าเซิร์ฟเวอร์ทัน (เกินภาระพีคใน SRS 2,000–5,000 อ่าน/ชม. หลายร้อยเท่า)
- **error** = 5xx · ต่อไม่ติด · ไม่ตอบภายใน 30 วินาที — 4xx นับแยก (ชุดคำขอถูกต้องหมด ไม่ควรมี 4xx เลย)
- token ล็อกอินเซ็นเองด้วย `JWT_SECRET` ของ `.env.perf` (payload เดียวกับ `utils/token.ts`) — ไม่ยิง `/auth/login` เพราะ bcrypt ตั้งใจให้ช้าและมี rate limit
- เซิร์ฟเวอร์ = `dist/server.js` (build จริง) โปรเซสเดียว · `cwd = perf/results` เพื่อไม่ให้ `.env` ของ dev รั่วเข้ามา
- **API · MySQL · ตัวยิง อยู่เครื่องเดียวกัน** ⇒ ตัวเลขเป็นพื้นล่าง เครื่องจริงที่แยก DB ออกไปจะดีกว่านี้
- ข้อมูลเป็น deterministic เกือบทั้งหมด (สายจับฉลากแบบ random) ⇒ รันซ้ำได้ผลใกล้เคียงกัน

## ไฟล์

```
perf/
  run.ts            ตัวหลัก — เตรียมข้อมูล + ทุก scenario + เขียนรายงาน
  lib/env.ts        โหลด .env.perf + ด่าน DB_NAME ต้องลงท้าย _perf
  lib/setupDb.ts    สร้างฐาน (ตรรกะเดียวกับ integration globalSetup) + เช็ค MySQL เป็น UTC
  lib/seed.ts       bulk seed ตามตารางปริมาณงานของ SRS + การทาย pick'em
  lib/server.ts     เปิด/ปิด dist/server.js เป็นโปรเซสแยก เก็บ log
  lib/http.ts       client node:http keep-alive (เบากว่า fetch — ตัวยิงแย่ง CPU กับเซิร์ฟเวอร์)
  lib/load.ts       VU แบบวงปิด + โหลดพื้นหลังที่หยุดได้
  lib/stats.ts      เก็บทุก latency → p50/p95/p99 จากค่าจริง
  lib/monitor.ts    CPU/RAM ของ node กับ mysqld จาก /proc (Linux)
  lib/token.ts      เซ็น token ล็อกอิน
  tsconfig.json     npx tsc -p perf  (ตรวจชนิดแยกจาก src)
```
