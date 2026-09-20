# -*- coding: utf-8 -*-
"""
เติมข้อมูลทดสอบของ "งานที่รอการตัดสิน" — ส่วนที่ seed อื่นยังไม่มีตัวอย่างให้กด

    1. กรรมการภายนอกที่ส่งเอกสารแล้ว รอแอดมินตรวจ      (AR01–AR04)
    2. คำขอให้กรรมการรับแมตช์เพิ่ม ที่ยังรอกรรมการตอบ    (FR02)
    3. คำขอแก้ไขทัวร์นาเมนต์ รอแอดมินอนุมัติ             (C09)
    4. ผลการแข่งที่ถูกโต้แย้ง รอผู้จัดตัดสิน               (S05–S07)
    5. เช็คอินด้วยรูปบัตร ที่รอกรรมการตรวจ                 (M13–M15)
    6. แมตช์ที่กำลังแข่งอยู่อีกหนึ่งนัด + สถิติผู้เล่น        (S01/S08)

วิธีใช้: python database/seed-qa-flows.py   (ให้ backend รันอยู่ และโหลด seed อื่นแล้ว)
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
    mark = "ok " if code < 400 else "ERR"
    print(f"  [{mark}] {label}: {code} {json.dumps(body, ensure_ascii=False)[:100]}")
    return code, body


def tok(email):
    _, b = req("POST", "/auth/login", None, {"email": email, "password": PASSWORD})
    return b.get("accessToken", "")


ORG = tok("somchai@ku.th")
SOMYING = tok("somying@ku.th")
MANA = tok("mana@ku.th")
EXTERNAL = tok("referee.ext@outside.org")

BADMINTON = 19          # แบดมินตัน ชิงแชมป์มหาวิทยาลัย (มีแมตช์ 6/7/8)
VOLLEY = 20             # วอลเลย์บอล คู่พิเศษ (แมตช์ 9 กำลังแข่ง)
FOOTBALL = 14           # ฟุตบอลประเพณี คณะวิศวกรรมศาสตร์


def find_match(tournament_id, status):
    _, ms = req("GET", f"/tournaments/{tournament_id}/matches", ORG)
    return next((m for m in ms.get("items", []) if m["status"] == status), None)


print("\n1) กรรมการภายนอกรอแอดมินตรวจเอกสาร")
code, invite = call("เชิญกรรมการภายนอก", "POST", f"/tournaments/{BADMINTON}/referees", ORG,
                    {"userId": 9053, "isExternal": True, "matchIds": []})
if code == 201:
    call("กรรมการภายนอกตอบรับ + แนบเอกสาร", "POST", f"/referee-invitations/{invite['id']}/accept",
         EXTERNAL, {"matchIds": [], "docs": ["referee-identity/9053-id-card.jpg"]})
    call("คิวของแอดมินตอนนี้", "GET", "/admin/referee-requests", ORG)

print("\n2) คำขอให้กรรมการรับแมตช์เพิ่ม (ยังรอกรรมการตอบ)")
final_match = find_match(BADMINTON, "scheduled")
_, pool = req("GET", f"/tournaments/{BADMINTON}/referees", ORG)
mana_ref = next((r for r in pool.get("items", []) if r["user"]["id"] == 9003), None)
if final_match and mana_ref:
    # เปลี่ยนกรรมการได้เฉพาะแมตช์ที่ "กำหนดเวลาแล้วและยังไม่ถึงเวลาแข่ง" — จัดเวลาให้ก่อน
    call("จัดเวลารอบชิงฯ ก่อน", "PATCH", f"/matches/{final_match['id']}/schedule", ORG,
         {"scheduledTime": "2026-10-26T02:00:00Z", "scheduledEndTime": "2026-10-26T04:00:00Z",
          "venue": "โรงยิม 1 คอร์ตกลาง"})
    call(f"ขอให้มานะคุมแมตช์ {final_match['id']}", "POST",
         f"/tournaments/{BADMINTON}/referee-requests/add-match", ORG,
         {"tournamentRefereeId": mana_ref["id"], "matchId": final_match["id"]})
    call("กล่องคำขอของมานะ", "GET", "/me/referee-requests", MANA)

print("\n3) คำขอแก้ไขทัวร์นาเมนต์ รอแอดมิน")
call("ผู้จัดขอขยายจำนวนทีมและเลื่อนวันแข่ง", "POST", f"/tournaments/{FOOTBALL}/amendment-requests", ORG,
     # backend รับเฉพาะ registrationStart/End, eventStartDate/EndDate, min/maxTeams,
     # genderRequirement, minAge, maxAge — ใส่ฟิลด์อื่น (เช่น reason) จะได้ 400 AMENDMENT_FIELD_NOT_ALLOWED
     {"requestedChanges": {"maxTeams": 8, "eventEndDate": "2026-10-23"}})
call("คิวคำขอแก้ไขของแอดมิน", "GET", "/admin/amendment-requests", ORG)

print("\n4) ผลการแข่งที่ถูกโต้แย้ง รอผู้จัดตัดสิน")
live = find_match(VOLLEY, "in_progress")
if live:
    team_a, team_b = live["teamA"], live["teamB"]
    leaders = {9027: tok("p9225@ku.th"), 9028: tok("p9213@ku.th"), 9004: tok("somying@ku.th")}
    winner, loser = team_a["id"], team_b["id"]
    call("กรรมการส่งผล", "POST", f"/matches/{live['id']}/result", SOMYING,
         {"winnerTeamId": winner, "scoreData": {str(winner): 3, str(loser): 2}})
    call("หัวหน้าทีมผู้ชนะยืนยันผล", "POST", f"/matches/{live['id']}/result/verify", leaders[winner], {})
    call("หัวหน้าทีมที่แพ้โต้แย้ง", "POST", f"/matches/{live['id']}/result/dispute", leaders[loser],
         {"reason": "เซ็ตที่ 5 กรรมการนับแต้มผิด ขอให้ตรวจสอบคลิปอีกครั้ง"})
    call("สถานะผลตอนนี้", "GET", f"/matches/{live['id']}/result", ORG)

print("\n5) เช็คอินด้วยรูปบัตร รอกรรมการตรวจ")
checkin_match = find_match(BADMINTON, "checkin_open")
if checkin_match:
    mid = checkin_match["id"]
    _, qr = req("GET", f"/matches/{mid}/checkin-qr", SOMYING)
    team_a_id = checkin_match["teamA"]["id"]
    team_b_id = checkin_match["teamB"]["id"]
    leaders = {9008: "playerA1@ku.th", 9009: "playerB1@ku.th", 9010: "playerC1@ku.th", 9011: "playerD1@ku.th"}
    members = {9008: "playerA2@ku.th", 9009: "playerB2@ku.th", 9010: "playerC2@ku.th", 9011: "playerD2@ku.th"}
    if qr.get("qrPayload"):
        call("ผู้เล่นฝั่งแรกเช็คอินด้วย QR", "POST", f"/matches/{mid}/checkins",
             tok(leaders[team_a_id]), {"method": "qr_onsite", "qrPayload": qr["qrPayload"]})
    call("ผู้เล่นอีกฝั่งส่งรูปบัตร (รอกรรมการตรวจ)", "POST", f"/matches/{mid}/checkins",
         tok(leaders[team_b_id]), {"method": "photo_online", "documentType": "student_id",
                                   "documentS3Key": "checkins/qa-student-id.jpg"})
    call("เพื่อนร่วมทีมส่งรูปบัตรอีกใบ", "POST", f"/matches/{mid}/checkins",
         tok(members[team_b_id]), {"method": "photo_online", "documentType": "national_id",
                                   "documentS3Key": "checkins/qa-national-id.jpg"})
    call("รายการเช็คอินที่กรรมการเห็น", "GET", f"/matches/{mid}/checkins", SOMYING)

print("\n6) สถิติผู้เล่นของแมตช์ที่แข่งจบแล้ว")
done_match = find_match(BADMINTON, "completed")
if done_match:
    _, defs = req("GET", "/sport-types/6/stat-definitions", None)
    stat_id = defs["items"][0]["statDefinitionId"] if defs.get("items") else None
    _, checkins = req("GET", f"/matches/{done_match['id']}/checkins", SOMYING)
    players = [c["userId"] for c in checkins.get("items", [])]
    if stat_id and players:
        call("กรรมการบันทึกสถิติ", "POST", f"/matches/{done_match['id']}/stats", SOMYING,
             {"playerStats": [{"userId": uid, "values": [{"statDefinitionId": stat_id, "value": 21 - i * 3}]}
                              for i, uid in enumerate(players)]})
        call("สถิติที่อ่านได้", "GET", f"/matches/{done_match['id']}/stats", None)

print("\n7) แมตช์ที่กำลังแข่งอยู่ (บาสเกตบอล)")
BASKET = 17
_, apps = req("GET", f"/tournaments/{BASKET}/applications", ORG)
if not apps.get("items"):
    for team_id, leader in ((9025, "p9207@ku.th"), (9026, "p9219@ku.th")):
        _, app = call(f"ทีม {team_id} สมัคร", "POST", f"/tournaments/{BASKET}/applications", tok(leader),
                      {"teamId": team_id})
        if app.get("id"):
            call("  ผู้จัดอนุมัติ", "POST", f"/applications/{app['id']}/approve", ORG, {})
    call("ปิดรับสมัคร", "POST", f"/tournaments/{BASKET}/close-registration", ORG, {})
    call("จับสาย", "POST", f"/tournaments/{BASKET}/bracket", ORG, {"seedingMethod": "random"})

basket_match = find_match(BASKET, "scheduled")
if basket_match:
    mid = basket_match["id"]
    call("จัดเวลา", "PATCH", f"/matches/{mid}/schedule", ORG,
         {"scheduledTime": "2026-11-01T03:00:00Z", "scheduledEndTime": "2026-11-01T05:00:00Z",
          "venue": "โรงยิม 3"})
    _, pool = req("GET", f"/tournaments/{BASKET}/referees", ORG)
    for ref in pool.get("items", []):
        token = SOMYING if ref["user"]["id"] == 9002 else MANA
        code, r = req("POST", f"/tournaments/{BASKET}/referee-requests/add-match", ORG,
                      {"tournamentRefereeId": ref["id"], "matchId": mid})
        if code == 201:
            req("POST", f"/referee-requests/{r['id']}/accept", token, {})
    call("เปิดเช็คอิน", "POST", f"/matches/{mid}/open-checkin", ORG, {})
    _, qr = req("GET", f"/matches/{mid}/checkin-qr", SOMYING)
    for leader in ("p9207@ku.th", "p9219@ku.th"):
        req("POST", f"/matches/{mid}/checkins", tok(leader),
            {"method": "qr_onsite", "qrPayload": qr.get("qrPayload", "")})
    call("เริ่มแข่ง", "POST", f"/matches/{mid}/start", SOMYING, {})


print("\nเสร็จแล้ว — เหลือของที่ backend ยังทำไม่ได้: ทัวร์นาเมนต์สถานะ completed, แชมป์, คอมเมนต์, เรตติ้ง")
