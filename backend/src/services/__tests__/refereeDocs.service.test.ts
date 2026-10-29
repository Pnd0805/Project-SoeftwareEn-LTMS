import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/tournamentReferee.repo.js', () => ({
  findDocKeysOfUser: vi.fn(),
  findPurgeableIdentityDocRows: vi.fn(),
  findDocKeysOnOtherRows: vi.fn(),
  closePurgedDocsRow: vi.fn(),
  findAllReferencedIdentityKeys: vi.fn(),
}));
vi.mock('../upload.service.js', () => ({
  deleteObjectConfirmed: vi.fn(),
  listObjectsByPrefix: vi.fn(),
  REFEREE_IDENTITY_PREFIX: 'referee_identity/',
  // ตัวจริง — ตัดสินว่าไฟล์ไหนเป็นภาพยืนยันตัวตน ต้องไม่ถูก mock ทิ้ง
  isRefereeIdentityKey: (k: string) =>
    /^referee_identity\/\d+\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png)$/i.test(k),
}));

import * as Docs from '../refereeDocs.service.js';
import * as RefRepo from '../../repositories/tournamentReferee.repo.js';
import * as Upload from '../upload.service.js';

const repo = vi.mocked(RefRepo);
const upload = vi.mocked(Upload);
const key = (user: number, n: number) => `referee_identity/${user}/0000000${n}-0000-4000-8000-000000000000.jpg`;
const row = (id: number, user: number, keys: string[]) => ({ tournament_referee_id: id, user_id: user, external_verification_docs: keys });

beforeEach(() => {
  vi.clearAllMocks();
  upload.deleteObjectConfirmed.mockResolvedValue(true);
  repo.closePurgedDocsRow.mockResolvedValue(true);
  repo.findDocKeysOnOtherRows.mockResolvedValue(new Set());
});

describe('ค่าคงที่ (ใบสั่งงานข้อ 2.2 — เปลี่ยนที่เดียว)', () => {
  it('เก็บภาพ 30 วันหลังทัวร์จบ · ไฟล์ไม่มีเจ้าของต้องเก่ากว่า 7 วัน', () => {
    expect(Docs.REFEREE_DOCS_RETENTION_DAYS).toBe(30);
    expect(Docs.ORPHAN_DOCS_GRACE_DAYS).toBe(7);
  });
});

// ① ตอนแอดมินตัดสิน
describe('deleteDocsNoLongerReferenced — ลบไฟล์หลังตัดสิน', () => {
  it('ลบเฉพาะไฟล์ที่ไม่มีแถวไหนของคนนี้ชี้ถึงแล้ว', async () => {
    repo.findDocKeysOfUser.mockResolvedValue([key(1, 2)]);   // แถวที่ถูกถอดยังถือคีย์ที่ 2 อยู่
    await expect(Docs.deleteDocsNoLongerReferenced(1, [key(1, 1), key(1, 2)])).resolves.toBe(1);
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledTimes(1);
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledWith(key(1, 1));
  });

  it('ไม่มีคีย์ → ไม่ยิงอะไรเลย', async () => {
    await expect(Docs.deleteDocsNoLongerReferenced(1, [])).resolves.toBe(0);
    expect(repo.findDocKeysOfUser).not.toHaveBeenCalled();
  });

  it('ลบพลาด → ไม่นับ แต่ไม่ throw', async () => {
    repo.findDocKeysOfUser.mockResolvedValue([]);
    upload.deleteObjectConfirmed.mockResolvedValue(false);
    await expect(Docs.deleteDocsNoLongerReferenced(1, [key(1, 1)])).resolves.toBe(0);
  });

  it('★ ฐานล่มตอนอ่าน → ไม่ throw (การตัดสินสำเร็จไปแล้ว ผู้ใช้ต้องไม่เห็น error)', async () => {
    repo.findDocKeysOfUser.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(Docs.deleteDocsNoLongerReferenced(1, [key(1, 1)])).resolves.toBe(0);
    expect(upload.deleteObjectConfirmed).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ② งานเบื้องหลัง — ตารางเทสของใบสั่งงานขั้น 5
describe('purgeRefereeIdentityDocs — แถวที่ยังถือคีย์ของทัวร์ที่จบแล้ว', () => {
  it('ส่งค่าคงที่ 30 วันให้ repo', async () => {
    repo.findPurgeableIdentityDocRows.mockResolvedValue([]);
    await Docs.purgeRefereeIdentityDocs();
    expect(repo.findPurgeableIdentityDocRows).toHaveBeenCalledWith(30);
  });

  it('เข้าเกณฑ์ → ลบทุกไฟล์ แล้วปิดแถว · คืนจำนวนแถวที่ปิด', async () => {
    repo.findPurgeableIdentityDocRows.mockResolvedValue([row(10, 1, [key(1, 1), key(1, 2)])]);
    await expect(Docs.purgeRefereeIdentityDocs()).resolves.toBe(1);
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledWith(key(1, 1));
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledWith(key(1, 2));
    expect(repo.closePurgedDocsRow).toHaveBeenCalledWith(10, [key(1, 1), key(1, 2)]);
  });

  it('🔴 ลำดับ: ลบไฟล์ก่อน แล้วค่อยปิดแถว', async () => {
    repo.findPurgeableIdentityDocRows.mockResolvedValue([row(10, 1, [key(1, 1)])]);
    await Docs.purgeRefereeIdentityDocs();
    expect(upload.deleteObjectConfirmed.mock.invocationCallOrder[0]!)
      .toBeLessThan(repo.closePurgedDocsRow.mock.invocationCallOrder[0]!);
  });

  it('🔴 ลบไฟล์พลาดแม้ตัวเดียว → แถวต้องไม่ถูกปิด (คีย์ยังอยู่ให้รอบหน้าลองใหม่)', async () => {
    repo.findPurgeableIdentityDocRows.mockResolvedValue([row(10, 1, [key(1, 1), key(1, 2)])]);
    upload.deleteObjectConfirmed.mockImplementation(async (k: string) => k !== key(1, 2));
    await expect(Docs.purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(repo.closePurgedDocsRow).not.toHaveBeenCalled();
  });

  it('ไม่มีแถวเข้าเกณฑ์ (ยังไม่ครบกำหนด / ปิดไปแล้ว / มีแถวรอตรวจ — กรองที่ repo) → ไม่ลบอะไร', async () => {
    repo.findPurgeableIdentityDocRows.mockResolvedValue([]);
    await expect(Docs.purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(upload.deleteObjectConfirmed).not.toHaveBeenCalled();
    expect(repo.findDocKeysOnOtherRows).not.toHaveBeenCalled();
  });

  it('★ ไฟล์ที่แถวอื่นของคนเดียวกันยังชี้อยู่ → ไม่ลบ และแถวนั้นยังไม่ปิด', async () => {
    repo.findPurgeableIdentityDocRows.mockResolvedValue([row(10, 1, [key(1, 1), key(1, 2)])]);
    repo.findDocKeysOnOtherRows.mockResolvedValue(new Set([key(1, 2)]));
    await expect(Docs.purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(upload.deleteObjectConfirmed).not.toHaveBeenCalled();
    expect(repo.findDocKeysOnOtherRows).toHaveBeenCalledWith([1], [10]);
  });

  it('คีย์เดียวกันอยู่สองแถวที่เข้าเกณฑ์ → ลบไฟล์ครั้งเดียว ปิดทั้งสองแถว', async () => {
    repo.findPurgeableIdentityDocRows.mockResolvedValue([row(10, 1, [key(1, 1)]), row(11, 1, [key(1, 1)])]);
    await expect(Docs.purgeRefereeIdentityDocs()).resolves.toBe(2);
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledTimes(1);
  });

  it('ปิดแถวไม่สำเร็จ (ระหว่างนั้น user ส่งเอกสารใหม่เข้าแถว) → ไม่นับ', async () => {
    repo.findPurgeableIdentityDocRows.mockResolvedValue([row(10, 1, [key(1, 1)])]);
    repo.closePurgedDocsRow.mockResolvedValue(false);
    await expect(Docs.purgeRefereeIdentityDocs()).resolves.toBe(0);
  });
});

// ③ งานเบื้องหลัง — ไฟล์ไม่มีเจ้าของ
describe('sweepOrphanRefereeDocs — ไฟล์ที่ไม่มีแถวไหนชี้ถึง', () => {
  const NOW = new Date('2026-10-29T00:00:00Z');
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

  it('ลบเฉพาะ: เป็นภาพยืนยันตัวตน + ไม่มีแถวชี้ถึง + เก่ากว่า 7 วัน', async () => {
    upload.listObjectsByPrefix.mockResolvedValue([
      { key: key(1, 1), lastModified: daysAgo(40) },          // ✅ ลบ
      { key: key(1, 2), lastModified: daysAgo(40) },          // มีแถวชี้ถึง
      { key: key(1, 3), lastModified: daysAgo(3) },           // เพิ่งอัปโหลด (กำลังกรอกฟอร์ม)
      { key: 'referee_identity/1/readme.txt', lastModified: daysAgo(40) },   // ไม่ใช่รูปชื่อภาพยืนยันตัวตน
      { key: key(1, 4), lastModified: null },                 // ไม่รู้อายุ
    ]);
    repo.findAllReferencedIdentityKeys.mockResolvedValue(new Set([key(1, 2)]));
    await expect(Docs.sweepOrphanRefereeDocs(NOW)).resolves.toBe(1);
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledTimes(1);
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledWith(key(1, 1));
    expect(upload.listObjectsByPrefix).toHaveBeenCalledWith('referee_identity/');
  });

  it('ขอบ 7 วันพอดี → ยังไม่ลบ · เกินไปนิดเดียว → ลบ', async () => {
    upload.listObjectsByPrefix.mockResolvedValue([
      { key: key(1, 1), lastModified: daysAgo(7) },
      { key: key(1, 2), lastModified: new Date(daysAgo(7).getTime() - 1000) },
    ]);
    repo.findAllReferencedIdentityKeys.mockResolvedValue(new Set());
    await expect(Docs.sweepOrphanRefereeDocs(NOW)).resolves.toBe(1);
    expect(upload.deleteObjectConfirmed).toHaveBeenCalledWith(key(1, 2));
  });

  it('★ อ่านรายชื่อไฟล์ก่อน แล้วค่อยอ่านคีย์ในฐาน (ไฟล์ที่ถูกส่งระหว่างนั้นจะไม่ถูกลบผิด)', async () => {
    upload.listObjectsByPrefix.mockResolvedValue([{ key: key(1, 1), lastModified: daysAgo(40) }]);
    repo.findAllReferencedIdentityKeys.mockResolvedValue(new Set());
    await Docs.sweepOrphanRefereeDocs(NOW);
    expect(upload.listObjectsByPrefix.mock.invocationCallOrder[0]!)
      .toBeLessThan(repo.findAllReferencedIdentityKeys.mock.invocationCallOrder[0]!);
  });

  it('ไม่มีไฟล์เลย → ไม่อ่านฐาน · ลบพลาด → ไม่นับ', async () => {
    upload.listObjectsByPrefix.mockResolvedValue([]);
    await expect(Docs.sweepOrphanRefereeDocs(NOW)).resolves.toBe(0);
    expect(repo.findAllReferencedIdentityKeys).not.toHaveBeenCalled();

    upload.listObjectsByPrefix.mockResolvedValue([{ key: key(1, 1), lastModified: daysAgo(40) }]);
    repo.findAllReferencedIdentityKeys.mockResolvedValue(new Set());
    upload.deleteObjectConfirmed.mockResolvedValue(false);
    await expect(Docs.sweepOrphanRefereeDocs(NOW)).resolves.toBe(0);
  });
});
