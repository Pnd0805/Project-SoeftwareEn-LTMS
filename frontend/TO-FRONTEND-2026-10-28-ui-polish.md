# ถึงทีม FE — ปรับ UX/UI รอบอาจารย์ท้วง (branch `ui-polish-s34`)

**จาก** FE slice 3/4
**วันที่** 28 ต.ค. 2569
**branch** `ui-polish-s34` แตกจาก `Final_Present` @ `eeef1a3` · 17 commit · 21 ไฟล์ (+465 / −115)
**สถานะ** push แล้ว **ยังไม่ merge** — ขอให้เจ้าของไฟล์ที่ระบุในหัวข้อ 3 ดูก่อน

---

## 1. อาจารย์ท้วงอะไร และแก้ด้วยหลักอะไร

| ที่อาจารย์ท้วง | หลักที่ใช้ | ทำอะไร |
|---|---|---|
| เวลาแต่ละจุด format ไม่เหมือนกัน | ISO 8601 / CLDR · Nielsen #4 | ทุกจุดผ่าน `shared/dateFormat.ts` → `8 Oct 2026, 22:44 (UTC+7)` · กฎ ESLint ห้าม `toLocaleDateString/TimeString` และ `new Date().toLocaleString()` ใน slice 3/4 |
| ตารางมี scroll ในกล่อง | WCAG 1.4.10 Reflow | **หน้าเลื่อนที่เดียว** — เอา `max-height` + `overflow:auto` ออกจากตาราง/รายการ/แท็บทั้งหมดที่เจอ (ตารางยังเลื่อนข้างได้บนจอแคบ) |
| กล่องไม่สมมาตร ไม่อยู่บนเส้นนำสายตา | Grid + แนวขอบร่วม · Gestalt proximity | กล่องคู่สูงเท่ากัน · หัวข้อคอลัมน์ติดกันอยู่บรรทัดเดียว · กริดไม่มีรู · ป้ายสถานะอยู่ติดสิ่งที่มันบอก |
| ข้อความกำกวม (เสร็จแล้วแต่ไม่บอกทำอะไรต่อ) | Nielsen #1, #9 | **ยังไม่ทำ** — รอทีมเลือกภาษา (หัวข้อ 4) |

ทุกข้อวัดบนหน้าเว็บจริงด้วยสคริปต์ (ตำแหน่ง/ขนาดกล่อง, กล่องที่เลื่อนในตัว, ความสูงปุ่มในแถบเดียวกัน) ที่ 1366 / 1536 / 1024 / 768 / 390px ไม่ใช่ดูด้วยตาอย่างเดียว

## 2. กติกาที่ตั้งไว้ — ใช้ต่อในหน้าของทุกคน

```
ตัวควบคุมในแถบเดียวกัน (input / select / ปุ่ม)   สูง 44px ชิดขอบล่างเส้นเดียว
ตาราง / รายการ / เนื้อหาแท็บ                    ไม่ตั้ง max-height + overflow:auto — ให้หน้าเลื่อน
ปุ่ม                                          หลัก = เขียวทึบ · รอง = เขียวอ่อนขอบเขียว · อันตราย = แดง
                                              ห้ามปุ่มโปร่งใสแบบตัวหนังสือ (ไม่ดูเหมือนกดได้)
หัวกลุ่มในรายการ (เช่น ROUND 1 · 2 MATCHES)    แถบ teal-ghost + ขอบซ้ายเขียว + mono ตัวใหญ่
แถวในกล่อง                                     แถบของตัวเอง: พื้น panel-2 + ขอบ + padding เท่ากันซ้ายขวา
                                              ข้อมูลซ้าย ปุ่มขวา กึ่งกลางแนวตั้ง
ป้ายสถานะ / ตัวนับ                             อยู่ติดชื่อหรือหัวข้อ ไม่ลอยไปขอบขวา
กล่องว่าง                                      ไอคอน + ข้อความอยู่กลางกล่อง
สี                                             ใช้ token ใน :root เท่านั้น (โหมดมืด/สว่างตามเอง)
วันเวลา                                        fmtDateTime / fmtDateOnly จาก shared/dateFormat.ts
                                              ⚠️ ค่าใน <input type=date/datetime-local> ห้ามจัด format
```

## 3. ไฟล์ของ slice อื่นที่แตะ — ขอเจ้าของช่วยดู

| ไฟล์ | เจ้าของ | เปลี่ยนอะไร |
|---|---|---|
| `features/tournament/BracketTab.tsx` | slice 2 | เส้นบางทึบแบบเดียว 3 ความหมาย (เส้นผู้ชนะ · เส้นคั่นรอบในพบกันหมด · เส้นตามทีมที่ Highlight) · วาดใหม่เมื่อเปลี่ยนทีมที่เลือก · การ์ดไม่เขียนรอบซ้ำ (เก็บไว้ให้ screen reader) |
| `features/tournament/TournamentPage.tsx` | slice 2 | ป้ายสถานะทัวร์อยู่ติดชื่อ · Approved teams / Entry rules / Entry notes ย้ายเข้า dropdown ชื่อใหม่ **"Details, entry & approved teams"** · ปุ่ม View team เป็นสีเขียว |
| `features/tournament/DashboardTab.tsx` | slice 2 | "Top of the table" อยู่กริดเดียวกับรายการแมตช์ (ทุกกล่องกว้างครึ่งเท่ากัน) · ตัวนับติดหัวข้อ · คู่ทีมเป็นการ์ด VS |
| `features/tournament/EntryPanel.tsx` | slice 2 | ป้าย "In" → "Approved" |
| `features/home/HomePage.tsx` | Person 1 (คุยแล้ว) | Home แสดงแค่ทัวร์ที่เปิดรับ/กำลังแข่ง ≤ 6 + "See all tournaments" · ค้นหา/ตัวกรองอยู่หน้า Tournaments ที่เดียว |
| `features/inbox/BackendInbox.tsx` | Person 1 | Team entries: สถานะนำหน้า (คอลัมน์กว้างเท่าป้ายที่กว้างสุด) · "In" → "Approved" · ตัวนับติด "Needs action" |
| `features/profile/ProfileSettings.tsx` | Person 1 | Notification preferences เป็นกริดหลายช่องต่อแถว ติ๊กอยู่หน้าชื่อ |
| `styles/prototype.css` | ไฟล์กลาง | บล็อกใหม่ต่อท้ายไฟล์ ทุกบล็อกมีคอมเมนต์บอกเหตุผล · selector ส่วนใหญ่ผูกกับ class ของหน้า |
| `eslint.config.js` | ไฟล์กลาง | กฎวันเวลา **เฉพาะโฟลเดอร์ slice 3/4** |

เทสที่แก้ตาม (แก้แค่บรรทัดที่ตรวจข้อความ): `ScheduleTab.discovery.test.tsx` · `journeySourceStates.test.tsx` (ของ gust) · `HomePage.real.test.tsx`

**ผลตรวจ:** tsc ✅ · lint ✅ · เทส **1,110 / 1,110** (เทสกล้อง QR `QrCameraFrame` หมดเวลาเป็นบางครั้งตอนรันทั้งชุด รันแยกผ่าน — เป็นมาก่อนรอบนี้)

## 4. ที่จะทำต่อ

| # | งาน | รออะไร |
|---|---|---|
| 1 | **ภาษาเดียวทั้งแอป + ข้อความแจ้งผลบอกขั้นต่อไป** (เกิดอะไร → สถานะตอนนี้ → ขั้นต่อไป [ปุ่ม]) · slice 3/4 มีไทยปนใน 15 ไฟล์ | **ทีมเลือกภาษา** — ถ้าแปลเฉพาะ slice ตัวเอง แอปจะปนภาษามากกว่าเดิม ต้องทำพร้อมกันทุก slice · แนะนำไทย เพราะข้อความจาก BE เป็นไทยอยู่แล้ว |
| 2 | ย้ายค่ากลาง `input,select` / `.btn` ให้สูง 44px ใน base CSS (ตอนนี้ตั้งทีละแถบ) | Person 1 |
| 3 | ขยายกฎ ESLint วันเวลาไปทั้งโปรเจกต์ · เหลือ 6 จุดนอก slice 3/4: `RewardsPage.tsx:39` · `LiveCommunityTab.tsx:91/94` · `ExternalIdentityPanel.tsx:44` · `RefereeCoverageWarnings.tsx:19` · `ContractErrorDetails.tsx:7` | เจ้าของไฟล์ |
| 4 | ตารางกรอกสถิติตอนบันทึกผล ยังเลื่อนข้างได้โดยตั้งใจ (คอลัมน์ชื่อตรึงซ้าย) — **ยังไม่ได้วัด** เพราะข้อมูลเดโมไม่มีแมตช์ที่เปิดกรอกผล | ข้อมูลทดสอบ |
| 5 | กล่องสรุปด้านขวาของ `/request` ยังเลื่อนในตัวได้เล็กน้อย — **ตั้งใจคงไว้** (ติดจอขณะกรอกฟอร์มยาว แบบกล่องสรุปตอนชำระเงิน) | ถ้าทีมไม่เห็นด้วยบอกได้ |
| 6 | merge `ui-polish-s34` → `Final_Present` | รีวิวไฟล์ในหัวข้อ 3 |

**จาก BE รอบ 7 (ไม่ต้องแก้โค้ด แค่รู้ไว้ตอน QA):** ทีม/ทัวร์ที่เข้าเกณฑ์ปิดจะหายช้าได้ถึง 1 ชม. (งานเบื้องหลังชั่วโมงละครั้ง) · ตารางอันดับ Pick'em ช้าได้ถึง 5 วินาทีหลังยืนยันผล (BE แคชไว้) — สองอย่างนี้ไม่ใช่บั๊ก

## 5. ลองดูเอง

```
docker start ltms-mysql ltms-minio
cd backend && npm run migrate && npm run dev          (ฐานเดโมอยู่ที่ 050 — migrate จะขึ้น 052)
python frontend/scripts/audit-roles.py
cd frontend && npm run dev                              → http://localhost:5173
```

บัญชีเดโม (รหัส `abcd1234`): `admin@ku.th` · `org1@ku.th` · `ref1@ku.th` · `b4.lead@ku.th` · `viewer1@ku.th`
หน้าที่เห็นความต่างชัด: `/t/11/bracket` (เลือก Highlight team) · `/t/11/dashboard` · `/t/9/schedule` · `/matches` · `/inbox` · `/me` · `/admin/filters`
