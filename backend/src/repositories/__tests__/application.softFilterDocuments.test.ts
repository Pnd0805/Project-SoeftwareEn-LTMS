import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = vi.fn();
  const connection = {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    query,
  };
  return { query, connection };
});

vi.mock('../../config/db.js', () => ({
  default: {
    query: mocks.query,
    getConnection: vi.fn(async () => mocks.connection),
  },
}));

import { insertApplicationWithPlayers } from '../application.repo.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('insertApplicationWithPlayers soft-filter documents', () => {
  it('persists document keys in the same transaction as the application and squad', async () => {
    const docs = [
      'soft_filter_document/20/5/11111111-1111-4111-8111-111111111111.jpg',
      'soft_filter_document/20/5/22222222-2222-4222-8222-222222222222.png',
    ];
    mocks.query
      .mockResolvedValueOnce([{ insertId: 77 }, []])
      .mockResolvedValueOnce([{ affectedRows: 2 }, []]);

    await expect(insertApplicationWithPlayers(
      20,
      10,
      [{ userId: 1, passed: true }],
      [1, 2],
      docs,
    )).resolves.toBe(77);

    const [applicationSql, applicationValues] = mocks.query.mock.calls[0]!;
    expect(applicationSql).toContain('soft_filter_documents');
    expect(applicationValues).toEqual([
      20,
      10,
      JSON.stringify([{ userId: 1, passed: true }]),
      JSON.stringify(docs),
    ]);
    expect(mocks.connection.commit).toHaveBeenCalledTimes(1);
  });
});
