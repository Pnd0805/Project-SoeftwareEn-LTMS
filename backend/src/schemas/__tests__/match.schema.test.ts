import { describe, it, expect } from 'vitest';
import {
  roomCodeSchema,
  livestreamSchema,
  scheduleMatchSchema,
  rejectCheckinSchema,
  rejectCheckinErrorCodes,
  createBracketSchema,
  submitCheckinSchema,
  manualCheckinSchema,
} from '../match.schema.js';

describe('roomCodeSchema', () => {
  it('accepts a non-empty room code', () => {
    const result = roomCodeSchema.safeParse({ roomCode: 'ABC123' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roomCode).toBe('ABC123');
  });

  it('trims surrounding whitespace', () => {
    const result = roomCodeSchema.safeParse({ roomCode: '  ABC123  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roomCode).toBe('ABC123');
  });

  it('accepts null (clears the room code)', () => {
    const result = roomCodeSchema.safeParse({ roomCode: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roomCode).toBeNull();
  });

  it('rejects an empty string', () => {
    const result = roomCodeSchema.safeParse({ roomCode: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a string that is only whitespace (trimmed to empty)', () => {
    const result = roomCodeSchema.safeParse({ roomCode: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects a room code longer than 50 characters', () => {
    const result = roomCodeSchema.safeParse({ roomCode: 'x'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('accepts a room code exactly 50 characters long', () => {
    const result = roomCodeSchema.safeParse({ roomCode: 'x'.repeat(50) });
    expect(result.success).toBe(true);
  });

  it('rejects a missing roomCode field (not optional, only nullable)', () => {
    const result = roomCodeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-string, non-null roomCode', () => {
    const result = roomCodeSchema.safeParse({ roomCode: 123 });
    expect(result.success).toBe(false);
  });
});

describe('livestreamSchema', () => {
  it('accepts a string URL', () => {
    const result = livestreamSchema.safeParse({ youtubeUrl: 'https://youtube.com/watch?v=abc' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty string (no format validation beyond being a string)', () => {
    const result = livestreamSchema.safeParse({ youtubeUrl: '' });
    expect(result.success).toBe(true);
  });

  it('accepts null (clears the link)', () => {
    const result = livestreamSchema.safeParse({ youtubeUrl: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.youtubeUrl).toBeNull();
  });

  it('rejects a missing youtubeUrl field (not optional, only nullable)', () => {
    const result = livestreamSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-string, non-null youtubeUrl', () => {
    const result = livestreamSchema.safeParse({ youtubeUrl: 123 });
    expect(result.success).toBe(false);
  });
});

describe('scheduleMatchSchema', () => {
  const validStart = '2026-10-01T10:00:00Z';
  const validEnd = '2026-10-01T12:00:00Z';

  it('accepts venue only', () => {
    const result = scheduleMatchSchema.safeParse({ venue: 'Main Gym' });
    expect(result.success).toBe(true);
  });

  it('accepts scheduledTime only', () => {
    const result = scheduleMatchSchema.safeParse({ scheduledTime: validStart });
    expect(result.success).toBe(true);
  });

  it('accepts scheduledEndTime only', () => {
    const result = scheduleMatchSchema.safeParse({ scheduledEndTime: validEnd });
    expect(result.success).toBe(true);
  });

  it('accepts a datetime with a "Z" (UTC) suffix', () => {
    const result = scheduleMatchSchema.safeParse({ scheduledTime: '2026-10-01T10:00:00Z' });
    expect(result.success).toBe(true);
  });

  it('accepts a datetime with a numeric offset (e.g. +07:00)', () => {
    const result = scheduleMatchSchema.safeParse({ scheduledTime: '2026-10-01T10:00:00+07:00' });
    expect(result.success).toBe(true);
  });

  it('rejects a datetime with no timezone marker at all', () => {
    const result = scheduleMatchSchema.safeParse({ scheduledTime: '2026-10-01T10:00:00' });
    expect(result.success).toBe(false);
  });

  it('rejects when none of scheduledTime, scheduledEndTime, or venue are provided', () => {
    const result = scheduleMatchSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message === 'ต้องระบุอย่างน้อยหนึ่งอย่าง: เวลาเริ่ม เวลาจบ หรือสนาม');
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(['scheduledTime']);
    }
  });

  it('rejects a malformed scheduledTime with the Thai format message', () => {
    const result = scheduleMatchSchema.safeParse({ scheduledTime: 'not-a-date' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'รูปแบบวันเวลาไม่ถูกต้อง')).toBe(true);
    }
  });

  it('rejects a malformed scheduledEndTime with the Thai format message', () => {
    const result = scheduleMatchSchema.safeParse({ scheduledEndTime: 'not-a-date' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'รูปแบบวันเวลาจบไม่ถูกต้อง')).toBe(true);
    }
  });

  it('rejects an empty venue string', () => {
    const result = scheduleMatchSchema.safeParse({ venue: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาระบุสนามแข่งขัน')).toBe(true);
    }
  });

  it('rejects scheduledEndTime at or before scheduledTime', () => {
    const result = scheduleMatchSchema.safeParse({ scheduledTime: validEnd, scheduledEndTime: validStart });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message === 'เวลาจบต้องหลังเวลาเริ่ม');
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(['scheduledEndTime']);
    }
  });

  it('rejects scheduledEndTime exactly equal to scheduledTime', () => {
    const result = scheduleMatchSchema.safeParse({ scheduledTime: validStart, scheduledEndTime: validStart });
    expect(result.success).toBe(false);
  });

  it('accepts scheduledTime, scheduledEndTime, and venue together when end is after start', () => {
    const result = scheduleMatchSchema.safeParse({
      scheduledTime: validStart,
      scheduledEndTime: validEnd,
      venue: 'Main Gym',
    });
    expect(result.success).toBe(true);
  });
});

describe('rejectCheckinSchema', () => {
  it('accepts a non-empty reason', () => {
    const result = rejectCheckinSchema.safeParse({ reason: 'รูปถ่ายไม่ชัดเจน' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty reason with the Thai message', () => {
    const result = rejectCheckinSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาระบุเหตุผลที่ปฏิเสธการยืนยันตัวตน')).toBe(true);
    }
  });

  it('rejects a missing reason', () => {
    const result = rejectCheckinSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('rejectCheckinErrorCodes', () => {
  it('carries the CHECKIN_REJECT_REASON_REQUIRED code and matching Thai message for the reason field', () => {
    expect(rejectCheckinErrorCodes.reason).toEqual({
      code: 'CHECKIN_REJECT_REASON_REQUIRED',
      message: 'กรุณาระบุเหตุผลที่ปฏิเสธการยืนยันตัวตน',
    });
  });
});

describe('createBracketSchema', () => {
  it('accepts seedingMethod "random" with no manualSeeds', () => {
    const result = createBracketSchema.safeParse({ seedingMethod: 'random' });
    expect(result.success).toBe(true);
  });

  it('accepts seedingMethod "manual" with a non-empty manualSeeds array', () => {
    const result = createBracketSchema.safeParse({ seedingMethod: 'manual', manualSeeds: [3, 1, 2] });
    expect(result.success).toBe(true);
  });

  it('rejects seedingMethod "manual" with manualSeeds omitted', () => {
    const result = createBracketSchema.safeParse({ seedingMethod: 'manual' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.message === 'ต้องระบุ manualSeeds เมื่อเลือก seedingMethod เป็น manual');
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(['manualSeeds']);
    }
  });

  it('rejects seedingMethod "manual" with an empty manualSeeds array', () => {
    const result = createBracketSchema.safeParse({ seedingMethod: 'manual', manualSeeds: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid seedingMethod value', () => {
    const result = createBracketSchema.safeParse({ seedingMethod: 'auto' });
    expect(result.success).toBe(false);
  });

  it('accepts the optional replace flag', () => {
    const result = createBracketSchema.safeParse({ seedingMethod: 'random', replace: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.replace).toBe(true);
  });

  it('rejects a non-boolean replace flag', () => {
    const result = createBracketSchema.safeParse({ seedingMethod: 'random', replace: 'yes' });
    expect(result.success).toBe(false);
  });
});

describe('submitCheckinSchema', () => {
  it('accepts a valid qr_onsite payload', () => {
    const result = submitCheckinSchema.safeParse({ method: 'qr_onsite', qrPayload: 'signed-payload-abc' });
    expect(result.success).toBe(true);
  });

  it('rejects qr_onsite with an empty qrPayload', () => {
    const result = submitCheckinSchema.safeParse({ method: 'qr_onsite', qrPayload: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาระบุ qrPayload')).toBe(true);
    }
  });

  it('rejects qr_onsite with qrPayload missing', () => {
    const result = submitCheckinSchema.safeParse({ method: 'qr_onsite' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid photo_online payload', () => {
    const result = submitCheckinSchema.safeParse({
      method: 'photo_online',
      documentType: 'student_id',
      documentS3Key: 'uploads/doc123.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('rejects photo_online with an invalid documentType', () => {
    const result = submitCheckinSchema.safeParse({
      method: 'photo_online',
      documentType: 'passport',
      documentS3Key: 'uploads/doc123.jpg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects photo_online with an empty documentS3Key', () => {
    const result = submitCheckinSchema.safeParse({
      method: 'photo_online',
      documentType: 'national_id',
      documentS3Key: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'กรุณาระบุ documentS3Key')).toBe(true);
    }
  });

  it('rejects an unrecognized method', () => {
    const result = submitCheckinSchema.safeParse({ method: 'manual_by_referee' });
    expect(result.success).toBe(false);
  });

  it('rejects a qr_onsite payload carrying photo_online-only fields instead of qrPayload', () => {
    const result = submitCheckinSchema.safeParse({
      method: 'qr_onsite',
      documentType: 'student_id',
      documentS3Key: 'uploads/doc123.jpg',
    });
    expect(result.success).toBe(false);
  });
});

describe('manualCheckinSchema', () => {
  it('accepts a positive integer userId with no note', () => {
    const result = manualCheckinSchema.safeParse({ userId: 7 });
    expect(result.success).toBe(true);
  });

  it('accepts a userId with a note, trimming the note', () => {
    const result = manualCheckinSchema.safeParse({ userId: 7, note: '  กล้องเสีย  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBe('กล้องเสีย');
  });

  it('rejects userId = 0', () => {
    const result = manualCheckinSchema.safeParse({ userId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative userId', () => {
    const result = manualCheckinSchema.safeParse({ userId: -3 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer userId', () => {
    const result = manualCheckinSchema.safeParse({ userId: 7.5 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing userId', () => {
    const result = manualCheckinSchema.safeParse({ note: 'no userId given' });
    expect(result.success).toBe(false);
  });

  it('rejects a note longer than 255 characters', () => {
    const result = manualCheckinSchema.safeParse({ userId: 7, note: 'x'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('accepts a note exactly 255 characters long', () => {
    const result = manualCheckinSchema.safeParse({ userId: 7, note: 'x'.repeat(255) });
    expect(result.success).toBe(true);
  });
});
