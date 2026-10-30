import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/match.repo.js', () => ({
  findPurgeableCheckinDocs: vi.fn(),
  findCheckinRowsByDocKeys: vi.fn(),
  clearCheckinDocument: vi.fn(),
  findAllReferencedCheckinDocKeys: vi.fn(),
}));
vi.mock('../upload.service.js', async (orig) => {
  const real = await orig<typeof import('../upload.service.js')>();
  return {
    deleteObjectConfirmed: vi.fn(),
    listObjectsByPrefix: vi.fn(),
    CHECKIN_DOCUMENT_PREFIX: real.CHECKIN_DOCUMENT_PREFIX,
    // ตัวจริง — ตัดสินว่าไฟล์ไหนเป็นรูปบัตรเช็คอิน ต้องไม่ถูก mock ทิ้ง
    isCheckinDocumentKey: real.isCheckinDocumentKey,
  };
});

import * as Docs from '../checkinDocs.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as Upload from '../upload.service.js';

const repo = vi.mocked(MatchRepo);
const upload = vi.mocked(Upload);
const key = (match: number, n: number) => `checkin_document/${match}/0000000${n}-0000-4000-8000-000000000000.jpg`;
const row = (id: number, match: number, k: string) => ({ match_checkin_id: id, match_id: match, document_s3_key: k });

beforeEach(() => {
  vi.clearAllMocks();
  upload.deleteObjectConfirmed.mockResolvedValue(true);
  repo.clearCheckinDocument.mockResolvedValue(true);
  repo.findCheckinRowsByDocKeys.mockResolvedValue([]);
});

describe('ค่าคงที่ที่ผู้ใช้เคาะ', () => {
  // ตรวจ SRS/SDS 30 ต.ค. (ข้อ 1.1) — NF-SE-03 เป็นเส้นตาย "ลบภายใน" ⇒ เริ่มลบก่อนเส้นตาย 24 ชม. (มติผู้ใช้: 48 ชม.)
  it('เริ่มลบ 48 ชม. หลังหมดเวลาโต้แย้ง · ทางสำรอง 29 วัน · ไฟล์ไม่มีเจ้าของรอ 1 วัน', () => {
    expect(Docs.CHECKIN_DOCS_RETENTION_HOURS).toBe(48);
    expect(Docs.CHECKIN_DOCS_UNVERIFIED_FALLBACK_HOURS).toBe(29 * 24);
    expect(Docs.ORPHAN_CHECKIN_DOCS_GRACE_DAYS).toBe(1);
  });

  // 🔴 งานรันชั่วโมงละครั้ง — ต้องเหลือเวลาให้ลองใหม่ก่อนเส้นตายของ NF-SE-03 อย่างน้อยหลายรอบ
  it('เริ่มลบได้ก่อนเส้นตาย NF-SE-03 (72 ชม. · 30 วัน) อย่างน้อย 1 รอบงาน', () => {
    expect(Docs.CHECKIN_DOCS_RETENTION_HOURS + 1).toBeLessThanOrEqual(Docs.CHECKIN_DOCS_DELETE_DEADLINE_HOURS);
    expect(Docs.CHECKIN_DOCS_UNVERIFIED_FALLBACK_HOURS + 1).toBeLessThanOrEqual(Docs.CHECKIN_DOCS_UNVERIFIED_DEADLINE_DAYS * 24);
  });
});

describe('purgeCheckinDocuments', () => {
  it('ส่งจำนวนชั่วโมงเข้า repo · ลบไฟล์ก่อนแล้วค่อยล้างคีย์', async () => {
    repo.findPurgeableCheckinDocs.mockResolvedValue([row(1, 7, key(7, 1))]);

    await expect(Docs.purgeCheckinDocuments()).resolves.toBe(1);

    expect(repo.findPurgeableCheckinDocs).toHaveBeenCalledWith(48, 29 * 24);
    expect(upload.deleteObjectConfirmed.mock.invocationCallOrder[0])
      .toBeLessThan(repo.clearCheckinDocument.mock.invocationCallOrder[0]!);
    expect(repo.clearCheckinDocument).toHaveBeenCalledWith(1, key(7, 1));
  });

  it('สองแถวชี้ไฟล์เดียวกันและหมดหน้าที่ทั้งคู่ → ลบไฟล์ครั้งเดียว ล้างทั้งสองแถว', async () => {
    repo.findPurgeableCheckinDocs.mockResolvedValue([row(1, 7, key(7, 1)), row(2, 7, key(7, 1))]);
    repo.findCheckinRowsByDocKeys.mockResolvedValue([
      { match_checkin_id: 1, document_s3_key: key(7, 1) }, { match_checkin_id: 2, document_s3_key: key(7, 1) }]);

    await expect(Docs.purgeCheckinDocuments()).resolves.toBe(2);
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledTimes(1);
  });

  it('ไม่มีอะไรเข้าเกณฑ์ → ไม่แตะที่เก็บไฟล์', async () => {
    repo.findPurgeableCheckinDocs.mockResolvedValue([]);
    await expect(Docs.purgeCheckinDocuments()).resolves.toBe(0);
    expect(upload.deleteObjectConfirmed).not.toHaveBeenCalled();
  });
});

describe('sweepOrphanCheckinDocs — ขอบ 1 วัน', () => {
  const NOW = new Date('2026-10-29T12:00:00Z');
  const ago = (ms: number) => new Date(NOW.getTime() - ms);
  const DAY = 24 * 3600 * 1000;

  it('เก่ากว่า 1 วันลบ · อายุ 1 วันพอดียังไม่ลบ', async () => {
    upload.listObjectsByPrefix.mockResolvedValue([
      { key: key(7, 1), lastModified: ago(DAY + 1000) },
      { key: key(7, 2), lastModified: ago(DAY) },
    ]);
    repo.findAllReferencedCheckinDocKeys.mockResolvedValue(new Set());

    await expect(Docs.sweepOrphanCheckinDocs(NOW)).resolves.toBe(1);
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledWith(key(7, 1));
    expect(upload.listObjectsByPrefix).toHaveBeenCalledWith('checkin_document/');
  });

  it('อ่านรายชื่อไฟล์ก่อนอ่านคีย์ในฐาน', async () => {
    upload.listObjectsByPrefix.mockResolvedValue([{ key: key(7, 1), lastModified: ago(2 * DAY) }]);
    repo.findAllReferencedCheckinDocKeys.mockResolvedValue(new Set());

    await Docs.sweepOrphanCheckinDocs(NOW);
    expect(upload.listObjectsByPrefix.mock.invocationCallOrder[0])
      .toBeLessThan(repo.findAllReferencedCheckinDocKeys.mock.invocationCallOrder[0]!);
  });

  it('ไม่มีไฟล์เลย → ไม่ต้องถามฐาน', async () => {
    upload.listObjectsByPrefix.mockResolvedValue([]);
    await expect(Docs.sweepOrphanCheckinDocs(NOW)).resolves.toBe(0);
    expect(repo.findAllReferencedCheckinDocKeys).not.toHaveBeenCalled();
  });
});
