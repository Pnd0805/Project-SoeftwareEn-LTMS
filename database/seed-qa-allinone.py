# -*- coding: utf-8 -*-
"""
ยุบบัญชีทดสอบให้เหลือน้อยที่สุด — ทำให้ ปกรณ์ (p9201@ku.th) สวมครบทุกหมวกในคนเดียว

หลังรันสคริปต์นี้ ปกรณ์จะเป็นทั้ง:
    หัวหน้าทีม  · นำ 3 ทีมอยู่แล้ว (ฟุตบอล/ฟุตซอล/RoV) — สมัครแข่ง จัดการรายชื่อ
    ผู้เล่น      · อยู่ในแมตช์ออนไลน์ที่เปิดเช็คอิน — เช็คอินด้วยรูปถ่าย
    กรรมการ     · คุมแมตช์แบดมินตันที่เปิดเช็คอิน — คอนโซลเช็คอิน ตรวจรูป เริ่มแข่ง ส่งผล
    ผู้จัด       · มีรายการของตัวเอง พร้อมใบสมัครรออนุมัติ
    มีของค้างใน Inbox · คำเชิญเข้าทีม 1 ใบ + คำขอรับแมตช์ 1 ใบ

ทำไมถึงไม่รวมสิทธิ์แอดมินเข้าไปด้วย: จะทดสอบไม่เจอบั๊กเรื่องการแบ่งสิทธิ์
(คนที่ไม่ใช่แอดมินต้องไม่เห็นหน้า Admin) — สมชายจึงยังเป็นบัญชีแอดมินแยกไว้

วิธีใช้: python database/seed-qa-allinone.py
"""
import json
import urllib.request
import urllib.error

API = "http://localhost:8000/api/v1"
PASSWORD = "abcd1234"


def req(method, path, token=None, data=None):
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(API + path, data=body, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


def call(label, method, path, token=None, data=None):
    code, body = req(method, path, token, data)
    print(f"  [{'ok ' if code < 400 else 'ERR'}] {label}: {code} {json.dumps(body, ensure_ascii=False)[:90]}")
    return code, body


def tok(email):
    _, b = req("POST", "/auth/login", None, {"email": email, "password": PASSWORD})
    return b.get("accessToken", "")


ADMIN = tok("somchai@ku.th")
PAKORN = tok("p9201@ku.th")
SOMYING = tok("somying@ku.th")
MANA = tok("mana@ku.th")
HERO = 9201            # ปกรณ์ ใจดี
BADMINTON_CUP = 19     # ทัวร์ของสมชาย — ใช้ปล่อยคำขอรับแมตช์ค้างไว้ใน Inbox


def invite_referee(tournament_id, user_id, token, organizer=ADMIN, label=""):
    code, invite = req("POST", f"/tournaments/{tournament_id}/referees", organizer,
                       {"userId": user_id, "isExternal": False, "matchIds": []})
    if code == 201:
        req("POST", f"/referee-invitations/{invite['id']}/accept", token, {"matchIds": []})
        print(f"  [ok ] {label or f'กรรมการ {user_id}'} เข้าทัวร์ {tournament_id} แล้ว")
    return code


def assign(tournament_id, match_id, user_id, token, organizer=ADMIN):
    """มอบหมายกรรมการเข้าแมตช์ — ต้องยื่นทีละคน คำขอที่ค้างของแมตช์เดียวกันจะถูกยกเลิกเมื่อมีคนรับ"""
    _, pool = req("GET", f"/tournaments/{tournament_id}/referees", organizer)
    row = next((r for r in pool.get("items", []) if r["user"]["id"] == user_id), None)
    if not row:
        return
    code, request = req("POST", f"/tournaments/{tournament_id}/referee-requests/add-match", organizer,
                        {"tournamentRefereeId": row["id"], "matchId": match_id})
    if code == 201:
        req("POST", f"/referee-requests/{request['id']}/accept", token, {})


print("\n1) ปกรณ์เป็นกรรมการ — แมตช์แบดมินตันที่เปิดเช็คอินรอคุมอยู่")
code, cup = call("สร้างรายการให้ปกรณ์คุม", "POST", "/tournaments", ADMIN, {
    "name": "แบดมินตัน ไฟต์พิเศษ", "sportTypeId": 6, "bracketFormat": "single_elimination",
    "scopeType": "faculty", "organizingFacultyId": 1,
    "registrationStart": "2026-09-18T08:00:00+07:00", "registrationEnd": "2026-09-30T23:59:00+07:00",
    "eventStartDate": "2026-11-10", "eventEndDate": "2026-11-11",
    "maxTeams": 2, "minTeams": 2, "venue": "โรงยิม 4", "genderRequirement": "any",
})
if code == 201:
    cup_id = cup["id"]
    req("POST", f"/tournaments/{cup_id}/approve", ADMIN, {})
    invite_referee(cup_id, HERO, PAKORN, label="ปกรณ์ (กรรมการ)")
    invite_referee(cup_id, 9002, SOMYING, label="สมหญิง (กรรมการคู่)")
    req("POST", f"/tournaments/{cup_id}/publish", ADMIN, {})
    req("POST", f"/tournaments/{cup_id}/open-registration", ADMIN, {})
    for team, leader in ((9008, "playerA1@ku.th"), (9009, "playerB1@ku.th")):
        _, app = req("POST", f"/tournaments/{cup_id}/applications", tok(leader), {"teamId": team})
        if app.get("id"):
            req("POST", f"/applications/{app['id']}/approve", ADMIN, {})
    req("POST", f"/tournaments/{cup_id}/close-registration", ADMIN, {})
    call("จับสาย", "POST", f"/tournaments/{cup_id}/bracket", ADMIN, {"seedingMethod": "random"})
    _, ms = req("GET", f"/tournaments/{cup_id}/matches", ADMIN)
    match = ms["items"][0] if ms.get("items") else None
    if match:
        call("จัดเวลา", "PATCH", f"/matches/{match['id']}/schedule", ADMIN,
             {"scheduledTime": "2026-11-10T03:00:00Z", "scheduledEndTime": "2026-11-10T05:00:00Z",
              "venue": "โรงยิม 4 คอร์ต 1"})
        assign(cup_id, match["id"], HERO, PAKORN)
        assign(cup_id, match["id"], 9002, SOMYING)
        call("เปิดเช็คอิน", "POST", f"/matches/{match['id']}/open-checkin", ADMIN, {})
        # ให้มีรูปบัตรรอตรวจไว้ 1 ใบ ปกรณ์จะได้มีอะไรให้กด
        call("ผู้เล่นส่งรูปบัตรรอตรวจ", "POST", f"/matches/{match['id']}/checkins",
             tok("playerB1@ku.th"), {"method": "photo_online", "documentType": "student_id",
                                     "documentS3Key": "checkins/qa-pakorn-review.jpg"})
        print(f"  → ปกรณ์คุมแมตช์ {match['id']} · /checkin/{match['id']}")

print("\n2) ปกรณ์เป็นผู้จัด — รายการของตัวเอง พร้อมใบสมัครรออนุมัติ")
code, own = call("ปกรณ์ยื่นขอจัดรายการ", "POST", "/tournaments", PAKORN, {
    "name": "ฟุตซอลสายสัมพันธ์ (ปกรณ์จัด)", "sportTypeId": 2, "bracketFormat": "single_elimination",
    "scopeType": "faculty", "organizingFacultyId": 1,
    "registrationStart": "2026-09-18T08:00:00+07:00", "registrationEnd": "2026-10-20T23:59:00+07:00",
    "eventStartDate": "2026-11-15", "eventEndDate": "2026-11-16",
    "maxTeams": 4, "minTeams": 2, "venue": "สนามฟุตซอลในร่ม", "genderRequirement": "any",
})
if code == 201:
    own_id = own["id"]
    call("แอดมินอนุมัติ → ปกรณ์กลายเป็นผู้จัด", "POST", f"/tournaments/{own_id}/approve", ADMIN, {})
    invite_referee(own_id, 9002, SOMYING, organizer=PAKORN, label="สมหญิง")
    invite_referee(own_id, 9003, MANA, organizer=PAKORN, label="มานะ")
    call("ปกรณ์ประกาศรายการ", "POST", f"/tournaments/{own_id}/publish", PAKORN, {})
    call("ปกรณ์เปิดรับสมัคร", "POST", f"/tournaments/{own_id}/open-registration", PAKORN, {})
    call("ทีมอื่นสมัครเข้ามา (รอปกรณ์อนุมัติ)", "POST", f"/tournaments/{own_id}/applications",
         tok("p9213@ku.th"), {"teamId": 9024})
    print(f"  → ปกรณ์จัดการรายการ {own_id} ที่ /t/{own_id}/manage")

print("\n3) ของค้างใน Inbox ของปกรณ์")
call("คำเชิญเข้าทีมตะกร้อ", "POST", "/teams/9030/invitations", tok("p9215@ku.th"), {"invitedUserId": HERO})
invite_referee(BADMINTON_CUP, HERO, PAKORN, label="ปกรณ์ (กรรมการทัวร์ 19)")
_, pool = req("GET", f"/tournaments/{BADMINTON_CUP}/referees", ADMIN)
row = next((r for r in pool.get("items", []) if r["user"]["id"] == HERO), None)
if row:
    call("ผู้จัดขอให้ปกรณ์รับแมตช์ 8 (ปล่อยค้างไว้)", "POST",
         f"/tournaments/{BADMINTON_CUP}/referee-requests/add-match", ADMIN,
         {"tournamentRefereeId": row["id"], "matchId": 8})

print("\n4) สรุปกล่องของปกรณ์")
call("ทีมที่นำอยู่", "GET", "/me/teams", PAKORN)
call("คำเชิญเข้าทีม", "GET", "/me/invitations", PAKORN)
call("คำขอรับแมตช์", "GET", "/me/referee-requests", PAKORN)
call("รายการที่ขอจัด", "GET", "/me/tournament-requests", PAKORN)
print("\nเสร็จแล้ว — อย่าลืม python database/qa-baseline.py save ถ้าอยากให้สภาพนี้เป็นจุดตั้งต้น")
