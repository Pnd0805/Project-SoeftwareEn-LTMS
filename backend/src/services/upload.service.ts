import { randomUUID } from 'crypto';
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3 from '../config/s3.js';
import { env } from '../config/env.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import { isRefereeOfMatch, isTeamLeaderOfMatch } from '../middlewares/requireReferee.js';
import { AppError } from '../utils/AppError.js';
import type { PresignUploadInput } from '../schemas/upload.schema.js';

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
};

const SOFT_FILTER_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);

// 20 นาที (ตกลงกับทีม 15 ก.ย.) — เน็ตหน้าสนามช้า (AS-02) อัปโหลดไม่ทันใน 5 นาที
// ใช้ทั้งลิงก์อัปโหลด (M16) และลิงก์ดูเอกสาร soft filter (P05)
const EXPIRES_IN_SECONDS = 1200;

export async function createPresignedUpload(input: PresignUploadInput, userId: number) {
    let entityId: number;

    if (input.purpose === 'referee_identity') {
        entityId = userId;
    } else if (input.purpose === 'dispute_evidence') {
        // หลักฐานประกอบการโต้แย้งผล (มติ 26 ก.ย.) — ขอลิงก์ได้เฉพาะคนที่ค้านผลแมตช์นั้นได้จริง
        // ไม่ผูกกับสถานะแมตช์เหมือนรูปเช็คอิน เพราะค้านได้ทั้งก่อนและหลัง verify
        if (input.matchId === undefined) {
            throw new AppError(400, "VALIDATION_FAILED", "ต้องระบุ matchId");
        }
        const match = await MatchRepo.findMatchById(input.matchId);
        if (!match) {
            throw new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้");
        }
        const canDispute = await isRefereeOfMatch(input.matchId, userId, match.tournament_id)
                        || await isTeamLeaderOfMatch(input.matchId, userId);
        if (!canDispute) {
            throw new AppError(403, "WRONG_SUBMITTER_ROLE", "คุณไม่ใช่ผู้ที่โต้แย้งผลแมตช์นี้ได้");
        }
        entityId = input.matchId;
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
    } else if (input.purpose === 'avatar') {
        entityId = userId; // ไม่รับ userId จาก body เด็ดขาด — กันส่ง key ไปเป็นรูปของคนอื่น
    } else if (input.purpose === 'team_logo') {
        if (input.teamId === undefined) {
            throw new AppError(400, "VALIDATION_FAILED", "ต้องระบุ teamId");
        }
        const team = await TeamRepo.findById(input.teamId);
        if (!team) {
            throw new AppError(404, "TEAM_NOT_FOUND", "ไม่พบทีมนี้");
        }
        if (team.leader_id !== userId) {
            throw new AppError(403, "NOT_TEAM_LEADER", "คุณไม่ใช่หัวหน้าทีมนี้");
        }
        entityId = input.teamId;
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
    const objectKey = input.purpose === 'soft_filter_document'
        ? `${input.purpose}/${entityId}/${userId}/${randomUUID()}.${extension}`
        : `${input.purpose}/${entityId}/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
        ContentType: input.contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN_SECONDS });

    return { uploadUrl, objectKey, expiresIn: EXPIRES_IN_SECONDS };
}


function isObjectNotFound(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
}

export async function validateSoftFilterDocuments(objectKeys: string[], tournamentId: number, userId: number): Promise<void> {
    const expectedKey = new RegExp(
        `^soft_filter_document/${tournamentId}/${userId}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png)$`,
        'i'
    );

    for (const objectKey of objectKeys) {
        if (!expectedKey.test(objectKey)) {
            throw new AppError(
                422,
                'SOFT_FILTER_DOCUMENT_INVALID',
                'เอกสาร soft filter ไม่ได้ถูกอัปโหลดโดยผู้ใช้นี้สำหรับทัวร์นาเมนต์นี้',
                { objectKey }
            );
        }
    }

    await Promise.all(objectKeys.map(async (objectKey) => {
        try {
            const metadata = await s3.send(new HeadObjectCommand({
                Bucket: env.S3_BUCKET,
                Key: objectKey,
            }));

            if (!metadata.ContentType || !SOFT_FILTER_CONTENT_TYPES.has(metadata.ContentType)) {
                throw new AppError(
                    422,
                    'SOFT_FILTER_DOCUMENT_INVALID',
                    'ชนิดไฟล์ soft filter ไม่ถูกต้อง',
                    { objectKey, contentType: metadata.ContentType ?? null }
                );
            }
        } catch (error) {
            if (error instanceof AppError) throw error;
            if (isObjectNotFound(error)) {
                throw new AppError(
                    422,
                    'SOFT_FILTER_DOCUMENT_NOT_FOUND',
                    'ไม่พบเอกสาร soft filter ที่อัปโหลดไว้ กรุณาอัปโหลดใหม่',
                    { objectKey }
                );
            }
            throw new AppError(503, 'STORAGE_UNAVAILABLE', 'ไม่สามารถตรวจสอบเอกสารที่อัปโหลดได้ในขณะนี้');
        }
    }));
}

// ใช้แปลง S3 key ดิบที่เก็บใน DB ให้เป็น URL ชั่วคราวตอนส่งออกไปให้ frontend
// (กฎรวม Part 3 ข้อ 11: "ทุก response ที่มีรูปต้องเป็น presigned URL ไม่ใช่ S3 key ดิบ")
export async function getPresignedDownloadUrl(objectKey: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey });
    return getSignedUrl(s3, command, { expiresIn: EXPIRES_IN_SECONDS });
}

const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);

async function assertImageObjectExists(objectKey: string, notFoundCode: string, notFoundMessage: string): Promise<void> {
    try {
        const metadata = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
        if (!metadata.ContentType || !IMAGE_CONTENT_TYPES.has(metadata.ContentType)) {
            throw new AppError(422, notFoundCode, notFoundMessage, { objectKey });
        }
    } catch (error) {
        if (error instanceof AppError) throw error;
        if (isObjectNotFound(error)) {
            throw new AppError(422, notFoundCode, notFoundMessage, { objectKey });
        }
        throw new AppError(503, 'STORAGE_UNAVAILABLE', 'ไม่สามารถตรวจสอบไฟล์ที่อัปโหลดได้ในขณะนี้');
    }
}

// ตรวจ 2 ชั้นก่อนบันทึก key ลง DB (มติ C2-avatar ข้อ 5): (ก) key ตรง regex ว่าเป็นของ user นี้จริง (ข) ไฟล์มีอยู่จริงบน S3
export async function validateAvatarKey(objectKey: string, userId: number): Promise<void> {
    const expectedKey = new RegExp(
        `^avatar/${userId}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png)$`,
        'i'
    );
    if (!expectedKey.test(objectKey)) {
        throw new AppError(422, 'AVATAR_KEY_INVALID', 'รูปนี้ไม่ได้ถูกอัปโหลดโดยผู้ใช้นี้', { objectKey });
    }
    await assertImageObjectExists(objectKey, 'AVATAR_KEY_NOT_FOUND', 'ไม่พบรูปที่อัปโหลดไว้ กรุณาอัปโหลดใหม่');
}

// ลบรูปเก่าตอนเปลี่ยนเป็นรูปใหม่ (มติ C2-avatar ข้อ 6) — best-effort เท่านั้น ลบไม่สำเร็จไม่ทำให้เปลี่ยนรูปล้ม แค่เขียน log
export async function deleteObjectBestEffort(objectKey: string): Promise<void> {
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
    } catch (error) {
        console.error(`deleteObjectBestEffort: failed to delete ${objectKey}`, error);
    }
}

export async function validateTeamLogoKey(objectKey: string, teamId: number): Promise<void> {
    const expectedKey = new RegExp(
        `^team_logo/${teamId}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png)$`,
        'i'
    );
    if (!expectedKey.test(objectKey)) {
        throw new AppError(422, 'TEAM_LOGO_KEY_INVALID', 'โลโก้นี้ไม่ได้ถูกอัปโหลดสำหรับทีมนี้', { objectKey });
    }
    await assertImageObjectExists(objectKey, 'TEAM_LOGO_KEY_NOT_FOUND', 'ไม่พบโลโก้ที่อัปโหลดไว้ กรุณาอัปโหลดใหม่');
}
