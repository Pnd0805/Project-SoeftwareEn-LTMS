-- admin ขอเอกสารใหม่ได้โดยไม่ต้อง reject (GUIDE/10 §8 F-15/F-17)
-- needs_docs = ยังรออยู่ แต่ user ต้องส่งเอกสารใหม่ตามข้อความใน external_rejection_reason
ALTER TABLE tournament_referees
  MODIFY COLUMN external_approval_status
    ENUM('not_required','pending','needs_docs','approved','rejected') NOT NULL DEFAULT 'not_required';
