import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('../../config/mail.js', () => ({ default: { sendMail: mocks.sendMail } }));
vi.mock('../../config/env.js', () => ({
  env: { MAIL_FROM: 'no-reply@ltms.local', FRONTEND_URL: 'http://localhost:8080' },
}));

import { sendPasswordResetEmail } from '../mail.service.js';

beforeEach(() => vi.clearAllMocks());

describe('mail.service sendPasswordResetEmail()', () => {
  it('ส่งเมลผ่าน transport ด้วยลิงก์ที่มี token ดิบต่อท้าย FRONTEND_URL', async () => {
    mocks.sendMail.mockResolvedValue(undefined);

    await sendPasswordResetEmail('user@example.com', 'สมชาย ใจดี', 'raw-token-abc');

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    const call = mocks.sendMail.mock.calls[0]![0];
    expect(call.from).toBe('no-reply@ltms.local');
    expect(call.to).toBe('user@example.com');
    expect(call.text).toContain('http://localhost:8080/reset-password?token=raw-token-abc');
    expect(call.text).toContain('สมชาย ใจดี');
  });

  it('ไม่มีรหัสผ่านหรือข้อมูลส่วนตัวอื่นปนอยู่ในเนื้อเมล', async () => {
    mocks.sendMail.mockResolvedValue(undefined);

    await sendPasswordResetEmail('user@example.com', 'สมชาย ใจดี', 'raw-token-abc');

    const call = mocks.sendMail.mock.calls[0]![0];
    expect(call.text).not.toContain('รหัสผ่านเดิม');
  });

  it('โยน error ต่อเมื่อ transport ล่ม (ผู้เรียก — auth.service — เป็นคนรับผิดชอบดักเอง)', async () => {
    mocks.sendMail.mockRejectedValue(new Error('SMTP down'));

    await expect(sendPasswordResetEmail('user@example.com', 'สมชาย', 'tok')).rejects.toThrow('SMTP down');
  });
});
