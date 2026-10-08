# LTMS — Deploy สำหรับพรีเซนต์ (branch `Final_Present`)

branch นี้คือ `NEW_UXUI_frontend` @ `ac37be9` (UI ใหม่ + backend รุ่นที่ migration ถึง `050`) บวกข้อมูลเริ่มต้นสำหรับพรีเซนต์
**9 ต.ค. 2569 เวลา 13:00** ทดสอบเส้นทางด้านล่างแล้วบนเครื่อง Windows + Docker Desktop เมื่อ 8 ต.ค. (เว็บขึ้นที่พอร์ต 8080 พร้อมข้อมูลเดโม)

| ไฟล์ | คืออะไร |
|---|---|
| `database/demo-seed.sql` | dump ทั้งฐานข้อมูลของชุดเดโม |
| `database/seed-demo.py` | สคริปต์ที่สร้างข้อมูลชุดนี้ (ใช้เมื่อเลื่อนวันหรือเวลาพรีเซนต์) |
| `docs/demo/LTMS_Demo_Seed.md` | รายการบัญชี ทีม ทัวร์ และหน้าต่างเวลาของข้อมูล |
| `docs/demo/LTMS_Demo_Runbook_4People.pdf` | สคริปต์กดตามสำหรับผู้พรีเซนต์ 4 คน |

## ต้องมีบนเครื่อง

Docker พร้อม Docker Compose เท่านั้น ไม่ต้องติดตั้ง Node หรือ MySQL

## ขั้นตอน

### 1. ดึงโค้ด

```bash
git clone -b Final_Present https://github.com/Pnd0805/Project-SoeftwareEn-LTMS.git
```

```bash
cd Project-SoeftwareEn-LTMS/backend
```

### 2. สร้างไฟล์ `backend/.env`

คัดลอกจาก `.env.example` แล้วเติมค่าให้ครบ ค่าที่ต้องมี:

```
DB_USER=root
DB_PASSWORD=<ตั้งรหัสฐานข้อมูล>
DB_NAME=ltms
MYSQL_ROOT_PASSWORD=<ค่าเดียวกับ DB_PASSWORD>
PORT=8000
JWT_SECRET=<สตริงสุ่มยาว ๆ>
JWT_EXPIRES_IN=7d
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=<ตั้งรหัส>
S3_BUCKET=ltms-uploads
S3_FORCE_PATH_STYLE=true
FRONTEND_URL=<ที่อยู่เว็บที่ผู้ใช้เปิด เช่น http://localhost:8080>
```

- `DB_HOST` และ `DB_PORT` ไม่ต้องใส่ `docker-compose.yml` ตั้งให้ container เอง (`mysql:3306`)
- ค่า `S3_*` ต้องมีเสมอแม้จะไม่ใช้ที่เก็บไฟล์ ไม่งั้น backend ไม่ยอมสตาร์ต
- `MYSQL_ROOT_PASSWORD` มีผลเฉพาะตอนสร้างฐานครั้งแรก ถ้าเคยรันมาก่อนด้วยรหัสอื่น ต้องใช้รหัสเดิม

### 3. สตาร์ตระบบ

แบบไม่มีที่เก็บไฟล์ (ชุดเดโมนี้ออกแบบมาสำหรับแบบนี้):

```bash
docker compose up -d mysql mailpit
```

```bash
docker compose up -d --build --no-deps backend nginx
```

ถ้าเครื่องดึง image ของ MinIO ได้และอยากมีที่เก็บไฟล์ด้วย ใช้คำสั่งเดียวแทนสองคำสั่งข้างบน:

```bash
docker compose up -d --build
```

### 4. โหลดข้อมูลเดโม

รอให้ `ltms-mysql` ขึ้นสถานะ healthy ก่อน (`docker ps`) แล้วรันจากโฟลเดอร์ `backend/` สองคำสั่งนี้ใช้ได้เหมือนกันทั้ง bash, PowerShell และ cmd:

```bash
docker cp ../database/demo-seed.sql ltms-mysql:/tmp/demo-seed.sql
```

```bash
docker exec ltms-mysql sh -c "mysql -uroot -p<DB_PASSWORD> --default-character-set=utf8mb4 ltms < /tmp/demo-seed.sql"
```

ไฟล์นี้ **ลบและสร้างทุกตารางใหม่** ข้อมูลเดิมในฐานจะหายทั้งหมด และรันซ้ำได้ทุกครั้งที่อยากคืนข้อมูลกลับเป็นค่าเริ่มต้น
ไม่ต้องรัน migration เพิ่ม (ไฟล์อยู่ที่ `050` เท่ากับโค้ดใน branch นี้)

อย่าส่งไฟล์เข้า `docker exec -i` ด้วยไปป์ของ PowerShell ตัวอักษรไทยจะเพี้ยน ให้ใช้วิธี `docker cp` ข้างบน

### 5. เปิดเว็บ

- เว็บ: `http://localhost:8080`
- อีเมลทดสอบ (OTP ตอนสมัครสมาชิก): `http://localhost:8025`

ล็อกอินทดสอบด้วย `admin@ku.th` รายการบัญชีทั้งหมดอยู่ใน `docs/demo/LTMS_Demo_Seed.md`

## ต้องรู้ก่อนวันพรีเซนต์

- **โหลดข้อมูล (ขั้นที่ 4) ก่อน 12:20 น. ของวันพรีเซนต์** แมตช์สด `/m/1` นัดไว้ 13:20 และระบบให้เปิดเช็คอินได้แค่ 12:20–14:20
  เวลาในไฟล์เป็นเวลาจริง ไม่ได้เลื่อนตามวันที่โหลด
- **ถ้าซ้อมแล้วข้อมูลเปลี่ยน ให้รันขั้นที่ 4 ซ้ำ** ก่อนขึ้นเวที
- **ถ้าเวลาพรีเซนต์เลื่อนเกินราว 1 ชั่วโมง** ต้องสร้างข้อมูลใหม่ ดูหัวข้อถัดไป
- **พอร์ตทั้งหมดผูกกับ `127.0.0.1`** เปิดได้จากเครื่องที่รันเท่านั้น ถ้าจะให้เครื่องอื่นเข้า ต้องตั้ง reverse proxy
  หรือแก้ `ports` ของ service `nginx` ใน `docker-compose.yml`
- **ฐานข้อมูลต้องเป็น UTC** `docker-compose.yml` ตั้งไว้ให้แล้ว ถ้าใช้ MySQL ตัวอื่นต้องตั้งเอง ไม่งั้นช่วงเวลาแมตช์สดจะเลื่อน 7 ชั่วโมง

## สร้างข้อมูลใหม่ (เมื่อเลื่อนวันหรือเวลา)

ต้องรัน backend แบบ dev บนเครื่อง (`npm ci` แล้ว `npm run dev` ใน `backend/` โดย `.env` ชี้ `DB_HOST=127.0.0.1`, `DB_PORT=3307`)
เพราะสคริปต์เรียก API ที่ `localhost:8000` และอ่าน `JWT_SECRET` จาก `backend/.env`

🔴 สคริปต์ล้างฐานข้อมูลทั้งหมดก่อนสร้าง และต้องมีบัญชีชุดทดสอบอยู่ในฐานก่อน (โหลด `demo-seed.sql` หรือ `qa-baseline.sql` ไว้ก่อน)

```bash
python database/seed-demo.py 2026-10-09T13:00
```

แล้ว dump ทับไฟล์เดิม:

```bash
docker exec ltms-mysql mysqldump -uroot -p<DB_PASSWORD> --default-character-set=utf8mb4 --single-transaction --add-drop-table --routines --triggers --skip-comments ltms > database/demo-seed.sql
```

## ข้อจำกัดของรุ่นนี้ที่กระทบการพรีเซนต์

- ทาย Pick'em บนหน้าเว็บไม่ได้ (หน้าเว็บส่งคำทายแบบเลือกทีม ส่วน backend รับแบบทายคะแนน) โชว์ได้เฉพาะสัดส่วนคำทายและตารางอันดับ
- ไม่มีหน้าเหรียญรางวัลใน UI รุ่นนี้
- ไม่มีที่เก็บไฟล์ จึงอัปโหลดรูปและเอกสารไม่ได้ และลิงก์เอกสารของกรรมการภายนอกเปิดไม่ขึ้น
- ทัวร์ที่ปิดแล้วไม่ขึ้นในหน้าแรก เข้าทาง `/t/9` หรือค้นหาแล้วเปลี่ยน Tournament status เป็น Completed
