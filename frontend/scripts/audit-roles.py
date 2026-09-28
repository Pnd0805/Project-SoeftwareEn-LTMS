"""
frontend/scripts/audit-roles.py — ตรวจข้อมูลในฐานว่ามีเคสที่ผิดกฎบทบาทค้างอยู่ไหม

    python frontend/scripts/audit-roles.py

ทำไมต้องมี: backend กันเคสใหม่ผ่าน API ได้ครบแล้ว (TEAM_CONFLICT_OF_INTEREST ·
REFEREE_CONFLICT_OF_INTEREST · ORGANIZER_CANNOT_BE_REFEREE · INSUFFICIENT_REFEREES)
แต่ข้อมูลที่เขียนลงฐานตรงๆ ไม่ผ่านด่านพวกนั้นเลย — 29 ก.ย. เจอ 10 เคสที่มากับ
`database/qa-baseline.sql` เอง (ปกรณ์ลงแข่งในทัวร์ที่ตัวเองจัด ฯลฯ) และทุกครั้งที่
`qa-baseline.py restore` เคสพวกนี้จะกลับมาใหม่ ต้องมีอะไรสักอย่างที่มองหามันเสมอ

แต่ละข้ออ้างกฎจากเอกสาร (`docs/spec/*` ของ backend เป็น source of truth ตาม README ของมัน)
ออกด้วย exit code 1 ถ้าเจอเคส · 0 ถ้าสะอาด · 2 ถ้าต่อฐานไม่ได้ (Docker ไม่ขึ้น)

ตั้งค่าได้ผ่าน env: LTMS_MYSQL_CONTAINER (ltms-mysql) · LTMS_MYSQL_PASSWORD (secret) · LTMS_MYSQL_DB (ltms)
"""
import os
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

CONTAINER = os.environ.get("LTMS_MYSQL_CONTAINER", "ltms-mysql")
PASSWORD = os.environ.get("LTMS_MYSQL_PASSWORD", "secret")
DB = os.environ.get("LTMS_MYSQL_DB", "ltms")

# ใบสมัครที่ยังนับว่า "ลงแข่ง" — ถอน/ถูกปฏิเสธแล้วไม่นับ
LIVE_APP = "('pending','approved')"
# คำเชิญกรรมการที่ยังมีผล — ถูกถอด (removed_at) หรือปฏิเสธแล้วไม่นับ
LIVE_REF = "tr.removed_at IS NULL AND tr.invitation_status IN ('pending','accepted')"

CHECKS = [
    (
        "C1", "ผู้จัดลงแข่งในทัวร์นาเมนต์ของตัวเอง",
        "spec 02-roles-permissions §7 · มติ 18 ก.ย. (application.service → TEAM_CONFLICT_OF_INTEREST)",
        f"""
        SELECT t.tournament_id AS tournament, t.name AS tournament_name,
               u.user_id AS user_id, u.full_name AS who, a.team_id AS team, tt.name AS team_name,
               a.tournament_application_status AS entry
        FROM tournaments t
        JOIN users u ON u.user_id = t.requested_by_user_id
        JOIN tournament_applications a ON a.tournament_id = t.tournament_id
             AND a.tournament_application_status IN {LIVE_APP}
        JOIN team_members tm ON tm.team_id = a.team_id AND tm.user_id = t.requested_by_user_id
        JOIN teams tt ON tt.team_id = a.team_id
        WHERE t.tournament_status <> 'auto_deleted'
        ORDER BY t.tournament_id
        """,
    ),
    (
        "C2", "กรรมการของทัวร์อยู่ในทีมที่สมัครทัวร์เดียวกัน (แม้ไม่ได้อยู่ในรายชื่อลงแข่ง)",
        "spec 02 §7 · มติ 18 ก.ย. (referee.service → REFEREE_CONFLICT_OF_INTEREST)",
        f"""
        SELECT tr.tournament_id AS tournament, t.name AS tournament_name,
               u.user_id AS user_id, u.full_name AS who, a.team_id AS team, tt.name AS team_name,
               tr.invitation_status AS referee_status
        FROM tournament_referees tr
        JOIN tournaments t ON t.tournament_id = tr.tournament_id
        JOIN users u ON u.user_id = tr.user_id
        JOIN tournament_applications a ON a.tournament_id = tr.tournament_id
             AND a.tournament_application_status IN {LIVE_APP}
        JOIN team_members tm ON tm.team_id = a.team_id AND tm.user_id = tr.user_id
        JOIN teams tt ON tt.team_id = a.team_id
        WHERE {LIVE_REF} AND t.tournament_status <> 'auto_deleted'
        ORDER BY tr.tournament_id, u.user_id
        """,
    ),
    (
        "C3", "ผู้จัดเป็นกรรมการของทัวร์ตัวเอง",
        "spec 02 §7 · มติ 18 ก.ย. (F01 → ORGANIZER_CANNOT_BE_REFEREE)",
        f"""
        SELECT tr.tournament_id AS tournament, t.name AS tournament_name,
               u.user_id AS user_id, u.full_name AS who, tr.invitation_status AS referee_status
        FROM tournament_referees tr
        JOIN tournaments t ON t.tournament_id = tr.tournament_id AND t.requested_by_user_id = tr.user_id
        JOIN users u ON u.user_id = tr.user_id
        WHERE {LIVE_REF}
        ORDER BY tr.tournament_id
        """,
    ),
    (
        "C4", "กรรมการที่คุมแมตช์เป็นสมาชิกทีมใดทีมหนึ่งในแมตช์นั้น",
        "spec 02 §7: \"Referee ต้องไม่ใช่ผู้แข่งขันใน Match ที่ตน officiate\"",
        """
        SELECT m.match_id AS match_id, m.tournament_id AS tournament,
               u.user_id AS user_id, u.full_name AS who, tm.team_id AS team
        FROM match_referees mr
        JOIN matches m ON m.match_id = mr.match_id
        JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
        JOIN users u ON u.user_id = tr.user_id
        JOIN team_members tm ON tm.user_id = tr.user_id AND tm.team_id IN (m.team_a_id, m.team_b_id)
        WHERE mr.assignment_status = 'accepted'
        ORDER BY m.match_id
        """,
    ),
    (
        "C5", "แมตช์ที่เลยขั้นนัดหมายแล้วแต่กรรมการไม่ครบ",
        "SRS BR-10/BR-11 · spec 05 ด่าน 2 (M10 start → INSUFFICIENT_REFEREES) · spec 02 §6",
        """
        SELECT x.match_id, x.tournament, x.status, x.mode, x.needed, x.have FROM (
          SELECT m.match_id, m.tournament_id AS tournament, m.match_status AS status, m.mode,
                 IF(m.mode = 'onsite' AND EXISTS (SELECT 1 FROM sport_stat_definitions d
                                                  WHERE d.sport_type_id = t.sport_type_id), 2, 1) AS needed,
                 (SELECT COUNT(*) FROM match_referees mr
                   WHERE mr.match_id = m.match_id AND mr.assignment_status = 'accepted') AS have
          FROM matches m JOIN tournaments t ON t.tournament_id = m.tournament_id
          WHERE m.match_status <> 'scheduled'
            AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL
            -- แพ้บาย/ไม่มีการแข่งจริง ไม่ต้องมีกรรมการ (OD-07)
            AND NOT EXISTS (SELECT 1 FROM match_results r
                             WHERE r.match_id = m.match_id AND r.match_result_status = 'walkover')
        ) x WHERE x.have < x.needed
        ORDER BY x.match_id
        """,
    ),
    (
        "C6", "การเช็คอินที่ยืนยัน/ปฏิเสธโดยคนที่ไม่ใช่กรรมการของแมตช์นั้น",
        "SDS wk12 น.44 (verify/reject = requireReferee · NF-SE-03) · spec 07 §1 · OD-09",
        """
        SELECT c.match_checkin_id AS checkin, c.match_id AS match_id, c.method,
               c.match_checkin_status AS status, u.user_id AS decided_by, u.full_name AS who
        FROM match_checkins c
        JOIN users u ON u.user_id = c.verified_by_referee_id
        WHERE NOT EXISTS (
          SELECT 1 FROM match_referees mr
          JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
          WHERE mr.match_id = c.match_id AND tr.user_id = c.verified_by_referee_id
            AND mr.assignment_status = 'accepted')
        ORDER BY c.match_id, c.match_checkin_id
        """,
    ),
]


def query(sql: str) -> list[dict]:
    cmd = ["docker", "exec", "-i", CONTAINER, "mysql", "--default-character-set=utf8mb4",
           "--batch", f"-uroot", f"-p{PASSWORD}", DB]
    out = subprocess.run(cmd, input=sql.encode("utf-8"), capture_output=True)
    if out.returncode != 0:
        err = out.stderr.decode("utf-8", "replace")
        raise RuntimeError("\n".join(l for l in err.splitlines() if "Using a password" not in l))
    lines = out.stdout.decode("utf-8").splitlines()
    if not lines:
        return []
    head = lines[0].split("\t")
    return [dict(zip(head, l.split("\t"))) for l in lines[1:]]


def main() -> int:
    try:
        query("SELECT 1")
    except (RuntimeError, FileNotFoundError) as e:
        print(f"ต่อฐานข้อมูลไม่ได้ ({CONTAINER}) — เปิด Docker แล้ว `docker start ltms-mysql` ก่อน\n{e}")
        return 2

    total = 0
    for code, title, rule, sql in CHECKS:
        rows = query(sql)
        total += len(rows)
        mark = "✗" if rows else "✓"
        print(f"{mark} {code} · {title} — {len(rows)} เคส")
        print(f"    กฎ: {rule}")
        for r in rows:
            print("    - " + " · ".join(f"{k}={v}" for k, v in r.items()))
    print()
    print(f"รวม {total} เคส" if total else "สะอาด — ไม่เจอเคสที่ผิดกฎบทบาท")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
