import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth.js';
import { AppError } from './AppError.js';

const QR_EXPIRES_IN_SECONDS = 300; // 5 นาที

type CheckinQrPayload = {
    type: 'checkin_qr';
    matchId: number;
};

export function signCheckinQr(matchId: number): { qrPayload: string; expiresAt: Date } {
    const payload: CheckinQrPayload = { type: 'checkin_qr', matchId };
    const qrPayload = jwt.sign(payload, authConfig.secret, { expiresIn: QR_EXPIRES_IN_SECONDS });
    const expiresAt = new Date(Date.now() + QR_EXPIRES_IN_SECONDS * 1000);
    return { qrPayload, expiresAt };
}

export function verifyCheckinQr(qrPayload: string, expectedMatchId: number): void {
    let decoded: unknown;
    try {
        decoded = jwt.verify(qrPayload, authConfig.secret);
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
