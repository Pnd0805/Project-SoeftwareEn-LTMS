# 04 — Step 1 · Auth (ลงมือทำจริง)

> **เป้าหมาย:** สมัครสมาชิก → ล็อกอินได้ token → เอา token ไปเรียก `GET /me` ได้
> **วิธีใช้ไฟล์นี้:** ทุก code block เป็น**โครงที่ก็อปวางได้จริง** ทดสอบคอมไพล์แล้วทุกตัว
> ส่วนที่เว้นเป็น `// TODO:` คือจุดที่ต้องคิดเอง — อ่าน comment แล้วเติม 1-3 บรรทัด ไม่ใช่เขียนใหม่ทั้งไฟล์

---

## ✅ สถานะตอนนี้ (เช็คจากไฟล์จริงในเครื่องคุณ)

```
src/
├── config/
│   ├── env.ts            ✅ เสร็จ
│   ├── db.ts              ✅ เสร็จ (มี timezone:'Z', dateStrings:['DATE'])
│   └── auth.ts             ✅ เสร็จ (authConfig.secret, authConfig.expireIn)
├── types/
│   ├── db.ts                ✅ เสร็จ (UserRow)
│   └── express.d.ts          ✅ เสร็จ (req.user?: UserRow)
├── utils/
│   └── AppError.ts             ✅ เสร็จ
├── middlewares/
│   ├── errorHandler.ts          ✅ เสร็จ
│   ├── notFound.ts               ✅ เสร็จ
│   └── validate.ts                ⬜ ว่างอยู่ ← เริ่มตรงนี้
├── schemas/
│   └── auth.schema.ts              ✅ เสร็จ (registerSchema)
└── controllers/
    └── auth.controller.ts           ⬜ มีแค่ stub

ยังไม่มีเลย: utils/password.ts, utils/token.ts,
             repositories/user.repo.ts, mappers/user.mapper.ts,
             services/auth.service.ts,
             routes/auth.routes.ts, routes/index.ts,
             middlewares/requireAuth.ts
```

**ลำดับที่จะทำต่อจากนี้ — ทำตามนี้ทีละไฟล์ ห้ามข้าม:**

```
1. utils/password.ts        (5 นาที)
2. utils/token.ts            (5 นาที)
3. repositories/user.repo.ts  (10 นาที)
4. mappers/user.mapper.ts      (10 นาที)
5. middlewares/validate.ts       (5 นาที — ไฟล์ที่ค้างอยู่)
6. services/auth.service.ts       (20 นาที — ส่วนคิดเยอะสุด)
7. controllers/auth.controller.ts   (5 นาที)
8. routes/auth.routes.ts + index.ts  (5 นาที)
9. middlewares/requireAuth.ts          (10 นาที)
10. ต่อเข้า app.ts + ทดสอบด้วย curl
```

เหตุผลที่เรียงแบบนี้: **ไฟล์แต่ละตัวต้อง import ไฟล์ก่อนหน้ามาใช้** เขียนสลับลำดับจะ import ของที่ยังไม่มี

---

## 1️⃣ `src/utils/password.ts`

**หน้าที่:** hash รหัสผ่านตอนสมัคร / เทียบรหัสผ่านตอนล็อกอิน

ก็อปทั้งไฟล์นี้ได้เลย — ไม่มีจุดต้องคิดเอง เพราะเป็นแค่ wrapper บาง ๆ รอบ `bcrypt`:

```ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

**ทดสอบไฟล์นี้ทันที** (ไม่ต้องรอ DB) — สร้าง `_test.ts` ชั่วคราวที่ root ของ `backend/`:
```ts
import { hashPassword, verifyPassword } from './src/utils/password.js';
const h = await hashPassword('test1234');
console.log(h);
console.log(await verifyPassword('test1234', h));   // ต้องได้ true
console.log(await verifyPassword('ผิด', h));         // ต้องได้ false
```
```bash
npx tsx _test.ts && rm _test.ts
```

---

## 2️⃣ `src/utils/token.ts`

**หน้าที่:** ออก JWT ตอน login / ถอดรหัส JWT ตอนมี request เข้ามา

```ts
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { authConfig } from '../config/auth.js';

type ExpiresIn = NonNullable<SignOptions['expiresIn']>;

export function signToken(userId: number): string {
  return jwt.sign(
    { sub: String(userId) },
    authConfig.secret,
    { expiresIn: authConfig.expireIn as ExpiresIn }
  );
}

export function verifyToken(token: string): { sub: string } {
  return jwt.verify(token, authConfig.secret) as { sub: string };
}
```

> **ทำไมต้อง `as ExpiresIn`?**
> `expiresIn` ไม่รับ `string` ธรรมดา แต่รับ template literal type ที่แคบมาก:
> `` `${number}` | `${number}${Unit}` `` → `'7d'`, `'15m'`, `'604800'` ผ่าน แต่ `'สวัสดี'` ไม่ผ่าน
> ส่วน `authConfig.expireIn` เป็น `string` ธรรมดา (มาจาก env ซึ่งอ่านตอน**รัน** ไม่ใช่ตอน**คอมไพล์**)
> TypeScript จึงเดา format ไม่ได้ ต้อง cast ยืนยันเอง
>
> **`NonNullable<>` มีไว้ตัด `undefined` ออก** — เพราะ `expiresIn?:` เป็น optional
> และ tsconfig เปิด `exactOptionalPropertyTypes: true` ซึ่งห้ามใส่ `undefined` ลงไปตรงๆ
>
> ⚠️ **ห้าม cast ทั้ง object เป็น `{...} as SignOptions`** ถึงแม้จะคอมไพล์ผ่านเหมือนกัน
> เพราะมันปิดการตรวจ key ทั้งหมด — ทดสอบแล้วว่าพิมพ์ `expresIn` ผิดก็ยังผ่าน
> ผลคือ token ไม่มีวันหมดอายุ โดยไม่มี error อะไรเตือนเลย
> **หลัก: `as` ให้แคบที่สุด — cast แค่ค่า ไม่ใช่ทั้งก้อน**

**ทดสอบ:**
```bash
npx tsx -e "
import { signToken, verifyToken } from './src/utils/token.js';
const t = signToken(42);
console.log(verifyToken(t));   // ต้องได้ { sub: '42', iat: ..., exp: ... }
"
```

---

## 3️⃣ `src/repositories/user.repo.ts`

**หน้าที่:** SQL ของตาราง `users` ทั้งหมด — ที่เดียวในระบบที่มีคำว่า `SELECT`/`INSERT` เกี่ยวกับ users

สร้างโฟลเดอร์ก่อน: `mkdir src/repositories`

```ts
import pool from '../config/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { UserRow } from '../types/db.js';

export async function findByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await pool.query<(UserRow & RowDataPacket)[]>(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  return rows[0] ?? null;
}

export async function findById(userId: number): Promise<UserRow | null> {
  const [rows] = await pool.query<(UserRow & RowDataPacket)[]>(
    'SELECT * FROM users WHERE user_id = ?',
    [userId]
  );
  return rows[0] ?? null;
}

type NewUser = {
  fullName: string;
  email: string;
  passwordHash: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string;
  facultyId: number;
  departmentId: number;
  year: number;
};

export async function create(data: NewUser): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (full_name, email, password_hash, gender, birth_date, user_type, faculty_id, department_id, year)
     VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?)`,
    [data.fullName, data.email, data.passwordHash, data.gender, data.birthDate, data.facultyId, data.departmentId, data.year]
  );
  return result.insertId;
}
```

**อ่านทำความเข้าใจ 3 จุดนี้ก่อนไปต่อ:**

1. `(UserRow & RowDataPacket)[]` — บอก TypeScript สองเรื่องพร้อมกัน: *"หน้าตาตรง `UserRow`"* (จากเรา) และ *"เป็นแถวจาก mysql2 นะ"* (ไลบรารีต้องการ marker นี้)
2. `rows[0] ?? null` — เพราะ `noUncheckedIndexedAccess` ทำให้ `rows[0]` เป็น `UserRow | undefined` เสมอ ต้องแปลงเป็น `null` explicit
3. `'student'` ถูก hardcode ไว้ในคำสั่ง SQL เลย — เพราะ A01 (register) ไม่รับ `userType` มาจาก client แต่ DB บังคับ NOT NULL (ดู [[07 - จุดที่ต้องยืนยันกับทีม]] ข้อ E3)

**ยังทดสอบไม่ได้** เพราะยังไม่มี route เรียก — รอไปทดสอบรวมท้ายสุด

---

## 4️⃣ `src/mappers/user.mapper.ts`

**หน้าที่:** แปลง `UserRow` (snake_case จาก DB) → JSON ที่ปลอดภัยจะส่งออก (camelCase, ไม่มี password)

สร้างโฟลเดอร์ก่อน: `mkdir src/mappers`

```ts
import type { UserRow } from '../types/db.js';

export function toMeDto(row: UserRow) {
  return {
    id: row.user_id,
    fullName: row.full_name,
    email: row.email,
    gender: row.gender,
    birthDate: row.birth_date,
    facultyId: row.faculty_id,
    departmentId: row.department_id,
    year: row.year,
    avatarUrl: row.profile_image_key,   // TODO: ตอนมี S3 presign แล้วค่อยแปลงเป็น URL จริง — ตอนนี้ปล่อย key ดิบไปก่อน
    contactInfo: row.contact_info,
    address: row.address,
    totalPoints: row.total_points,
    notificationPrefs: row.notification_prefs,
    createdAt: row.created_at.toISOString(),
  };
}

export function toUserRef(row: UserRow) {
  return {
    id: row.user_id,
    fullName: row.full_name,
    avatarUrl: row.profile_image_key,
  };
}
```

> **สังเกต:** ฟังก์ชันนี้สร้าง object ใหม่ **ทีละ field ด้วยมือ** ไม่ใช้ `{ ...row }`
> เพราะ `{ ...row }` จะลาก `password_hash` ติดมาด้วย — พิมพ์ทุก field เองคือวิธีป้องกัน ไม่ใช่ความขี้เกียจ

**ยังไม่ต้องเขียน `toPublicUserDto` (สำหรับ U03)** — Step 1 ทำแค่ A01/A02/A03/U01 พอ ตัวนั้นทำตอน Step 3

---

## 5️⃣ `src/middlewares/validate.ts` ← ไฟล์ที่ค้างอยู่

**หน้าที่:** รับ Zod schema มา 1 ตัว → คืน middleware ที่เอา schema นั้นไปตรวจ `req.body`

```ts
import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/AppError.js';

export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        fields[key] = issue.message;
      }
      return next(new AppError(400, 'VALIDATION_FAILED', 'ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่', { fields }));
    }

    req.body = result.data;   // ★ ทับ req.body ด้วยค่าที่ผ่านการ parse แล้ว (กรอง field แปลกปลอมทิ้ง)
    next();
  };
}
```

**ทำไมวนลูป issues ทีละตัวแทนที่จะใช้ `.flatten()`:** เพราะสเปก (Part 0-1 §1.8) ต้องการ `fields` เป็น `{ email: "ข้อความ", password: "ข้อความ" }` — object แบน ๆ 1 field ต่อ 1 ข้อความ ซึ่งวนลูปเองแล้วเขียนตรง ๆ ง่ายกว่าไปงมวิธี format ของ Zod

---

## 6️⃣ `src/services/auth.service.ts` ← จุดที่ต้องคิดเยอะสุด

**หน้าที่:** ตรรกะจริงของ register/login — จุดเดียวที่ตัดสินใจว่า "ทำได้ไหม" ไม่ใช่แค่ "รูปแบบถูกไหม"

สร้างโฟลเดอร์: `mkdir src/services`

```ts
import * as userRepo from '../repositories/user.repo.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { AppError } from '../utils/AppError.js';
import type { RegisterInput } from '../schemas/auth.schema.js';

export async function register(input: RegisterInput) {
  const existing = await userRepo.findByEmail(input.email);
  if (existing) {
    throw new AppError(400, 'EMAIL_ALREADY_REGISTERED', 'ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่', {
      fields: { email: 'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ' },
    });
  }

  // TODO 1: hash รหัสผ่านด้วย hashPassword(input.password)

  // TODO 2: เรียก userRepo.create({...}) ด้วยค่าที่แปลงแล้ว
  //         (fullName, email, passwordHash, gender, birthDate, facultyId, departmentId, year)
  //         เก็บค่าที่ได้ (insertId) ไว้เป็นตัวแปร เช่น const newId = ...

  // TODO 3: คืนค่าตาม A01 → { id: newId, fullName: input.fullName, email: input.email }
}

export async function login(email: string, password: string) {
  const user = await userRepo.findByEmail(email);

  // TODO 4: ถ้า !user → throw AppError(401, 'INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')

  // TODO 5: verifyPassword(password, user.password_hash) → ถ้าไม่ตรง
  //         throw AppError ตัวเดียวกันเป๊ะกับ TODO 4 (ข้อความเดียวกัน ห้ามแยก — กัน user enumeration)

  // TODO 6: ถ้า user.is_suspended === 1 →
  //         throw AppError(403, 'ACCOUNT_SUSPENDED', 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ')

  // TODO 7: signToken(user.user_id) → เก็บเป็น accessToken

  // TODO 8: คืนค่าตาม A02:
  // {
  //   accessToken,
  //   expiresIn: 604800,
  //   tokenType: 'Bearer' as const,
  //   user: { id: user.user_id, fullName: user.full_name, userType: user.user_type },
  // }
}
```

**เทคนิคทำ TODO 4-5 ให้ TypeScript ช่วยได้:** หลัง TODO 4 คุณต้องมั่นใจว่า `user` ไม่ใช่ `null` แล้ว — ใช้ pattern นี้:
```ts
if (!user) {
  throw new AppError(401, 'INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
}
// ผ่านบรรทัดนี้มาได้ TypeScript รู้เองว่า user ไม่ใช่ null แล้ว (type narrowing)
```

> **`logout` ไม่ต้องเขียนที่นี่เลย** — Part 2 §1 บอกว่าไม่มี logic ฝั่ง server ใส่ไว้ที่ controller ตรง ๆ ได้เลย (ดูข้อ 7️⃣)

---

## 7️⃣ `src/controllers/auth.controller.ts`

**หน้าที่:** แค่ต่อสาย `req` → service → `res` บาง ๆ ไม่มี logic

ไฟล์คุณตอนนี้มี `import jwt` ที่ไม่ได้ใช้แล้ว (ย้ายไป `utils/token.ts` แล้ว) — เขียนทับทั้งไฟล์:

```ts
import type { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export function logout(req: Request, res: Response) {
  res.status(204).send();
}
```

> **ทำไมต้องมี `try/catch` ทั้งที่ Express 5 จับ error จาก async ให้อัตโนมัติ?**
> จริง ๆ ไม่จำเป็นก็ได้ (Express 5 จับให้จริง) แต่ใส่ไว้ให้เห็นชัดว่า error จาก service วิ่งไปไหนต่อ — ถ้าอยากเขียนสั้นกว่านี้ ตัด `try/catch` ออกแล้วปล่อยให้ Express จัดการเองก็ได้เหมือนกัน ทั้งสองแบบทำงานเหมือนกันในโปรเจกต์นี้

---

## 8️⃣ `src/routes/auth.routes.ts` + `src/routes/index.ts`

สร้างโฟลเดอร์: `mkdir src/routes`

```ts
// src/routes/auth.routes.ts
import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { registerSchema } from '../schemas/auth.schema.js';
// TODO: import loginSchema จาก schemas/auth.schema.ts (ยังไม่มี — ดูหมายเหตุด้านล่าง)
// TODO: import requireAuth จาก middlewares/requireAuth.js (ยังไม่มี — ทำในข้อ 9️⃣)

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
// TODO: router.post('/login', validate(loginSchema), authController.login);
// TODO: router.post('/logout', requireAuth, authController.logout);

export default router;
```

```ts
// src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes.js';

const router = Router();
router.use('/auth', authRoutes);

export default router;
```

**หมายเหตุ `loginSchema` ที่ยังไม่มี:** เปิด `src/schemas/auth.schema.ts` เพิ่มต่อจาก `registerSchema`:
```ts
const loginSchema = z.object({
  email: z.email('รูปแบบอีเมลไม่ถูกต้อง'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),   // ★ ห้ามใส่กฎความยาว/ตัวเลขซ้ำที่นี่
});

export { loginSchema };
```
> **ทำไม `loginSchema` ห้ามมีกฎ "8 ตัว + มีตัวเลข" ซ้ำกับ `registerSchema`?**
> เพราะ user ที่สมัครไว้ก่อนกฎเปลี่ยน (หรือรหัสผ่านสั้นกว่าเกณฑ์ปัจจุบัน) ต้องล็อกอินได้เหมือนเดิม
> validate ตอน login เช็คแค่ "ส่งมาไหม" ไม่ใช่ "ถูกกฎไหม" — กฎถูกเช็คตอนสมัคร/เปลี่ยนรหัสเท่านั้น

---

## 9️⃣ `src/middlewares/requireAuth.ts`

**หน้าที่:** ตัวที่ 92 endpoint ที่เหลือในระบบจะ import ไปใช้ — ทำให้ดีตั้งแต่ตอนนี้

```ts
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/token.js';
import * as userRepo from '../repositories/user.repo.js';
import { AppError } from '../utils/AppError.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return next(new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน'));
  }

  try {
    const payload = verifyToken(token);
    const user = await userRepo.findById(Number(payload.sub));

    if (!user || user.is_suspended === 1) {
      return next(new AppError(403, 'ACCOUNT_SUSPENDED', 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'));
    }

    req.user = user;
    next();
  } catch {
    next(new AppError(401, 'TOKEN_EXPIRED', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'));
  }
}
```

**อ่านทวนทีละบรรทัดให้แน่ใจว่าเข้าใจ ก่อนไปต่อ:**

| บรรทัด | ทำไมต้องมี |
|---|---|
| `split(' ')[1]` | header คือ `"Bearer eyJ..."` — ตัด `"Bearer"` ทิ้ง เอาแค่ token |
| `verifyToken` อยู่ใน `try` | token ปลอม/หมดอายุจะ throw จาก `jwt.verify` ข้างใน |
| `userRepo.findById` | **จุดที่สำคัญที่สุดของทั้งไฟล์** — query DB สดทุก request แทนที่จะเชื่อแค่ token (เหตุผลเต็มอยู่ใน [[01 - Backend ทำงานยังไง]] §6) |
| `user.is_suspended === 1` | ไม่ใช่ `=== true` เพราะ MySQL คืน `0`/`1` ไม่ใช่ boolean จริง |
| `req.user = user` | ใส่ **row ดิบทั้งแถว** ไม่ map — endpoint อื่นต้องใช้ field ที่ mapper กรองทิ้งไปด้วย เช่น `is_suspended` |

**ตอนนี้กลับไปเติม routes ที่ค้างไว้ในข้อ 8️⃣:**
```ts
import { loginSchema } from '../schemas/auth.schema.js';
import { requireAuth } from '../middlewares/requireAuth.js';

router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', requireAuth, authController.logout);
```

---

## 🔟 ต่อเข้า `app.ts` แล้วทดสอบ

เปิด `src/app.ts` — เอา route `/health` ทดสอบ MySQL ที่เคยใส่ไว้ (ถ้ามี) ออก แล้วใส่:

```ts
import express from 'express';
import routes from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);   // ★ ต้องอยู่บรรทัดสุดท้ายเสมอ

export default app;
```

รัน:
```bash
npm run dev
```

### ทดสอบทีละ endpoint

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"สมชาย ใจดี","email":"somchai@test.com","password":"test1234","gender":"male","birthDate":"2004-05-01","facultyId":1,"departmentId":1,"year":3}'
```
ควรได้ `201` พร้อม `{ "id": ..., "fullName": "สมชาย ใจดี", "email": "somchai@test.com" }`

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"somchai@test.com","password":"test1234"}'
```
ควรได้ `accessToken` มา — **ก็อป token เก็บไว้**

```bash
curl http://localhost:8000/api/v1/me \
  -H 'Authorization: Bearer <วาง token ตรงนี้>'
```
❗ ยังไม่ได้ทำ `GET /me` — ทำในข้อ 1️⃣1️⃣ ถัดไป ตอนนี้ลอง `/auth/logout` แทนได้:
```bash
curl -i -X POST http://localhost:8000/api/v1/auth/logout \
  -H 'Authorization: Bearer <token>'
```
ควรได้ `204 No Content`

### เคสที่ต้องลองให้ครบ (นี่คือการเทสจริง ไม่ใช่แค่ให้ผ่าน)

| ลองอะไร | ต้องได้ |
|---|---|
| สมัครอีเมลซ้ำ | `400` `EMAIL_ALREADY_REGISTERED` พร้อม `fields.email` ภาษาไทย |
| `password: "abc"` | `400` `VALIDATION_FAILED` |
| ไม่ส่ง `fullName` | `400` `VALIDATION_FAILED` |
| login รหัสผิด | `401` `INVALID_CREDENTIALS` |
| login อีเมลที่ไม่มี | `401` **ข้อความเดียวกันเป๊ะ** กับข้างบน |
| `/auth/logout` ไม่ส่ง header | `401` `NO_TOKEN` |
| `/auth/logout` token มั่ว ๆ | `401` `TOKEN_EXPIRED` |

---

## 1️⃣1️⃣ ปิดท้าย Step 1: `GET /me` (U01)

พอมี `requireAuth` แล้ว endpoint นี้สั้นมาก — ทำ 3 จุด:

**`src/controllers/user.controller.ts`** (ไฟล์ใหม่):
```ts
import type { Request, Response } from 'express';
import { toMeDto } from '../mappers/user.mapper.js';

export function getMe(req: Request, res: Response) {
  res.status(200).json(toMeDto(req.user!));
}
```
> `req.user!` — `!` บอก TypeScript ว่า "มั่นใจว่าไม่ใช่ undefined" เพราะ route นี้ผ่าน `requireAuth` มาก่อนเสมอ (ตั้งค่าไว้แน่นอนแล้ว)

**`src/routes/user.routes.ts`** (ไฟล์ใหม่):
```ts
import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();
router.get('/me', requireAuth, userController.getMe);

export default router;
```

**ต่อเข้า `src/routes/index.ts`:**
```ts
import userRoutes from './user.routes.js';
router.use(userRoutes);   // ★ ไม่มี prefix — path จริงคือ /me ตรงๆ ไม่ใช่ /user/me
```

**ทดสอบ:**
```bash
curl http://localhost:8000/api/v1/me -H 'Authorization: Bearer <token>'
```

**เช็คด้วยตาเป็นอย่างสุดท้าย** — สำคัญที่สุดในทั้ง Step:
```bash
curl -s http://localhost:8000/api/v1/me -H 'Authorization: Bearer <token>' | grep -i password
```
ต้อง**ไม่ได้อะไรกลับมาเลย** ถ้าเจอ `password` หรือ `passwordHash` แปลว่า mapper รั่ว ต้องแก้ก่อนไปต่อ

---

## ✅ เช็คลิสต์จบ Step 1

- [ ] register / login / logout / GET me ทำงานครบตามตารางทดสอบข้างบน
- [ ] response ไม่มี password ในทุกรูปแบบ (เช็คด้วย `grep -i password` จริง ไม่ใช่แค่มองผ่าน)
- [ ] error ทุกตัวหน้าตาเป็น `{ error: { code, message } }` เหมือนกันหมด
- [ ] message เป็นภาษาไทยทุกตัว
- [ ] `npm run typecheck` ผ่าน ไม่มี error
- [ ] ไม่มี `SELECT`/`INSERT` นอกโฟลเดอร์ `repositories/`
- [ ] ไม่มี `req`/`res` ใน `services/`

**พอผ่านหมด → คุณมีโครงที่รองรับอีก 89 endpoint แล้ว** endpoint ถัดไปจะเร็วขึ้นมาก เพราะ 90% ของไฟล์ (middleware, error handling, mapper pattern) ทำเสร็จแล้วในรอบนี้

ต่อไป → [[05 - สูตรทำ endpoint + แผนงาน]]
