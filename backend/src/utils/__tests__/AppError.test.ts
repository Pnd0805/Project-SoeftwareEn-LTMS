import { describe, it, expect } from 'vitest';
import { AppError } from '../AppError.js';

describe('AppError — construction', () => {
  it('sets status, code, and message from the constructor args', () => {
    const err = new AppError(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้ในระบบ');

    expect(err.status).toBe(404);
    expect(err.code).toBe('USER_NOT_FOUND');
    expect(err.message).toBe('ไม่พบผู้ใช้นี้ในระบบ');
  });

  it('sets extra when provided', () => {
    const extra = { fields: { id: 'รหัสต้องเป็นจำนวนเต็มบวก' } };
    const err = new AppError(400, 'VALIDATION_FAILED', 'ข้อมูลไม่ถูกต้อง', extra);

    expect(err.extra).toBe(extra);
    expect(err.extra?.fields).toEqual({ id: 'รหัสต้องเป็นจำนวนเต็มบวก' });
  });

  it('defaults extra to undefined when omitted', () => {
    const err = new AppError(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้ในระบบ');

    expect(err.extra).toBeUndefined();
  });
});

describe('AppError — Error inheritance', () => {
  it('is an instance of both AppError and the native Error', () => {
    const err = new AppError(500, 'INTERNAL_ERROR', 'เกิดข้อผิดพลาด');

    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets the name property (inherited from Error) as expected', () => {
    const err = new AppError(500, 'INTERNAL_ERROR', 'เกิดข้อผิดพลาด');

    expect(err.name).toBe('Error');
  });

  it('produces a readable stack trace', () => {
    const err = new AppError(500, 'INTERNAL_ERROR', 'เกิดข้อผิดพลาด');

    expect(typeof err.stack).toBe('string');
    expect(err.stack).toContain('เกิดข้อผิดพลาด');
  });

  it('can be thrown and caught like a normal Error', () => {
    const throwIt = () => {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึง');
    };

    expect(throwIt).toThrow(AppError);
    expect(throwIt).toThrow('ไม่มีสิทธิ์เข้าถึง');
  });

  it('exposes message via String(err) the same way a native Error does', () => {
    const err = new AppError(400, 'VALIDATION_FAILED', 'ข้อมูลไม่ถูกต้อง');

    expect(String(err)).toBe('Error: ข้อมูลไม่ถูกต้อง');
  });
});

describe('AppError — distinct instances stay independent', () => {
  it('does not share extra between separate instances', () => {
    const err1 = new AppError(400, 'A', 'msg1', { fields: { a: '1' } });
    const err2 = new AppError(400, 'B', 'msg2');

    expect(err1.extra).toEqual({ fields: { a: '1' } });
    expect(err2.extra).toBeUndefined();
  });
});
