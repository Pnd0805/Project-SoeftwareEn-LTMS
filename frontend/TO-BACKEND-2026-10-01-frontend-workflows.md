# TO-BACKEND — งานที่ Frontend ยังต้องการ · 2026-10-01

Baseline: **BE_KN@d5bda6df8c02af5015b364d994a5a7bc587fa476**
ตรวจ `git ls-remote --heads origin` และ `git fetch origin` วันที่ 1 ต.ค. 2569
ไฟล์นี้เป็น handoff ใน frontend repository; ยังไม่ได้ส่งข้อความให้ทีมอื่น

## สรุปสถานะ: รอ merge หรือขอทำใหม่

| รายการ | สถานะ ณ remote ที่ตรวจ | งานต่อ |
|---|---|---|
| Announcement → Inbox ผู้ลงแข่ง | **ต้องการใหม่** | เพิ่ม notification producer และกำหนดผู้รับ |
| S05 ชื่อผู้บันทึกผล/เวลาส่งจริง | **ต้องการใหม่** | เพิ่ม read DTO ที่คงข้อมูลหลัง reload |
| Admin อ่าน dispute ที่ต้องรับช่วงตัดสิน | **ต้องการใหม่** | จัด read permission ให้ตรงกับสิทธิ์ resolve |
| logoUrl ใน `/me/teams` | **ต้องการใหม่** | เพิ่ม field ใน MyTeam mapper |
| logoUrl ใน public-profile `teams[]` | **ต้องการใหม่** | เพิ่ม field ใน TeamRef mapper |
| หลักฐาน user report เป็น private download URL | **ต้องการใหม่** | เซ็น URL หลังตรวจสิทธิ์ พร้อมวิธี refresh |
| ติดตามทีมและ notification feed | **ต้องการใหม่ / ต้องตกลง contract** | user follow ที่มีแล้วไม่ใช่ team follow |
| Profile ยอด MVP ที่ได้รับ | **ต้องการใหม่ / ต้องตกลง metric** | ระบุว่าเป็นยอดคะแนนโหวตหรือจำนวนรางวัล และช่วงเวลาที่นับ |
| F02 pool: canonical active invitation / effective counts | **ต้องการใหม่** | Notice C follow-up: see section 7 |
| entryNotes / soft filter | **มีใน BE_KN แล้ว — รอ FE** | ไม่ต้องทำ BE ใหม่และไม่ต้องรอ merge |
| หน้าเริ่มคำขอโอน/แลกแมตช์ | **BE มีแล้ว — รอ FE** | Inbox รับ/ปฏิเสธมีแล้ว แต่ FE ยังไม่มีหน้าส่งคำขอครบ |

### รอ merge

**ไม่พบรายการข้างต้นที่ทำเสร็จใน branch อื่นแต่ยังไม่เข้า BE_KN**
จึงไม่มีรายการที่ยืนยันว่า “รอ merge” ในรอบนี้ หากมีงาน local ที่ยังไม่ push
ขอ branch/commit และ contract เพิ่มก่อนเปลี่ยนสถานะ ห้ามถือว่ามี branch แล้วแปลว่าส่งมอบแล้ว

## 1. Announcement ต้องสร้าง notification ถึงผู้ลงแข่ง

- `backend/src/services/announcement.service.ts#createAnnouncement` สร้างแถวและคืน DTO
  โดยไม่มี notification producer; `comment_rewritten_after_removal` เป็นคนละ flow
- FE Inbox รองรับ `tournament_announcement` → `/t/:id/announcements` และ mark-read แล้ว
- ขอเพิ่ม producer และตกลงผู้รับ: approved application_players และหัวหน้าทีม
  พร้อมกติกา withdrawn/rejected รวมถึงผู้จัด/กรรมการ และ deduplicate คนที่มีหลายบทบาท
- ใช้ `relatedEntityType: tournament` และ tournament ID; ประกาศหนึ่งรายการไม่ควรแจ้งคนเดิมซ้ำ
- ตรวจรับ: ผู้จัดโพสต์ → ผู้รับอ่าน `/me/notifications` → reload ยังมี → เปิดประกาศถูกทัวร์
  ผู้เล่นอีกทัวร์ไม่ได้รับโดยไม่มีเหตุผลตาม contract

## 2. S05 ต้องคืนชื่อผู้บันทึกผลและเวลาส่งจริง

- `toVerifiedResult` ใน `backend/src/mappers/matchResult.mapper.ts` มี submittedRole
  แต่ไม่มี submittedBy/submittedAt ใน S05 read DTO
- POST submit ตอบ submittedBy เป็น numeric ID อยู่แล้ว แต่ไม่พอสำหรับชื่อและ reload
- ขอ `submittedBy: UserRef | null` และ `submittedAt: ISO string | null`
  กำหนดสิทธิ์ identity ของผลสาธารณะกับผลที่ยังไม่ final ให้ชัด
- FE ปัจจุบันแสดงบทบาทพร้อม name-unavailable; ไม่เดาชื่อกรรมการหรือเวลาปัจจุบัน
- ตรวจรับ: referee/team_leader/organizer ส่งผล → S05 อ่านซ้ำได้ identity/time จริง
  รวมผล auto verification โดยไม่เปิดข้อมูลส่วนตัวเกิน contract

## 3. Admin มีสิทธิ์ resolve หลัง 48 ชั่วโมง แต่ยังอ่าน dispute ไม่ได้

- `requireCanResolveDispute` อนุญาต university_wide admin รับช่วงตัดสินหลัง deadline
- S05 และ S03b ใน matchResult.service ใช้ `canSeeUnfinishedResult` ซึ่งรับเฉพาะ
  organizer / match referee / team leader ไม่รับ admin ที่ไม่มีสามบทบาทนี้
- ขอ authorized read ของ score, reason, actor/time, proposed score และ private evidence
  ระบุว่าอ่านได้เมื่อครบ 48 ชั่วโมงหรือใช้คิว admin แยก; รักษาสิทธิ์ faculty/root/บุคคลทั่วไป
- FE ยังไม่เปิดปุ่มตัดสินที่ไม่มีข้อมูลให้อ่าน; complaint decision เป็นอีก flow ที่มีแล้ว
- ตรวจรับ: university admin ที่ไม่ใช่ organizer/referee/leader อ่านและตัดสินได้ตาม deadline
  ข้อมูล private ไม่หลุดผ่าน public result DTO

## 4. logoUrl และ private user-report evidence

รายละเอียดและเกณฑ์ตรวจรับ: `TO-BACKEND-2026-10-01-avatar-logo-follow-up.md`

- MyTeam และ public-profile TeamRef ยังไม่ส่ง logoUrl; GET /teams และ team detail มีแล้ว
- userReport mapper ยังคืน `evidence: row.evidence ?? []` เป็น key ดิบ
- ขอ URL ที่ผ่านสิทธิ์ของ admin, TTL และวิธีขอ URL ใหม่; ห้ามทำหลักฐานเป็น public URL

## 5. Team follow/feed และ Profile MVP totals

- `/me/following` และ POST/DELETE `/users/:id/follow` ส่งมอบแล้ว FE เชื่อมแล้ว
- ไม่พบ team-follow route ใน remote branches ที่ตรวจ; ต้องตกลง route/DTO,
  read state หลัง login/reload, notification events, recipients และ deduplication
- ยังไม่พบ Profile read contract ของยอด MVP ที่ได้รับ; match MVP candidate votes
  ไม่ใช่ยอดสะสมส่วนบุคคล และห้ามเปิดคะแนนก่อนช่วงโหวตสิ้นสุดผ่าน endpoint สะสม
- ขอ metric, sport/time scope และนโยบายแก้ผล/ยกเลิกก่อน FE ทำหน้าสรุป

## 6. สิ่งที่มีแล้ว — ไม่ต้องทำ BE ใหม่

- entryNotes: tournament schema, mapper, repository รับ/อ่าน field แล้ว;
  `PATCH /tournaments/:id` ส่งผ่าน updateTournamentGeneral ลง `entry_notes` ได้
  FE `saveEntryNotes()` ยัง unavailable จึงเป็นงาน FE ต่อ ไม่ใช่ BE blocker
- Referee transfer/swap/add-match routes มีแล้ว; FE มี Inbox accept/decline
  งานหน้าส่ง transfer/swap เป็น FE backlog ไม่ใช่คำขอ BE ใหม่
- Dismiss report, rewritten-comment notification, match MVP, abandon,
  organizer-result, complaints, admin-users/scopes/audit, leader-transfer,
  tournament deletion, user follow และ career read มีใน baseline แล้ว
- qa-baseline schema 034: ผู้ใช้ restore แล้ว migrate = up to date และ audit C1-C8 สะอาด
  ไม่ต้อง merge หรือรัน legacy repair wrapper ซ้ำ; browser acceptance ยังแยกเปิดอยู่

## หลักฐาน remote branches

| Branch | Head |
|---|---|
| BE_KN | d5bda6d |
| backend | 6313a07 |
| backend_shokun | f222b12 |
| backend_shokun_2 | 01db599 |
| backend_step9-10 | 4813d1f |
| feat/be-c4-c5a | 871a681 |
| feat/be-c8-profile | f0e2c85 |
| feat/rewards-match-history | bb7ef10 |
| feature/tournaments-step-5 | d90893c |

อ่าน source ของ routes/services/mappers ที่เกี่ยวกับรายการข้างต้น:
announcement producer, S05 mapper, canSeeUnfinishedResult, MyTeam/TeamRef,
userReport evidence และ user/team follow/Profile reads ไม่พบงานของรายการขอใหม่
ที่พร้อมนำจาก branch อื่นมา merge ผลนี้เป็น source inspection ที่ remote heads
ไม่ครอบคลุมงาน local ที่ยังไม่ push และไม่ใช่ runtime/browser acceptance ของ branch อื่น

## 7. Notice C ต่อ: F02 pool ยังเลือกใบล่าสุดแทนสิทธิ์ที่ใช้งานจริง

สถานะ: **ต้องการ BE แก้เพิ่ม — ไม่พบตัวแก้พร้อม merge ใน remote branches ที่ตรวจ**

- Notice C แก้ permission gates ให้ถามทุกใบที่ยังมีผลแล้ว แต่
  `backend/src/repositories/tournamentReferee.repo.ts#findLatestPerUserByTournament`
  ยัง JOIN `MAX(tournament_referee_id)` ต่อ user แล้วค่อยกรอง `removed_at IS NULL`
- `referee.service.ts#listTournamentReferees` ยังใช้ query นี้สร้าง F02 items,
  acceptedCount และ awaitingAdminCount ดังนั้นใบล่าสุดที่ถูกถอดอาจทำให้ใบเก่าหายจาก pool;
  ใบล่าสุดที่รอ/ไม่ผ่าน admin อาจทำให้ผู้มีใบเก่าที่ approved ถูกแสดงว่ายังไม่ active
- FE planner ใช้ F02 row ที่ active และ invitation ID จริงเพื่อส่งคำขอ;
  FE ไม่สามารถสร้างแถวที่ API ไม่ส่งมา หรือเดา ID ของใบเก่าที่มีสิทธิ์ได้
- ขอ F02 คืน canonical row ที่มีสิทธิ์ใช้งานจริงต่อ user สำหรับการจัดแมตช์
  พร้อมกติกาประวัติ/reinvite และยอดนับที่สอดคล้องกับการ publish; pending external
  ที่เป็นใบใหม่ต้องไม่ทับสิทธิ์เก่าที่ approved แล้วยังไม่ถูกถอด
- เกณฑ์ตรวจรับ: ใบเก่า accepted/approved + ใบใหม่ pending/rejected/removed
  ยังคงมี active candidate ที่ใช้จัดแมตช์ได้; ไม่มีคนเดียวถูกนับซ้ำเป็นหลายที่นั่ง;
  ถอดสิทธิ์จริงแล้ว pool และ match assignments เปลี่ยนตาม contract
- ตรวจ repository ที่หัว branch ทั้งอีก 8 branches ในตารางด้านบนแล้ว
  ยังใช้ MAX(id) รูปแบบเดียวกัน ไม่มีตัวแก้สำหรับ F02 ที่ยืนยันว่ารอ merge

### QA fixture ที่ยังขาดสำหรับ private invitation

- หลัง restore ตรวจ DB แล้วไม่พบแถว invitation ที่ยังไม่ถูกถอดในทัวร์สถานะ private
  จึงยังยืนยัน pending-invite/private access ด้วย runtime/browser ไม่ได้จาก baseline นี้
- ขอ fixture ที่ไม่ขัดกฎบทบาท: private tournament + pending invitee และ fixture
  หลายใบ (old approved active + newer rejected/removed) เพื่อทดสอบ gates และ F02
- FE เปิด Inbox → tournament จาก referee_invited แล้ว และมี regression tests;
  Backend ยังเป็นผู้ตรวจสิทธิ์จริง การเปิด historical notice ไม่รับประกันสิทธิ์ปัจจุบัน
