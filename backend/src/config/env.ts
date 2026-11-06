import 'dotenv/config';

function requireEnv(name:string):string {
    const value = process.env[name];
    if (!value){
        throw new Error("Missing require environment variable " + name);
    }

    return value;
};

export const env = {
    HOST : requireEnv("DB_HOST"),
    USER : requireEnv("DB_USER"),
    PASSWORD : requireEnv("DB_PASSWORD"),
    DB_PORT : Number(requireEnv("DB_PORT")),
    DB_NAME : requireEnv("DB_NAME"),

    JWT_SECRET : requireEnv("JWT_SECRET"),
    JWT_EXPIRES_IN : requireEnv("JWT_EXPIRES_IN"),
    // secret เซ็น QR เช็คอิน (M11) แยกจาก login — ไม่ require เพื่อไม่ให้เครื่องที่ยังไม่ตั้งพัง ไม่ใส่ = ใช้ JWT_SECRET
    CHECKIN_QR_SECRET : process.env["CHECKIN_QR_SECRET"] || requireEnv("JWT_SECRET"),

    PORT : Number(requireEnv("PORT")),

    S3_ENDPOINT : requireEnv("S3_ENDPOINT"),
    S3_REGION : requireEnv("S3_REGION"),
    S3_ACCESS_KEY_ID : requireEnv("S3_ACCESS_KEY_ID"),
    S3_SECRET_ACCESS_KEY : requireEnv("S3_SECRET_ACCESS_KEY"),
    S3_BUCKET : requireEnv("S3_BUCKET"),
    // MinIO (dev) ต้องการ true เสมอ / AWS S3 จริง (production) ต้องตั้งเป็น false ผ่าน .env
    // ไม่ require เพราะไม่อยากบังคับทุกคนต้องตั้งค่านี้ตอน dev — ไม่ใส่ = ใช้ true (พฤติกรรมเดิม)
    S3_FORCE_PATH_STYLE : process.env["S3_FORCE_PATH_STYLE"] !== "false",

    // URL สาธารณะสำหรับรูปที่ตั้งใจให้ทุกคนเห็น (avatar/team_logo) — ต้องตั้ง bucket policy อ่านสาธารณะก่อน (GUIDE)
    // ไม่ require เพื่อไม่บังคับทุกเครื่อง — ไม่ใส่ = ประกอบจาก S3_ENDPOINT + S3_BUCKET เอง (ใช้ได้กับ MinIO path-style local)
    S3_PUBLIC_ENDPOINT : process.env["S3_PUBLIC_ENDPOINT"] || requireEnv("S3_ENDPOINT"),
    S3_PUBLIC_BASE : process.env["S3_PUBLIC_BASE"] || `${requireEnv("S3_ENDPOINT")}/${requireEnv("S3_BUCKET")}`,

    // Password recovery — ทุกตัว **ห้าม requireEnv** โดยเจตนา เพื่อนอีก 10+ คนที่ไม่ได้ทำเรื่องนี้ต้องรันโปรเจกต์ได้
    // ปกติโดยไม่มี credential SMTP เลย · ไม่ตั้งค่า = ชี้ไป mailpit (localhost:1025) อัตโนมัติ
    SMTP_HOST : process.env["SMTP_HOST"] || "localhost",
    SMTP_PORT : Number(process.env["SMTP_PORT"] || 1025),   // 1025 = mailpit (blank .env value also defaults)
    // For real SMTP relays (Brevo on port 587), require STARTTLS rather than sending credentials over plaintext.
    // Defaults false to keep existing local Mailpit development working unchanged.
    SMTP_REQUIRE_TLS : process.env["SMTP_REQUIRE_TLS"] === "true",
    SMTP_USER : process.env["SMTP_USER"],                    // undefined = ไม่ auth (mailpit ไม่ต้อง)
    SMTP_PASS : process.env["SMTP_PASS"],
    MAIL_FROM : process.env["MAIL_FROM"] || "no-reply@ltms.local",
    FRONTEND_URL : process.env["FRONTEND_URL"] || "http://localhost:8080",
    // Explicit opt-in: existing deployments must not suddenly email all verified users.
    EMAIL_NOTIFICATIONS_ENABLED : process.env["EMAIL_NOTIFICATIONS_ENABLED"] === "true",

    // C2 (8 ต.ค. 2569) — คำขอที่ใช้เวลาเกินกี่ ms ถึงจะถูก log · 0 = ปิดสนิท
    // ไม่ requireEnv ตามกฎเดิมของไฟล์นี้ — เพื่อนอีก 10+ คนต้องรันโปรเจกต์ได้โดยไม่ต้องตั้งอะไร
    // 2000 มาจากของจริง: load test เจอคำขอค้างจน timeout 2,000+ ครั้ง โดย log ว่างเปล่า
    SLOW_REQUEST_MS : Number(process.env["SLOW_REQUEST_MS"] ?? 2000),

    // C3 (8 ต.ค. 2569) — ขนาด pool ของ MySQL · ไม่ตั้ง = 10 (ค่าตั้งต้นของ mysql2 เดิม)
    // ตอน load test connection ทั้ง 10 ถูกถือยาวโดยคิวรีที่ช้า ⇒ ทุก endpoint รอคิวไปด้วย
    // 🔴 เพิ่มค่านี้ **ไม่ใช่การแก้คิวรีช้า** — ฐานก็มี max_connections ของตัวเอง
    //   มีไว้ให้ปรับตามเครื่องตอน deploy โดยไม่ต้องแก้โค้ด ไม่ใช่ปุ่มเร่งความเร็ว
    DB_POOL_SIZE : Number(process.env["DB_POOL_SIZE"] ?? 10),

    // C4 (8 ต.ค. 2569) — ต้อง **มากกว่า** idle timeout ของ reverse proxy ที่อยู่หน้าเรา
    // ไม่งั้น Node ปิด connection พอดีจังหวะที่ proxy กำลังส่งคำขอใหม่เข้ามา ⇒ 502 ประปราย
    // (load test เห็น ECONNRESET 4 ครั้งจาก 29,000 คำขอ ด้วยเหตุนี้) · nginx ตั้งต้น 60 วิ ⇒ 65
    KEEP_ALIVE_TIMEOUT_MS : Number(process.env["KEEP_ALIVE_TIMEOUT_MS"] ?? 65_000),

    // งานเบื้องหลังที่รันตามเวลา (มติ 8 ต.ค. 2569) — 0 = ปิดสนิท
    // เหตุผลที่ย้ายการกวาดมาอยู่ที่นี่แทนการกวาดตอนมีคนเปิดหน้า อยู่ใน jobs/scheduler.ts
    JOB_INTERVAL_MS : Number(process.env["JOB_INTERVAL_MS"] ?? 3_600_000),
    // หน่วงรอบแรกหลังเซิร์ฟเวอร์ขึ้น เพื่อไม่แย่ง connection กับคำขอชุดแรก
    JOB_STARTUP_DELAY_MS : Number(process.env["JOB_STARTUP_DELAY_MS"] ?? 10_000),

    /**
     * OD-53 (29 ต.ค. 2569) — บังคับยืนยันอีเมลก่อนใช้งาน · **ตั้งต้นเป็น false โดยเจตนา**
     *
     * 🔴 เปิดเป็น true ได้เฉพาะเมื่อ "ส่งเมลออกได้จริงบนเครื่องนั้น" เท่านั้น
     *   ไม่งั้นคนสมัครใหม่จะรอ OTP ที่ไม่มีทางมาถึง ⇒ **สมัครไม่ได้ทั้งระบบ**
     *   เครื่องพัฒนาชี้ไป mailpit (http://127.0.0.1:8025) ก็นับว่าส่งได้จริง
     *
     * ★ ทำเป็นสวิตช์ไม่ใช่ฝังในโค้ด เพราะวันเปิดจริงยังไม่แน่ (รอบัญชี Brevo ของทีม)
     *   และถ้าเปิดแล้วพบปัญหาตอนสาธิต ต้องปิดกลับได้ทันทีโดยไม่ต้องแก้โค้ดและ deploy ใหม่
     *
     * ★ คุมสองที่พร้อมกันโดยตั้งใจ — ด่านล็อกอิน และการกรองผลค้นหาผู้ใช้
     *   ถ้าคุมแค่ล็อกอิน จะเกิดสภาพ "ใช้งานได้แต่ไม่มีใครค้นเจอ" ซึ่งอธิบายกับผู้ใช้ไม่ได้
     */
    REQUIRE_EMAIL_VERIFIED : process.env["REQUIRE_EMAIL_VERIFIED"] === "true",

    /**
     * ลบบัญชีที่สมัครแล้วไม่ยืนยันอีเมลภายในกี่ชั่วโมง (0 = ไม่ลบเลย)
     *
     * ★ 24 ชม. — ให้โอกาสคนที่ตั้งใจกลับมาทำต่อวันรุ่งขึ้น และสั้นพอที่จะตอบได้ว่า
     *   "เก็บข้อมูลไว้เท่าที่จำเป็นต่อการสมัครให้เสร็จ" (หลักการเดียวกับงานลบภาพยืนยันตัวตน · OD-70)
     * 🔴 ไม่ตั้งต่ำกว่า 1 ชม. — งานกวาดรันชั่วโมงละครั้ง ตั้งต่ำกว่านั้นไม่ได้ผลเร็วขึ้น
     */
    UNVERIFIED_ACCOUNT_TTL_HOURS : Number(process.env["UNVERIFIED_ACCOUNT_TTL_HOURS"] ?? 24),

    /**
     * 🔴 30 ต.ค. 2569 (bug hunt ข้อ 1) — จำนวนชั้นของ reverse proxy ที่อยู่หน้า backend (express `trust proxy`)
     *
     * ใน docker-compose ทุกคำขอผ่าน nginx ก่อน ⇒ ไม่ตั้ง = `req.ip` เป็นไอพีของ nginx ตัวเดียวสำหรับทุกคน
     *   ⇒ ตัวจำกัดล็อกอิน "60 ครั้งต่อไอพี" กลายเป็น "60 ครั้งทั้งเว็บ" — คนเดียวกดผิดรัว ๆ ล็อกทุกคนได้ 15 นาที
     * ★ 0 (ค่าตั้งต้น) = ไม่เชื่อ header ใด ๆ — ถูกเมื่อรัน backend ตรง ๆ (npm run dev)
     *   🔴 ห้ามตั้งเมื่อไม่มี proxy จริง: client ต่อตรงแล้วปลอม `X-Forwarded-For` หลบตัวจำกัดได้
     * ★ 1 = มี nginx หนึ่งชั้น (docker-compose ตั้งให้แล้ว) · nginx ต่อไอพีจริงไว้ท้าย header ด้วย
     *   `$proxy_add_x_forwarded_for` ⇒ express หยิบตัวท้ายสุด ค่าที่ client ปลอมมาข้างหน้าไม่มีผล
     */
    TRUST_PROXY : Number(process.env["TRUST_PROXY"] ?? 0),
};
