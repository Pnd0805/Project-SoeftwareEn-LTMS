-- เวลาจบของแต่ละแมตช์ — ใช้เช็คกรรมการซ้อนเวลา (GUIDE/10 §8 F-4a, GUIDE/11 §4.1)
ALTER TABLE matches
  ADD COLUMN scheduled_end_time DATETIME NULL AFTER scheduled_time;
