import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

// 20 นาที (ตกลงกับทีม 15 ก.ย.) — response มี expiresAt ให้หน้าจอกรรมการขอ QR ใหม่ก่อนหมดอายุ
const QR_EXPIRES_IN_SECONDS = 1200;

type CheckinQrPayload = {
    type: 'checkin_qr';
    matchId: number;
};

// เซ็นด้วย CHECKIN_QR_SECRET (ไม่ตั้ง = JWT_SECRET) — แยกได้เพื่อไม่ให้ secret ของ QR กับ login รั่วพ่วงกัน
export function signCheckinQr(matchId: number): { qrPayload: string; expiresAt: Date } {
    const payload: CheckinQrPayload = { type: 'checkin_qr', matchId };
    const qrPayload = jwt.sign(payload, env.CHECKIN_QR_SECRET, { expiresIn: QR_EXPIRES_IN_SECONDS });
    const expiresAt = new Date(Date.now() + QR_EXPIRES_IN_SECONDS * 1000);
    return { qrPayload, expiresAt };
}

export function verifyCheckinQr(qrPayload: string, expectedMatchId: number): void {
    let decoded: unknown;
    try {
        decoded = jwt.verify(qrPayload, env.CHECKIN_QR_SECRET);
    } catch {
        throw new AppError(400, "CHECKIN_QR_MISMATCH", "QR Code นี้ไม่ตรงกับแมตช์นี้");
    }

    const isValidShape = typeof decoded === 'object' && decoded !== null
        && (decoded as Record<string, unknown>)['type'] === 'checkin_qr'
        && (decoded as Record<string, unknown>)['matchId'] === expectedMatchId;

    if (!isValidShape) {
        throw new AppError(400, "CHECKIN_QR_MISMATCH", "QR Code นี้ไม่ตรงกับแมตช์นี้");
    }
}
