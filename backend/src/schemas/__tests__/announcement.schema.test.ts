import { describe, it, expect } from 'vitest';
import { createAnnouncementSchema, updateAnnouncementSchema } from '../announcement.schema.js';

describe('createAnnouncementSchema', () => {
  it('accepts a valid title and body', () => {
    const result = createAnnouncementSchema.safeParse({ title: 'Schedule update', body: 'The match moved to 10:00.' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: 'Schedule update', body: 'The match moved to 10:00.' });
    }
  });

  it('accepts empty strings for title and body (no min-length constraint)', () => {
    const result = createAnnouncementSchema.safeParse({ title: '', body: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing title', () => {
    const result = createAnnouncementSchema.safeParse({ body: 'Body only' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });

  it('rejects a missing body', () => {
    const result = createAnnouncementSchema.safeParse({ title: 'Title only' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'body')).toBe(true);
    }
  });

  it('rejects a non-string title', () => {
    const result = createAnnouncementSchema.safeParse({ title: 123, body: 'Body' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });

  it('rejects a non-string body', () => {
    const result = createAnnouncementSchema.safeParse({ title: 'Title', body: null });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'body')).toBe(true);
    }
  });

  it('strips unknown fields rather than rejecting them', () => {
    const result = createAnnouncementSchema.safeParse({ title: 'T', body: 'B', extra: 'ignored' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('extra');
    }
  });
});

describe('updateAnnouncementSchema', () => {
  it('accepts an empty object since both fields are optional', () => {
    const result = updateAnnouncementSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts title only', () => {
    const result = updateAnnouncementSchema.safeParse({ title: 'New title' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: 'New title' });
    }
  });

  it('accepts body only', () => {
    const result = updateAnnouncementSchema.safeParse({ body: 'New body' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ body: 'New body' });
    }
  });

  it('accepts both title and body', () => {
    const result = updateAnnouncementSchema.safeParse({ title: 'T', body: 'B' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-string title when provided', () => {
    const result = updateAnnouncementSchema.safeParse({ title: 123 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'title')).toBe(true);
    }
  });

  it('rejects a non-string body when provided', () => {
    const result = updateAnnouncementSchema.safeParse({ body: false });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'body')).toBe(true);
    }
  });
});
