# -*- coding: utf-8 -*-
"""
สร้างข้อมูลแมตช์สำหรับทดสอบ — ต้องผ่าน API ไม่ใช่ INSERT ตรงๆ
เพราะแมตช์เกิดจากการจับสาย (POST /tournaments/:id/bracket) ซึ่งต้องปิดรับสมัครและมีทีมครบก่อน

⚠️ ไฟล์นี้รันไม่ผ่านแล้วตั้งแต่ migration 010_sport_types_renumber
   ข้างล่างยังส่ง sportTypeId 6 (แบดมินตัน) กับ 4 (วอลเลย์บอล) ซึ่งเป็นเลขชุดเก่า
   ตอนนี้ชนิดกีฬาเหลือ 1–5 แบดมินตันย้ายไปเป็น 3 และวอลเลย์บอลไม่มีในระบบแล้ว
   แก้ด้วยการเปลี่ยนเลขเฉยๆ ไม่ได้ ต้องเลือกกีฬาใหม่ให้ทัวร์ที่สอง
   ระหว่างนี้ใช้ `python database/qa-baseline.py restore` แทน — ได้ข้อมูลชุดเดียวกัน
   พร้อม id เดิม ซึ่งเป็น id ที่รายงานบั๊กของ frontend อ้างถึง
   เก็บไฟล์นี้ไว้เพราะมันคือบันทึกว่าข้อมูลชุดนั้นถูกสร้างมาอย่างไร

วิธีใช้ (ให้ backend รันอยู่ที่ localhost:8000 และโหลด seed-qa-teams.sql แล้ว):
    python database/seed-qa-matches.py

สิ่งที่ได้ — แมตช์ครบทุกสถานะให้กดทดสอบ:
    รอบรองฯ #1  completed      (ส่งผล + ยืนยันผลแล้ว ผู้ชนะเลื่อนเข้าชิง)
    รอบรองฯ #2  checkin_open   (จัดเวลา + กรรมการครบ + เปิดเช็คอินแล้ว รอผู้เล่นสแกน)
    รอบชิงฯ     scheduled      (รอผู้ชนะอีกฝั่ง)
    วอลเลย์บอล  in_progress    (เช็คอินครบ เริ่มแข่งแล้ว รอผล)
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


def call(label, method, path, token=None, data=None, quiet=False):
    code, body = req(method, path, token, data)
    if not quiet:
        mark = "ok " if code < 400 else "ERR"
        print(f"  [{mark}] {label}: {code} {json.dumps(body, ensure_ascii=False)[:90]}")
    return code, body


def tok(email):
    _, b = req("POST", "/auth/login", None, {"email": email, "password": PASSWORD})
    return b.get("accessToken", "")


ORG = tok("somchai@ku.th")
REF = {9002: tok("somying@ku.th"), 9003: tok("mana@ku.th")}
LEAD = {
    9008: tok("playerA1@ku.th"), 9009: tok("playerB1@ku.th"),
    9010: tok("playerC1@ku.th"), 9011: tok("playerD1@ku.th"),
    9027: tok("p9225@ku.th"), 9028: tok("p9213@ku.th"),
}


def create_tournament(name, sport, teams, venue):
    """สร้าง → อนุมัติ → เชิญกรรมการ 2 คน → เปิดรับสมัคร → ทีมสมัคร → อนุมัติ → ปิดรับสมัคร → จับสาย"""
    print(f"\n=== {name}")
    code, t = call("create", "POST", "/tournaments", ORG, {
        "name": name, "sportTypeId": sport, "bracketFormat": "single_elimination",
        "scopeType": "faculty", "organizingFacultyId": 1,
        "registrationStart": "2026-09-18T08:00:00+07:00",
        "registrationEnd": "2026-09-30T23:59:00+07:00",
        "eventStartDate": "2026-10-25", "eventEndDate": "2026-10-26",
        "maxTeams": len(teams), "minTeams": len(teams),
        "venue": venue, "genderRequirement": "any",
    })
    if code != 201:
        return None, {}
    tid = t["id"]
    call("approve", "POST", f"/tournaments/{tid}/approve", ORG, {}, quiet=True)
    trf = {}
    for user_id in (9002, 9003):
        _, inv = call("", "POST", f"/tournaments/{tid}/referees", ORG,
                      {"userId": user_id, "isExternal": False}, quiet=True)
        call("", "POST", f"/referee-invitations/{inv['id']}/accept", REF[user_id], {}, quiet=True)
        trf[user_id] = inv["id"]
    call("publish", "POST", f"/tournaments/{tid}/publish", ORG, {}, quiet=True)
    call("open registration", "POST", f"/tournaments/{tid}/open-registration", ORG, {}, quiet=True)
    for team_id in teams:
        _, app = call("", "POST", f"/tournaments/{tid}/applications", LEAD[team_id],
                      {"teamId": team_id}, quiet=True)
        call("", "POST", f"/applications/{app['id']}/approve", ORG, {}, quiet=True)
    call("close registration", "POST", f"/tournaments/{tid}/close-registration", ORG, {}, quiet=True)
    call("draw the bracket", "POST", f"/tournaments/{tid}/bracket", ORG, {"seedingMethod": "random"})
    return tid, trf


def assign_referees(tid, match_id, trf):
    """มอบหมายกรรมการเข้าแมตช์ — ต้องยื่นทีละคน เพราะคำขอที่ค้างของแมตช์เดียวกันจะถูกยกเลิกเมื่อมีคนรับ"""
    for user_id, referee_id in trf.items():
        code, r = req("POST", f"/tournaments/{tid}/referee-requests/add-match", ORG,
                      {"tournamentRefereeId": referee_id, "matchId": match_id})
        if code == 201:
            req("POST", f"/referee-requests/{r['id']}/accept", REF[user_id], {})


def prepare(tid, match_id, trf, start, end, venue):
    """จัดเวลา + กรรมการ + เปิดเช็คอิน (ต้องเรียงลำดับนี้ เปิดเช็คอินแล้วเพิ่มกรรมการไม่ได้อีก)"""
    call("schedule", "PATCH", f"/matches/{match_id}/schedule", ORG,
         {"scheduledTime": start, "scheduledEndTime": end, "venue": venue}, quiet=True)
    assign_referees(tid, match_id, trf)
    call("open check-in", "POST", f"/matches/{match_id}/open-checkin", ORG, {}, quiet=True)


def play(match_id, team_a, team_b, winner, score_a, score_b):
    """เช็คอินหัวหน้าทีมทั้งสองฝั่ง → เริ่มแข่ง → ส่งผล → หัวหน้าทีมผู้ชนะยืนยัน"""
    _, qr = call("", "GET", f"/matches/{match_id}/checkin-qr", REF[9002], quiet=True)
    payload = qr.get("qrPayload", "")
    for team_id in (team_a, team_b):
        call("", "POST", f"/matches/{match_id}/checkins", LEAD[team_id],
             {"method": "qr_onsite", "qrPayload": payload}, quiet=True)
    call("start", "POST", f"/matches/{match_id}/start", REF[9002], {}, quiet=True)
    return payload


def finish(match_id, team_a, team_b, winner, score_a, score_b):
    call("submit result", "POST", f"/matches/{match_id}/result", REF[9002],
         {"winnerTeamId": winner, "scoreData": {str(team_a): score_a, str(team_b): score_b}}, quiet=True)
    call("verify result", "POST", f"/matches/{match_id}/result/verify", LEAD[winner], {}, quiet=True)


# ── แบดมินตัน 4 ทีม → รอบรองฯ 2 นัด + รอบชิงฯ ────────────────────────────
tid, trf = create_tournament("แบดมินตัน ชิงแชมป์มหาวิทยาลัย", 6, [9008, 9009, 9010, 9011], "โรงยิม 1")
if tid:
    _, ms = call("matches", "GET", f"/tournaments/{tid}/matches", ORG, quiet=True)
    semis = [m for m in ms["items"] if m["round"] == 1]
    final = next((m for m in ms["items"] if m["round"] == 2), None)

    first = semis[0]
    prepare(tid, first["id"], trf, "2026-10-25T02:00:00Z", "2026-10-25T04:00:00Z", "โรงยิม 1 คอร์ต A")
    play(first["id"], first["teamA"]["id"], first["teamB"]["id"], first["teamA"]["id"], 2, 0)
    finish(first["id"], first["teamA"]["id"], first["teamB"]["id"], first["teamA"]["id"], 2, 0)
    print(f"  รอบรองฯ #1 (match {first['id']}) — แข่งจบแล้ว ผู้ชนะเลื่อนเข้าชิง")

    second = semis[1]
    prepare(tid, second["id"], trf, "2026-10-25T05:00:00Z", "2026-10-25T07:00:00Z", "โรงยิม 1 คอร์ต B")
    print(f"  รอบรองฯ #2 (match {second['id']}) — เปิดเช็คอินแล้ว รอผู้เล่น")
    if final:
        print(f"  รอบชิงฯ (match {final['id']}) — รอผู้ชนะอีกฝั่ง")

# ── วอลเลย์บอล 2 ทีม → แมตช์เดียวที่กำลังแข่งอยู่ ─────────────────────────
tid2, trf2 = create_tournament("วอลเลย์บอล คู่พิเศษ", 4, [9027, 9028], "โรงยิม 2")
if tid2:
    _, ms2 = call("matches", "GET", f"/tournaments/{tid2}/matches", ORG, quiet=True)
    live = ms2["items"][0]
    prepare(tid2, live["id"], trf2, "2026-10-25T08:00:00Z", "2026-10-25T10:00:00Z", "โรงยิม 2")
    play(live["id"], live["teamA"]["id"], live["teamB"]["id"], live["teamA"]["id"], 0, 0)
    print(f"  แมตช์ {live['id']} — กำลังแข่งอยู่ (in_progress) รอกรรมการส่งผล")

print("\nเสร็จแล้ว")
