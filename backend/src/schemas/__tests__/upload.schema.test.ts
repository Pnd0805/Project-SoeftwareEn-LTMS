import { describe, it, expect } from 'vitest';
import { presignUploadSchema, presignUploadErrorCodes } from '../upload.schema.js';

describe('presignUploadSchema', () => {
  it('accepts checkin_document with a matchId', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'checkin_document',
      contentType: 'image/jpeg',
      matchId: 30,
    });
    expect(result.success).toBe(true);
  });

  it('rejects checkin_document without a matchId, with the Thai message on the matchId path', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'checkin_document',
      contentType: 'image/jpeg',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message === 'ต้องระบุ matchId เมื่อ purpose เป็น checkin_document');
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(['matchId']);
    }
  });

  it('accepts checkin_document with matchId = 0 (refine only checks presence, not positivity)', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'checkin_document',
      contentType: 'image/jpeg',
      matchId: 0,
    });
    expect(result.success).toBe(true);
  });

  it('accepts soft_filter_document with a tournamentId', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'soft_filter_document',
      contentType: 'image/png',
      tournamentId: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects soft_filter_document without a tournamentId, with the Thai message on the tournamentId path', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'soft_filter_document',
      contentType: 'image/png',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message === 'ต้องระบุ tournamentId เมื่อ purpose เป็น soft_filter_document');
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(['tournamentId']);
    }
  });

  it('accepts referee_identity with neither matchId nor tournamentId', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'referee_identity',
      contentType: 'image/jpeg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts referee_identity even if matchId/tournamentId are supplied anyway', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'referee_identity',
      contentType: 'image/jpeg',
      matchId: 30,
      tournamentId: 20,
    });
    expect(result.success).toBe(true);
  });

  it("checkin_document's missing-matchId error does not also require tournamentId", () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'checkin_document',
      contentType: 'image/jpeg',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'tournamentId')).toBe(false);
    }
  });

  it('rejects an unrecognized purpose', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'profile_picture',
      contentType: 'image/jpeg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported contentType', () => {
    const result = presignUploadSchema.safeParse({
      purpose: 'referee_identity',
      contentType: 'image/gif',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing purpose', () => {
    const result = presignUploadSchema.safeParse({ contentType: 'image/jpeg' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing contentType', () => {
    const result = presignUploadSchema.safeParse({ purpose: 'referee_identity' });
    expect(result.success).toBe(false);
  });
});

describe('presignUploadErrorCodes', () => {
  it('carries the UNSUPPORTED_FILE_TYPE code and matching Thai message for the contentType field', () => {
    expect(presignUploadErrorCodes.contentType).toEqual({
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'รองรับเฉพาะไฟล์ JPEG และ PNG เท่านั้น',
    });
  });
});
