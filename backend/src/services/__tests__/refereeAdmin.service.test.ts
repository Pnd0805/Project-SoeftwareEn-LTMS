import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/tournamentReferee.repo.js', () => ({
  findPendingAdminReview: vi.fn(),
  approveUser: vi.fn(),
  requestDocsFromUser: vi.fn(),
  rejectUser: vi.fn(),
}));

vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../mappers/user.mapper.js', () => ({
  toUserRef: vi.fn(),
}));

vi.mock('../refereeIdentity.service.js', () => ({
  getIdentityState: vi.fn(),
}));

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
}));

import {
  listPendingExternalReferees,
  approveExternalReferee,
  requestDocsFromExternalReferee,
  rejectExternalReferee,
} from '../refereeAdmin.service.js';
import * as RefRepo from '../../repositories/tournamentReferee.repo.js';
import * as UserRepo from '../../repositories/user.repo.js';
import { toUserRef } from '../../mappers/user.mapper.js';
import { getIdentityState } from '../refereeIdentity.service.js';
import * as NotificationService from '../notification.service.js';

const mockedRefRepo = vi.mocked(RefRepo);
const mockedUserRepo = vi.mocked(UserRepo);
const mockedToUserRef = vi.mocked(toUserRef);
const mockedGetIdentityState = vi.mocked(getIdentityState);
const mockedNotify = vi.mocked(NotificationService.notify);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listPendingExternalReferees', () => {
  it('groups multiple pending rows for the same user into a single item', async () => {
    const rows = [
      {
        tournament_referee_id: 1,
        user_id: 5,
        tournament_id: 100,
        external_verification_docs: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        full_name: 'สมชาย',
        profile_image_key: 'a.png',
        email: 'a@x.com',
        tournament_name: 'Tour A',
      },
      {
        tournament_referee_id: 2,
        user_id: 5,
        tournament_id: 200,
        external_verification_docs: ['doc1.pdf'],
        created_at: new Date('2024-01-02T00:00:00Z'),
        full_name: 'สมชาย',
        profile_image_key: 'a.png',
        email: 'a@x.com',
        tournament_name: 'Tour B',
      },
    ] as any[];
    mockedRefRepo.findPendingAdminReview.mockResolvedValue(rows);
    mockedToUserRef.mockReturnValue({ id: 5, fullName: 'สมชาย', avatarUrl: 'a.png' });

    const result = await listPendingExternalReferees();

    // toUserRef is called with the first row of the group.
    expect(mockedToUserRef).toHaveBeenCalledWith(rows[0]);
    expect(result.items).toEqual([
      {
        userId: 5,
        user: { id: 5, fullName: 'สมชาย', avatarUrl: 'a.png', email: 'a@x.com' },
        docs: ['doc1.pdf'],
        // 🆕 6 ต.ค. 2569 — ธงแยก "ส่งเอกสารแล้ว" ออกจาก "ยังไม่ส่ง" (ทางเลือก ข)
        docsSubmitted: true,
        tournaments: [
          { id: 100, name: 'Tour A', tournamentRefereeId: 1 },
          { id: 200, name: 'Tour B', tournamentRefereeId: 2 },
        ],
        submittedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('picks docs from whichever row in the group has them, even if not the first row', async () => {
    const rows = [
      {
        tournament_referee_id: 1,
        user_id: 5,
        tournament_id: 100,
        external_verification_docs: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        full_name: 'สมชาย',
        profile_image_key: null,
        email: 'a@x.com',
        tournament_name: 'Tour A',
      },
      {
        tournament_referee_id: 2,
        user_id: 5,
        tournament_id: 200,
        external_verification_docs: ['doc1.pdf'],
        created_at: new Date('2024-01-02T00:00:00Z'),
        full_name: 'สมชาย',
        profile_image_key: null,
        email: 'a@x.com',
        tournament_name: 'Tour B',
      },
    ] as any[];
    mockedRefRepo.findPendingAdminReview.mockResolvedValue(rows);
    mockedToUserRef.mockReturnValue({ id: 5, fullName: 'สมชาย', avatarUrl: null });

    const result = await listPendingExternalReferees();

    expect(result.items[0]?.docs).toEqual(['doc1.pdf']);
  });

  it('defaults docs to an empty array when no row in the group has any', async () => {
    mockedRefRepo.findPendingAdminReview.mockResolvedValue([
      {
        tournament_referee_id: 1,
        user_id: 5,
        tournament_id: 100,
        external_verification_docs: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        full_name: 'สมชาย',
        profile_image_key: null,
        email: 'a@x.com',
        tournament_name: 'Tour A',
      },
    ] as any[]);
    mockedToUserRef.mockReturnValue({ id: 5, fullName: 'สมชาย', avatarUrl: null });

    const result = await listPendingExternalReferees();

    expect(result.items[0]?.docs).toEqual([]);
  });

  it('produces one item per distinct user_id', async () => {
    mockedRefRepo.findPendingAdminReview.mockResolvedValue([
      {
        tournament_referee_id: 1,
        user_id: 5,
        tournament_id: 100,
        external_verification_docs: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        full_name: 'A',
        profile_image_key: null,
        email: 'a@x.com',
        tournament_name: 'Tour A',
      },
      {
        tournament_referee_id: 2,
        user_id: 6,
        tournament_id: 100,
        external_verification_docs: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        full_name: 'B',
        profile_image_key: null,
        email: 'b@x.com',
        tournament_name: 'Tour A',
      },
    ] as any[]);
    mockedToUserRef
      .mockReturnValueOnce({ id: 5, fullName: 'A', avatarUrl: null })
      .mockReturnValueOnce({ id: 6, fullName: 'B', avatarUrl: null });

    const result = await listPendingExternalReferees();

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.userId)).toEqual([5, 6]);
  });

  it('returns an empty items array when there is nothing pending', async () => {
    mockedRefRepo.findPendingAdminReview.mockResolvedValue([]);

    const result = await listPendingExternalReferees();

    expect(result.items).toEqual([]);
    expect(mockedToUserRef).not.toHaveBeenCalled();
  });
});

describe('approveExternalReferee', () => {
  it('throws USER_NOT_FOUND and never checks identity state when the user does not exist', async () => {
    mockedUserRepo.findById.mockResolvedValue(null);

    await expect(approveExternalReferee(1, 99)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedGetIdentityState).not.toHaveBeenCalled();
    expect(mockedRefRepo.approveUser).not.toHaveBeenCalled();
  });

  it.each(['none', 'approved', 'rejected'] as const)(
    'throws NOT_PENDING_REVIEW when identity status is "%s"',
    async (status) => {
      mockedUserRepo.findById.mockResolvedValue({ user_id: 1 } as any);
      mockedGetIdentityState.mockResolvedValue({ status } as any);

      await expect(approveExternalReferee(1, 99)).rejects.toMatchObject({
        status: 409,
        code: 'NOT_PENDING_REVIEW',
      });
      expect(mockedRefRepo.approveUser).not.toHaveBeenCalled();
      expect(mockedNotify).not.toHaveBeenCalled();
    },
  );

  it.each(['pending', 'needs_docs'] as const)(
    'approves the user and notifies them when identity status is "%s"',
    async (status) => {
      mockedUserRepo.findById.mockResolvedValue({ user_id: 1 } as any);
      // 🔴 ต้องมี docsSubmitted: true — 6 ต.ค. เพิ่มด่านห้ามอนุมัติคนที่ยังไม่ส่งเอกสาร
      //   (ของเดิมเช็คแค่สถานะ ⇒ อนุมัติคนที่ไม่เคยส่งเอกสารได้)
      mockedGetIdentityState.mockResolvedValue({ status, docsSubmitted: true } as any);
      mockedRefRepo.approveUser.mockResolvedValue(3);

      const result = await approveExternalReferee(1, 99);

      expect(mockedRefRepo.approveUser).toHaveBeenCalledWith(1, 99);
      expect(mockedNotify).toHaveBeenCalledWith({
        userId: 1,
        type: 'referee_external_decided',
        title: 'ยืนยันตัวตนกรรมการผ่านแล้ว',
        message: 'แอดมินยืนยันตัวตนของคุณแล้ว คุณทำหน้าที่กรรมการได้ทันที',
      });
      expect(result).toEqual({ userId: 1, identityStatus: 'approved', tournamentsUpdated: 3 });
    },
  );
});

describe('requestDocsFromExternalReferee', () => {
  const input = { reason: 'เอกสารไม่ชัด' };

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    mockedUserRepo.findById.mockResolvedValue(null);

    await expect(requestDocsFromExternalReferee(1, 99, input)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedRefRepo.requestDocsFromUser).not.toHaveBeenCalled();
  });

  it.each(['none', 'needs_docs', 'approved', 'rejected'] as const)(
    'throws NOT_PENDING_REVIEW when identity status is "%s" (only "pending" is accepted here)',
    async (status) => {
      mockedUserRepo.findById.mockResolvedValue({ user_id: 1 } as any);
      mockedGetIdentityState.mockResolvedValue({ status } as any);

      await expect(requestDocsFromExternalReferee(1, 99, input)).rejects.toMatchObject({
        status: 409,
        code: 'NOT_PENDING_REVIEW',
      });
      expect(mockedRefRepo.requestDocsFromUser).not.toHaveBeenCalled();
    },
  );

  it('requests docs and notifies the user with the reason when identity status is "pending"', async () => {
    mockedUserRepo.findById.mockResolvedValue({ user_id: 1 } as any);
    mockedGetIdentityState.mockResolvedValue({ status: 'pending' } as any);
    mockedRefRepo.requestDocsFromUser.mockResolvedValue(2);

    const result = await requestDocsFromExternalReferee(1, 99, input);

    expect(mockedRefRepo.requestDocsFromUser).toHaveBeenCalledWith(1, 99, 'เอกสารไม่ชัด');
    expect(mockedNotify).toHaveBeenCalledWith({
      userId: 1,
      type: 'referee_external_decided',
      title: 'แอดมินขอเอกสารยืนยันตัวตนเพิ่ม',
      message: 'กรุณาส่งเอกสารยืนยันตัวตนใหม่ — เอกสารไม่ชัด',
    });
    expect(result).toEqual({
      userId: 1,
      identityStatus: 'needs_docs',
      reason: 'เอกสารไม่ชัด',
      tournamentsUpdated: 2,
    });
  });
});

describe('rejectExternalReferee', () => {
  const input = { reason: 'ปลอมเอกสาร' };

  it('throws USER_NOT_FOUND when the user does not exist', async () => {
    mockedUserRepo.findById.mockResolvedValue(null);

    await expect(rejectExternalReferee(1, 99, input)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedRefRepo.rejectUser).not.toHaveBeenCalled();
  });

  it.each(['none', 'rejected'] as const)(
    'throws NOT_PENDING_REVIEW when identity status is "%s"',
    async (status) => {
      mockedUserRepo.findById.mockResolvedValue({ user_id: 1 } as any);
      mockedGetIdentityState.mockResolvedValue({ status } as any);

      await expect(rejectExternalReferee(1, 99, input)).rejects.toMatchObject({
        status: 409,
        code: 'NOT_PENDING_REVIEW',
      });
      expect(mockedRefRepo.rejectUser).not.toHaveBeenCalled();
    },
  );

  it.each(['pending', 'needs_docs', 'approved'] as const)(
    'rejects the user and notifies them when identity status is "%s"',
    async (status) => {
      mockedUserRepo.findById.mockResolvedValue({ user_id: 1 } as any);
      mockedGetIdentityState.mockResolvedValue({ status } as any);
      mockedRefRepo.rejectUser.mockResolvedValue(4);

      const result = await rejectExternalReferee(1, 99, input);

      expect(mockedRefRepo.rejectUser).toHaveBeenCalledWith(1, 99, 'ปลอมเอกสาร');
      expect(mockedNotify).toHaveBeenCalledWith({
        userId: 1,
        type: 'referee_external_decided',
        title: 'ยืนยันตัวตนกรรมการไม่ผ่าน',
        message: 'แอดมินไม่อนุมัติตัวตนกรรมการของคุณ — เหตุผล: ปลอมเอกสาร',
      });
      expect(result).toEqual({
        userId: 1,
        identityStatus: 'rejected',
        reason: 'ปลอมเอกสาร',
        tournamentsUpdated: 4,
      });
    },
  );
});

/**
 * 🆕 ด่านใหม่ 6 ต.ค. 2569 (ทางเลือก ข) — ห้ามอนุมัติคนที่ยังไม่ส่งเอกสาร
 *
 * 🔴 ช่องที่ปิด: resolveApprovalForAccept ตั้งสถานะ `pending` ให้ตั้งแต่ตอน **กดรับคำเชิญ**
 *   แม้ไม่มีเอกสารแนบมาเลย ⇒ คนนั้นโผล่ในคิวแอดมินทันทีโดยมี docs: []
 *   แล้วด่านเดิมเช็คแค่สถานะ ⇒ แอดมินกด "อนุมัติ" ได้โดยไม่เคยเห็นเอกสารอะไร
 *   และผลนั้นใช้ได้ 1 ปี ก็อปไปทุกทัวร์ที่เขาจะเข้าต่อจากนั้น ⇒ ผลกระจายต่อเอง
 */
describe('approveExternalReferee — ต้องส่งเอกสารก่อน (DOCS_NOT_SUBMITTED)', () => {
  it.each(['pending', 'needs_docs'] as const)(
    'สถานะ %s แต่ยังไม่ส่งเอกสาร = 409 และไม่อนุมัติ ไม่แจ้งเตือน',
    async (status) => {
      mockedUserRepo.findById.mockResolvedValue({ user_id: 1 } as any);
      mockedGetIdentityState.mockResolvedValue({ status, docsSubmitted: false } as any);

      await expect(approveExternalReferee(1, 99)).rejects.toMatchObject({
        status: 409, code: 'DOCS_NOT_SUBMITTED',
      });
      expect(mockedRefRepo.approveUser).not.toHaveBeenCalled();
      expect(mockedNotify).not.toHaveBeenCalled();
    },
  );

  /**
   * ★ ด่านนี้ต้องมาหลังด่านสถานะ — คนที่ถูกปฏิเสธไปแล้ว (rejected) ก็ไม่มีเอกสารเหมือนกัน
   *   ถ้าสลับลำดับ เขาจะได้ DOCS_NOT_SUBMITTED ซึ่งบอกให้ "ส่งเอกสาร" ทั้งที่เรื่องจบไปแล้ว
   */
  it('คนที่ถูกปฏิเสธไปแล้ว ยังได้ NOT_PENDING_REVIEW ไม่ใช่ DOCS_NOT_SUBMITTED', async () => {
    mockedUserRepo.findById.mockResolvedValue({ user_id: 1 } as any);
    mockedGetIdentityState.mockResolvedValue({ status: 'rejected', docsSubmitted: false } as any);

    await expect(approveExternalReferee(1, 99)).rejects.toMatchObject({ code: 'NOT_PENDING_REVIEW' });
  });

  /** ★ ปฏิเสธ (AR03) ไม่ติดด่านนี้ — ไม่มีเอกสารก็ปฏิเสธได้ ไม่งั้นคนที่ไม่ยอมส่งจะค้างคิวตลอดไป */
  it('ปฏิเสธคนที่ยังไม่ส่งเอกสารได้ตามปกติ', async () => {
    mockedUserRepo.findById.mockResolvedValue({ user_id: 1 } as any);
    mockedGetIdentityState.mockResolvedValue({ status: 'pending', docsSubmitted: false } as any);
    mockedRefRepo.rejectUser.mockResolvedValue(1 as any);

    await expect(rejectExternalReferee(1, 99, { reason: 'ไม่ส่งเอกสารตามกำหนด' } as any))
      .resolves.toMatchObject({ identityStatus: 'rejected' });
  });
});

/**
 * ธง docsSubmitted ในคิวแอดมิน — แอดมินต้องแยกได้ว่า "ยังไม่ส่ง" กับ "ส่งแล้ว"
 * ★ ไม่ซ่อนคนที่ยังไม่ส่งออกจากคิว เพราะแอดมินต้องเห็นว่ามีใครค้างอยู่
 */
describe('listPendingExternalReferees — ธง docsSubmitted', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    tournament_referee_id: 1, user_id: 5, tournament_id: 100,
    external_verification_docs: null, created_at: new Date('2024-01-01T00:00:00Z'),
    full_name: 'สมชาย', profile_image_key: 'a.png', email: 'a@x.com', tournament_name: 'Tour A',
    ...over,
  }) as any;

  it('ยังไม่ส่งเอกสารเลย = false และยังอยู่ในคิว', async () => {
    mockedRefRepo.findPendingAdminReview.mockResolvedValue([row()]);
    mockedToUserRef.mockReturnValue({ id: 5, fullName: 'สมชาย', avatarUrl: 'a.png' });

    const result = await listPendingExternalReferees();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ docsSubmitted: false, docs: [] });
  });

  /** ★ ส่งแล้วแถวใดแถวหนึ่งก็ถือว่าส่งแล้ว — เอกสารเป็นของ "คน" ไม่ใช่ของทัวร์ */
  it('ส่งแล้วแถวใดแถวหนึ่ง = true', async () => {
    mockedRefRepo.findPendingAdminReview.mockResolvedValue([
      row(),
      row({ tournament_referee_id: 2, tournament_id: 200, external_verification_docs: ['doc.pdf'] }),
    ]);
    mockedToUserRef.mockReturnValue({ id: 5, fullName: 'สมชาย', avatarUrl: 'a.png' });

    const result = await listPendingExternalReferees();

    expect(result.items[0]).toMatchObject({ docsSubmitted: true, docs: ['doc.pdf'] });
  });
});
