-- กรรมการภายนอก: ที่เก็บเอกสารยืนยันตัวตน + เหตุผลที่ admin ปฏิเสธ (GUIDE/10 §8 F-13, F-15)
-- แบบเดียวกับ tournaments.organizer_external_verification_docs / organizer_external_rejection_reason
-- docs = array ของ S3 key (M16 presign) — ถูกล้างเป็น NULL ทันทีที่ admin ตัดสิน (PDPA)
ALTER TABLE tournament_referees
  ADD COLUMN external_verification_docs JSON NULL AFTER external_approval_status,
  ADD COLUMN external_rejection_reason TEXT NULL AFTER approved_at;
