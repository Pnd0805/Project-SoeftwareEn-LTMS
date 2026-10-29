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

vi.mock('../../repositories/team.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../middlewares/requireReferee.js', () => ({
  isRefereeOfMatch: vi.fn(),
  isTeamLeaderOfMatch: vi.fn(),
}));

import * as uploadService from '../upload.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import { isRefereeOfMatch, isTeamLeaderOfMatch } from '../../middlewares/requireReferee.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

// ───────── OD-70 — ตัวช่วยลบภาพยืนยันตัวตนกรรมการ ─────────
describe('deleteObjectConfirmed — ลบแบบรู้ผล', () => {
  it('S3 ตอบสำเร็จ → true · ส่งคำสั่งลบคีย์นั้นคีย์เดียว', async () => {
    s3Send.mockResolvedValueOnce({});
    await expect(uploadService.deleteObjectConfirmed('referee_identity/1/x.jpg')).resolves.toBe(true);
    expect(s3Send.mock.calls.at(-1)![0].input).toMatchObject({ Key: 'referee_identity/1/x.jpg' });
  });

  it('S3 พัง → false (ไม่ throw · เขียน log)', async () => {
    s3Send.mockRejectedValueOnce(new Error('minio down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(uploadService.deleteObjectConfirmed('referee_identity/1/x.jpg')).resolves.toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('listObjectsByPrefix — ไล่ทุกหน้า', () => {
  it('ต่อหน้าด้วย ContinuationToken จนครบ · ส่ง prefix ทุกหน้า', async () => {
    const d = new Date('2026-10-01T00:00:00Z');
    s3Send
      .mockResolvedValueOnce({ Contents: [{ Key: 'referee_identity/1/a.jpg', LastModified: d }], IsTruncated: true, NextContinuationToken: 't2' })
      .mockResolvedValueOnce({ Contents: [{ Key: 'referee_identity/2/b.png' }], IsTruncated: false });
    await expect(uploadService.listObjectsByPrefix('referee_identity/')).resolves.toEqual([
      { key: 'referee_identity/1/a.jpg', lastModified: d },
      { key: 'referee_identity/2/b.png', lastModified: null },
    ]);
    const inputs = s3Send.mock.calls.slice(-2).map(c => c[0].input);
    expect(inputs[0]).toMatchObject({ Prefix: 'referee_identity/', ContinuationToken: undefined });
    expect(inputs[1]).toMatchObject({ Prefix: 'referee_identity/', ContinuationToken: 't2' });
  });

  it('ไม่มีไฟล์ → []', async () => {
    s3Send.mockResolvedValueOnce({ IsTruncated: false });
    await expect(uploadService.listObjectsByPrefix('referee_identity/')).resolves.toEqual([]);
  });
});

describe('isRefereeIdentityKey — รูปชื่อไฟล์ยืนยันตัวตนเท่านั้น', () => {
  it.each([
    ['referee_identity/12/0b2f3c4d-1234-4abc-8def-0123456789ab.jpg', true],
    ['referee_identity/12/0b2f3c4d-1234-4abc-8def-0123456789ab.PNG', true],
    ['referee_identity/12/readme.txt', false],
    ['referee_identity/0b2f3c4d-1234-4abc-8def-0123456789ab.jpg', false],
    ['checkin_document/12/0b2f3c4d-1234-4abc-8def-0123456789ab.jpg', false],
    ['referee_identity/12/0b2f3c4d-1234-4abc-8def-0123456789ab.jpg.bak', false],
  ])('%s → %s', (k, expected) => {
    expect(uploadService.isRefereeIdentityKey(k)).toBe(expected);
  });
});

// ─────────────────────────── paths not covered above ───────────────────────────

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const putInput = () => (vi.mocked(getSignedUrl).mock.calls.at(-1)![1] as { input: Record<string, unknown> }).input;

describe('createPresignedUpload — checkin_document without matchId', () => {
  it('400 VALIDATION_FAILED and no lookup', async () => {
    await expectAppError(
      uploadService.createPresignedUpload({ purpose: 'checkin_document', contentType: 'image/jpeg' } as never, 9001),
      400, 'VALIDATION_FAILED');
    expect(MatchRepo.findMatchById).not.toHaveBeenCalled();
  });
});

describe('createPresignedUpload — referee_identity and avatar (bound to the caller)', () => {
  it.each(['referee_identity', 'avatar'])('%s: key is <purpose>/<userId>/<uuid>.<ext>, no DB lookup', async (purpose) => {
    const result = await uploadService.createPresignedUpload({ purpose, contentType: 'image/png' } as never, 9001);

    expect(result.objectKey).toMatch(new RegExp(`^${purpose}/9001/${UUID}\\.png$`));
    expect(MatchRepo.findMatchById).not.toHaveBeenCalled();
    expect(TournamentRepo.findTournamentById).not.toHaveBeenCalled();
    expect(TeamRepo.findById).not.toHaveBeenCalled();
  });

  it('avatar ignores any id in the body — the key is always the caller\'s', async () => {
    const result = await uploadService.createPresignedUpload(
      { purpose: 'avatar', contentType: 'image/jpeg', teamId: 5, matchId: 6, tournamentId: 7 } as never, 9001);
    expect(result.objectKey).toMatch(/^avatar\/9001\//);
  });

  it('referee_identity keys are accepted by isRefereeIdentityKey (one shape, end to end)', async () => {
    const { objectKey } = await uploadService.createPresignedUpload(
      { purpose: 'referee_identity', contentType: 'image/jpeg' } as never, 9001);
    expect(uploadService.isRefereeIdentityKey(objectKey)).toBe(true);
    expect(() => uploadService.validateRefereeIdentityKeys([objectKey], 9001)).not.toThrow();
  });
});

describe('createPresignedUpload — signed PUT command', () => {
  it('signs a PutObject for the configured bucket, generated key and content type, valid 20 minutes', async () => {
    const result = await uploadService.createPresignedUpload({ purpose: 'avatar', contentType: 'image/jpeg' } as never, 9001);

    expect(putInput()).toEqual({ Bucket: 'ltms-test', Key: result.objectKey, ContentType: 'image/jpeg' });
    expect(vi.mocked(getSignedUrl).mock.calls.at(-1)![2]).toEqual({ expiresIn: 1200 });
    expect(result.objectKey.endsWith('.jpg')).toBe(true);
  });

  it('generates a different key for every request', async () => {
    const a = await uploadService.createPresignedUpload({ purpose: 'avatar', contentType: 'image/png' } as never, 9001);
    const b = await uploadService.createPresignedUpload({ purpose: 'avatar', contentType: 'image/png' } as never, 9001);
    expect(a.objectKey).not.toBe(b.objectKey);
  });
});

describe('createPresignedUpload — dispute_evidence', () => {
  const input = (o: Record<string, unknown> = {}) =>
    ({ purpose: 'dispute_evidence', contentType: 'image/png', matchId: 1, ...o }) as never;

  beforeEach(() => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ tournament_id: 20, match_status: 'completed' }));
    vi.mocked(isRefereeOfMatch).mockResolvedValue(false as never);
    vi.mocked(isTeamLeaderOfMatch).mockResolvedValue(false as never);
  });

  it('a referee of the match gets a key bound to the match', async () => {
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true as never);

    const result = await uploadService.createPresignedUpload(input(), 9001);

    expect(isRefereeOfMatch).toHaveBeenCalledWith(1, 9001, 20);
    expect(isTeamLeaderOfMatch).not.toHaveBeenCalled();   // short-circuits once the referee check passes
    expect(result.objectKey).toMatch(new RegExp(`^dispute_evidence/1/${UUID}\\.png$`));
  });

  it('a team leader of the match is also allowed', async () => {
    vi.mocked(isTeamLeaderOfMatch).mockResolvedValue(true as never);

    const result = await uploadService.createPresignedUpload(input(), 9001);

    expect(isTeamLeaderOfMatch).toHaveBeenCalledWith(1, 9001);
    expect(result.objectKey).toMatch(/^dispute_evidence\/1\//);
  });

  it('anyone else is refused with 403 WRONG_SUBMITTER_ROLE', async () => {
    await expectAppError(uploadService.createPresignedUpload(input(), 9001), 403, 'WRONG_SUBMITTER_ROLE');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('does not depend on match status (dispute is allowed before and after verify)', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ tournament_id: 20, match_status: 'scheduled' }));
    vi.mocked(isRefereeOfMatch).mockResolvedValue(true as never);

    await expect(uploadService.createPresignedUpload(input(), 9001)).resolves.toHaveProperty('objectKey');
  });

  it('400 when matchId is missing', async () => {
    await expectAppError(uploadService.createPresignedUpload(input({ matchId: undefined }), 9001), 400, 'VALIDATION_FAILED');
    expect(MatchRepo.findMatchById).not.toHaveBeenCalled();
  });

  it('404 MATCH_NOT_FOUND for an unknown match, before any role check', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(null);

    await expectAppError(uploadService.createPresignedUpload(input(), 9001), 404, 'MATCH_NOT_FOUND');
    expect(isRefereeOfMatch).not.toHaveBeenCalled();
  });
});

describe('createPresignedUpload — team_logo', () => {
  const input = (o: Record<string, unknown> = {}) =>
    ({ purpose: 'team_logo', contentType: 'image/jpeg', teamId: 30, ...o }) as never;

  it('the team leader gets a key bound to the team', async () => {
    vi.mocked(TeamRepo.findById).mockResolvedValue({ team_id: 30, leader_id: 9001 } as never);

    const result = await uploadService.createPresignedUpload(input(), 9001);

    expect(TeamRepo.findById).toHaveBeenCalledWith(30);
    expect(result.objectKey).toMatch(new RegExp(`^team_logo/30/${UUID}\\.jpg$`));
  });

  it('a member who is not the leader is refused with 403 NOT_TEAM_LEADER', async () => {
    vi.mocked(TeamRepo.findById).mockResolvedValue({ team_id: 30, leader_id: 1 } as never);
    await expectAppError(uploadService.createPresignedUpload(input(), 9001), 403, 'NOT_TEAM_LEADER');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('404 TEAM_NOT_FOUND for an unknown team', async () => {
    vi.mocked(TeamRepo.findById).mockResolvedValue(null as never);
    await expectAppError(uploadService.createPresignedUpload(input(), 9001), 404, 'TEAM_NOT_FOUND');
  });

  it('400 when teamId is missing', async () => {
    await expectAppError(uploadService.createPresignedUpload(input({ teamId: undefined }), 9001), 400, 'VALIDATION_FAILED');
    expect(TeamRepo.findById).not.toHaveBeenCalled();
  });
});

describe('createPresignedUpload — soft_filter_document errors', () => {
  it('400 when tournamentId is missing', async () => {
    await expectAppError(
      uploadService.createPresignedUpload({ purpose: 'soft_filter_document', contentType: 'image/png' } as never, 9001),
      400, 'VALIDATION_FAILED');
    expect(TournamentRepo.findTournamentById).not.toHaveBeenCalled();
  });

  it('404 TOURNAMENT_NOT_FOUND for an unknown tournament', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(null as never);
    await expectAppError(
      uploadService.createPresignedUpload({ purpose: 'soft_filter_document', contentType: 'image/png', tournamentId: 20 } as never, 9001),
      404, 'TOURNAMENT_NOT_FOUND');
  });

  it('the generated key passes validateSoftFilterDocuments for the same user and tournament', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20 } as never);
    const { objectKey } = await uploadService.createPresignedUpload(
      { purpose: 'soft_filter_document', contentType: 'image/jpeg', tournamentId: 20 } as never, 9001);
    s3Send.mockResolvedValueOnce({ ContentType: 'image/jpeg' });

    await expect(uploadService.validateSoftFilterDocuments([objectKey], 20, 9001)).resolves.toBeUndefined();
  });
});

describe('validateSoftFilterDocuments — more paths', () => {
  const key = (n: number) => `soft_filter_document/20/9001/${String(n).repeat(8)}-1111-4111-8111-111111111111.png`;

  it('accepts an empty list without calling storage', async () => {
    await expect(uploadService.validateSoftFilterDocuments([], 20, 9001)).resolves.toBeUndefined();
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('checks every key with a HEAD on the configured bucket', async () => {
    s3Send.mockResolvedValueOnce({ ContentType: 'image/png' }).mockResolvedValueOnce({ ContentType: 'image/png' });

    await uploadService.validateSoftFilterDocuments([key(1), key(2)], 20, 9001);

    expect(s3Send).toHaveBeenCalledTimes(2);
    expect(s3Send.mock.calls.map(c => c[0].input)).toEqual([
      { Bucket: 'ltms-test', Key: key(1) },
      { Bucket: 'ltms-test', Key: key(2) },
    ]);
  });

  it('one bad key in the list rejects all of them before storage is touched', async () => {
    const err = await uploadService.validateSoftFilterDocuments([key(1), 'soft_filter_document/20/9001/x.png'], 20, 9001)
      .catch(e => e);
    expect(err).toMatchObject({ status: 422, code: 'SOFT_FILTER_DOCUMENT_INVALID', extra: { objectKey: 'soft_filter_document/20/9001/x.png' } });
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('reports contentType: null when storage returns no content type', async () => {
    s3Send.mockResolvedValueOnce({});
    const err = await uploadService.validateSoftFilterDocuments([key(1)], 20, 9001).catch(e => e);
    expect(err).toMatchObject({ code: 'SOFT_FILTER_DOCUMENT_INVALID', extra: { objectKey: key(1), contentType: null } });
  });

  it.each([
    ['name NoSuchKey', { name: 'NoSuchKey' }],
    ['httpStatusCode 404 only', { $metadata: { httpStatusCode: 404 } }],
  ])('treats %s as "not uploaded" (422)', async (_l, error) => {
    s3Send.mockRejectedValueOnce(error);
    await expectAppError(uploadService.validateSoftFilterDocuments([key(1)], 20, 9001), 422, 'SOFT_FILTER_DOCUMENT_NOT_FOUND');
  });

  it.each([
    ['null', null],
    ['a string', 'boom'],
  ])('treats a non-object error (%s) as storage unavailable (503)', async (_l, error) => {
    s3Send.mockRejectedValueOnce(error);
    await expectAppError(uploadService.validateSoftFilterDocuments([key(1)], 20, 9001), 503, 'STORAGE_UNAVAILABLE');
  });

  it('accepts .png keys and upper-case uuids (regex is case-insensitive)', async () => {
    s3Send.mockResolvedValueOnce({ ContentType: 'image/png' });
    await expect(uploadService.validateSoftFilterDocuments(
      ['soft_filter_document/20/9001/ABCDEF12-1111-4111-8111-111111111111.PNG'], 20, 9001)).resolves.toBeUndefined();
  });

  it.each([
    ['other tournament', 'soft_filter_document/21/9001/11111111-1111-4111-8111-111111111111.jpg'],
    ['uuid not v4', 'soft_filter_document/20/9001/11111111-1111-1111-8111-111111111111.jpg'],
    ['wrong extension', 'soft_filter_document/20/9001/11111111-1111-4111-8111-111111111111.gif'],
    ['path traversal suffix', 'soft_filter_document/20/9001/11111111-1111-4111-8111-111111111111.jpg/../x'],
  ])('rejects key with %s', async (_l, bad) => {
    await expectAppError(uploadService.validateSoftFilterDocuments([bad], 20, 9001), 422, 'SOFT_FILTER_DOCUMENT_INVALID');
  });
});

describe('getPresignedDownloadUrl', () => {
  it('signs a GetObject for the key with the same 20-minute expiry', async () => {
    await expect(uploadService.getPresignedDownloadUrl('avatar/1/a.png')).resolves.toBe('https://s3/signed');

    const [, command, options] = vi.mocked(getSignedUrl).mock.calls.at(-1)!;
    expect((command as { input: unknown }).input).toEqual({ Bucket: 'ltms-test', Key: 'avatar/1/a.png' });
    expect(options).toEqual({ expiresIn: 1200 });
  });
});

describe('validateAvatarKey — more paths', () => {
  const own = 'avatar/9001/22222222-2222-4222-8222-222222222222.png';

  it('accepts an own key whose object exists as an image', async () => {
    s3Send.mockResolvedValueOnce({ ContentType: 'image/png' });
    await expect(uploadService.validateAvatarKey(own, 9001)).resolves.toBeUndefined();
    expect(s3Send.mock.calls[0]![0].input).toEqual({ Bucket: 'ltms-test', Key: own });
  });

  it.each([
    ['another user\'s avatar', 'avatar/9002/22222222-2222-4222-8222-222222222222.png'],
    ['a team logo key', 'team_logo/9001/22222222-2222-4222-8222-222222222222.png'],
    ['a key without a uuid', 'avatar/9001/me.png'],
    ['a prefix-only match', 'avatar/90011/22222222-2222-4222-8222-222222222222.png'],
  ])('rejects %s with 422 AVATAR_KEY_INVALID and no storage call', async (_l, bad) => {
    const err = await uploadService.validateAvatarKey(bad, 9001).catch(e => e);
    expect(err).toMatchObject({ status: 422, code: 'AVATAR_KEY_INVALID', extra: { objectKey: bad } });
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('rejects an object without a content type as not found', async () => {
    s3Send.mockResolvedValueOnce({});
    await expectAppError(uploadService.validateAvatarKey(own, 9001), 422, 'AVATAR_KEY_NOT_FOUND');
  });
});

describe('validateRefereeIdentityKeys (A1)', () => {
  const own = (ext = 'jpg') => `referee_identity/9001/33333333-3333-4333-8333-333333333333.${ext}`;

  it('accepts the caller\'s own keys (jpg and png) without touching storage', () => {
    expect(() => uploadService.validateRefereeIdentityKeys([own('jpg'), own('png')], 9001)).not.toThrow();
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('accepts an empty list', () => {
    expect(() => uploadService.validateRefereeIdentityKeys([], 9001)).not.toThrow();
  });

  it('rejects another user\'s avatar used as an identity document', () => {
    const stolen = 'avatar/1234/33333333-3333-4333-8333-333333333333.jpg';
    expect(() => uploadService.validateRefereeIdentityKeys([stolen], 9001)).toThrow(
      expect.objectContaining({ status: 422, code: 'REFEREE_IDENTITY_KEY_INVALID' }),
    );
  });

  it('rejects another applicant\'s identity document', () => {
    const other = 'referee_identity/1234/33333333-3333-4333-8333-333333333333.jpg';
    expect(() => uploadService.validateRefereeIdentityKeys([other], 9001)).toThrow(AppError);
  });

  it('lists only the invalid keys in extra.objectKeys', () => {
    const bad1 = 'referee_identity/9001/not-a-uuid.jpg';
    const bad2 = 'referee_identity/9001/33333333-3333-4333-8333-333333333333.gif';

    let caught: AppError | undefined;
    try {
      uploadService.validateRefereeIdentityKeys([own(), bad1, own('png'), bad2], 9001);
    } catch (e) {
      caught = e as AppError;
    }

    expect(caught?.extra).toEqual({ objectKeys: [bad1, bad2] });
  });

  it('does not let user 900 use user 9001\'s keys (no prefix match on the id)', () => {
    expect(() => uploadService.validateRefereeIdentityKeys([own()], 900)).toThrow(AppError);
  });
});

describe('deleteObjectBestEffort', () => {
  it('sends a DeleteObject for the key on the configured bucket', async () => {
    s3Send.mockResolvedValueOnce({});

    await expect(uploadService.deleteObjectBestEffort('avatar/1/old.png')).resolves.toBeUndefined();
    expect(s3Send.mock.calls[0]![0].input).toEqual({ Bucket: 'ltms-test', Key: 'avatar/1/old.png' });
  });

  it('swallows a storage error and logs it with the key (never throws)', async () => {
    const boom = new Error('minio down');
    s3Send.mockRejectedValueOnce(boom);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(uploadService.deleteObjectBestEffort('avatar/1/old.png')).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledWith('deleteObjectBestEffort: failed to delete avatar/1/old.png', boom);
    spy.mockRestore();
  });
});

describe('listObjectsByPrefix — more paths', () => {
  it('skips entries that have no Key', async () => {
    s3Send.mockResolvedValueOnce({ Contents: [{}, { Key: 'referee_identity/1/a.jpg' }], IsTruncated: false });
    await expect(uploadService.listObjectsByPrefix('referee_identity/')).resolves.toEqual([
      { key: 'referee_identity/1/a.jpg', lastModified: null },
    ]);
  });

  it('stops when IsTruncated is true but no continuation token is given', async () => {
    s3Send.mockResolvedValueOnce({ Contents: [], IsTruncated: true });
    await uploadService.listObjectsByPrefix('referee_identity/');
    expect(s3Send).toHaveBeenCalledTimes(1);
  });

  it('propagates a storage failure (read-only, caller decides)', async () => {
    s3Send.mockRejectedValueOnce(new Error('minio down'));
    await expect(uploadService.listObjectsByPrefix('referee_identity/')).rejects.toThrow('minio down');
  });
});

describe('validateTeamLogoKey', () => {
  const own = 'team_logo/30/44444444-4444-4444-8444-444444444444.jpg';

  it('accepts a key for this team whose object exists as an image', async () => {
    s3Send.mockResolvedValueOnce({ ContentType: 'image/jpeg' });
    await expect(uploadService.validateTeamLogoKey(own, 30)).resolves.toBeUndefined();
    expect(s3Send.mock.calls[0]![0].input).toEqual({ Bucket: 'ltms-test', Key: own });
  });

  it.each([
    ['another team', 'team_logo/31/44444444-4444-4444-8444-444444444444.jpg'],
    ['an avatar key', 'avatar/30/44444444-4444-4444-8444-444444444444.jpg'],
    ['a prefix-only id match', 'team_logo/300/44444444-4444-4444-8444-444444444444.jpg'],
    ['a webp file', 'team_logo/30/44444444-4444-4444-8444-444444444444.webp'],
  ])('rejects a key for %s with 422 TEAM_LOGO_KEY_INVALID and no storage call', async (_l, bad) => {
    const err = await uploadService.validateTeamLogoKey(bad, 30).catch(e => e);
    expect(err).toMatchObject({ status: 422, code: 'TEAM_LOGO_KEY_INVALID', extra: { objectKey: bad } });
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('422 TEAM_LOGO_KEY_NOT_FOUND when the object was never uploaded', async () => {
    s3Send.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    await expectAppError(uploadService.validateTeamLogoKey(own, 30), 422, 'TEAM_LOGO_KEY_NOT_FOUND');
  });

  it('422 TEAM_LOGO_KEY_NOT_FOUND when the stored object is not an image', async () => {
    s3Send.mockResolvedValueOnce({ ContentType: 'text/html' });
    await expectAppError(uploadService.validateTeamLogoKey(own, 30), 422, 'TEAM_LOGO_KEY_NOT_FOUND');
  });

  it('503 STORAGE_UNAVAILABLE when storage itself fails', async () => {
    s3Send.mockRejectedValueOnce({ name: 'TimeoutError', $metadata: { httpStatusCode: 500 } });
    await expectAppError(uploadService.validateTeamLogoKey(own, 30), 503, 'STORAGE_UNAVAILABLE');
  });
});
