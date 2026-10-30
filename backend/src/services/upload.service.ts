import { randomUUID } from 'crypto';
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3, { s3Public } from '../config/s3.js';
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
    'application/pdf': 'pdf',   // เฉพาะ team_official_document — schema กันชนิดอื่นไว้แล้ว
};

const SOFT_FILTER_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);

// 20 นาที (ตกลงกับทีม 15 ก.ย.) — เน็ตหน้าสนามช้า (AS-02) อัปโหลดไม่ทันใน 5 นาที
// ใช้ทั้งลิงก์อัปโหลด (M16) และลิงก์ดูเอกสาร soft filter (P05)
const EXPIRES_IN_SECONDS = 1200;

export async function createPresignedUpload(input: PresignUploadInput, userId: number) {
    let entityId: number;

    if (input.purpose === 'referee_identity') {
        entityId = userId;
    } else if (input.purpose === 'report_evidence') {
        // หลักฐานแนบคำร้องขอระงับ — ผูกกับผู้แจ้งจาก token เท่านั้น ไม่รับ userId จาก body
        // (ด่านตอนยื่นคำร้องตรวจว่า key ขึ้นต้นด้วย report_evidence/<ผู้แจ้ง>/ จึงแนบ key ของคนอื่นมาไม่ได้)
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
    } else if (input.purpose === 'team_logo' || input.purpose === 'team_official_document') {
        // เอกสารคำขอ Official ใช้กฎเดียวกับโลโก้ — หัวหน้าทีมของทีมนั้นเท่านั้น
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
    const uploadUrl = await getSignedUrl(s3Public, command, { expiresIn: EXPIRES_IN_SECONDS });

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
    return getSignedUrl(s3Public, command, { expiresIn: EXPIRES_IN_SECONDS });
}

// คอลัมน์ JSON ที่เก็บ "array ของ S3 key" แล้วอาจเป็น NULL (evidence, supporting_docs, dispute_evidence)
// รับ null ตรงๆ เพื่อให้ฝั่งเรียกไม่ต้องเขียน ?? [] ซ้ำทุกที่ แล้วเผลอลืมที่ใดที่หนึ่งแบบที่เคยเกิดกับ user_reports
export async function presignAll(objectKeys: string[] | null | undefined): Promise<string[]> {
    return Promise.all((objectKeys ?? []).map(key => getPresignedDownloadUrl(key)));
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

/**
 * 🔴 A1 (8 ต.ค. 2569) — เอกสารยืนยันตัวตนกรรมการ ต้องเป็นไฟล์ที่ **ผู้สมัครคนนี้อัปเอง**
 *
 * เดิม `PUT /me/referee-identity/docs` และ `POST /referee-invitations/:id/accept`
 * รับ object key อะไรก็ได้ (schema ตรวจแค่เป็น string 1–255 ตัวอักษร)
 * แล้วคิวแอดมินเซ็น presigned URL ให้เปิดไฟล์ตาม key นั้นตรง ๆ
 * ⇒ ผู้สมัครแนบ **ไฟล์ของคนอื่น** เป็น "บัตรของตัวเอง" ได้ — เช่น avatar ของคนอื่น
 *   ซึ่ง key โผล่อยู่ใน URL สาธารณะอยู่แล้ว ⇒ เดาไม่ต้องเดา ก็อปมาวางได้เลย
 * ⇒ แอดมินตัดสิน **ตัวตน** จากเอกสารที่ไม่ใช่ของผู้สมัคร · อนุมัติแล้วได้สิทธิ์คุมแมตช์และส่งผล
 *
 * upload ชนิดอื่นตรวจ key หมดแล้ว (avatar · team_logo · dispute_evidence ·
 * soft_filter_document) — เหลือชนิดนี้ชนิดเดียว ซึ่งเป็นชนิดที่ผลเสียหนักที่สุด
 *
 * ★ ตรวจ **รูปของ key** อย่างเดียว ไม่ HEAD ว่ามีไฟล์จริง — ต่างจาก `validateAvatarKey`
 *   โดยเจตนา เพราะ fixture 9053 เป็น key ที่ **ตั้งใจให้ไม่มีไฟล์** ไว้ทดสอบจอกู้สถานการณ์
 *   ตอนลิงก์ตอบ 404 (FE ขอให้คงไว้ 7 ต.ค.) ⇒ ถ้า HEAD ที่นี่ จะสร้างสถานะนั้นผ่าน API ไม่ได้อีก
 *   🙋 ถ้าทีมอยากได้ HEAD ด้วย ต้องตัดสินใจเรื่อง fixture นั้นพร้อมกัน — ยังไม่ทำรอบนี้
 * ★ รูป key มาจาก `createPresignedUpload` ที่เดียว: `referee_identity/<userId>/<uuid v4>.<ext>`
 */
const REFEREE_IDENTITY_KEY = (userId: number) => new RegExp(
    `^referee_identity/${userId}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png)$`,
    'i'
);

export function validateRefereeIdentityKeys(objectKeys: string[], userId: number): void {
    const expected = REFEREE_IDENTITY_KEY(userId);
    const invalid = objectKeys.filter(key => !expected.test(key));
    if (invalid.length > 0) {
        throw new AppError(422, 'REFEREE_IDENTITY_KEY_INVALID',
            'เอกสารยืนยันตัวตนต้องเป็นไฟล์ที่คุณอัปโหลดเอง — ขอลิงก์อัปโหลดใหม่แล้วส่งอีกครั้ง',
            { objectKeys: invalid });
    }
}

// ลบรูปเก่าตอนเปลี่ยนเป็นรูปใหม่ (มติ C2-avatar ข้อ 6) — best-effort เท่านั้น ลบไม่สำเร็จไม่ทำให้เปลี่ยนรูปล้ม แค่เขียน log
export async function deleteObjectBestEffort(objectKey: string): Promise<void> {
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
    } catch (error) {
        console.error(`deleteObjectBestEffort: failed to delete ${objectKey}`, error);
    }
}

/**
 * ลบแบบ "รู้ผล" — คืน true เมื่อที่เก็บไฟล์ตอบว่าลบแล้ว · false เมื่อลบไม่สำเร็จ (เขียน log ไว้)
 * (OD-70) ใช้กับงานที่ต้องรู้ก่อนว่าไฟล์หายจริง แล้วค่อยทิ้งคีย์ในฐาน
 *   ต่างจาก deleteObjectBestEffort ที่กลืน error ⇒ ผู้เรียกแยกไม่ออกว่าลบสำเร็จไหม
 * ★ S3 ลบคีย์ที่ไม่มีอยู่แล้วก็ตอบสำเร็จ ⇒ เรียกซ้ำได้ ไม่ต้องเช็คก่อนว่ามีไฟล์ไหม
 */
export async function deleteObjectConfirmed(objectKey: string): Promise<boolean> {
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
        return true;
    } catch (error) {
        console.error(`deleteObjectConfirmed: failed to delete ${objectKey}`, error);
        return false;
    }
}

/**
 * ไฟล์ทั้งหมดใต้ prefix (ไล่ทีละหน้า 1,000 ไฟล์ตามที่ S3 ให้) — อ่านอย่างเดียว ไม่ลบอะไร
 * (OD-70) ใช้หาไฟล์ยืนยันตัวตนที่ไม่มีแถวไหนชี้ถึงแล้ว
 */
export async function listObjectsByPrefix(prefix: string): Promise<{ key: string; lastModified: Date | null }[]> {
    const out: { key: string; lastModified: Date | null }[] = [];
    let token: string | undefined;
    do {
        const page = await s3.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: prefix, ContinuationToken: token }));
        for (const obj of page.Contents ?? []) {
            if (obj.Key) out.push({ key: obj.Key, lastModified: obj.LastModified ?? null });
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
}

/** รูป key ของเอกสารยืนยันตัวตน (ทุก user) — ให้งานกวาดลบเฉพาะไฟล์รูปร่างนี้ ไม่แตะอย่างอื่นใต้ prefix เดียวกัน */
export const REFEREE_IDENTITY_PREFIX = 'referee_identity/';
export function isRefereeIdentityKey(objectKey: string): boolean {
    return /^referee_identity\/\d+\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png)$/i.test(objectKey);
}

/**
 * OD-73 — รูป key ของรูปบัตรตอนเช็คอินออนไลน์: `checkin_document/<matchId>/<uuid v4>.(jpg|png)` (createPresignedUpload)
 * ส่ง matchId มา = ต้องเป็นของแมตช์นั้นเป๊ะ · ไม่ส่ง = แมตช์ไหนก็ได้ (งานกวาดไฟล์)
 * ★ งานลบใช้ตัวนี้กันลบไฟล์ที่ไม่ใช่รูปเช็คอิน
 */
export const CHECKIN_DOCUMENT_PREFIX = 'checkin_document/';
export function isCheckinDocumentKey(objectKey: string, matchId?: number): boolean {
    const match = matchId === undefined ? '\\d+' : String(matchId);
    return new RegExp(
        `^checkin_document/${match}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png)$`, 'i'
    ).test(objectKey);
}

/**
 * 30 ต.ค. 2569 (QA ข้อ 4) — ตรวจ key รูปบัตรก่อนบันทึกลงแถวเช็คอิน
 *
 * เดิม `submitCheckin` รับ `documentS3Key` มาตรง ๆ โดยตรวจแค่ความยาวไม่เกิน 255
 * ⇒ ส่ง key ของไฟล์อื่นมาเป็นบัตรของตัวเองได้ (avatar ของคนอื่น · รูปจากแมตช์อื่น)
 *   แล้วกรรมการจะได้ลิงก์เปิดไฟล์นั้นตอนตรวจ — ช่องเดียวกับที่ปิดไปแล้วในเอกสารยืนยันตัวตนกรรมการ
 *
 * ★ ตรวจสองชั้นแบบเดียวกับโลโก้ทีม/เอกสารทีม Official: รูป key ต้องเป็นของ **แมตช์นี้**
 *   และไฟล์ต้องมีอยู่จริงบนที่เก็บ (ไม่งั้นกรรมการกดดูแล้วไม่มีไฟล์ ตรวจไม่ได้ ต้องไล่ถามกันใหม่)
 *
 * 🔴 ที่ยังปิดไม่ได้ด้วยวิธีนี้: key เป็น `checkin_document/<matchId>/<uuid>` **ไม่มีรหัสผู้ใช้อยู่ในนั้น**
 *   ⇒ รูปของ **เพื่อนร่วมทีมในแมตช์เดียวกัน** ยังผ่านด่านนี้
 *   ปิดสนิทต้องเปลี่ยนรูป key เป็น `checkin_document/<matchId>/<userId>/<uuid>` (แบบเดียวกับ soft filter)
 *   ซึ่งทำให้ไฟล์ที่อัปไว้ก่อนหน้านี้ใช้ไม่ได้ทั้งหมด ⇒ ยังไม่ทำในรอบนี้ · ความเสี่ยงที่เหลือจำกัดอยู่ในทีมเดียวกัน
 */
export async function validateCheckinDocumentKey(objectKey: string, matchId: number): Promise<void> {
    if (!isCheckinDocumentKey(objectKey, matchId)) {
        throw new AppError(422, 'CHECKIN_DOCUMENT_KEY_INVALID',
            'รูปบัตรต้องเป็นไฟล์ที่คุณอัปโหลดสำหรับแมตช์นี้ — ขอลิงก์อัปโหลดใหม่แล้วส่งอีกครั้ง', { objectKey });
    }
    await assertImageObjectExists(objectKey, 'CHECKIN_DOCUMENT_NOT_FOUND',
        'ไม่พบรูปบัตรที่อัปโหลดไว้ กรุณาอัปโหลดใหม่');
}

/**
 * 30 ต.ค. 2569 — เอกสารประกอบคำขอเป็นทีม Official (T15) เปลี่ยนจาก "ข้อความ" เป็น "ไฟล์ที่อัปโหลดจริง"
 *
 * เดิม: หน้าเว็บส่งข้อความทีละบรรทัด แต่คิวแอดมิน (T16) เซ็นทุกบรรทัดเป็นลิงก์ไฟล์ ⇒ แอดมินเปิดไม่ได้ทุกใบ
 * ★ ตรวจสองชั้นแบบโลโก้ทีม: รูป key ต้องเป็นของทีมนี้ (`team_official_document/<teamId>/<uuid>.(jpg|png|pdf)`)
 *   และไฟล์ต้องมีอยู่จริงบนที่เก็บ — ไม่งั้นแนบ key ของทีมอื่นหรือ key ที่ไม่มีไฟล์ แล้วแอดมินเปิดไม่ได้อีก
 */
const OFFICIAL_DOC_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
export const TEAM_OFFICIAL_DOCUMENT_PREFIX = 'team_official_document/';
export function isTeamOfficialDocumentKey(objectKey: string, teamId?: number): boolean {
    const team = teamId === undefined ? '\\d+' : String(teamId);
    return new RegExp(
        `^team_official_document/${team}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png|pdf)$`, 'i'
    ).test(objectKey);
}

export async function validateTeamOfficialDocumentKeys(objectKeys: string[], teamId: number): Promise<void> {
    const invalid = objectKeys.filter(key => !isTeamOfficialDocumentKey(key, teamId));
    if (invalid.length > 0) {
        throw new AppError(422, 'TEAM_OFFICIAL_DOC_INVALID',
            'เอกสารต้องเป็นไฟล์ที่อัปโหลดสำหรับทีมนี้ — อัปโหลดไฟล์ใหม่แล้วส่งอีกครั้ง', { objectKeys: invalid });
    }
    await Promise.all(objectKeys.map(async (objectKey) => {
        try {
            const metadata = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }));
            if (!metadata.ContentType || !OFFICIAL_DOC_CONTENT_TYPES.has(metadata.ContentType)) {
                throw new AppError(422, 'TEAM_OFFICIAL_DOC_NOT_FOUND', 'ไม่พบไฟล์เอกสารที่อัปโหลดไว้ กรุณาอัปโหลดใหม่', { objectKey });
            }
        } catch (error) {
            if (error instanceof AppError) throw error;
            if (isObjectNotFound(error)) {
                throw new AppError(422, 'TEAM_OFFICIAL_DOC_NOT_FOUND', 'ไม่พบไฟล์เอกสารที่อัปโหลดไว้ กรุณาอัปโหลดใหม่', { objectKey });
            }
            throw new AppError(503, 'STORAGE_UNAVAILABLE', 'ไม่สามารถตรวจสอบไฟล์ที่อัปโหลดได้ในขณะนี้');
        }
    }));
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
