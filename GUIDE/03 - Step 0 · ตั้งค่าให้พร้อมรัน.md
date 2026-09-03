# 03 — Step 0 · ตั้งค่าให้พร้อมรัน

> **เป้าหมาย:** สั่ง `npm run dev` แล้วเซิร์ฟเวอร์ขึ้น + ต่อ MySQL ได้ + ตาราง 36 ตารางอยู่ครบ
> **ใช้เวลา:** ~1 วัน
> **ยังไม่เขียน endpoint ใดๆ ในบทนี้** — บทนี้คือการเก็บงานค้างให้พร้อมก่อน

---

## สิ่งที่ยังขาดอยู่ตอนนี้ (ตรวจแล้วจากไฟล์จริง)

| ไฟล์ | ปัญหา |
|---|---|
| `package.json` | ไม่มี `typescript` เลย — คอมไพล์ไม่ได้ |
| `package.json` | มี `@types/jsonwebtoken` แต่**ไม่มี `jsonwebtoken` ตัวจริง** → `controllers/auth.ts` ที่คุณเขียนไว้จะพังทันทีที่รัน |
| `package.json` | ไม่มี `zod` (Part 0-1 §1.9 บังคับใช้), ไม่มีตัว hash รหัสผ่าน, ไม่มี `@types/node` |
| `package.json` | ไม่มี script `dev` — รันไม่ได้ |
| `tsconfig.json` | `"types": []` → ใช้ `process.env` ไม่ได้ |
| `tsconfig.json` | `"jsx": "react-jsx"` → เป็นค่าจากเทมเพลต frontend ไม่เกี่ยวกับ backend |
| `.env` | `JWT_SECRET=` ว่างอยู่ → token จะเซ็นไม่ได้ |
| `docker-compose.yml` | ไม่ได้ mount `schema.sql` เข้าไป → ตารางยังไม่ถูกสร้าง |

---

## 0.1 ติดตั้ง dependency

```bash
cd /home/cheetah/soft_end/backend
npm i jsonwebtoken bcrypt zod cors
```

```bash
npm i -D typescript tsx @types/node @types/bcrypt @types/cors
```

**แต่ละตัวมีไว้ทำอะไร:**

| package | ทำอะไร | ใช้ตรงไหน |
|---|---|---|
| `jsonwebtoken` | สร้าง/ตรวจ JWT | `utils/token.ts` |
| `bcrypt` | hash รหัสผ่าน | `utils/password.ts` |
| `zod` | validate ข้อมูลขาเข้า | `schemas/*.ts` |
| `cors` | ให้ frontend คนละ port เรียกได้ | `app.ts` |
| `typescript` | ตัวคอมไพล์ | build |
| `tsx` | รัน `.ts` ตรงๆ ไม่ต้อง build ก่อน | `npm run dev` |
| `@types/node` | type ของ `process`, `Buffer` | ทั้งโปรเจกต์ |

> **`bcrypt` vs `bcryptjs`** — คนละ package แต่ใช้อัลกอริทึมเดียวกัน hash ใช้แทนกันได้ 100%
> `bcrypt` เป็น native C++ (เร็วกว่า แต่ตอนติดตั้งอาจต้อง compile ถ้าไม่มี binary ตรงรุ่น Node)
> `bcryptjs` เป็น JS ล้วน (ติดตั้งไม่มีวันพัง)
> **ทดสอบบนเครื่องนี้แล้ว (Node 24 / Linux): `bcrypt` ติดตั้งผ่านใน 0.9 วิ ใช้ binary สำเร็จรูป ไม่ต้อง compile**
> ต่างกันด้านความเร็วแค่ ~20% เลยใช้ `bcrypt` ได้เลย
> ถ้าวันไหนย้ายเครื่องแล้วติดตั้ง `bcrypt` ไม่ผ่าน → สลับเป็น `bcryptjs` ได้ทันที
> **ข้อมูลใน DB ไม่ต้องแก้อะไรเลย** เพราะ hash เข้ากันได้ (แค่เปลี่ยนชื่อ import)

---

## 0.2 เพิ่ม script ใน `package.json`

```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "typecheck": "tsc --noEmit"
}
```

- `dev` — รันแล้วแก้โค้ดปุ๊บ restart เอง (ใช้ตัวนี้ตลอดตอนพัฒนา)
- `typecheck` — เช็ค type อย่างเดียวไม่สร้างไฟล์ **รันบ่อยๆ** เพราะ `tsx` ไม่เช็ค type ให้ตอนรัน

> ⚠️ **จุดที่ต้องรู้:** `tsx` แค่ *ลบ type ทิ้ง* แล้วรัน มันไม่บอกคุณว่า type ผิด
> ถ้าโค้ดรันได้แต่ผลลัพธ์แปลก ให้ลอง `npm run typecheck` ก่อนเสมอ

---

## 0.3 แก้ `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",

    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2022",
    "lib": ["es2023"],
    "types": ["node"],              // ← เดิมเป็น [] ทำให้ process.env ใช้ไม่ได้

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "skipLibCheck": true,
    "sourceMap": true,

    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"]
}
```

**สิ่งที่เอาออก และเหตุผล:**
- `"jsx": "react-jsx"` — backend ไม่มี JSX
- `"declaration"` / `"declarationMap"` — ใช้ตอนทำ library ให้คนอื่น import ไม่ใช่ตอนทำ server

**สิ่งที่ควรรู้ว่ามันบังคับอะไรคุณ:**

| ตัวเลือก | บังคับให้คุณ |
|---|---|
| `strict` | ห้ามปล่อยตัวแปรเป็น `any` ลอยๆ, ต้องเช็ค `null` |
| `noUncheckedIndexedAccess` | `rows[0]` มี type เป็น `T \| undefined` → **ต้องเช็คก่อนใช้เสมอ** |
| `exactOptionalPropertyTypes` | `{ name?: string }` ใส่ `undefined` ตรงๆ ไม่ได้ ต้องไม่ใส่ key ไปเลย |
| `verbatimModuleSyntax` | import ที่เป็น type ต้องเขียน `import type {...}` |

> `noUncheckedIndexedAccess` จะกวนใจตอนอ่านผลจาก mysql2 มาก แต่มัน**ช่วยชีวิตคุณ**
> เพราะ `SELECT ... WHERE id = ?` ที่ไม่เจอจะได้ array ว่าง แล้ว `rows[0].name` จะพังตอน runtime
> ถ้าไม่มีตัวเลือกนี้ TypeScript จะไม่เตือนเลย

---

## 0.4 แก้ `docker-compose.yml` ให้สร้างตารางอัตโนมัติ

```yaml
services:
  mysql:
    image: mysql:8
    container_name: ltms-mysql
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: ltms
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ../database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-psecret"]
      interval: 5s
      retries: 10

volumes:
  mysql_data:
```

**สองอย่างที่เพิ่ม:**

1. **`/docker-entrypoint-initdb.d/`** — MySQL image จะรันทุกไฟล์ `.sql` ในโฟลเดอร์นี้**ตอนสร้าง database ครั้งแรกเท่านั้น**
   > ⚠️ **สำคัญมาก:** ถ้าคุณเคย `docker compose up` ไปแล้ว volume `mysql_data` มีข้อมูลอยู่แล้ว
   > → MySQL จะ**ข้าม** initdb ทั้งหมด ไฟล์ schema.sql จะไม่ถูกรัน
   > ต้องลบ volume ทิ้งก่อน: `docker compose down -v` (ดูข้อ 0.6)

2. **`healthcheck`** — MySQL ใช้เวลา ~15 วินาทีกว่าจะพร้อมรับ connection จริง
   ถ้าไม่มีอันนี้ คุณจะเจอ `ECONNREFUSED` ทั้งที่ container ขึ้นแล้ว แล้วงงว่าทำไม

---

## 0.5 ตั้งค่า `.env`

```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=secret
DB_PORT=3306
DB_NAME=ltms

PORT=8000
JWT_SECRET=<สุ่มมาใส่ อย่างน้อย 32 ตัวอักษร>
JWT_EXPIRES_IN=7d
```

สุ่ม secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

จากนั้นทำ 2 อย่าง:
1. สร้าง `.env.example` — ก็อป `.env` มาแล้วลบค่าความลับออก เหลือแต่ชื่อ key (ไฟล์นี้ commit ได้)
2. สร้าง `.gitignore` ให้มี `.env`, `node_modules/`, `dist/`

> **`JWT_SECRET` คืออะไร?** มันคือกุญแจที่ server ใช้ "เซ็น" token
> ใครถือกุญแจนี้ = ปลอม token เป็นใครก็ได้ในระบบ → ห้ามหลุดขึ้น git เด็ดขาด

---

## 0.6 เปิด database

```bash
cd /home/cheetah/soft_end/backend
docker compose down -v
```
> `-v` = ลบ volume ด้วย **ข้อมูลเดิมหายหมด** — ตอนนี้ยังไม่มีข้อมูลจริงเลยปลอดภัย
> แต่พอทำ Step 3 ไปแล้วอย่าเผลอสั่งอันนี้อีก

```bash
docker compose up -d
```

รอ ~20 วินาที แล้วเช็คว่าตารางขึ้นครบ:
```bash
docker exec ltms-mysql mysql -uroot -psecret ltms -e "SHOW TABLES;"
```

ควรได้ 32 บรรทัด (`users`, `teams`, `tournaments`, ...) ถ้าได้ว่างเปล่า → volume เก่ายังอยู่ ให้ `down -v` แล้วขึ้นใหม่

ถ้าอยากดูว่ามี error ตอนรัน schema ไหม:
```bash
docker compose logs mysql | grep -i error
```

---

## 0.7 สร้าง `config/env.ts`

ตอนนี้ `db.ts` ของคุณมี `requireEnv()` อยู่ในตัวเอง — ดีแล้ว แต่พอมีหลายไฟล์ต้องใช้ env จะซ้ำกัน
ย้ายมาไว้ที่เดียว:

**สิ่งที่ไฟล์นี้ต้องทำ:**
- มี `requireEnv(name)` ที่ throw ถ้าไม่มีค่า (ย้ายมาจาก `db.ts`)
- export object `env` ที่มี `PORT`, `DB_*`, `JWT_SECRET`, `JWT_EXPIRES_IN` ครบ
- แปลง type ให้เรียบร้อยตรงนี้เลย (`PORT` เป็น `number` ไม่ใช่ `string`)
- `import 'dotenv/config'` ไว้ที่นี่ที่เดียว

**ทำไมต้องมี:** ถ้า env ขาด คุณอยากรู้**ตอนเซิร์ฟเวอร์เริ่ม** ไม่ใช่ตอนมีคนยิง API มาแล้วพัง 500
ไฟล์นี้ถูก import ตั้งแต่บรรทัดแรกของโปรแกรม → ถ้าขาดอะไรจะ crash ทันทีพร้อมบอกว่าขาดตัวไหน

แล้วแก้ `config/db.ts` ให้ใช้ `env` แทน `requireEnv` ของตัวเอง

> **หมายเหตุ:** `db.ts` ของคุณใช้ `await` ที่ระดับบนสุดของไฟล์ (top-level await) — อันนี้**ใช้ได้**
> เพราะโปรเจกต์เป็น ESM แต่จริงๆ `mysql.createPool()` ไม่ใช่ async ด้วยซ้ำ ลบ `await` ออกได้เลย

---

## 0.8 สร้าง `config/auth.ts`

Part 0-1 §1.3 เขียนไฟล์นี้ไว้ให้แล้ว:
```ts
export const authConfig = {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,   // '7d'
};
```

---

## 0.9 แยก `server.ts` ออกจาก `app.ts`

**`src/app.ts`** — ตอนนี้ยังไม่มี route ก็ใส่ health check ไว้ก่อนเพื่อทดสอบ:
- `express()` → `express.json()` → `cors()` → (ที่ว่างไว้สำหรับ router) → `notFound` → `errorHandler`
- `export default app`

**`src/server.ts`**:
- `import app`, `import { env }`
- `app.listen(env.PORT, ...)`

ลอง:
```bash
npm run dev
```
ควรเห็น `Server is running at http://localhost:8000/`

---

## 0.10 ทดสอบว่าต่อ DB ได้จริง

เขียน route ชั่วคราวไว้ใน `app.ts` (ลบทีหลัง):
```
GET /health  →  ยิง SELECT 1 ผ่าน pool แล้วตอบ { db: 'ok' }
```

```bash
curl http://localhost:8000/health
```

ถ้าได้ `{"db":"ok"}` = **Step 0 จบแล้ว** 🎉

**ถ้าพัง เจอบ่อย 3 แบบ:**

| error | สาเหตุ | แก้ |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL ยังไม่พร้อม | รอ 20 วิ แล้วลองใหม่ / `docker compose ps` ดูว่า healthy หรือยัง |
| `ER_ACCESS_DENIED_ERROR` | รหัสผ่านใน `.env` ไม่ตรงกับ compose | ตรวจ `DB_PASSWORD` = `MYSQL_ROOT_PASSWORD` |
| `ER_BAD_DB_ERROR: Unknown database 'ltms'` | volume เก่าไม่มี db นี้ | `docker compose down -v && docker compose up -d` |

---

## เช็คลิสต์ก่อนไป Step 1

- [ ] `npm run dev` ขึ้นได้ ไม่มี error
- [ ] `npm run typecheck` ผ่าน
- [ ] `SHOW TABLES;` ได้ 36 ตาราง
- [ ] `GET /health` ตอบ `{"db":"ok"}`
- [ ] `.env` มี `JWT_SECRET` ที่ไม่ว่าง
- [ ] `.gitignore` มี `.env` แล้ว

---

## 0.11 (ทำเมื่อพร้อม) ใส่ข้อมูลตั้งต้น

`faculties`, `departments`, `sport_types` เป็น**ข้อมูลอ้างอิง** — Part 0-1 §2.1 ระบุว่า
"seed ผ่าน migration ไม่ใช่ผ่าน API" คือไม่มี `POST /faculties` ให้สร้าง

สร้าง `database/seed.sql` ใส่ข้อมูลตัวอย่างสัก 3-4 คณะ, 5-6 ภาควิชา, 3-4 ประเภทกีฬา
ไม่งั้นตอนทดสอบ `POST /auth/register` คุณจะไม่มี `facultyId` ให้ส่ง (FK จะพัง)

```bash
docker exec -i ltms-mysql mysql -uroot -psecret ltms < ../database/seed.sql
```

> ⚠️ `sport_types.min_members` / `max_members` ยังเป็นค่า placeholder ตาม Part 0-1 §4.4
> ใส่ค่าสมมติไปก่อนได้ (ฟุตบอล 11/18, บาส 5/12) แต่จดไว้ว่าต้องถามอาจารย์
> ดู [[07 - จุดที่ต้องยืนยันกับทีม]]

ต่อไป → [[04 - Step 1 · Auth]]
