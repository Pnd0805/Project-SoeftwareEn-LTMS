import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 30 ต.ค. 2569 — เอกสารประกอบคำขอทีม Official เปลี่ยนจาก "ข้อความ" เป็น "ไฟล์ที่อัปโหลดจริง"
 *
 * เดิม: หน้าเว็บส่งข้อความทีละบรรทัด แต่คิวแอดมิน (T16) เซ็นทุกบรรทัดเป็นลิงก์ไฟล์ ⇒ แอดมินเปิดไม่ได้ทุกใบ
 * ★ S3 ถูกบล็อกใน integration ⇒ จำลอง "ไฟล์ที่มีอยู่จริง" ด้วยชุด key · ตรวจรูป key ใช้ตัวจริง
 */
const stored = vi.hoisted(() => new Set<string>());
vi.mock('../../services/upload.service.js', async (orig) => {
  const real = await orig<typeof import('../../services/upload.service.js')>();
  const { AppError } = await import('../../utils/AppError.js');
  return {
    ...real,
    getPresignedDownloadUrl: vi.fn(async (k: string) => `signed:${k}`),
    // รูป key ตรวจด้วยตัวจริง · "มีไฟล์จริงไหม" ดูจากชุด stored แทน HEAD ที่เก็บไฟล์
    validateTeamOfficialDocumentKeys: vi.fn(async (keys: string[], teamId: number) => {
      const invalid = keys.filter(k => !real.isTeamOfficialDocumentKey(k, teamId));
      if (invalid.length) throw new AppError(422, 'TEAM_OFFICIAL_DOC_INVALID', 'x', { objectKeys: invalid });
      const missing = keys.find(k => !stored.has(k));
      if (missing) throw new AppError(422, 'TEAM_OFFICIAL_DOC_NOT_FOUND', 'x', { objectKey: missing });
    }),
  };
});

import { as } from './helpers/api.js';
import { all, insert } from './helpers/db.js';
import { createSportType, createTeam, createUser, makeAdmin, type TestUser } from './helpers/factories.js';

let leader: TestUser;
let uni: TestUser;
let team: number;
const fileKey = (t: number, n: number, ext = 'pdf') => `team_official_document/${t}/0000000${n}-0000-4000-8000-000000000000.${ext}`;
const rows = () => all<{ supporting_docs: string[] }>(
  "SELECT supporting_docs FROM team_admin_requests WHERE team_id = ? AND request_type = 'official_status'", [team]);

beforeEach(async () => {
  stored.clear();
  leader = await createUser();
  uni = await createUser();
  await makeAdmin(uni.id, 'university_wide');
  team = await createTeam({ leader: leader.id, sportTypeId: await createSportType() });
});

describe('T15 POST /teams/:id/official-request — ต้องเป็นไฟล์ของทีมนี้', () => {
  it('🔴 ส่งข้อความแบบเดิม → 422 TEAM_OFFICIAL_DOC_INVALID · ไม่มีคำขอในฐาน', async () => {
    const res = await as(leader).post(`/teams/${team}/official-request`).send({ supportingDocs: ['Club registration letter 2026'] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TEAM_OFFICIAL_DOC_INVALID');
    expect(await rows()).toHaveLength(0);
  });

  it('ไฟล์ของทีมอื่น → 422 TEAM_OFFICIAL_DOC_INVALID', async () => {
    stored.add(fileKey(team + 1, 1));
    const res = await as(leader).post(`/teams/${team}/official-request`).send({ supportingDocs: [fileKey(team + 1, 1)] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TEAM_OFFICIAL_DOC_INVALID');
  });

  it('รูป key ถูกแต่ไม่ได้อัปโหลดจริง → 422 TEAM_OFFICIAL_DOC_NOT_FOUND', async () => {
    const res = await as(leader).post(`/teams/${team}/official-request`).send({ supportingDocs: [fileKey(team, 1)] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TEAM_OFFICIAL_DOC_NOT_FOUND');
  });

  it('ไฟล์ที่อัปโหลดแล้ว (PDF + รูป) → 201 · เก็บ key ลงคำขอ', async () => {
    const docs = [fileKey(team, 1), fileKey(team, 2, 'png')];
    docs.forEach(k => stored.add(k));
    const res = await as(leader).post(`/teams/${team}/official-request`).send({ supportingDocs: docs });
    expect(res.status).toBe(201);
    expect((await rows())[0]!.supporting_docs).toEqual(docs);
  });
});

describe('T16 GET /admin/team-requests — แอดมินเปิดเอกสารได้', () => {
  it('ไฟล์ของทีม → ลิงก์ที่เซ็นแล้ว (ไม่ส่ง key ดิบ)', async () => {
    const doc = fileKey(team, 1);
    stored.add(doc);
    expect((await as(leader).post(`/teams/${team}/official-request`).send({ supportingDocs: [doc] })).status).toBe(201);

    const res = await as(uni).get('/admin/team-requests');
    expect(res.status).toBe(200);
    const item = (res.body.items as { team: { id: number }; supportingDocs: string[] }[]).find(i => i.team.id === team)!;
    expect(item.supportingDocs).toEqual([`signed:${doc}`]);
  });

  it('🔴 คำขอเก่าที่เป็นข้อความ/ลิงก์ภายนอก → ส่งเป็นข้อความตามเดิม (เดิมกลายเป็นลิงก์ไฟล์ที่ไม่มีจริง)', async () => {
    const legacy = ['Club registration letter 2026', 'https://drive.google.com/file/d/abc/view'];
    await insert('team_admin_requests', {
      team_id: team, request_type: 'official_status', requested_by: leader.id,
      team_admin_request_status: 'pending', supporting_docs: JSON.stringify(legacy),
    });

    const res = await as(uni).get('/admin/team-requests');
    const item = (res.body.items as { team: { id: number }; supportingDocs: string[] }[]).find(i => i.team.id === team)!;
    expect(item.supportingDocs).toEqual(legacy);
  });
});

describe('M16 POST /uploads/presign — PDF เปิดเฉพาะเอกสาร Official', () => {
  it.each(['avatar', 'referee_identity'])('🔴 %s + PDF → 400 UNSUPPORTED_FILE_TYPE', async (purpose) => {
    const res = await as(leader).post('/uploads/presign').send({ purpose, contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('team_logo + PDF → 400 UNSUPPORTED_FILE_TYPE', async () => {
    const res = await as(leader).post('/uploads/presign').send({ purpose: 'team_logo', contentType: 'application/pdf', teamId: team });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('team_official_document ไม่มี teamId → 400', async () => {
    const res = await as(leader).post('/uploads/presign').send({ purpose: 'team_official_document', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });
});
