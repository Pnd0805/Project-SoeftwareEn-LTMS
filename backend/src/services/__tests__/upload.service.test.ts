import { describe, it, expect, vi, beforeEach } from 'vitest';

const s3Send = vi.hoisted(() => vi.fn());
vi.mock('../../config/s3.js', () => ({ default: { send: s3Send } }));
vi.mock('../../config/env.js', () => ({ env: { S3_BUCKET: 'ltms-test' } }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(() => Promise.resolve('https://s3/signed')),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  findMatchById: vi.fn(),
  isRegisteredPlayerOfMatch: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

import * as uploadService from '../upload.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import { AppError } from '../../utils/AppError.js';

const checkinInput = { purpose: 'checkin_document', contentType: 'image/jpeg', matchId: 1 } as never;

function match(overrides: Record<string, unknown> = {}) {
  return { match_id: 1, team_a_id: 11, team_b_id: 12, match_status: 'checkin_open', ...overrides } as never;
}

async function expectAppError(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  expect((err as AppError).code).toBe(code);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createPresignedUpload — checkin_document', () => {
  it('gives an upload URL to a player of the match while check-in is open', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.isRegisteredPlayerOfMatch).mockResolvedValue(true);

    const result = await uploadService.createPresignedUpload(checkinInput, 9001);

    expect(MatchRepo.isRegisteredPlayerOfMatch).toHaveBeenCalledWith(9001, 1);
    expect(result.uploadUrl).toBe('https://s3/signed');
    expect(result.objectKey).toMatch(/^checkin_document\/1\/.+\.jpg$/);
    expect(result.expiresIn).toBe(1200);
  });

  it('refuses a user the team did not register for this match with NOT_IN_APPROVED_ROSTER', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.isRegisteredPlayerOfMatch).mockResolvedValue(false);

    await expectAppError(uploadService.createPresignedUpload(checkinInput, 9999), 403, 'NOT_IN_APPROVED_ROSTER');
  });

  it.each(['scheduled', 'in_progress', 'completed'])('refuses while the match is %s with CHECKIN_NOT_OPEN', async (status) => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));

    await expectAppError(uploadService.createPresignedUpload(checkinInput, 9001), 409, 'CHECKIN_NOT_OPEN');
    expect(MatchRepo.isRegisteredPlayerOfMatch).not.toHaveBeenCalled();
  });

  it('returns MATCH_NOT_FOUND for an unknown match', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(null);

    await expectAppError(uploadService.createPresignedUpload(checkinInput, 9001), 404, 'MATCH_NOT_FOUND');
  });
});

describe('createPresignedUpload — soft_filter_document', () => {
  it('binds the generated object key to both tournament and uploader', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20 } as never);

    const result = await uploadService.createPresignedUpload(
      { purpose: 'soft_filter_document', contentType: 'image/png', tournamentId: 20 } as never, 9001);

    expect(result.objectKey).toMatch(/^soft_filter_document\/20\/9001\/.+\.png$/);
  });
});

describe('createPresignedUpload — report_evidence', () => {
  // หลักฐานแนบคำร้องขอระงับผู้ใช้ (C2) — ผูก key กับผู้อัปจาก token เสมอ
  // ด่านตอนยื่นคำร้องตรวจ prefix นี้ ⇒ ถ้า key ไม่มี userId อยู่ในนั้น จะกันคนแนบไฟล์ของคนอื่นไม่ได้เลย
  it('ผูก key กับผู้อัปโหลด ไม่ต้องมี matchId/tournamentId', async () => {
    const result = await uploadService.createPresignedUpload(
      { purpose: 'report_evidence', contentType: 'image/png' } as never, 9001);

    expect(result.objectKey).toMatch(/^report_evidence\/9001\/.+\.png$/);
  });

  it('ไม่แตะฐานข้อมูลเลย — ไม่ต้องมีแมตช์หรือทัวร์อยู่จริง', async () => {
    await uploadService.createPresignedUpload(
      { purpose: 'report_evidence', contentType: 'image/jpeg' } as never, 9001);

    expect(vi.mocked(MatchRepo.findMatchById)).not.toHaveBeenCalled();
    expect(vi.mocked(TournamentRepo.findTournamentById)).not.toHaveBeenCalled();
  });
});

describe('presignAll', () => {
  it('คอลัมน์ JSON ที่เป็น null คืน array ว่าง ไม่พังและไม่เซ็นอะไร', async () => {
    await expect(uploadService.presignAll(null)).resolves.toEqual([]);
    await expect(uploadService.presignAll(undefined)).resolves.toEqual([]);
  });

  it('เซ็นครบทุก key ตามลำดับเดิม', async () => {
    await expect(uploadService.presignAll(['a.png', 'b.png']))
      .resolves.toEqual(['https://s3/signed', 'https://s3/signed']);
  });
});

describe('validateSoftFilterDocuments', () => {
  const ownKey = 'soft_filter_document/20/9001/11111111-1111-4111-8111-111111111111.jpg';

  it('accepts uploaded objects owned by this user for this tournament', async () => {
    s3Send.mockResolvedValueOnce({ ContentType: 'image/jpeg' });

    await expect(uploadService.validateSoftFilterDocuments([ownKey], 20, 9001)).resolves.toBeUndefined();
    expect(s3Send).toHaveBeenCalledTimes(1);
  });

  it('rejects a key from another user or tournament without touching storage', async () => {
    await expectAppError(
      uploadService.validateSoftFilterDocuments(
        ['soft_filter_document/20/9999/11111111-1111-4111-8111-111111111111.jpg'],
        20,
        9001,
      ),
      422,
      'SOFT_FILTER_DOCUMENT_INVALID',
    );
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('rejects a key when the object was never uploaded', async () => {
    s3Send.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });

    await expectAppError(uploadService.validateSoftFilterDocuments([ownKey], 20, 9001), 422, 'SOFT_FILTER_DOCUMENT_NOT_FOUND');
  });

  it('rejects an object with an unsupported stored content type', async () => {
    s3Send.mockResolvedValueOnce({ ContentType: 'application/pdf' });

    await expectAppError(uploadService.validateSoftFilterDocuments([ownKey], 20, 9001), 422, 'SOFT_FILTER_DOCUMENT_INVALID');
  });
});

/**
 * STORAGE_UNAVAILABLE — เดิม **ไม่มีเทสไหนเอ่ยถึงเลย** (ไล่ตรวจ 6 ต.ค. 2569)
 *
 * ★ ความสำคัญอยู่ที่ "แยกให้ออกระหว่างของผู้ใช้ผิด กับของเราพัง"
 *   ไฟล์ไม่มีจริง / ชนิดไฟล์ผิด = 422 ผู้ใช้ต้องไปอัปโหลดใหม่
 *   MinIO ล่ม เน็ตขาด สิทธิ์ S3 หมด      = 503 ผู้ใช้ทำอะไรไม่ได้ ต้องให้ลองใหม่ทีหลัง
 * 🔴 ถ้าเหมารวมเป็น 422 ทั้งหมด ผู้ใช้จะถูกบอกว่า "ไฟล์ของคุณใช้ไม่ได้ อัปโหลดใหม่"
 *   ทุกครั้งที่ฝั่งเราล่ม ⇒ เขาจะอัปโหลดใหม่ซ้ำ ๆ แล้วก็เจอเหมือนเดิม
 *   และเราจะไม่เห็นว่าระบบเก็บไฟล์มีปัญหาเลยเพราะมันถูกนับเป็นความผิดของผู้ใช้
 */
describe('STORAGE_UNAVAILABLE — แยก "ที่เก็บไฟล์ล่ม" ออกจาก "ไฟล์ผู้ใช้ผิด"', () => {
  const ownKey = 'soft_filter_document/20/9001/11111111-1111-4111-8111-111111111111.jpg';
  const avatarKey = 'avatar/9001/22222222-2222-4222-8222-222222222222.png';

  it('เอกสาร soft filter: S3 ล่ม (ไม่ใช่ 404) = 503 ไม่ใช่ 422', async () => {
    s3Send.mockRejectedValueOnce({ name: 'TimeoutError', $metadata: { httpStatusCode: 500 } });

    await expectAppError(uploadService.validateSoftFilterDocuments([ownKey], 20, 9001), 503, 'STORAGE_UNAVAILABLE');
  });

  it('รูปโปรไฟล์: S3 ล่ม = 503 ไม่ใช่ AVATAR_KEY_NOT_FOUND', async () => {
    s3Send.mockRejectedValueOnce({ name: 'NetworkingError' });

    await expectAppError(uploadService.validateAvatarKey(avatarKey, 9001), 503, 'STORAGE_UNAVAILABLE');
  });

  /**
   * ★ เส้นแบ่งที่ต้องล็อกไว้: 404 ยังต้องเป็น 422 เหมือนเดิม
   *   เทสคู่นี้คือตัวที่ทำให้ "เหมารวมทุก error เป็น 503" ก็ผิด และ "เหมารวมเป็น 422" ก็ผิด
   */
  it('รูปโปรไฟล์: ไฟล์ไม่มีจริง = 422 ของผู้ใช้ ไม่ใช่ 503', async () => {
    s3Send.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });

    await expectAppError(uploadService.validateAvatarKey(avatarKey, 9001), 422, 'AVATAR_KEY_NOT_FOUND');
  });

  it('AppError ที่โยนจากข้างในต้องผ่านออกมาเหมือนเดิม ไม่ถูกกลืนเป็น 503', async () => {
    s3Send.mockResolvedValueOnce({ ContentType: 'application/pdf' });

    await expectAppError(uploadService.validateAvatarKey(avatarKey, 9001), 422, 'AVATAR_KEY_NOT_FOUND');
  });
});
