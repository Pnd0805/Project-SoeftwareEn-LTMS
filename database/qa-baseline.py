# -*- coding: utf-8 -*-
"""
จุดย้อนกลับของข้อมูลทดสอบ — แทน "reset mock" ของ prototype

    python database/qa-baseline.py save      เก็บสถานะปัจจุบันทั้งฐานข้อมูลเป็นจุดตั้งต้น
    python database/qa-baseline.py restore   ย้อนข้อมูลกลับไปที่จุดตั้งต้น
    python database/qa-baseline.py status    ดูว่าจุดตั้งต้นเก็บไว้เมื่อไร และตอนนี้ต่างไปแค่ไหน

ทำไมถึงใช้วิธี dump ทั้งก้อน แทนการรัน seed ใหม่:
  - รัน seed ใหม่ = ลบแล้วสร้างใหม่ → id เดินหน้าเรื่อยๆ (auto_increment ไม่ย้อน)
    ลิงก์ที่จดไว้ เช่น /t/19 หรือ /m/7 จะชี้คนละอันทุกครั้ง
  - dump เก็บทั้งโครงสร้าง ข้อมูล และตัวนับ auto_increment → ย้อนแล้วได้ "ตำแหน่งเดิม" จริงๆ
    ไม่มีอะไรเพิ่มและไม่มีอะไรหาย

ข้อควรรู้:
  - ไฟล์รูปที่อัปโหลดไว้ใน MinIO ไม่ได้ถูกย้อนไปด้วย (ไฟล์ที่ไม่มีใครอ้างถึงแล้วจะค้างอยู่เฉยๆ
    ไม่กระทบการทดสอบ) ถ้าอยากล้างจริงให้ลบ bucket ltms-uploads เอง
  - ผู้ที่ล็อกอินค้างอยู่ในเบราว์เซอร์ยังใช้ token เดิมได้ เพราะบัญชีถูกย้อนกลับมาเหมือนเดิม
"""
import os
import subprocess
import sys
import time

CONTAINER = "ltms-mysql"
DB = "ltms"
USER = "root"
PASSWORD = "secret"
BASELINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qa-baseline.sql")

DUMP_ARGS = [
    "mysqldump", f"-u{USER}", f"-p{PASSWORD}", "--default-character-set=utf8mb4",
    "--single-transaction", "--add-drop-table", "--routines", "--triggers",
    "--skip-comments",   # ไม่มีบรรทัดเวลา ทำให้ diff ไฟล์ได้ว่าข้อมูลเปลี่ยนจริงไหม
    DB,
]
LOAD_ARGS = ["mysql", f"-u{USER}", f"-p{PASSWORD}", "--default-character-set=utf8mb4", DB]

COUNTS = """
SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'teams', COUNT(*) FROM teams
UNION ALL SELECT 'team_members', COUNT(*) FROM team_members
UNION ALL SELECT 'tournaments', COUNT(*) FROM tournaments
UNION ALL SELECT 'applications', COUNT(*) FROM tournament_applications
UNION ALL SELECT 'matches', COUNT(*) FROM matches
UNION ALL SELECT 'checkins', COUNT(*) FROM match_checkins
UNION ALL SELECT 'results', COUNT(*) FROM match_results
UNION ALL SELECT 'referee_requests', COUNT(*) FROM referee_change_requests;
"""


def docker(args, stdin=None, capture=True):
    cmd = ["docker", "exec"] + (["-i"] if stdin is not None else []) + [CONTAINER] + args
    return subprocess.run(cmd, input=stdin, capture_output=capture)


def ensure_container():
    probe = subprocess.run(["docker", "ps", "--filter", f"name={CONTAINER}", "--format", "{{.Names}}"],
                           capture_output=True, text=True)
    if CONTAINER not in (probe.stdout or ""):
        print(f"ไม่พบคอนเทนเนอร์ {CONTAINER} — เปิด Docker Desktop แล้วสั่ง docker compose up -d ก่อน")
        sys.exit(1)


def save():
    ensure_container()
    done = docker(DUMP_ARGS)
    if done.returncode != 0:
        print("dump ไม่สำเร็จ:", done.stderr.decode("utf-8", "replace")[:400])
        sys.exit(1)
    with open(BASELINE, "wb") as f:
        f.write(done.stdout)
    print(f"เก็บจุดตั้งต้นแล้ว: {BASELINE} ({len(done.stdout) // 1024} KB)")
    show_counts("ข้อมูลที่เก็บไว้")


def restore():
    ensure_container()
    if not os.path.exists(BASELINE):
        print("ยังไม่มีจุดตั้งต้น — สั่ง save ก่อน")
        sys.exit(1)
    with open(BASELINE, "rb") as f:
        payload = f.read()
    started = time.time()
    done = docker(LOAD_ARGS, stdin=payload)
    if done.returncode != 0:
        print("restore ไม่สำเร็จ:", done.stderr.decode("utf-8", "replace")[:400])
        sys.exit(1)
    print(f"ย้อนข้อมูลกลับจุดตั้งต้นแล้ว ({time.time() - started:.1f}s)")
    show_counts("ข้อมูลหลังย้อนกลับ")


def show_counts(title):
    done = docker(["mysql", f"-u{USER}", f"-p{PASSWORD}", "--default-character-set=utf8mb4",
                   "-N", "-B", DB, "-e", COUNTS])
    if done.returncode != 0:
        return
    print(f"\n{title}:")
    for line in done.stdout.decode("utf-8", "replace").splitlines():
        if "\t" in line:
            table, n = line.split("\t")
            print(f"  {table:<18} {n}")


def status():
    ensure_container()
    if os.path.exists(BASELINE):
        when = time.strftime("%Y-%m-%d %H:%M", time.localtime(os.path.getmtime(BASELINE)))
        print(f"จุดตั้งต้น: {BASELINE}\n  เก็บเมื่อ {when} · {os.path.getsize(BASELINE) // 1024} KB")
    else:
        print("ยังไม่มีจุดตั้งต้น — สั่ง save ก่อน")
    show_counts("ข้อมูลตอนนี้")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "status"
    if mode == "save":
        save()
    elif mode == "restore":
        restore()
    elif mode == "status":
        status()
    else:
        print(__doc__)
        sys.exit(1)
