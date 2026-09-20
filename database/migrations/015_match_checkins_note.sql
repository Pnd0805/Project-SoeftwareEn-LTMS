-- FE-note-manual-check-stored (19 ก.ย. 2569): M19 เช็คอินแทนโดยกรรมการเคยเก็บ "เหตุผลที่อนุโลม" ลง rejection_reason
-- ทำให้แถวที่เช็คอินสำเร็จมีข้อความในช่อง "เหตุผลที่ถูกปฏิเสธ" — แยกคอลัมน์ note ให้เป็นของตัวเอง แล้วย้ายแถวเก่า
ALTER TABLE match_checkins
  ADD COLUMN note VARCHAR(255) NULL AFTER rejection_reason;

UPDATE match_checkins
   SET note = rejection_reason, rejection_reason = NULL
 WHERE method = 'manual_by_referee' AND rejection_reason IS NOT NULL;
