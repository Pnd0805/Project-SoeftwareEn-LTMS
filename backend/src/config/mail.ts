import nodemailer from 'nodemailer';
import { env } from './env.js';

// SMTP_USER ไม่ตั้ง = undefined ⇒ ไม่ส่ง auth เลย (mailpit ไม่ต้อง auth) — ส่ง auth ที่เป็น undefined
// ให้ nodemailer จะพังตอนต่อจริง ต้องเว้น auth ทั้งก้อนเมื่อไม่มี user/pass
const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,   // mailpit/dev ไม่ใช้ TLS · SMTP จริง (Gmail ฯลฯ) ใช้ STARTTLS อัตโนมัติผ่าน port 587 อยู่แล้วไม่ต้องตั้ง true ตรงนี้
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
});

export default transport;
