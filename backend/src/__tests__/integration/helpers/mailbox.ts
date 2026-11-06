/**
 * กล่องจดหมายปลอมแทน SMTP — perFile.ts เสียบตัวนี้แทน config/mail.js ให้ทุกไฟล์ integration
 *
 * ★ ไม่ยิงเมลจริงเด็ดขาด (เหตุผลเดียวกับ noRealIO: SMTP ทะลุ = ส่งเมลหาคนจริง ย้อนกลับไม่ได้)
 *   แต่ต่างจาก unit test ตรงที่ **เก็บเมลไว้ให้อ่าน** — flow อย่างสมัคร→OTP→ยืนยัน ต้องหยิบรหัสจากเมลได้
 *
 *   const otp = mailbox.lastTo('a@test.local')!.text.match(/\d{6}/)![0];
 */
export type SentMail = { to: string; subject: string; text: string; html: string };

const sent: SentMail[] = [];
let failNext = 0;

export const mailbox = {
    /** ตัวที่ config/mail.js ถูกแทนด้วย — รูปเดียวกับ transport.sendMail ของ nodemailer */
    async sendMail(message: { to?: unknown; subject?: unknown; text?: unknown; html?: unknown }) {
        if (failNext > 0) {
            failNext--;
            throw new Error('SMTP down (mailbox.failNextSend)');
        }
        sent.push({
            to: String(message.to ?? ''),
            subject: String(message.subject ?? ''),
            text: String(message.text ?? ''),
            html: String(message.html ?? ''),
        });
        return { messageId: `test-${sent.length}` };
    },

    all(): readonly SentMail[] {
        return sent;
    },

    lastTo(address: string): SentMail | undefined {
        return [...sent].reverse().find(m => m.to.includes(address));
    },

    /** จำลอง SMTP ล่ม n ครั้งถัดไป — เทสเส้น "ส่งเมลไม่ได้แต่ API ยังตอบถูก" */
    failNextSend(times = 1): void {
        failNext = times;
    },

    /** perFile.ts เรียกก่อนทุกเทส */
    clear(): void {
        sent.length = 0;
        failNext = 0;
    },
};
