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
    S3_PUBLIC_BASE : process.env["S3_PUBLIC_BASE"] || `${requireEnv("S3_ENDPOINT")}/${requireEnv("S3_BUCKET")}`,

    // Password recovery — ทุกตัว **ห้าม requireEnv** โดยเจตนา เพื่อนอีก 10+ คนที่ไม่ได้ทำเรื่องนี้ต้องรันโปรเจกต์ได้
    // ปกติโดยไม่มี credential SMTP เลย · ไม่ตั้งค่า = ชี้ไป mailpit (localhost:1025) อัตโนมัติ
    SMTP_HOST : process.env["SMTP_HOST"] || "localhost",
    SMTP_PORT : Number(process.env["SMTP_PORT"] ?? 1025),   // 1025 = mailpit
    SMTP_USER : process.env["SMTP_USER"],                    // undefined = ไม่ auth (mailpit ไม่ต้อง)
    SMTP_PASS : process.env["SMTP_PASS"],
    MAIL_FROM : process.env["MAIL_FROM"] || "no-reply@ltms.local",
    FRONTEND_URL : process.env["FRONTEND_URL"] || "http://localhost:8080",

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
};