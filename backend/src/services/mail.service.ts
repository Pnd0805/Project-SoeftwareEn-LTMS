import transport from '../config/mail.js';
import { env } from '../config/env.js';

// ใส่แค่ชื่อกับลิงก์ — ห้ามใส่รหัสผ่านเดิมหรือข้อมูลส่วนตัวอื่นในเมล (TASK-password-recovery §3.4)
export async function sendPasswordResetEmail(to : string , fullName : string , rawToken : string) : Promise<void>{
    const link = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    await transport.sendMail({
        from: env.MAIL_FROM,
        to,
        subject: 'ตั้งรหัสผ่านใหม่ — LTMS',
        text: `สวัสดีคุณ ${fullName}\n\n`
            + `มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 1 ชั่วโมง):\n\n`
            + `${link}\n\n`
            + `ถ้าคุณไม่ได้เป็นคนขอ ไม่ต้องทำอะไร บัญชีของคุณยังปลอดภัย`,
    });
}
