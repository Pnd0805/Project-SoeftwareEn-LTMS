/**
 * src/api/match.ts — Person 3 (Match + Results + Standings)
 *
 * ตามแพตเทิร์นเดียวกับ api/auth.ts และ api/reference.ts เป๊ะ:
 * สลับ mock ↔ ของจริงข้างในฟังก์ชัน · component/hook ข้างนอกไม่รู้ว่าคุยกับใคร
 *
 * ── สถานะของ endpoint แต่ละตัว ────────────────────────────────────────────
 * [ยืนยันแล้ว] มีอ้างอิงตรงใน schema.sql:
 *   S01  POST /matches/:id/result          (schema.sql:403 — idempotent ผ่าน match_id UNIQUE)
 *   E12  PUT  /matches/:id/livestream      (schema.sql:365 — ⚠️ คอลัมน์ยังไม่มีใน DB)
 *
 * [ตั้งไว้ก่อน] ที่เหลือยังไม่เห็นใน GUIDE/06 (ไฟล์นั้นไม่มีในรีโป) — path/verb
 *   อนุมานจากตารางใน schema.sql + คอนเวนชันของ endpoint ที่ทำไปแล้ว (A01-A03, R01-R03)
 *   ทุกตัว mark ด้วย TODO(guide) — พอได้ GUIDE/06 มาให้ไล่แก้เฉพาะบรรทัด path
 *   **ตัวเรียกไม่ต้องแก้เลย** เพราะ signature ตั้งตาม use case ไม่ได้ตั้งตาม URL
 */
import { apiFetch, mockDelay, mockReject, USE_MOCK } from "./client";
import type {
  MatchDto,
  MatchListItemDto,
  MatchResultDto,
  MatchCheckinDto,
  PlayerMatchStatDto,
  TournamentStandingDto,
  UpdateMatchRequest,
  SubmitResultRequest,
  VerifyResultRequest,
  DisputeResultRequest,
  ResolveDisputeRequest,
  CheckinRequest,
  VerifyCheckinRequest,
  SaveMatchStatsRequest,
} from "../types/match.dto";
import {
  mockMatches,
  mockMyMatches,
  mockResults,
  mockCheckins,
  mockStats,
  mockStandings,
  mockPlayers,
  takeNextMockId,
} from "../mocks/match.mock";

const notFound = <T>(what: string): Promise<T> =>
  mockReject<T>(404, { code: "NOT_FOUND", message: `ไม่พบ${what}ที่ต้องการ` });

// ══════════════ Match ══════════════

/** TODO(guide): GET /tournaments/:id/matches */
export async function getTournamentMatches(tournamentId: number): Promise<{ items: MatchDto[] }> {
  if (USE_MOCK) {
    return mockDelay({ items: mockMatches.filter((m) => m.tournamentId === tournamentId) });
  }
  return apiFetch(`/tournaments/${tournamentId}/matches`);
}

/** TODO(guide): GET /matches/:id */
export async function getMatch(matchId: number): Promise<MatchDto> {
  if (USE_MOCK) {
    const m = mockMatches.find((x) => x.id === matchId);
    return m ? mockDelay(m) : notFound<MatchDto>("แมตช์");
  }
  return apiFetch(`/matches/${matchId}`);
}

/**
 * TODO(guide): GET /matches?assignedToMe=true
 * แมตช์ที่ "ฉัน" เกี่ยวข้อง ไม่ว่าจะในฐานะกรรมการ ผู้เล่น หรือผู้จัด
 * หน้า /matches (MatchesPage) ใช้ตัวนี้ตัวเดียว จึงคืน MatchListItemDto ที่
 * denormalize ชื่อทัวร์นาเมนต์ สกอร์ และยอดเช็คอินมาให้แล้ว — กัน N+1 ต่อแถว
 */
export async function getMyMatches(): Promise<{ items: MatchListItemDto[] }> {
  if (USE_MOCK) return mockDelay({ items: mockMyMatches });
  return apiFetch("/matches?assignedToMe=true");
}

/** TODO(guide): PATCH /matches/:id — จัดตาราง/สนาม/เวลาเปิดเช็คอิน (FixturePage) */
export async function updateMatch(matchId: number, input: UpdateMatchRequest): Promise<MatchDto> {
  if (USE_MOCK) {
    const m = mockMatches.find((x) => x.id === matchId);
    if (!m) return notFound<MatchDto>("แมตช์");
    Object.assign(m, input, { updatedAt: new Date().toISOString() });
    return mockDelay(m);
  }
  return apiFetch(`/matches/${matchId}`, { method: "PATCH", body: JSON.stringify(input) });
}

/**
 * E12 PUT /matches/:id/livestream — ยืนยันแล้วจาก schema.sql:365
 * ⚠️ แต่ `matches` ยังไม่มีคอลัมน์ livestream_url — เรียกจริงจะพังจนกว่า schema จะแก้
 */
export async function setLivestream(matchId: number, url: string | null): Promise<MatchDto> {
  if (USE_MOCK) {
    const m = mockMatches.find((x) => x.id === matchId);
    if (!m) return notFound<MatchDto>("แมตช์");
    m.livestreamUrl = url;
    return mockDelay(m);
  }
  return apiFetch(`/matches/${matchId}/livestream`, { method: "PUT", body: JSON.stringify({ url }) });
}

// ══════════════ Result ══════════════

/** TODO(guide): GET /matches/:id/result — ยังไม่มีผล = 404 ไม่ใช่ null */
export async function getResult(matchId: number): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const r = mockResults.find((x) => x.matchId === matchId);
    return r ? mockDelay(r) : notFound<MatchResultDto>("ผลการแข่งขัน");
  }
  return apiFetch(`/matches/${matchId}/result`);
}

/**
 * S01 POST /matches/:id/result — ยืนยันแล้วจาก schema.sql:403
 * **idempotent**: match_results.match_id เป็น UNIQUE → ส่งซ้ำ = UPDATE แถวเดิม
 * ไม่ต้องกันปุ่มกดซ้ำที่ฝั่ง UI ด้วย flag เอง กดซ้ำแล้วผลเหมือนเดิมโดยดีไซน์
 */
export async function submitResult(matchId: number, input: SubmitResultRequest): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const existing = mockResults.find((x) => x.matchId === matchId);
    if (existing) {
      Object.assign(existing, input, { status: "submitted" as const });
      return mockDelay(existing);
    }
    const created: MatchResultDto = {
      id: takeNextMockId(),
      matchId,
      winnerTeamId: input.winnerTeamId,
      scoreData: input.scoreData,
      submittedBy: mockPlayers[3],
      submittedRole: "referee",
      status: "submitted",
      disputeReason: null,
      disputeRaisedBy: null,
      disputeRaisedAt: null,
      disputeResolvedBy: null,
      disputeResolution: null,
      disputeResolvedAt: null,
      verifiedBy: null,
      verifiedAt: null,
      amendedBy: null,
      amendReason: null,
      amendedAt: null,
      createdAt: new Date().toISOString(),
    };
    mockResults.push(created);
    return mockDelay(created);
  }
  return apiFetch(`/matches/${matchId}/result`, { method: "POST", body: JSON.stringify(input) });
}

/** TODO(guide): POST /matches/:id/result/verify */
export async function verifyResult(matchId: number, input: VerifyResultRequest = {}): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const r = mockResults.find((x) => x.matchId === matchId);
    if (!r) return notFound<MatchResultDto>("ผลการแข่งขัน");
    r.status = "verified";
    r.verifiedBy = mockPlayers[3];
    r.verifiedAt = new Date().toISOString();
    return mockDelay(r);
  }
  return apiFetch(`/matches/${matchId}/result/verify`, { method: "POST", body: JSON.stringify(input) });
}

/**
 * TODO(guide): POST /matches/:id/result/dispute
 * กฎจาก schema.sql: พอ status เป็น 'disputed' backend ต้อง UPDATE
 * matches.match_status='disputed' ในทรานแซกชันเดียวกันเสมอ → invalidate ทั้ง 2 key
 */
export async function disputeResult(matchId: number, input: DisputeResultRequest): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const r = mockResults.find((x) => x.matchId === matchId);
    if (!r) return notFound<MatchResultDto>("ผลการแข่งขัน");
    r.status = "disputed";
    r.disputeReason = input.reason;
    r.disputeRaisedBy = mockPlayers[2];
    r.disputeRaisedAt = new Date().toISOString();
    const m = mockMatches.find((x) => x.id === matchId);
    if (m) m.status = "disputed";
    return mockDelay(r);
  }
  return apiFetch(`/matches/${matchId}/result/dispute`, { method: "POST", body: JSON.stringify(input) });
}

/** TODO(guide): POST /matches/:id/result/resolve — Organizer/Admin เท่านั้น */
export async function resolveDispute(matchId: number, input: ResolveDisputeRequest): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const r = mockResults.find((x) => x.matchId === matchId);
    if (!r) return notFound<MatchResultDto>("ผลการแข่งขัน");
    r.status = "verified";
    r.disputeResolution = input.resolution;
    r.disputeResolvedBy = mockPlayers[9];
    r.disputeResolvedAt = new Date().toISOString();
    if (input.winnerTeamId !== undefined) r.winnerTeamId = input.winnerTeamId;
    if (input.scoreData !== undefined) r.scoreData = input.scoreData;
    const m = mockMatches.find((x) => x.id === matchId);
    if (m) m.status = "completed";
    return mockDelay(r);
  }
  return apiFetch(`/matches/${matchId}/result/resolve`, { method: "POST", body: JSON.stringify(input) });
}

// ══════════════ Check-in ══════════════

/** TODO(guide): GET /matches/:id/checkins */
export async function getCheckins(matchId: number): Promise<{ items: MatchCheckinDto[] }> {
  if (USE_MOCK) {
    return mockDelay({ items: mockCheckins.filter((c) => c.matchId === matchId) });
  }
  return apiFetch(`/matches/${matchId}/checkins`);
}

/** TODO(guide): POST /matches/:id/checkin */
export async function checkin(matchId: number, input: CheckinRequest): Promise<MatchCheckinDto> {
  if (USE_MOCK) {
    const created: MatchCheckinDto = {
      id: takeNextMockId(),
      matchId,
      user: mockPlayers[input.userId ?? 1] ?? mockPlayers[1],
      method: input.method,
      status: input.method === "photo_online" ? "exception" : "success",
      rejectionReason: null,
      documentType: input.documentType ?? null,
      documentS3Key: input.documentS3Key ?? null,
      verifiedByReferee: null,
      checkedInAt: new Date().toISOString(),
      verifiedAt: null,
    };
    mockCheckins.push(created);
    return mockDelay(created);
  }
  return apiFetch(`/matches/${matchId}/checkin`, { method: "POST", body: JSON.stringify(input) });
}

/** TODO(guide): POST /matches/:id/checkins/:userId/verify — กรรมการตรวจรูปโหมด online */
export async function verifyCheckin(
  matchId: number,
  userId: number,
  input: VerifyCheckinRequest,
): Promise<MatchCheckinDto> {
  if (USE_MOCK) {
    const c = mockCheckins.find((x) => x.matchId === matchId && x.user.id === userId);
    if (!c) return notFound<MatchCheckinDto>("การเช็คอิน");
    c.status = input.status;
    c.rejectionReason = input.rejectionReason ?? null;
    c.verifiedByReferee = mockPlayers[3];
    c.verifiedAt = new Date().toISOString();
    return mockDelay(c);
  }
  return apiFetch(`/matches/${matchId}/checkins/${userId}/verify`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ══════════════ Player stats ══════════════

/** TODO(guide): GET /matches/:id/stats */
export async function getMatchStats(matchId: number): Promise<{ items: PlayerMatchStatDto[] }> {
  if (USE_MOCK) {
    return mockDelay({ items: mockStats.filter((s) => s.matchId === matchId) });
  }
  return apiFetch(`/matches/${matchId}/stats`);
}

/** TODO(guide): PUT /matches/:id/stats — บันทึกทั้งแมตช์ทีเดียว ไม่ใช่ทีละคน */
export async function saveMatchStats(
  matchId: number,
  input: SaveMatchStatsRequest,
): Promise<{ items: PlayerMatchStatDto[] }> {
  if (USE_MOCK) {
    input.entries.forEach((e) => {
      const existing = mockStats.find((s) => s.matchId === matchId && s.player.id === e.userId);
      if (existing) {
        existing.values = e.values;
        return;
      }
      mockStats.push({
        id: takeNextMockId(),
        matchId,
        player: mockPlayers[e.userId] ?? { id: e.userId, fullName: `ผู้เล่น ${e.userId}`, avatarUrl: null },
        teamId: e.teamId,
        recordedByReferee: mockPlayers[3],
        values: e.values,
        createdAt: new Date().toISOString(),
      });
    });
    return mockDelay({ items: mockStats.filter((s) => s.matchId === matchId) });
  }
  return apiFetch(`/matches/${matchId}/stats`, { method: "PUT", body: JSON.stringify(input) });
}

// ══════════════ Standings ══════════════

/** TODO(guide): GET /tournaments/:id/standings */
export async function getStandings(tournamentId: number): Promise<{ items: TournamentStandingDto[] }> {
  if (USE_MOCK) {
    return mockDelay({ items: mockStandings.filter((s) => s.tournamentId === tournamentId) });
  }
  return apiFetch(`/tournaments/${tournamentId}/standings`);
}
