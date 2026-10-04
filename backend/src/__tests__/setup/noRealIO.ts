import { vi } from 'vitest';

/**
 * ด่านกันเทสออกไปแตะของจริงข้างนอก (OD-62, 4 ต.ค. 2569)
 *
 * ปิดสามทาง: **MySQL** (`config/db.ts`) · **S3/MinIO** (`config/s3.ts`) · **SMTP** (`config/mail.ts`)
 *
 * ★ ทำไมต้องมี — เคสจริงที่เกิดแล้วกับ MySQL เมื่อ 4 ต.ค.
 *
 * OD-58 ทำให้ `canSeeUnfinishedResult()` เรียก `adminScope.repo` เพิ่มขึ้นมาหนึ่งที่
 * แต่เทส 9 ไฟล์ที่เดินผ่านเส้นนั้น mock แค่ repo ที่ "เห็นว่าเกี่ยว" ⇒ repo ตัวใหม่ไม่ถูก mock
 * ⇒ เทสพวกนั้นไปต่อ MySQL ที่ `127.0.0.1:3307` จริง และ **ผ่าน** เพราะเครื่องมี docker รันอยู่
 *
 * ```
 * อาการคือ "เทสผ่าน" — ไม่ใช่ "เทสแดง"  ⇒ ไม่มีสัญญาณอะไรให้จับได้เลย
 * จับได้เพราะ docker ดับเองกลางทาง แล้วเทสที่ผ่านเมื่อครึ่งชั่วโมงก่อนกลายเป็น ECONNREFUSED
 * ```
 *
 * ของที่เสียไปไม่ใช่แค่ "เทสต้องมี docker" แต่คือ **เทสเลิกทดสอบสิ่งที่มันเขียนไว้ว่าทดสอบ**
 * — มันไปอ่านข้อมูลในฐานของเครื่องนั้น ⇒ ผลขึ้นกับว่าใครเพิ่ง seed อะไรไว้ ไม่ใช่ขึ้นกับโค้ด
 *
 * ★ ทำไมคลุม S3 กับ SMTP ด้วย ทั้งที่ตอนนี้ยังไม่มีเทสไหนไปถึง
 *
 * **กลไกที่ทำให้รูของ MySQL เกิด มีครบทั้งสามทาง** — ใครเพิ่ม `s3.send()` หรือ "ส่งเมลแจ้ง"
 * เข้า service ที่มีเทสเดินผ่านอยู่แล้ว เทสก็ทะลุออกไปของจริงแบบเดียวกัน
 * และสองตัวนี้พังแรงกว่า เพราะมันไม่ใช่การ *อ่าน*:
 *
 * ```
 * MySQL ทะลุ → อ่านฐานในเครื่องตัวเอง      เสียความน่าเชื่อถือของเทส
 * S3 ทะลุ    → เขียนไฟล์ขึ้นถังจริง         เทสทิ้งขยะไว้ในที่เก็บจริง
 * SMTP ทะลุ  → ส่งเมลจริงออกไปหาคนจริง  ← 🔴 ย้อนกลับไม่ได้
 * ```
 *
 * 🔴 **SMTP คือเหตุผลที่ด่านนี้ต้องมาก่อน ไม่ใช่ตามหลัง** — ตามลำดับที่ตกลงกันไว้เรื่อง OTP
 * (OD-53) จะมีการใส่ SMTP จริงลง `backend/.env` ⇒ ตั้งแต่วินาทีนั้น เทสที่ทะลุจะไม่ใช่
 * "ต่อ mailpit ใน localhost" อีกต่อไป มัน **ยิงเมลออกจากบัญชีจริงทุกครั้งที่ใครรัน `npm test`**
 *
 * วิธีทำงาน: mock ทั้งสาม client ให้ระเบิดทุกเมธอด **เป็นค่าตั้งต้นของทุกไฟล์**
 * ไฟล์ที่ mock เองอยู่แล้วทับอันนี้ได้ตามปกติ เพราะ `vi.mock` ในไฟล์เทสถูกลงทะเบียนหลัง setup
 */

/** ชื่อที่ runtime/ตัวตรวจสอบแตะเพื่อ "ส่อง" object — ต้องไม่ระเบิด ไม่งั้น error จะกลายเป็นเรื่องอื่น */
const INTROSPECTION = new Set([
    'then', 'catch', 'finally', 'constructor', 'prototype', '__esModule',
    'inspect', 'toJSON', 'toString', 'valueOf', 'asymmetricMatch', '$$typeof',
]);

function blocked(target: string, member: string, hint: string): never {
    const message =
        `[no-real-io] เทสแตะ ${target}.${member} = กำลังจะออกไปหาของจริงข้างนอก\n` +
        `\n` +
        `สาเหตุที่พบบ่อยที่สุด: โค้ดที่เทสเรียกไป "แวะของที่ไฟล์นี้ยังไม่ได้ mock"\n` +
        `(เช่นมีคนเพิ่ม call เข้า service/middleware ที่เทสนี้เดินผ่านอยู่แล้ว)\n` +
        `⇒ ดู stack trace บรรทัดถัดไป มันบอกไฟล์และบรรทัดที่เป็นต้นเหตุ\n` +
        `\n` +
        `${hint}\n` +
        `\n` +
        `🔴 ห้ามแก้ด้วยการสั่งให้ docker / mailpit รัน — นั่นคือรูเดิมที่ด่านนี้ตั้งมาปิด\n` +
        `   เทสที่ออกไปแตะของจริงจะให้ผลตามสภาพเครื่องคนรัน ไม่ใช่ตามโค้ด`;

    /**
     * 🔴 ต้องพิมพ์ออก stderr ด้วย ไม่ใช่ throw เฉย ๆ
     *
     * `upload.service` ครอง `s3.send()` ด้วย try/catch แล้วแปลงทุก error เป็น 503
     * ⇒ ถ้า throw อย่างเดียว เทสแดงจริง (ดีแล้ว) แต่คนอ่านเห็นแค่ "expected 503 to be 422"
     *   ซึ่งไม่บอกเลยว่าต้นเหตุคือ "ลืม mock S3" ⇒ ด่านจับได้แต่สื่อสารไม่ได้
     */
    console.error(`\n${message}\n`);
    throw new Error(message);
}

/**
 * คืน object ที่ **การแตะ property อะไรก็ระเบิด** (ไม่ใช่แค่เมธอดที่เรานึกออก)
 *
 * ★ ใช้ Proxy เพราะ client ของ AWS SDK ไม่ได้ถูกเรียกแค่ `.send()` — `getSignedUrl(s3, ...)`
 *   ไปอ่าน `.config` / `.middlewareStack` ของมันเอง · ถ้าดักแต่ `send` เคสนั้นจะพังด้วย error
 *   ของ SDK ที่อ่านไม่รู้เรื่อง แทนที่จะเป็นข้อความนี้
 */
function poison(target: string, hint: string): Record<string, unknown> {
    return new Proxy({}, {
        get(_t, prop) {
            if (typeof prop === 'symbol' || INTROSPECTION.has(prop)) return undefined;
            return () => blocked(target, String(prop), hint);
        },
    }) as Record<string, unknown>;
}

// ═══════════════════════════ MySQL ═══════════════════════════
vi.mock('../../config/db.js', () => ({
    default: poison('pool (MySQL)',
        `ทางแก้ เลือกอย่างใดอย่างหนึ่ง:\n` +
        `  ① mock repo ตัวที่ขาด — ดูชื่อจาก stack trace แล้วใส่\n` +
        `       vi.mock('../../repositories/<ชื่อ>.repo.js', () => ({ <fn>: vi.fn(() => Promise.resolve(null)) }));\n` +
        `     ★ ใช้วิธีนี้เป็นหลัก เพราะเทสยังตรวจ "logic ของ service" ตามที่ตั้งใจไว้\n` +
        `  ② ถ้าไฟล์นี้ตั้งใจตรวจตัว SQL เอง (เทส repo) ให้ mock pool ในไฟล์เทสเลย\n` +
        `       const mocks = vi.hoisted(() => ({ query: vi.fn() }));\n` +
        `       vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));`),
}));

// ═══════════════════════════ S3 / MinIO ═══════════════════════════
vi.mock('../../config/s3.js', () => ({
    default: poison('s3 (MinIO/S3)',
        `ทางแก้ เลือกอย่างใดอย่างหนึ่ง:\n` +
        `  ① mock upload.service — ที่ service อื่นเรียกใช้ (14 ไฟล์ทำแบบนี้อยู่แล้ว)\n` +
        `       vi.mock('../upload.service.js', () => ({ toPublicOrSignedUrl: vi.fn(() => null) }));\n` +
        `     ★ ใช้วิธีนี้เป็นหลัก — เทสของ service อื่นไม่ควรรู้เรื่อง S3 เลย\n` +
        `  ② ถ้าไฟล์นี้ตั้งใจตรวจ upload.service เอง ให้ mock client ในไฟล์เทส\n` +
        `       vi.mock('../../config/s3.js', () => ({ default: { send: s3Send } }));\n` +
        `       vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn(...) }));`),
}));

// ═══════════════════════════ SMTP ═══════════════════════════
vi.mock('../../config/mail.js', () => ({
    default: poison('transport (SMTP)',
        `ทางแก้ เลือกอย่างใดอย่างหนึ่ง:\n` +
        `  ① mock mail.service — ที่ auth.service เรียกใช้\n` +
        `       vi.mock('../mail.service.js', () => ({ sendVerificationEmail: vi.fn() }));\n` +
        `     ★ ใช้วิธีนี้เป็นหลัก — เทสของ flow อื่นไม่ควรรู้เรื่องการส่งเมล\n` +
        `  ② ถ้าไฟล์นี้ตั้งใจตรวจ mail.service เอง ให้ mock transport ในไฟล์เทส\n` +
        `       vi.mock('../../config/mail.js', () => ({ default: { sendMail: mocks.sendMail } }));`),
}));
