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

// OD-53 — ส่งเลข 6 หลัก ไม่ส่งลิงก์
// เจตนาที่เลือก OTP แทนลิงก์: ลิงก์ต้องมี route ฝั่ง FE รองรับ และตอนนี้ feat/1
// ยังไม่มีแม้หน้า /reset-password เลย (แล้ว <Route path="*"> ของเขาเด้งไปหน้าแรก)
// ★ เลขกรอกบนหน้าเดิม ⇒ ไม่พึ่ง FRONTEND_URL เลย ไม่ต้องรอใครตอบว่า path อะไร
export async function sendEmailVerificationOtp(to : string , fullName : string , code : string , ttlMinutes : number) : Promise<void>{
    await transport.sendMail({
        from: env.MAIL_FROM,
        to,
        subject: `รหัสยืนยันอีเมล ${code} — LTMS`,
        text: `สวัสดีคุณ ${fullName}

`
            + `รหัสยืนยันอีเมลของคุณคือ ${code}

`
            + `กรอกรหัสนี้ในหน้าที่คุณสมัครไว้ รหัสหมดอายุใน ${ttlMinutes} นาที

`
            + `ยังใช้งานระบบได้ปกติระหว่างที่ยังไม่ได้ยืนยัน การยืนยันช่วยให้กู้รหัสผ่านได้ถ้าวันหนึ่งลืมรหัส

`
            + `ถ้าคุณไม่ได้เป็นคนสมัคร ไม่ต้องทำอะไร`,
    });
}
