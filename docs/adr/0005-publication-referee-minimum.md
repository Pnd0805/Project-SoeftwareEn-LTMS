# ADR-0005: Minimum Referees for Tournament Publication

- Status: Superseded
- Date: 2026-09-08
- Superseded: 2026-09-15 by `docs/spec/03-tournaments.md` and `docs/spec/05-referees.md`

## Context

The Tournament publication rule requires accepted referees, but the current Tournament model does not carry per-match mode information and the referee minimum for publication is unspecified.

## Decision

C13 requires at least one accepted Tournament referee. The stricter two-referee rule applies later to on-site matches that record statistics, at match execution/result verification time.

> **Superseded decision:** หลังมติทีมล่าสุด Tournament จะมี bracket skeleton และ planned schedule ตั้งแต่ private preparation จึงสามารถคำนวณ minimum active referee capacity จาก peak concurrent match demand ก่อน publication ได้ ไม่ใช้ค่าคงที่ขั้นต่ำ 1 คนอีกต่อไป

## Consequences

- Publishing does not depend on Match records that do not exist yet.
- Match-level rules remain enforceable when the relevant mode and statistics are known.
