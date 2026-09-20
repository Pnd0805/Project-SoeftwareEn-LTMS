import { randomUUID } from 'crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3 from '../config/s3.js';
import { env } from '../config/env.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import { AppError } from '../utils/AppError.js';
import type { PresignUploadInput } from '../schemas/upload.schema.js';

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
};

// 20 นาที (ตกลงกับทีม 15 ก.ย.) — เน็ตหน้าสนามช้า (AS-02) อัปโหลดไม่ทันใน 5 นาที
// ใช้ทั้งลิงก์อัปโหลด (M16) และลิงก์ดูเอกสาร soft filter (P05)
const EXPIRES_IN_SECONDS = 1200;

export async function createPresignedUpload(input: PresignUploadInput, userId: number) {
    let entityId: number;

    if (input.purpose === 'referee_identity') {
        entityId = userId;
    } else if (input.purpose === 'checkin_document') {
        if (input.matchId === undefined) {
            throw new AppError(400, "VALIDATION_FAILED", "ต้องระบุ matchId");
        }
        const match = await MatchRepo.findMatchById(input.matchId);
        if (!match) {
            throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
        }

        // กฎเดียวกับ M12 — ขอลิงก์อัปรูปเช็คอินได้เฉพาะผู้เล่นในทีมของแมตช์ และตอนเปิดเช็คอินเท่านั้น
        if (match.match_status !== 'checkin_open') {
            throw new AppError(409, "CHECKIN_NOT_OPEN", "แมตช์นี้ยังไม่เปิดเช็คอิน หรือปิดเช็คอินไปแล้ว");
        }
        if (!(await MatchRepo.isRegisteredPlayerOfMatch(userId, input.matchId))) {
            throw new AppError(403, "NOT_IN_APPROVED_ROSTER", "คุณไม่อยู่ในรายชื่อผู้เล่นที่ทีมส่งลงแข่งในแมตช์นี้");
        }
        entityId = input.matchId;
    } else {
        if (input.tournamentId === undefined) {
            throw new AppError(400, "VALIDATION_FAILED", "ต้องระบุ tournamentId");
        }
        const tournament = await TournamentRepo.findTournamentById(input.tournamentId);
        if (!tournament) {
            throw new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์นี้");
        }
        entityId = input.tournamentId;
    }

    const extension = CONTENT_TYPE_EXTENSION[input.contentType];
    const objectKey = `${input.purpose}/${entityId}/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
        ContentType: input.contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN_SECONDS });

    return { uploadUrl, objectKey, expiresIn: EXPIRES_IN_SECONDS };
}

// ใช้แปลง S3 key ดิบที่เก็บใน DB ให้เป็น URL ชั่วคราวตอนส่งออกไปให้ frontend
// (กฎรวม Part 3 ข้อ 11: "ทุก response ที่มีรูปต้องเป็น presigned URL ไม่ใช่ S3 key ดิบ")
export async function getPresignedDownloadUrl(objectKey: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey });
    return getSignedUrl(s3, command, { expiresIn: EXPIRES_IN_SECONDS });
}
