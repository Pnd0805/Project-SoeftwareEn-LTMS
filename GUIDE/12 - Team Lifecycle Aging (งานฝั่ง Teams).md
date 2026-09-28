# 12 · Team Lifecycle Aging — ทีมที่ไม่ใช้งานต้องถูกปิดเอง (งานฝั่ง Teams)

> ถึง: คนทำ Teams (T01–T18) · จาก: ฝั่ง Referees (BE_KN) · 18 ก.ย. 2569
> สถานะ: ✅ **ทำแล้ว (21 ก.ย. 2569)** — `TeamRepo.sweepInactiveTeams()` ตาม proposal ข้อ 3 เป๊ะ เรียกจาก `getMyTeam`/`getTeamById` (T02/T03) ก่อน query จริง ทดสอบ HTTP จริงครบทั้ง 2 กฎ (no_registration/inactive_6_months) + เคส "ยังไม่ครบ/มีใบสมัครแล้ว/ยังแอคทีฟ" ที่ต้องไม่โดนกวาด ผ่านหมด · `requireTeamLeader` เพิ่มเช็ค `deleted_at IS NULL` แล้ว (404 TEAM_NOT_FOUND) ตามข้อเสนอ

## 1. กฎที่ SRS กำหนด (`docs/spec/04-teams-applications.md` §3)

| ทีม | เงื่อนไข | เวลา | `teams.deleted_reason` |
|---|---|---|---|
| ทีมใหม่ที่**ยังไม่เคยยื่นสมัครทัวร์** | ต้องยื่น P01 ครั้งแรก | **14 วัน**หลัง `created_at` | `no_registration` |
| ทีมที่**เคยแข่งแล้ว** | ไม่มี activity | **6 เดือน** | `inactive_6_months` |

ทั้งสองกรณี = soft delete (`deleted_at = NOW()`) → mapper แสดง `readinessStatus: 'Inactive'` ให้เองแล้ว (`team.mapper.ts:48`)

## 2. สิ่งที่มีอยู่แล้ว vs ยังไม่มี

| | สถานะ |
|---|---|
| `teams.deleted_at`, `deleted_reason ENUM('no_registration','leader_deleted','inactive_6_months')` | ✅ schema |
| `teams.last_competed_at` (ไว้นับ 6 เดือน) | ✅ schema · ยังไม่มีใครเขียนค่านี้ — **แก้โดยไม่แตะเลย** ใช้ `MAX(matches.updated_at) WHERE match_status='completed'` ในตัว sweep query แทนตามที่เสนอไว้ในข้อ 4 |
| mapper คืน `Inactive` เมื่อ `deleted_at` ไม่ว่าง | ✅ |
| T05 soft delete โดยหัวหน้า (`leader_deleted`) | ✅ |
| โค้ดที่ตั้ง `no_registration` / `inactive_6_months` | ✅ `TeamRepo.sweepInactiveTeams()` (`team.repo.ts`) |
| GUIDE/07 **B4** "soft delete เลย หรือมี `Inactive` ก่อน" | ✅ ตัดสินแล้วตามที่เสนอ — soft delete ตรงๆ ไม่มี `Inactive` แยก |

## 3. ข้อเสนอ (ทำแบบ lazy — โปรเจกต์ไม่มี cron)

ไม่ต้องมี background job: ให้ "กวาด" ตอนมีคนอ่านข้อมูลทีมอยู่แล้ว

```
sweepInactiveTeams()  ← เรียกจาก T02 (GET /me/teams) และ T03 (GET /teams/:id) ก่อน query จริง
  UPDATE teams t
     SET deleted_at = NOW(), deleted_reason = 'no_registration'
   WHERE t.deleted_at IS NULL
     AND t.created_at < NOW() - INTERVAL 14 DAY
     AND NOT EXISTS (SELECT 1 FROM tournament_applications a WHERE a.team_id = t.team_id);

  UPDATE teams t
     SET deleted_at = NOW(), deleted_reason = 'inactive_6_months'
   WHERE t.deleted_at IS NULL
     AND t.last_competed_at IS NOT NULL
     AND t.last_competed_at < NOW() - INTERVAL 6 MONTH
     AND NOT EXISTS (SELECT 1 FROM tournament_applications a
                      WHERE a.team_id = t.team_id
                        AND a.tournament_application_status IN ('pending','approved')
                        AND a.applied_at > NOW() - INTERVAL 6 MONTH);
```

- 2 query นี้ idempotent รันบ่อยแค่ไหนก็ได้ · จำกัดเฉพาะทีมของ user ที่เรียก (`t.leader_id = ?` หรือ `team_id = ?`) จะเบากว่า
- ทีมที่ถูกปิดแล้ว **ห้าม**ทำ T04/T07/T08/T09/P01 — เช็ค `deleted_at IS NULL` ใน `requireTeamLeader` ที่เดียวพอ
- **ต้องกัน**: ทีมที่มีใบสมัคร `approved` ในทัวร์ที่ยังไม่จบ ห้ามถูกปิดด้วย 6 เดือน (เงื่อนไข `applied_at` ข้างบนกันไว้แล้ว แต่ทัวร์ยาวเกิน 6 เดือนก็ควรเช็ค `tournaments.event_end_date > NOW()` เพิ่ม)

## 4. ที่ต้องตัดสินใจ (ไม่ต้องรอ — เสนอไว้)

| ประเด็น | เสนอ |
|---|---|
| B4: มี `Inactive` ก่อนลบไหม | **ไม่ต้อง** — soft delete พร้อม `deleted_reason` ก็คือ Inactive อยู่แล้ว mapper แสดงถูกต้อง · เพิ่มค่าใน ENUM = แก้ schema + ทุก mapper โดยไม่ได้อะไรเพิ่ม |
| ฟื้นทีมที่ถูกปิดได้ไหม | **ไม่** ใน MVP — หัวหน้าสร้างทีมใหม่ (`UNIQUE(name, sport_type_id)` ต้องปล่อยชื่อ: เปลี่ยนชื่อทีมที่ลบเป็น `name + ' (deleted #id)'` ตอน soft delete เหมือนที่หลายระบบทำ) |
| นับ 14 วันจาก "ยื่นสมัคร" หรือ "ได้รับอนุมัติ" | **ยื่น** (`tournament_applications` มีแถว) — ตรงคำว่า "ยื่น Tournament application" ใน SRS และไม่ลงโทษทีมที่ ORG ตอบช้า |
| `last_competed_at` ใครเขียน | ฝั่ง Matches/Results ตอนแมตช์ `completed` (verify ปกติ + walkover) — ถ้าไม่อยากแตะ ใช้ `MAX(m.updated_at) WHERE team_a_id/team_b_id = ? AND match_status='completed'` แทนได้ |
| แจ้งเตือนก่อนถูกปิด | ไม่มีระบบ notification — ให้ FE แสดง banner "ทีมจะถูกปิดใน N วันถ้าไม่สมัครทัวร์" จาก `created_at` ก็พอ |

## 5. seed-test ที่จะกระทบ

`seed-test.sql` ทีม 9001/9002/9004 `created_at` เป็น NOW() ตอนรัน → ครบ 14 วันแล้วจะถูกกวาดถ้าไม่มีใบสมัคร · ควรใส่ `tournament_applications` ให้ทีมทดสอบ หรือตั้ง `created_at` ใหม่ทุกครั้งที่ seed (seed ใช้ `ON DUPLICATE KEY UPDATE` อยู่แล้ว เพิ่ม `created_at = NOW()` ได้)
