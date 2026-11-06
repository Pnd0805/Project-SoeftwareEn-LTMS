"""
Default (since 2026-10-05): the schema-034 baseline flow only —
backend `qa-baseline.py restore` → `npm run migrate` → `audit-roles.py`.
BE_KN@d5bda6d's qa-baseline.sql already includes the September repairs, so the
eight repair steps below run only with `--legacy-repairs` (September baseline).

    python frontend/scripts/restore-qa.py                   ย้อน + migrate + audit (ใช้อันนี้)
    python frontend/scripts/restore-qa.py --legacy-repairs  ของเดิม 8 ขั้น — เฉพาะ baseline 21 ก.ย.

LEGACY (ข้างล่าง): repairs the September baseline. Do not reapply them to the
schema-034 baseline without reviewing compatibility.

frontend/scripts/restore-qa.py — ย้อนฐานกลับ QA baseline แล้วซ่อมให้ใช้งานได้ ในคำสั่งเดียว

    python frontend/scripts/restore-qa.py --legacy-repairs               ย้อน + ซ่อม + ตรวจ
    python frontend/scripts/restore-qa.py --legacy-repairs --no-restore  ซ่อม + ตรวจอย่างเดียว (เช่น รอบที่แล้ว backend ยังไม่เปิด)

ทำไมไม่ใช้ `python database/qa-baseline.py restore` ตรงๆ: baseline ถูกเก็บ 21 ก.ย. และ
ย้อนแล้วได้ฐานที่ backend ปัจจุบันใช้ไม่ได้ — เจอจริง 30 ก.ย. หลังย้อนแล้วไม่ได้ migrate
หน้าแมตช์กับตารางคะแนน 500 ทั้งหมด (ไม่มีคอลัมน์ started_at / actual_end_time / goals_for)
และ `npm run migrate` เองก็ไปไม่ถึงปลายทาง:
  - restore ลบเฉพาะตารางที่อยู่ใน dump — ตารางจาก migration หลัง 21 ก.ย. (user_reports ·
    match_result_complaints) ค้างอยู่ migration 024/028 จึงล้มด้วย ER_TABLE_EXISTS_ERROR
  - baseline มีคอลัมน์ supporting_docs อยู่แล้ว 029 จึงล้มด้วย ER_DUP_FIELDNAME
    แล้ว 030 (root ได้คนเดียว) ไม่เคยถูกสร้าง
  - baseline มีเคสผิดกฎบทบาท 12 เคส และไม่มีแอดมินคณะ (admin.eng) กับ root

ลำดับ: restore → migrate (ข้ามไฟล์ที่ผลของมันมีอยู่แล้วจริง เท่านั้น) → ใส่แอดมินจาก seed-test.sql
→ แก้ 12 เคสตามที่ผู้ใช้ตัดสินไว้ 29 ก.ย. → audit-roles.py

การแก้ 12 เคสผูกกับรายการตายตัวข้างล่าง ไม่ได้คิดเองจากผล audit — กฎของงานนี้คือห้ามเดาว่า
ควรถอดบทบาทไหน เคสใหม่ที่ไม่อยู่ในรายการจะโผล่ใน audit ตอนท้ายให้คนตัดสิน

exit code: 0 สะอาด · 1 audit ยังเจอเคส · 2 ต่อฐานไม่ได้ · 3 backend ไม่ตอบ (ซ่อมไม่ครบ)
· 4 migration ที่ล้มไม่เข้าเงื่อนไขข้ามอย่างปลอดภัย (ต้องให้คนดู)

ตั้งค่าได้ผ่าน env: LTMS_BACKEND_DIR · LTMS_API_BASE · LTMS_MYSQL_CONTAINER · LTMS_MYSQL_PASSWORD · LTMS_MYSQL_DB
"""
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

# line_buffering: audit-roles.py เป็นโปรเซสลูกที่เขียน stdout เดียวกัน — ไม่ flush แล้วผลของมันขึ้นก่อนหัวข้อ
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)

HERE = os.path.dirname(os.path.abspath(__file__))
# repo backend อยู่คนละที่ในแต่ละเครื่อง — ค่าตายตัวค่าเดียวเคยชี้ไปโฟลเดอร์ที่ไม่มีอยู่จริง แล้ว
# subprocess ล้มด้วย WinError 267 ซึ่งไม่บอกเลยว่าหาอะไรไม่เจอ · ไล่หาที่ที่มี qa-baseline.py จริง
BACKEND_CANDIDATES = [
    os.environ.get("LTMS_BACKEND_DIR", ""),
    os.path.abspath(os.path.join(HERE, "..", "..")),
    os.path.abspath(os.path.join(HERE, "..", "..", "..", "ltms-backend-shokun2")),
    "D:/Project-LTMS/BE_KN",
]
BACKEND_DIR = next((d for d in BACKEND_CANDIDATES
                    if d and os.path.isfile(os.path.join(d, "database", "qa-baseline.py"))), "")
API = os.environ.get("LTMS_API_BASE", "http://localhost:8000/api/v1")
CONTAINER = os.environ.get("LTMS_MYSQL_CONTAINER", "ltms-mysql")
PASSWORD = os.environ.get("LTMS_MYSQL_PASSWORD", "secret")
DB = os.environ.get("LTMS_MYSQL_DB", "ltms")
TEST_PASSWORD = "abcd1234"   # ทุกบัญชีทดสอบใน seed ใช้รหัสนี้
HERE = os.path.dirname(os.path.abspath(__file__))

# ผู้ใช้ตัดสิน 29 ก.ย.: ผู้จัดที่ลงแข่งทัวร์ตัวเอง → ย้ายผู้จัด (ทัวร์, จาก, ไป)
ORGANIZER_HANDOVER = [(22, 9201, 9001), (23, 9201, 9001), (14, 9001, 9201)]
# ผู้ใช้ตัดสิน 29 ก.ย.: กรรมการที่ขัดกับทีม/เป็นผู้จัดเอง → ถอดผ่าน F03 (ทัวร์, กรรมการ)
# ผ่าน API ไม่ใช่ UPDATE ตรง — F03 ถอดทุกแมตช์ของคนนั้นในทัวร์ด้วยและบอกว่าแมตช์ไหนขาดกรรมการ
REFEREE_REMOVALS = [(2, 9001), (2, 9002), (2, 9003), (4, 9001), (6, 9002), (6, 9003),
                    (14, 9003), (16, 9002), (16, 9003)]
# บัญชีที่ seed-test.sql มีแต่ baseline ไม่มี
SEED_ADMIN_USERS = (9004, 9099)
# ผู้ใช้ตัดสิน 30 ก.ย.: ถอดกรรมการข้างบนแล้วทัวร์ที่เปิดสาธารณะไปแล้วเหลือกรรมการไม่ครบ
# (backend ไม่ยอมให้เปิดสาธารณะแบบนั้น — REFEREES_INCOMPLETE) รางของผู้จัดจึงเด้งกลับไปขั้น 1
# เติมด้วย referee3/referee4 ซึ่งภายใน ไม่ต้องรอแอดมิน และไม่ขัดกับทีมไหนในห้าทัวร์นี้ (ทัวร์, กรรมการ)
REFEREE_TOPUPS = [(2, 9051), (2, 9052), (4, 9051), (6, 9051), (6, 9052), (14, 9051), (16, 9051), (16, 9052)]
# ผู้ใช้ตัดสิน 30 ก.ย.: แมตช์ #1 เปิดเช็คอินค้างตั้งแต่ 17 ก.ย. โดยไม่มีเวลา สนาม หรือกรรมการ
# ซึ่ง backend ปัจจุบันไม่ยอมให้เกิด (SCHEDULE_INCOMPLETE) — ถอยกลับ จัดให้ครบ แล้วเปิดเช็คอินใหม่
# ผู้ใช้ตัดสิน 30 ก.ย. (รอบสอง): แมตช์ 13 (t23) มีนัดครบแต่ไม่มีกรรมการ — สมหญิงเคยกรอกผลแมตช์นี้
# ในการทดสอบ จึงให้กรรมการจากพูลของทัวร์รับคุม · แมตช์ 14 (t22) ยังไม่มีนัด ปล่อยไว้เป็นเคส "ขั้น 6 ยังไม่เสร็จ"
MATCH_FIXES = [{"match": 1, "scheduledTime": "2026-10-05T02:00:00Z",
                "scheduledEndTime": "2026-10-05T04:00:00Z", "venue": "QA Court"},
               {"match": 13}]
# ผู้ใช้ตัดสิน 30 ก.ย. (รอบสาม) — seed จากก่อน OD-26 / migration 022 ที่หน้าจออ่านแล้วขัดกับขั้นตอนจริง
# แมตช์ 12 (t21): in_progress แต่มีผล submitted แล้ว — OD-26 ส่งผลได้หลังกดจบเท่านั้น → กรรมการกดจบผ่าน M11
FINISH_MATCHES = [12]
# t12: completed ก่อนมีคอลัมน์ champion_team_id → หน้าทัวร์ขึ้น "No champion was assigned"
# completeTournament เรียกซ้ำกับทัวร์ที่ปิดแล้วไม่ได้ (TOURNAMENT_COMPLETED) จึงเติมจากผลนัดชิงที่ยืนยันแล้ว
CHAMPION_BACKFILL = [12]


def step(title: str) -> None:
    print(f"\n── {title}")


def query(sql: str) -> list[dict]:
    cmd = ["docker", "exec", "-i", CONTAINER, "mysql", "--default-character-set=utf8mb4",
           "--batch", "-uroot", f"-p{PASSWORD}", DB]
    out = subprocess.run(cmd, input=sql.encode("utf-8"), capture_output=True)
    if out.returncode != 0:
        err = out.stderr.decode("utf-8", "replace")
        raise RuntimeError("\n".join(l for l in err.splitlines() if "Using a password" not in l))
    lines = out.stdout.decode("utf-8").splitlines()
    if not lines:
        return []
    head = lines[0].split("\t")
    return [dict(zip(head, l.split("\t"))) for l in lines[1:]]


def run(cmd: list[str], cwd: str) -> tuple[int, str]:
    out = subprocess.run(cmd, cwd=cwd, capture_output=True, shell=(os.name == "nt"),
                         env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    return out.returncode, (out.stdout + out.stderr).decode("utf-8", "replace")


# ── migrate ──────────────────────────────────────────────────────────────

def statements(path: str) -> list[str]:
    sql = open(path, encoding="utf-8").read()
    sql = re.sub(r"--[^\n]*", "", sql)
    return [s.strip() for s in sql.split(";") if s.strip()]


def split_top(body: str) -> list[str]:
    """แยกด้วยจุลภาคเฉพาะระดับบนสุด — ENUM('a','b') มีจุลภาคข้างในวงเล็บ"""
    parts, depth, cur = [], 0, ""
    for ch in body:
        depth += ch == "("
        depth -= ch == ")"
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    return parts + ([cur.strip()] if cur.strip() else [])


def already_in_place(filename: str, code: str) -> tuple[bool, str]:
    """ไฟล์ที่ล้มนี้ ผลของมันอยู่ในฐานครบแล้วจริงไหม — ข้ามได้เฉพาะสองรูปที่รู้จัก ที่เหลือให้คนดู"""
    path = os.path.join(BACKEND_DIR, "database", "migrations", filename)
    stmts = statements(path)

    if code == "ER_TABLE_EXISTS_ERROR":
        tables = []
        for s in stmts:
            m = re.match(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?", s, re.I)
            if not m:
                return False, f"มีคำสั่งอื่นนอกจาก CREATE TABLE ({s[:40]}…) ข้ามแล้วจะตกหล่น"
            tables.append(m.group(1))
        for t in tables:
            n = int(query(f"SELECT COUNT(*) AS n FROM `{t}`")[0]["n"])
            # ตารางค้างที่มีข้อมูล = ข้อมูลจากก่อน restore ปนกับ baseline — ไม่ใช่ของที่ควรเก็บเงียบๆ
            if n:
                return False, f"ตาราง {t} ค้างจากก่อน restore และมีข้อมูล {n} แถว"
        return True, f"ตาราง {', '.join(tables)} มีอยู่แล้วและว่าง (ค้างจากก่อน restore)"

    if code == "ER_DUP_FIELDNAME":
        for s in stmts:
            m = re.match(r"ALTER\s+TABLE\s+`?(\w+)`?\s+(.*)", s, re.I | re.S)
            if not m:
                return False, f"มีคำสั่งอื่นนอกจาก ALTER TABLE ({s[:40]}…)"
            table = m.group(1)
            for clause in split_top(m.group(2)):
                c = re.match(r"ADD\s+(?:COLUMN\s+)?`?(\w+)`?", clause, re.I)
                if not c:
                    return False, f"ALTER มีอย่างอื่นนอกจาก ADD COLUMN ({clause[:40]}…)"
                if not query(f"SHOW COLUMNS FROM `{table}` LIKE '{c.group(1)}'"):
                    return False, f"คอลัมน์ {table}.{c.group(1)} ยังไม่มี"
        return True, "คอลัมน์ที่ไฟล์นี้เพิ่มมีอยู่ครบแล้ว (baseline มีมาก่อน)"

    return False, f"error {code} ไม่ใช่รูปที่รู้วิธีข้าม"


def migrate() -> bool:
    backend = os.path.join(BACKEND_DIR, "backend")
    for _ in range(40):
        code, out = run(["npm", "run", "migrate"], backend)
        for line in out.splitlines():
            if line.startswith(("applied", "marked")):
                print("   " + line)
        if code == 0:
            print("   " + (re.search(r"up to date \(\d+ migrations\)", out) or ["เสร็จ"])[0])
            return True
        failed = re.search(r"FAILED (\S+\.sql)", out)
        err = re.search(r"code: '(\w+)'", out)
        if not failed or not err:
            print("   migrate ล้มแบบไม่รู้จัก:\n" + "\n".join(out.splitlines()[-15:]))
            return False
        ok, why = already_in_place(failed.group(1), err.group(1))
        if not ok:
            print(f"   ✗ {failed.group(1)} ล้ม ({err.group(1)}) และข้ามไม่ได้: {why}")
            return False
        query(f"INSERT INTO schema_migrations (name) VALUES ('{failed.group(1)}')")
        print(f"   ข้าม {failed.group(1)} — {why}")
    print("   วนเกิน 40 รอบ หยุดไว้ก่อน")
    return False


# ── แอดมินจาก seed-test.sql ──────────────────────────────────────────────

def seed_block(sql: str, table: str) -> tuple[str, list[str]]:
    m = re.search(rf"INSERT INTO {table}\s*\(([^)]*)\)\s*VALUES(.*?)\bAS new\b", sql, re.S)
    if not m:
        raise RuntimeError(f"หา INSERT INTO {table} ใน seed-test.sql ไม่เจอ")
    rows = [r.strip().rstrip(",") for r in m.group(2).splitlines() if r.strip().startswith("(")]
    return m.group(1), rows


def readd_admins() -> None:
    seed = open(os.path.join(BACKEND_DIR, "database", "seed-test.sql"), encoding="utf-8").read()
    ucols, urows = seed_block(seed, "users")
    acols, arows = seed_block(seed, "admin_scopes")
    ids = tuple(str(i) for i in SEED_ADMIN_USERS)
    users = [r for r in urows if re.match(r"\((\d+)", r).group(1) in ids]
    # admin_scopes: (admin_scope_id, user_id, …) — เลือกตาม user_id คอลัมน์ที่สอง
    scopes = [r for r in arows if re.match(r"\(\s*\d+\s*,\s*(\d+)", r).group(1) in ids]
    query(f"INSERT INTO users ({ucols}) VALUES {', '.join(users)} "
          f"AS new ON DUPLICATE KEY UPDATE full_name = new.full_name;\n"
          f"INSERT INTO admin_scopes ({acols}) VALUES {', '.join(scopes)} "
          f"AS new ON DUPLICATE KEY UPDATE scope_type = new.scope_type, faculty_id = new.faculty_id;")
    for r in query("SELECT u.email, a.scope_type, a.faculty_id FROM admin_scopes a "
                   "JOIN users u USING (user_id) ORDER BY a.admin_scope_id"):
        print(f"   {r['email']:<18} {r['scope_type']}{'' if r['faculty_id'] == 'NULL' else ' · คณะ ' + r['faculty_id']}")


# ── 12 เคสตามที่ตัดสินไว้ ──────────────────────────────────────────────────

def hand_over_organizers() -> None:
    for tid, frm, to in ORGANIZER_HANDOVER:
        n = query(f"UPDATE tournaments SET requested_by_user_id = {to} "
                  f"WHERE tournament_id = {tid} AND requested_by_user_id = {frm}; SELECT ROW_COUNT() AS n")
        print(f"   t{tid}: {frm} → {to}" + ("" if n and n[0]["n"] != "0" else " (ย้ายไว้แล้ว)"))


def api(method: str, path: str, body=None, token=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=None if body is None else json.dumps(body).encode())
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode("utf-8")
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


TOKENS: dict[str, str] = {}


def token(email: str) -> str:
    if email not in TOKENS:
        status, body = api("POST", "/auth/login", {"email": email, "password": TEST_PASSWORD})
        if status != 200:
            raise RuntimeError(f"ล็อกอิน {email} ไม่ได้: {status} {body}")
        TOKENS[email] = body["accessToken"]
    return TOKENS[email]


def backend_up() -> bool:
    try:
        api("GET", "/sport-types")
        return True
    except (urllib.error.URLError, OSError):
        print(f"   backend ไม่ตอบที่ {API} — เปิด `npm run dev` แล้วรันใหม่ด้วย --no-restore")
        return False


def remove_referees() -> bool:
    pairs = " OR ".join(f"(tr.tournament_id = {t} AND tr.user_id = {u})" for t, u in REFEREE_REMOVALS)
    rows = query(f"""
        SELECT tr.tournament_referee_id AS rid, tr.tournament_id AS tid, tr.user_id AS uid, o.email AS org
        FROM tournament_referees tr
        JOIN tournaments t ON t.tournament_id = tr.tournament_id
        JOIN users o ON o.user_id = t.requested_by_user_id
        WHERE tr.removed_at IS NULL AND ({pairs})
        ORDER BY tr.tournament_id, tr.tournament_referee_id""")
    if not rows:
        print("   ไม่มีแถวค้าง (ถอดไว้แล้ว)")
    ok = True
    for r in rows:
        status, body = api("DELETE", f"/tournaments/{r['tid']}/referees/{r['rid']}", token=token(r["org"]))
        uncovered = (body or {}).get("uncoveredMatches") if isinstance(body, dict) else None
        mark = "✓" if status == 200 else "✗"
        ok &= status == 200
        print(f"   {mark} t{r['tid']} กรรมการ {r['uid']} (rid {r['rid']}) → {status}"
              + (f" · แมตช์ที่ขาดกรรมการ {uncovered}" if uncovered else "")
              + ("" if status == 200 else f" {body}"))
    return ok


def email_of(user_id) -> str:
    return query(f"SELECT email FROM users WHERE user_id = {int(user_id)}")[0]["email"]


def organizer_of(tid) -> str:
    return query(f"SELECT u.email FROM tournaments t JOIN users u ON u.user_id = t.requested_by_user_id "
                 f"WHERE t.tournament_id = {int(tid)}")[0]["email"]


def top_up_referees() -> bool:
    """เชิญ → ตอบรับ ผ่าน F01/F05 เหมือนผู้ใช้จริง ไม่ INSERT ตรง — ด่านขัดผลประโยชน์ของ backend จึงได้ตรวจด้วย"""
    ok = True
    for tid, uid in REFEREE_TOPUPS:
        live = query(f"SELECT tournament_referee_id AS rid, invitation_status AS st FROM tournament_referees "
                     f"WHERE tournament_id = {tid} AND user_id = {uid} AND removed_at IS NULL")
        if live and live[0]["st"] == "accepted":
            print(f"   t{tid} กรรมการ {uid} ตอบรับไว้แล้ว")
            continue
        if live:
            rid = live[0]["rid"]
        else:
            status, body = api("POST", f"/tournaments/{tid}/referees", {"userId": uid, "isExternal": False},
                               token=token(organizer_of(tid)))
            if status != 201:
                print(f"   ✗ t{tid} เชิญ {uid} ไม่ได้: {status} {body}")
                ok = False
                continue
            rid = query(f"SELECT tournament_referee_id AS rid FROM tournament_referees "
                        f"WHERE tournament_id = {tid} AND user_id = {uid} AND removed_at IS NULL")[0]["rid"]
        status, body = api("POST", f"/referee-invitations/{rid}/accept", {}, token=token(email_of(uid)))
        ok &= status == 200
        print(f"   {'✓' if status == 200 else '✗'} t{tid} กรรมการ {uid} (rid {rid}) เชิญแล้วตอบรับ → {status}"
              + ("" if status == 200 else f" {body}"))
    return ok


def fix_matches() -> bool:
    ok = True
    for f in MATCH_FIXES:
        mid = f["match"]
        m = query(f"""SELECT m.tournament_id AS tid, m.match_status AS st, m.mode,
                             (m.venue IS NOT NULL AND m.venue <> '' AND m.scheduled_time IS NOT NULL
                              AND m.scheduled_end_time IS NOT NULL) AS fixture,
                             (SELECT COUNT(*) FROM match_checkins c WHERE c.match_id = m.match_id) AS checkins,
                             (SELECT COUNT(*) FROM sport_stat_definitions d
                              JOIN tournaments t ON t.sport_type_id = d.sport_type_id
                              WHERE t.tournament_id = m.tournament_id) AS statdefs
                      FROM matches m WHERE m.match_id = {mid}""")[0]
        org = token(organizer_of(m["tid"]))
        was_open = m["st"] == "checkin_open"

        if m["fixture"] != "1":
            if "venue" not in f:
                print(f"   ✗ #{mid} ยังไม่มีนัด และรายการนี้ไม่ได้กำหนดเวลาให้ — ไม่เดาเวลาเอง ต้องให้คนดู")
                ok = False
                continue
            if m["st"] not in ("scheduled", "checkin_open"):
                print(f"   ✗ #{mid} สถานะ {m['st']} เลยขั้นจัดนัดไปแล้ว แก้ผ่าน API ไม่ได้ — ต้องให้คนดู")
                ok = False
                continue
            if was_open:
                # ปิดเช็คอินลบรายการเช็คอินทั้งหมด — ยอมเฉพาะตอนที่ยังไม่มีใครเช็คอิน
                if m["checkins"] != "0":
                    print(f"   ✗ #{mid} มีเช็คอิน {m['checkins']} รายการ ปิดแล้วจะหาย — ไม่แตะ ต้องให้คนดู")
                    ok = False
                    continue
                status, body = api("POST", f"/matches/{mid}/close-checkin", token=org)
                print(f"   #{mid} ปิดเช็คอินชั่วคราวเพื่อจัดนัด → {status}" + ("" if status == 200 else f" {body}"))
            status, body = api("PATCH", f"/matches/{mid}/schedule", {k: f[k] for k in
                               ("scheduledTime", "scheduledEndTime", "venue")}, token=org)
            print(f"   #{mid} ตั้งเวลา {f['scheduledTime']} · {f['venue']} → {status}" + ("" if status == 200 else f" {body}"))
            if status != 200:
                ok = False
                continue

        need = (2 if m["statdefs"] != "0" else 1) if m["mode"] == "onsite" else 1
        pool = query(f"""SELECT tr.tournament_referee_id AS rid, tr.user_id AS uid FROM tournament_referees tr
            WHERE tr.tournament_id = {m['tid']} AND tr.removed_at IS NULL AND tr.invitation_status = 'accepted'
              AND NOT EXISTS (SELECT 1 FROM match_referees mr WHERE mr.match_id = {mid}
                              AND mr.tournament_referee_id = tr.tournament_referee_id AND mr.assignment_status = 'accepted')
            ORDER BY tr.tournament_referee_id""")
        have = int(query(f"SELECT COUNT(*) AS n FROM match_referees WHERE match_id = {mid} "
                         f"AND assignment_status = 'accepted'")[0]["n"])
        for r in pool[:max(0, need - have)]:
            status, body = api("POST", f"/tournaments/{m['tid']}/referee-requests/add-match",
                               {"tournamentRefereeId": int(r["rid"]), "matchId": mid}, token=org)
            if status != 201:
                print(f"   ✗ #{mid} ขอกรรมการ {r['uid']} ไม่ได้: {status} {body}")
                ok = False
                continue
            status, body = api("POST", f"/referee-requests/{body['id']}/accept", {}, token=token(email_of(r["uid"])))
            ok &= status == 200
            print(f"   {'✓' if status == 200 else '✗'} #{mid} กรรมการ {r['uid']} รับคุมแมตช์ → {status}"
                  + ("" if status == 200 else f" {body}"))

        if was_open and query(f"SELECT match_status AS st FROM matches WHERE match_id = {mid}")[0]["st"] == "scheduled":
            status, body = api("POST", f"/matches/{mid}/open-checkin", token=org)
            print(f"   #{mid} เปิดเช็คอินกลับเหมือนเดิม → {status}" + ("" if status == 200 else f" {body}"))
            ok &= status == 200
    return ok


def finish_matches() -> bool:
    ok = True
    for mid in FINISH_MATCHES:
        m = query(f"""SELECT m.match_status AS st, r.match_result_status AS result FROM matches m
                      LEFT JOIN match_results r ON r.match_id = m.match_id WHERE m.match_id = {mid}""")[0]
        if m["st"] != "in_progress" or m["result"] != "submitted":
            print(f"   #{mid} สถานะ {m['st']} · ผล {m['result']} — ไม่ใช่เคสนี้แล้ว ข้าม")
            continue
        ref = query(f"""SELECT u.email FROM match_referees mr
                        JOIN tournament_referees tr ON tr.tournament_referee_id = mr.tournament_referee_id
                        JOIN users u ON u.user_id = tr.user_id
                        WHERE mr.match_id = {mid} AND mr.assignment_status = 'accepted' AND tr.removed_at IS NULL
                        ORDER BY tr.tournament_referee_id LIMIT 1""")
        if not ref:
            print(f"   ✗ #{mid} ไม่มีกรรมการของแมตช์ให้กดจบ — ต้องให้คนดู")
            ok = False
            continue
        status, body = api("POST", f"/matches/{mid}/finish", token=token(ref[0]["email"]))
        ok &= status == 200
        print(f"   {'✓' if status == 200 else '✗'} #{mid} {ref[0]['email']} กดจบการแข่งขัน → {status}"
              + ("" if status == 200 else f" {body}"))
    return ok


def backfill_champions() -> bool:
    ok = True
    for tid in CHAMPION_BACKFILL:
        t = query(f"SELECT tournament_status AS st, champion_team_id AS champ FROM tournaments WHERE tournament_id = {tid}")[0]
        if t["st"] != "completed" or t["champ"] != "NULL":
            print(f"   t{tid} สถานะ {t['st']} · แชมป์ {t['champ']} — ไม่ใช่เคสนี้แล้ว ข้าม")
            continue
        # นัดชิง = นัดเดียวของทัวร์ที่ไม่มีนัดถัดไป — ถ้ามีมากกว่าหนึ่งหรือยังไม่ยืนยันผล ไม่เดา
        final = query(f"""SELECT m.match_id, r.winner_team_id AS winner, r.verified_at FROM matches m
                          JOIN match_results r ON r.match_id = m.match_id
                            AND r.match_result_status IN ('verified', 'walkover')
                          WHERE m.tournament_id = {tid} AND m.next_match_id IS NULL""")
        if len(final) != 1 or final[0]["winner"] == "NULL":
            print(f"   ✗ t{tid} หานัดชิงที่ยืนยันผลแล้วไม่ได้ชัด ({len(final)} นัด) — ต้องให้คนดู")
            ok = False
            continue
        f = final[0]
        # completed_by ไม่เติม — ไม่รู้ว่าใครเป็นคนปิดจริง และไม่มีจอไหนอ่าน
        query(f"UPDATE tournaments SET champion_team_id = {f['winner']}, "
              f"completed_at = COALESCE(completed_at, '{f['verified_at']}') "
              f"WHERE tournament_id = {tid} AND champion_team_id IS NULL")
        print(f"   ✓ t{tid} แชมป์ = ทีม {f['winner']} (ผู้ชนะนัดชิง #{f['match_id']} · ยืนยัน {f['verified_at']})")
    return ok


def baseline_only() -> int:
    """baseline schema-034 รวมการซ่อมไว้แล้ว — ซ่อมซ้ำอาจไปทับข้อมูลที่ backend ตั้งใจใส่"""
    print(f"backend: {BACKEND_DIR}")
    if "--no-restore" not in sys.argv:
        step("1/3 ย้อนฐานกลับ QA baseline")
        code, out = run([sys.executable, os.path.join("database", "qa-baseline.py"), "restore"], BACKEND_DIR)
        print("\n".join("   " + l for l in out.strip().splitlines()))
        if code != 0:
            return 2
    step("2/3 npm run migrate")
    if not migrate():
        return 4
    step("3/3 audit-roles.py")
    return subprocess.run([sys.executable, os.path.join(HERE, "audit-roles.py")]).returncode


def main() -> int:
    try:
        query("SELECT 1")
    except (RuntimeError, FileNotFoundError) as e:
        print(f"ต่อฐานข้อมูลไม่ได้ ({CONTAINER}) — เปิด Docker แล้ว `docker start ltms-mysql ltms-minio` ก่อน\n{e}")
        return 2

    if not BACKEND_DIR:
        print("หา repo backend ไม่เจอ (ต้องมี database/qa-baseline.py) — ลองแล้ว:\n   "
              + "\n   ".join(d for d in BACKEND_CANDIDATES if d)
              + "\nตั้ง LTMS_BACKEND_DIR ให้ชี้ไปที่ root ของ repo backend")
        return 2

    if "--legacy-repairs" not in sys.argv:
        return baseline_only()

    if "--no-restore" not in sys.argv:
        step("1/8 ย้อนฐานกลับ QA baseline")
        code, out = run([sys.executable, os.path.join("database", "qa-baseline.py"), "restore"], BACKEND_DIR)
        print("\n".join("   " + l for l in out.strip().splitlines()[-3:]))
        if code != 0:
            return 2

    step("2/8 npm run migrate")
    if not migrate():
        return 4

    step("3/8 แอดมินที่ baseline ไม่มี (จาก seed-test.sql)")
    readd_admins()

    step("4/8 ผู้จัดที่ลงแข่งทัวร์ตัวเอง → ย้ายผู้จัด")
    hand_over_organizers()

    api_ok = backend_up()
    if api_ok:
        step("5/8 กรรมการที่ขัดผลประโยชน์ → ถอดผ่าน F03")
        api_ok &= remove_referees()
        step("6/8 ทัวร์ที่เปิดสาธารณะแล้วแต่กรรมการไม่ครบ → เชิญ referee3/referee4")
        api_ok &= top_up_referees()
        step("7/8 แมตช์ที่นัดหรือกรรมการไม่ครบ → จัดนัด หากรรมการ (และเปิดเช็คอินกลับถ้าเคยเปิด)")
        api_ok &= fix_matches()
        step("8/8 seed จากก่อน OD-26/022 → กดจบแมตช์ที่ส่งผลแล้ว · เติมแชมป์ทัวร์ที่ปิดแล้ว")
        api_ok &= finish_matches()
        api_ok &= backfill_champions()

    step("audit-roles.py")
    audit = subprocess.run([sys.executable, os.path.join(HERE, "audit-roles.py")])
    if not api_ok:
        return 3
    return audit.returncode


if __name__ == "__main__":
    sys.exit(main())
