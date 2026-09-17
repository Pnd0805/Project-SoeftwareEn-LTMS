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
};