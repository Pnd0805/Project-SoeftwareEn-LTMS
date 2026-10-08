# -*- coding: utf-8 -*-
"""
seed-demo.py — ข้อมูลเริ่มต้นสำหรับพรีเซนต์ LTMS (ทุกขั้นของวงจรมีทัวร์ค้างอยู่ตรงขั้นนั้น)

    python database/seed-demo.py                         พรีเซนต์พรุ่งนี้ 13:00 (ค่าตั้งต้น)
    python database/seed-demo.py 2026-10-09T13:00        ระบุวันเวลาพรีเซนต์เอง (เวลาไทย)

ทำอะไร:
  1. ล้างทุกตารางที่ไม่ใช่ข้อมูลอ้างอิง (คงไว้: คณะ ภาควิชา กีฬา นิยามสถิติ แคตตาล็อกเหรียญ schema_migrations)
  2. ใส่บัญชีผู้ใช้และสิทธิ์แอดมินด้วย SQL (รหัสผ่านเดิมของชุดทดสอบ · ยืนยันอีเมลแล้วทุกบัญชี)
  3. ที่เหลือทั้งหมดสร้างผ่าน API จริง — ทีม ทัวร์ ใบสมัคร สาย แมตช์ ผล ความเห็น ฯลฯ
     จึงผ่านกฎทุกข้อของระบบ และแจ้งเตือน/เหรียญ/audit log เกิดขึ้นเอง
  4. ย้อนเวลาด้วย SQL เฉพาะจุดที่ API ไม่ยอม (แมตช์ที่ต้อง "แข่งไปแล้ว" — ระบบบังคับหน้าต่างเวลาเช็คอิน/เริ่มแข่ง)

ต้องมี: backend รันที่ localhost:8000 · container ltms-mysql · backend/.env (อ่าน JWT_SECRET มาออก token เอง
เพราะ /auth/login จำกัด 60 ครั้ง/15 นาที/IP ซึ่งไม่พอสำหรับ ~80 บัญชี)

🔴 สคริปต์นี้ "ล้างฐานข้อมูล" — ห้ามรันกับฐานที่มีข้อมูลจริง
"""
import base64, hashlib, hmac, json, os, subprocess, sys, time
import urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)

HERE = os.path.dirname(os.path.abspath(__file__))
API = os.environ.get("LTMS_API_BASE", "http://localhost:8000/api/v1")
CONTAINER = os.environ.get("LTMS_MYSQL_CONTAINER", "ltms-mysql")
DB_PASSWORD = os.environ.get("LTMS_MYSQL_PASSWORD", "secret")
DB = os.environ.get("LTMS_MYSQL_DB", "ltms")
TH = timezone(timedelta(hours=7))

NOW = datetime.now(TH)
if len(sys.argv) > 1:
    DEMO = datetime.fromisoformat(sys.argv[1]).replace(tzinfo=TH)
else:
    DEMO = (NOW + timedelta(days=1)).replace(hour=13, minute=0, second=0, microsecond=0)


def iso(dt):  # API รับ ISO พร้อม offset
    return dt.astimezone(TH).strftime("%Y-%m-%dT%H:%M:%S+07:00")


def utc_sql(dt):  # ฐานเก็บ UTC
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def day(dt):
    return dt.astimezone(TH).strftime("%Y-%m-%d")


# ---------------------------------------------------------------- SQL / API helpers
def sql(statement, fetch=False):
    cmd = ["docker", "exec", "-i", CONTAINER, "mysql", "-uroot", f"-p{DB_PASSWORD}",
           "--default-character-set=utf8mb4", "-N", DB]
    r = subprocess.run(cmd, input=statement.encode("utf-8"), capture_output=True)
    err = "\n".join(l for l in r.stderr.decode("utf-8", "replace").splitlines() if "Warning" not in l)
    if r.returncode != 0:
        raise RuntimeError(f"SQL failed: {err}\n--- {statement[:400]}")
    out = r.stdout.decode("utf-8", "replace").strip()
    return [l.split("\t") for l in out.splitlines()] if fetch else None


def read_env(key):
    with open(os.path.join(HERE, "..", "backend", ".env"), encoding="utf-8") as f:
        for line in f:
            if line.startswith(key + "="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError(f"{key} not found in backend/.env")


JWT_SECRET = None
_tokens = {}


def b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=")


def token(uid):
    if uid not in _tokens:
        head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
        now = int(time.time())
        body = b64(json.dumps({"sub": str(uid), "tv": 0, "iat": now, "exp": now + 3600}, separators=(",", ":")).encode())
        sig = b64(hmac.new(JWT_SECRET.encode(), head + b"." + body, hashlib.sha256).digest())
        _tokens[uid] = (head + b"." + body + b"." + sig).decode()
    return _tokens[uid]


class ApiError(Exception):
    pass


def api(method, path, uid=None, data=None, ok=(200, 201, 204)):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(API + path, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if uid is not None:
        req.add_header("Authorization", "Bearer " + token(uid))
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw, status = r.read().decode("utf-8"), r.status
    except urllib.error.HTTPError as e:
        raw, status = e.read().decode("utf-8", "replace"), e.code
    if status not in ok:
        raise ApiError(f"{method} {path} (user {uid}) → {status} {raw[:500]}\n    payload: {json.dumps(data, ensure_ascii=False)[:300]}")
    return json.loads(raw) if raw.strip() else None


def items(resp):
    return resp["items"] if isinstance(resp, dict) and "items" in resp else resp


def step(msg):
    print(f"\n== {msg}")


# ---------------------------------------------------------------- accounts
# (id, email, ชื่อ, เพศ, ปีเกิด, user_type, คณะ, ภาควิชา, ชั้นปี)
ROOT, ADMIN, ADMIN_ENG, ADMIN_SCI = 1, 2, 3, 4
ORG1, ORG2, ORG3 = 11, 12, 13
REF1, REF2, REF3, REF4, EXT1, EXT2 = 21, 22, 23, 24, 25, 26
VIEW1, VIEW2, VIEW3, BANNED, NEWBIE, FREE1 = 31, 32, 33, 34, 35, 36

USERS = [
    (ROOT, "root@ku.th", "ผู้ดูแลระบบสูงสุด", "other", 1985, "staff", None, None, None),
    (ADMIN, "admin@ku.th", "สมชาย ใจดี", "male", 1980, "staff", 1, 1, None),
    (ADMIN_ENG, "admin.eng@ku.th", "วิภาวรรณ ศรีวิศวะ", "female", 1984, "staff", 1, 2, None),
    (ADMIN_SCI, "admin.sci@ku.th", "ธนากร วิทยาการ", "male", 1986, "staff", 2, 6, None),
    (ORG1, "org1@ku.th", "ปกรณ์ จัดการดี", "male", 2003, "student", 1, 1, 4),
    (ORG2, "org2@ku.th", "ณัฐธิดา ประสานงาน", "female", 2003, "student", 2, 7, 4),
    (ORG3, "org3@ku.th", "กิตติพงษ์ สโมสร", "male", 2004, "student", 4, 16, 3),
    (REF1, "ref1@ku.th", "วีระชัย นกหวีดทอง", "male", 1990, "staff", 7, 25, None),
    (REF2, "ref2@ku.th", "อรทัย กฎกติกา", "female", 1992, "staff", 7, 25, None),
    (REF3, "ref3@ku.th", "สุรเชษฐ์ ยุติธรรม", "male", 2002, "student", 7, 25, 4),
    (REF4, "ref4@ku.th", "พิมพ์ชนก เที่ยงตรง", "female", 2003, "student", 7, 25, 4),
    (EXT1, "ref.ext1@gmail.com", "สมเกียรติ ผู้ตัดสินอาชีพ", "male", 1988, "external", None, None, None),
    (EXT2, "ref.ext2@gmail.com", "ดารุณี กรรมการรับเชิญ", "female", 1991, "external", None, None, None),
    (VIEW1, "viewer1@ku.th", "ชนาธิป แฟนกีฬา", "male", 2005, "student", 5, 18, 2),
    (VIEW2, "viewer2@ku.th", "ปาณิสรา เชียร์สุดใจ", "female", 2006, "student", 6, 23, 1),
    (VIEW3, "viewer3@ku.th", "ธีรภัทร ชอบทายผล", "male", 2004, "student", 8, 28, 3),
    (BANNED, "banned@ku.th", "อดิศร ถูกระงับ", "male", 2004, "student", 3, 11, 3),
    (NEWBIE, "newbie@ku.th", "ศุภวิชญ์ มือใหม่", "male", 2007, "student", 5, 19, 1),
    (FREE1, "free1@ku.th", "กัญญารัตน์ ยังไม่มีทีม", "female", 2006, "student", 6, 21, 2),
]

MALE = ["ธนวัฒน์", "ภูมิพัฒน์", "กฤษณะ", "ณัฐวุฒิ", "พีรพล", "ชยพล", "วรเมธ", "ศุภกร", "อนุชา", "ธีรเดช", "ปิยะพงษ์",
        "จิรายุ", "รัชชานนท์", "สิรวิชญ์", "ภาณุวัฒน์", "นนทกร", "เจษฎา", "อภิวัฒน์", "ก้องภพ", "ธนกฤต", "วชิรวิทย์",
        "ปุณณวิช", "ณภัทร", "กันตพงศ์", "ชัยวัฒน์", "สหรัฐ", "พงศกร", "ธนดล", "อิทธิพล", "ศิวกร", "คณิน", "ปรเมศวร์"]
FEMALE = ["ณัฐธิดา", "พิมพ์ลภัส", "กัญญาณัฐ", "ชนิกานต์", "ธัญชนก", "สุพิชญา", "อริสรา", "วรรณิดา", "ปาริฉัตร", "เบญญาภา",
          "ศิริลักษณ์", "กมลชนก", "ณิชากร", "พรรณวษา", "จิดาภา"]
LAST = ["แสงทอง", "ศรีสุข", "บุญมา", "จันทร์เพ็ญ", "ทองคำ", "ปัญญาดี", "เกษมสุข", "พงษ์ไพบูลย์", "มณีรัตน์", "ธารารักษ์",
        "วงศ์สวัสดิ์", "อินทรีย์", "สุวรรณภูมิ", "รุ่งเรือง", "ชัยมงคล", "นาคประเสริฐ", "ศักดิ์ดี", "พรหมมา", "กิตติวงศ์"]

# (รหัสย่อ, ชื่อทีม, กีฬา, คณะ, เพศ, จำนวนผู้เล่น)
TEAM_DEFS = [
    ("b1", "วิศวะ Smashers", 3, 1, "male", 2), ("b2", "Sci Shuttle", 3, 2, "male", 2),
    ("b3", "เกษตรตบสนั่น", 3, 3, "male", 2), ("b4", "BBA Birdies", 3, 4, "female", 2),
    ("b5", "มนุษย์ลูกขนไก่", 3, 5, "female", 2), ("b6", "Econ Rackets", 3, 8, "male", 2),
    ("k1", "วิศวะ Ballers", 2, 1, "male", 6), ("k2", "Sci Hoopers", 2, 2, "male", 5),
    ("k3", "วิศวะ Lady Hoops", 2, 1, "female", 6), ("k4", "บริหาร Queens", 2, 4, "female", 5),
    ("r1", "RoV วิศวะ Dragons", 4, 1, "male", 5), ("r2", "RoV Sci Phoenix", 4, 2, "male", 5),
    ("f1", "ฟุตบอลวิศวกรรมศาสตร์", 1, 1, "male", 11), ("f2", "ฟุตบอลวิทยาศาสตร์", 1, 2, "male", 11),
]
FACULTY_DEPT = {1: 1, 2: 6, 3: 11, 4: 14, 5: 18, 6: 21, 7: 25, 8: 28}

PLAYERS = {}   # code -> [user ids]  (ตัวแรก = หัวหน้าทีม)
TEAM = {}      # code -> team id


def build_players():
    uid, mi, fi = 100, 0, 0
    for code, _name, _sport, fac, gender, n in TEAM_DEFS:
        PLAYERS[code] = []
        for i in range(n):
            uid += 1
            if gender == "male":
                first, mi = MALE[mi % len(MALE)], mi + 1
            else:
                first, fi = FEMALE[fi % len(FEMALE)], fi + 1
            email = f"{code}.lead@ku.th" if i == 0 else f"{code}.p{i + 1}@ku.th"
            USERS.append((uid, email, f"{first} {LAST[uid % len(LAST)]}", gender, 2003 + (uid % 4), "student",
                          fac, FACULTY_DEPT[fac] + (uid % 2), 1 + (uid % 4)))
            PLAYERS[code].append(uid)


def lead(code):
    return PLAYERS[code][0]


KEEP = {"faculties", "departments", "sport_types", "sport_stat_definitions", "rewards", "schema_migrations"}


def reset_database():
    step("ล้างข้อมูลเดิม + ใส่บัญชีผู้ใช้")
    pw = sql("SELECT password_hash FROM users WHERE email='somchai@ku.th' OR email='admin@ku.th' LIMIT 1", fetch=True)
    if not pw:
        raise RuntimeError("หา password_hash ของชุดทดสอบไม่เจอ — restore qa-baseline ก่อนรันครั้งแรก")
    pw_hash = pw[0][0]
    tables = [r[0] for r in sql(f"SELECT table_name FROM information_schema.tables WHERE table_schema='{DB}' AND table_type='BASE TABLE'", fetch=True)]
    wipe = "SET FOREIGN_KEY_CHECKS=0;\n" + "\n".join(f"TRUNCATE TABLE `{t}`;" for t in tables if t not in KEEP) + "\nSET FOREIGN_KEY_CHECKS=1;"
    sql(wipe)

    rows = []
    for uid, email, name, gender, born, utype, fac, dept, year in USERS:
        n = lambda v: "NULL" if v is None else str(v)
        rows.append(f"({uid},'{name}','{email}','{pw_hash}','{gender}','{born}-0{1 + uid % 9}-1{uid % 9}','{utype}',"
                    f"{n(fac)},{n(dept)},{n(year)},1,NOW() - INTERVAL 40 DAY)")
    sql("INSERT INTO users (user_id,full_name,email,password_hash,gender,birth_date,user_type,faculty_id,department_id,year,"
        "email_verified,created_at) VALUES\n" + ",\n".join(rows) + ";")
    sql(f"""INSERT INTO admin_scopes (user_id,scope_type,faculty_id,created_at,created_by) VALUES
        ({ROOT},'root',NULL,NOW() - INTERVAL 40 DAY,NULL),
        ({ADMIN},'university_wide',NULL,NOW() - INTERVAL 40 DAY,{ROOT}),
        ({ADMIN_ENG},'faculty',1,NOW() - INTERVAL 30 DAY,{ADMIN}),
        ({ADMIN_SCI},'faculty',2,NOW() - INTERVAL 30 DAY,{ADMIN});""")
    print(f"   บัญชี {len(USERS)} · แอดมิน 4")


# ---------------------------------------------------------------- teams
def create_teams():
    step("สร้างทีม 14 ทีม + สมาชิก")
    for code, name, sport, _fac, _g, _n in TEAM_DEFS:
        t = api("POST", "/teams", lead(code), {"name": name, "sportTypeId": sport})
        TEAM[code] = t["id"]
        for member in PLAYERS[code][1:]:
            inv = api("POST", f"/teams/{t['id']}/invitations", lead(code), {"invitedUserId": member})
            api("POST", f"/invitations/{inv['id']}/accept", member)
        print(f"   {code} #{t['id']} {name} ({len(PLAYERS[code])} คน)")


# ---------------------------------------------------------------- tournaments
REG_OPEN = NOW - timedelta(minutes=2)


def create_tournament(org, name, sport, fmt, fac, *, max_teams=4, min_teams=2, venue, reg_end=None, start=None, end=None,
                      gender="any", min_age=None, max_age=None, best_of=None, notes=None, dispute=72):
    start = start or (DEMO + timedelta(days=14))
    body = {"name": name, "sportTypeId": sport, "bracketFormat": fmt, "scopeType": "faculty", "organizingFacultyId": fac,
            "registrationStart": iso(REG_OPEN), "registrationEnd": iso(reg_end or (DEMO + timedelta(days=7))),
            "eventStartDate": day(start), "eventEndDate": day(end or (start + timedelta(days=1))),
            "maxTeams": max_teams, "minTeams": min_teams, "venue": venue, "genderRequirement": gender,
            "disputeWindowHours": dispute}
    if min_age is not None: body["minAge"] = min_age
    if max_age is not None: body["maxAge"] = max_age
    if best_of is not None: body["bestOf"] = best_of
    if notes: body["entryNotes"] = notes
    t = api("POST", "/tournaments", org, body)
    print(f"   T{t['id']} {name} [{t['status']}]")
    return t["id"]


def add_referees(tid, org, refs):
    for r in refs:
        api("POST", f"/tournaments/{tid}/referees", org, {"userId": r, "isExternal": False})
        inv = next(i for i in items(api("GET", "/me/referee-invitations", r)) if i["tournament"]["id"] == tid)
        api("POST", f"/referee-invitations/{inv['id']}/accept", r, {})


def tref_ids(tid, org):
    return {x["user"]["id"]: x["id"] for x in items(api("GET", f"/tournaments/{tid}/referees", org))}


def apply_team(tid, code, approve_by=None, n=None):
    players = PLAYERS[code][: (n or len(PLAYERS[code]))]
    a = api("POST", f"/tournaments/{tid}/applications", lead(code), {"teamId": TEAM[code], "playerIds": players})
    if approve_by:
        api("POST", f"/applications/{a['id']}/approve", approve_by)
    return a["id"]


def matches_of(tid):
    return items(api("GET", f"/tournaments/{tid}/matches"))


def find_match(tid, a, b):
    ids = {TEAM[a], TEAM[b]}
    for m in matches_of(tid):
        if m.get("teamA") and m.get("teamB") and {m["teamA"]["id"], m["teamB"]["id"]} == ids:
            return m["id"]
    raise RuntimeError(f"ไม่เจอแมตช์ {a} v {b} ในทัวร์ {tid}")


def set_tournament_dates(tid, reg_start, reg_end, ev_start, ev_end):
    sql(f"UPDATE tournaments SET registration_start='{utc_sql(reg_start)}', registration_end='{utc_sql(reg_end)}', "
        f"event_start_date='{day(ev_start)}', event_end_date='{day(ev_end)}' WHERE tournament_id={tid};")


def schedule(mid, org, when, venue, minutes=60):
    api("PATCH", f"/matches/{mid}/schedule", org,
        {"scheduledTime": iso(when), "scheduledEndTime": iso(when + timedelta(minutes=minutes)), "venue": venue})


def staff(tid, mid, org, refs, accept=True):
    ids = tref_ids(tid, org)
    for r in refs:
        rq = api("POST", f"/tournaments/{tid}/referee-requests/add-match", org, {"tournamentRefereeId": ids[r], "matchId": mid})
        if accept:
            api("POST", f"/referee-requests/{rq['id']}/accept", r)


def predict(mid, viewer, scores):
    api("POST", f"/matches/{mid}/predictions", viewer, {"scoreData": {str(TEAM[c]): s for c, s in scores.items()}})


def play(mid, ref, a, b, score_a, score_b, *, at, verify=True, mvp=None):
    """เล่นแมตช์ onsite ให้จบ ณ ตอนนี้ — เลื่อนเวลานัดมาเป็นปัจจุบันก่อน เพราะระบบบังคับหน้าต่างเวลา"""
    sql(f"UPDATE matches SET scheduled_time=NOW(), scheduled_end_time=NOW() + INTERVAL 1 HOUR WHERE match_id={mid};")
    api("POST", f"/matches/{mid}/open-checkin", ref)
    qr = api("GET", f"/matches/{mid}/checkin-qr", ref)["qrPayload"]
    for p in PLAYERS[a] + PLAYERS[b]:
        api("POST", f"/matches/{mid}/checkins", p, {"method": "qr_onsite", "qrPayload": qr})
    api("POST", f"/matches/{mid}/start", ref)
    api("POST", f"/matches/{mid}/finish", ref)
    winner = a if score_a > score_b else b
    api("POST", f"/matches/{mid}/result", ref,
        {"winnerTeamId": TEAM[winner], "scoreData": {str(TEAM[a]): score_a, str(TEAM[b]): score_b}})
    if verify:
        api("POST", f"/matches/{mid}/result/verify", lead(winner), {})
    for voter, target in (mvp or []):
        api("POST", f"/matches/{mid}/mvp-votes", voter, {"userId": target})
    backdate_match(mid, at)      # ย้ายเวลาไปที่ที่ควรเป็นทันที — ไม่งั้นแมตช์ถัดไปที่เลื่อนมา "ตอนนี้" จะชนเวลากัน
    return winner


def backdate_match(mid, start):
    end = start + timedelta(minutes=45)
    sql(f"""UPDATE matches SET scheduled_time='{utc_sql(start)}', scheduled_end_time='{utc_sql(start + timedelta(hours=1))}',
            checkin_open_at='{utc_sql(start - timedelta(minutes=30))}', started_at='{utc_sql(start)}',
            actual_end_time='{utc_sql(end)}' WHERE match_id={mid};
        UPDATE match_results SET submitted_at='{utc_sql(end + timedelta(minutes=5))}',
            verified_at=IF(verified_at IS NULL, NULL, '{utc_sql(end + timedelta(minutes=20))}') WHERE match_id={mid};
        UPDATE match_checkins SET checked_in_at='{utc_sql(start - timedelta(minutes=15))}' WHERE match_id={mid};""")


def main():
    global JWT_SECRET
    JWT_SECRET = read_env("JWT_SECRET")
    print(f"พรีเซนต์: {DEMO:%d/%m/%Y %H:%M} (เวลาไทย) · สร้างเมื่อ {NOW:%d/%m %H:%M}")
    api("GET", "/sport-types")   # backend ต้องตอบก่อนเริ่มล้างอะไร

    build_players()
    reset_database()
    create_teams()

    # ------------------------------------------------------------ ทีมสถานะพิเศษ
    step("ทีมสถานะพิเศษ: Official · รอ Official · รอโอนหัวหน้า · Forming")
    api("POST", f"/teams/{TEAM['f1']}/official-request", lead("f1"), {"supportingDocs": ["หนังสือรับรองชมรมฟุตบอลคณะวิศวกรรมศาสตร์ ปี 2569"]})
    rq = next(r for r in items(api("GET", "/admin/team-requests", ADMIN)) if r["team"]["id"] == TEAM["f1"])
    api("POST", f"/admin/team-requests/{rq['id']}/approve", ADMIN)
    api("POST", f"/teams/{TEAM['f1']}/transfer-leader", lead("f1"), {"newLeaderId": PLAYERS["f1"][1]})
    api("POST", f"/teams/{TEAM['f2']}/official-request", lead("f2"), {"supportingDocs": ["หนังสือรับรองชมรมฟุตบอลคณะวิทยาศาสตร์ ปี 2569"]})
    newbie = api("POST", "/teams", NEWBIE, {"name": "มือใหม่หัดตบ", "sportTypeId": 3})
    TEAM["newbie"] = newbie["id"]
    api("POST", f"/teams/{newbie['id']}/invitations", NEWBIE, {"invitedUserId": FREE1})

    # ------------------------------------------------------------ ทัวร์ 1–11 (สร้างตามลำดับให้ id ตรงกับเอกสาร)
    step("ทัวร์นาเมนต์ 11 รายการ")
    soon = NOW + timedelta(minutes=30)          # ปิดรับสมัคร "อีกครู่" สำหรับทัวร์ที่จะย้อนเวลาทีหลัง
    tomorrow = NOW + timedelta(days=1)
    T1 = create_tournament(ORG1, "ฟุตบอลประเพณี วิศวะ–วิทยา 2569", 1, "single_elimination", 1, venue="สนามกีฬากลาง")
    T2 = create_tournament(ORG3, "VALORANT Night Cup", 5, "single_elimination", 4, venue="ออนไลน์", best_of=3)
    T3 = create_tournament(ORG2, "บาสเกตบอลเฟรชชี่คัพ", 2, "single_elimination", 2, venue="โรงยิม 2")
    T4 = create_tournament(ORG2, "แบดมินตันเกษตรแฟร์", 3, "single_elimination", 2, venue="โรงยิม 1", best_of=3)
    T5 = create_tournament(ORG1, "บาสเกตบอลหญิง ชิงถ้วยคณบดี", 2, "single_elimination", 1, venue="ศูนย์กีฬามหาวิทยาลัย",
                           gender="female", min_age=18, max_age=25,
                           notes="รับเฉพาะทีมหญิง อายุ 18–25 ปี · นำบัตรนักศึกษามาเช็คอินทุกแมตช์")
    T6 = create_tournament(ORG3, "แบดมินตัน Open รอบคัดเลือก", 3, "single_elimination", 4, venue="โรงยิม 3",
                           reg_end=soon, start=DEMO + timedelta(days=3), best_of=3)
    T7 = create_tournament(ORG1, "แบดมินตันชิงแชมป์มหาวิทยาลัย 2569", 3, "single_elimination", 1, venue="โรงยิม 1",
                           reg_end=soon, start=tomorrow, end=tomorrow + timedelta(days=1), best_of=3)
    T8 = create_tournament(ORG2, "แบดมินตัน Faculty League", 3, "single_elimination", 2, venue="โรงยิม 2",
                           reg_end=soon, start=tomorrow, end=tomorrow + timedelta(days=1), best_of=3)
    T9 = create_tournament(ORG3, "แบดมินตัน Welcome Cup", 3, "single_elimination", 4, venue="โรงยิม 4",
                           reg_end=soon, start=tomorrow, end=tomorrow + timedelta(days=1), best_of=3)
    T10 = create_tournament(ORG3, "RoV Campus Showdown (ออนไลน์)", 4, "single_elimination", 4, venue="ออนไลน์",
                            reg_end=soon, start=tomorrow, end=tomorrow + timedelta(days=1), best_of=3)
    T11 = create_tournament(ORG1, "แบดมินตันกระชับมิตร (พบกันหมด)", 3, "round_robin", 1, venue="โรงยิม 5",
                            reg_end=soon, start=tomorrow, end=tomorrow + timedelta(days=3), best_of=3)
    assert [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11] == list(range(1, 12)), "รหัสทัวร์ไม่เรียง 1–11"

    step("อนุมัติ · กรรมการ · เปิดสาธารณะ · รับสมัคร")
    for t in (T3, T4, T5, T6, T7, T8, T9, T10, T11):
        api("POST", f"/tournaments/{t}/approve", ADMIN)
    org_of = {T4: ORG2, T5: ORG1, T6: ORG3, T7: ORG1, T8: ORG2, T9: ORG3, T10: ORG3, T11: ORG1}
    refs_of = {T4: [REF3, REF4], T5: [REF1, REF2], T6: [REF3, REF4], T7: [REF1, REF2], T8: [REF3, REF4],
               T9: [REF3, REF4], T10: [REF3, REF4], T11: [REF1, REF2]}
    for t, refs in refs_of.items():
        add_referees(t, org_of[t], refs)
    for t in (T5, T6, T7, T8, T9, T10, T11):                     # T4 ค้างไว้ให้ผู้จัดกดเปิดเองบนเวที
        api("POST", f"/tournaments/{t}/publish", org_of[t])
        api("POST", f"/tournaments/{t}/open-registration", org_of[t])

    apply_team(T5, "k4")                                         # ใบสมัครค้างให้ผู้จัดอนุมัติสด
    for code in ("b3", "b4", "b5", "b6"): apply_team(T6, code, ORG3)
    for code in ("b1", "b2", "b3", "b4"): apply_team(T7, code, ORG1)
    for code in ("b1", "b2", "b5", "b6"): apply_team(T8, code, ORG2)
    for code in ("b3", "b4", "b5", "b6"): apply_team(T9, code, ORG3)
    for code in ("r1", "r2"): apply_team(T10, code, ORG3)
    for code in ("b1", "b2", "b3", "b4"): apply_team(T11, code, ORG1)
    for t in (T6, T7, T8, T9, T10, T11):
        api("POST", f"/tournaments/{t}/close-registration", org_of[t])

    step("จับสาย")
    api("POST", f"/tournaments/{T7}/bracket", ORG1, {"seedingMethod": "manual", "manualSeeds": [TEAM[c] for c in ("b1", "b2", "b3", "b4")]})
    api("POST", f"/tournaments/{T8}/bracket", ORG2, {"seedingMethod": "manual", "manualSeeds": [TEAM[c] for c in ("b5", "b6", "b1", "b2")]})
    api("POST", f"/tournaments/{T9}/bracket", ORG3, {"seedingMethod": "manual", "manualSeeds": [TEAM[c] for c in ("b3", "b4", "b5", "b6")]})
    api("POST", f"/tournaments/{T10}/bracket", ORG3, {"seedingMethod": "random"})
    api("POST", f"/tournaments/{T11}/bracket", ORG1, {"seedingMethod": "random"})
    for t in (T7, T8, T9, T10, T11):
        print(f"   T{t}: " + " | ".join(f"#{m['id']} R{m.get('round')} {(m.get('teamA') or {}).get('name', 'TBD')} v {(m.get('teamB') or {}).get('name', 'TBD')}"
                                         for m in matches_of(t)))

    # ช่วงรับสมัครของทัวร์ที่จับสายแล้ว/ปิดรับแล้ว → ย้อนเป็นอดีต และวันแข่งให้ครอบวันนี้
    past_open, past_close = NOW - timedelta(days=20), NOW - timedelta(days=6)
    set_tournament_dates(T6, past_open, NOW - timedelta(hours=3), DEMO + timedelta(days=3), DEMO + timedelta(days=4))
    set_tournament_dates(T7, past_open, past_close, NOW, DEMO + timedelta(days=1))
    set_tournament_dates(T8, past_open, past_close, NOW - timedelta(days=1), DEMO + timedelta(days=1))
    set_tournament_dates(T9, past_open, past_close, NOW - timedelta(days=1), DEMO + timedelta(days=1))
    set_tournament_dates(T10, past_open, past_close, NOW, DEMO + timedelta(days=1))
    set_tournament_dates(T11, past_open, past_close, NOW - timedelta(days=1), DEMO + timedelta(days=3))

    later = NOW + timedelta(hours=3)            # เวลานัดชั่วคราว (ต้องเป็นอนาคตตอนขอกรรมการ) ก่อน play() เลื่อนมาเป็นปัจจุบัน

    # ------------------------------------------------------------ T9 จบแล้ว
    step("T9 — เล่นจนจบ ได้แชมป์ แล้วย้อนเวลาไปสัปดาห์ก่อน")
    sf1, sf2 = find_match(T9, "b3", "b4"), find_match(T9, "b5", "b6")
    # กรรมการสองคนคุมสองแมตช์เวลาเดียวกันไม่ได้ → แมตช์ที่สองนัดเหลื่อมเวลา
    schedule(sf1, ORG3, later, "โรงยิม 4 คอร์ต A")
    staff(T9, sf1, ORG3, [REF3, REF4])
    schedule(sf2, ORG3, later + timedelta(hours=2), "โรงยิม 4 คอร์ต B")
    staff(T9, sf2, ORG3, [REF3, REF4])
    predict(sf1, VIEW1, {"b3": 2, "b4": 1}); predict(sf1, VIEW2, {"b3": 0, "b4": 2}); predict(sf1, VIEW3, {"b3": 2, "b4": 0})
    predict(sf2, VIEW1, {"b5": 2, "b6": 0}); predict(sf2, VIEW2, {"b5": 2, "b6": 1}); predict(sf2, VIEW3, {"b5": 1, "b6": 2})
    wk = (NOW - timedelta(days=8)).replace(hour=10, minute=0, second=0, microsecond=0)
    play(sf1, REF3, "b3", "b4", 2, 1, at=wk, mvp=[(VIEW1, lead("b3")), (VIEW2, lead("b3")), (VIEW3, PLAYERS["b4"][1])])
    play(sf2, REF3, "b5", "b6", 2, 0, at=wk + timedelta(hours=2), mvp=[(VIEW1, lead("b5")), (VIEW2, PLAYERS["b5"][1]), (VIEW3, lead("b5"))])
    final = find_match(T9, "b3", "b5")
    schedule(final, ORG3, later + timedelta(hours=4), "โรงยิม 4 คอร์ต A")
    staff(T9, final, ORG3, [REF3, REF4])
    predict(final, VIEW1, {"b3": 1, "b5": 2}); predict(final, VIEW2, {"b3": 2, "b5": 1}); predict(final, VIEW3, {"b3": 0, "b5": 2})
    play(final, REF4, "b3", "b5", 1, 2, at=wk + timedelta(days=1, hours=4), mvp=[(VIEW1, lead("b5")), (VIEW2, lead("b5")), (VIEW3, lead("b3"))])
    api("POST", f"/tournaments/{T9}/comments", VIEW1, {"content": "รอบชิงสนุกมาก ลุ้นจนเซตสุดท้าย"})
    api("POST", f"/tournaments/{T9}/comments", VIEW2, {"content": "ขอบคุณผู้จัดและกรรมการ จัดได้ตรงเวลาทุกแมตช์"})
    api("POST", f"/tournaments/{T9}/comments", lead("b5"), {"content": "ขอบคุณทุกทีมที่มาร่วมแข่ง แล้วเจอกันรายการหน้า"})
    api("POST", f"/tournaments/{T9}/complete", ORG3)
    for who, rating, text in ((lead("b5"), 5, "จัดการดี สนามพร้อม กรรมการตัดสินชัดเจน"), (lead("b3"), 4, "โดยรวมดี อยากให้มีเวลาพักระหว่างแมตช์มากขึ้น"),
                              (lead("b4"), 5, "ประกาศตารางล่วงหน้าชัดเจน"), (PLAYERS["b6"][1], 3, "สนามคอร์ต B ไฟสว่างไม่พอ"), (lead("b6"), 4, None)):
        body = {"rating": rating}
        if text: body["content"] = text
        api("POST", f"/tournaments/{T9}/feedback", who, body)
    set_tournament_dates(T9, NOW - timedelta(days=30), NOW - timedelta(days=12), wk, wk + timedelta(days=1))
    # ปิดทัวร์ "เมื่อ 2 วันก่อน" — ช่วงรีวิวเปิด 7 วันหลังปิด จึงยังส่ง/แก้รีวิวบนเวทีได้
    sql(f"UPDATE tournaments SET completed_at='{utc_sql(NOW - timedelta(days=2))}' WHERE tournament_id={T9};")

    # ------------------------------------------------------------ T8 กำลังแข่ง
    step("T8 — คู่แรกจบแล้ว (โหวต MVP เปิดอยู่) · คู่สองรอหัวหน้าทีมยืนยันผล")
    a, b = find_match(T8, "b5", "b6"), find_match(T8, "b1", "b2")
    schedule(a, ORG2, later, "โรงยิม 2 คอร์ต A"); staff(T8, a, ORG2, [REF3, REF4])
    schedule(b, ORG2, later + timedelta(hours=2), "โรงยิม 2 คอร์ต A"); staff(T8, b, ORG2, [REF3, REF4])
    predict(a, VIEW1, {"b5": 2, "b6": 1}); predict(a, VIEW3, {"b5": 0, "b6": 2})
    predict(b, VIEW1, {"b1": 2, "b2": 0}); predict(b, VIEW2, {"b1": 1, "b2": 2})
    play(a, REF3, "b5", "b6", 1, 2, at=NOW - timedelta(hours=4), mvp=[(VIEW1, lead("b6")), (VIEW2, PLAYERS["b5"][1])])
    play(b, REF4, "b1", "b2", 2, 1, at=NOW - timedelta(hours=2), verify=False)                # ค้างไว้: หัวหน้าทีม b1 กดยืนยันบนเวที → รอบชิงได้คู่
    api("POST", f"/tournaments/{T8}/announcements", ORG2, {"title": "ผลรอบรองชนะเลิศคู่แรก", "body": "Econ Rackets ชนะ มนุษย์ลูกขนไก่ 2–1 เข้ารอบชิงชนะเลิศ", "type": "result"})
    api("POST", f"/tournaments/{T8}/announcements", ORG2, {"title": "ย้ายสนามรอบชิง", "body": "รอบชิงชนะเลิศย้ายไปแข่งที่โรงยิม 1 คอร์ตกลาง", "type": "venue_change"})
    c = api("POST", f"/tournaments/{T8}/comments", VIEW3, {"content": "กรรมการเป่าเข้าข้างชัด ๆ แย่มาก"})
    api("POST", f"/feedback/{c['id']}/report", VIEW1, {"reason": "harassment"})
    api("POST", f"/tournaments/{T8}/comments", VIEW2, {"content": "คู่แรกสูสีมาก เชียร์ทั้งสองทีม"})

    # ------------------------------------------------------------ T11 พบกันหมด
    step("T11 — พบกันหมด เล่นไป 3 จาก 6 แมตช์ (หนึ่งแมตช์มีข้อโต้แย้งรอผู้จัด)")
    rr = matches_of(T11)
    code_of = {TEAM[c]: c for c in ("b1", "b2", "b3", "b4")}
    played = 0
    for i, m in enumerate(rr):
        x, y = code_of[m["teamA"]["id"]], code_of[m["teamB"]["id"]]
        if played < 3:
            schedule(m["id"], ORG1, later + timedelta(hours=2 * i), "โรงยิม 5")
            staff(T11, m["id"], ORG1, [REF1, REF2])
            w = play(m["id"], REF1, x, y, 2, played % 2, at=NOW - timedelta(hours=9 - 2 * played))
            if played == 2:
                loser = y if w == x else x
                api("POST", f"/matches/{m['id']}/result/dispute", lead(loser),
                    {"reason": "เซตที่สามนับแต้มผิด คะแนนจริงคือ 21–19 ฝั่งเรา ขอให้ตรวจใบบันทึกคะแนน",
                     "claimedWinnerTeamId": TEAM[loser], "claimedScoreData": {str(TEAM[loser]): 2, str(TEAM[w]): 1}})
            played += 1
        else:
            schedule(m["id"], ORG1, DEMO + timedelta(days=1, hours=2 * (i - 3)), "โรงยิม 5")

    # ------------------------------------------------------------ T7 วันแข่ง (สดบนเวที)
    step("T7 — นัดแข่งตรงเวลาพรีเซนต์")
    live, pick = find_match(T7, "b1", "b2"), find_match(T7, "b3", "b4")
    final7 = next(m["id"] for m in matches_of(T7) if m["id"] not in (live, pick))
    schedule(live, ORG1, DEMO + timedelta(minutes=20), "โรงยิม 1 คอร์ตกลาง"); staff(T7, live, ORG1, [REF1, REF2])
    schedule(pick, ORG1, DEMO + timedelta(hours=2), "โรงยิม 1 คอร์ตกลาง"); staff(T7, pick, ORG1, [REF1, REF2])
    schedule(final7, ORG1, DEMO + timedelta(hours=4), "โรงยิม 1 คอร์ตกลาง")
    staff(T7, final7, ORG1, [REF1])
    staff(T7, final7, ORG1, [REF2], accept=False)                # คำขอค้างใน Inbox ของ ref2
    predict(pick, VIEW1, {"b3": 2, "b4": 1}); predict(pick, VIEW2, {"b3": 0, "b4": 2})
    api("POST", f"/tournaments/{T7}/announcements", ORG1, {"title": "ตารางแข่งวันชิงแชมป์", "body": "รอบรองชนะเลิศเริ่ม 13:20 น. ที่โรงยิม 1 คอร์ตกลาง กรุณามาเช็คอินก่อนเวลา 30 นาที", "type": "schedule_change"})
    api("POST", f"/tournaments/{T7}/comments", VIEW1, {"content": "รอดูคู่วิศวะ–วิทยา คู่นี้เจอกันทุกปี"})
    api("POST", f"/tournaments/{T7}/comments", VIEW3, {"content": "ปีนี้เชียร์เกษตรตบสนั่น"})

    # ------------------------------------------------------------ T10 ออนไลน์
    step("T10 — RoV ออนไลน์ BO3 นัดแล้ว มีรหัสห้อง")
    rov = matches_of(T10)[0]["id"]
    schedule(rov, ORG3, DEMO + timedelta(hours=3), "ออนไลน์ (Custom Room)")
    staff(T10, rov, ORG3, [REF4])
    api("PUT", f"/matches/{rov}/room-code", ORG3, {"roomCode": "LTMS-ROV-2569"})

    # ------------------------------------------------------------ คิวแอดมินและของค้าง
    step("คิวแอดมิน: คำขอแก้ไข · กรรมการภายนอก · รายงานผู้ใช้ · บัญชีถูกระงับ")
    api("POST", f"/tournaments/{T5}/amendment-requests", ORG1,
        {"requestedChanges": {"maxAge": 28}, "reason": "มีนิสิตปริญญาโทขอร่วมแข่ง ขอขยายอายุสูงสุดจาก 25 เป็น 28 ปี"})
    for ext, tid, org in ((EXT1, T6, ORG3), (EXT2, T4, ORG2)):
        try:
            api("POST", f"/tournaments/{tid}/referees", org, {"userId": ext, "isExternal": True})
            inv = next(i for i in items(api("GET", "/me/referee-invitations", ext)) if i["tournament"]["id"] == tid)
            api("POST", f"/referee-invitations/{inv['id']}/accept", ext, {})
            print(f"   กรรมการภายนอก {ext} ตอบรับทัวร์ {tid} แล้ว")
        except ApiError as e:
            print(f"   ⚠ กรรมการภายนอก {ext}: {str(e)[:260]}")
    # เครื่อง deploy ยังไม่มีที่เก็บไฟล์ → อัปเอกสารยืนยันตัวตนจริงไม่ได้ จึงใส่คีย์เอกสาร (รูปแบบถูกต้อง แต่ไม่มีไฟล์)
    # ให้แอดมินกดอนุมัติ/ปฏิเสธได้ · ลิงก์ดูเอกสารจะเปิดไม่ขึ้น — แจ้งไว้ในเอกสารส่งมอบ
    for ext in (EXT1, EXT2):
        key = f"referee_identity/{ext}/00000000-0000-4000-8000-{ext:012d}.png"
        sql(f"UPDATE tournament_referees SET external_verification_docs=JSON_ARRAY('{key}') WHERE user_id={ext};")
    try:
        api("POST", f"/admin/referee-requests/{EXT1}/approve", ADMIN)
        print("   กรรมการภายนอก 25 อนุมัติแล้ว · 26 รอแอดมินตรวจ")
    except ApiError as e:
        print(f"   ⚠ อนุมัติกรรมการภายนอก 25 ไม่ผ่าน: {str(e)[:260]}")
    api("POST", f"/users/{VIEW3}/report", VIEW1, {"reason": "ใช้ถ้อยคำไม่เหมาะสมในช่องความเห็นของทัวร์ Faculty League"})
    api("PATCH", f"/admin/users/{BANNED}/suspend", ADMIN,
        {"suspended": True, "reason": "ส่งข้อความรบกวนซ้ำในช่องความเห็นหลายรายการ", "days": 30, "category": "spam"})

    step("สรุป")
    for row in sql("""SELECT t.tournament_id, t.tournament_status, t.registration_open,
                (SELECT COUNT(*) FROM tournament_applications a WHERE a.tournament_id=t.tournament_id),
                (SELECT COUNT(*) FROM matches m WHERE m.tournament_id=t.tournament_id),
                (SELECT COUNT(*) FROM matches m WHERE m.tournament_id=t.tournament_id AND m.match_status='completed'), t.name
            FROM tournaments t ORDER BY 1""", fetch=True):
        print(f"   T{row[0]:>2} {row[1]:<17} reg={row[2]} apps={row[3]} matches={row[4]} done={row[5]}  {row[6]}")
    print("\nเสร็จแล้ว")


if __name__ == "__main__":
    try:
        main()
    except (ApiError, RuntimeError, AssertionError) as e:
        print(f"\n✖ หยุด: {e}")
        sys.exit(1)
