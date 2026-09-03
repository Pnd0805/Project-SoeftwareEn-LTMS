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
  StandingsDto,
  UpdateMatchRequest,
  SubmitResultRequest,
  VerifyResultRequest,
  DisputeResultRequest,
  ResolveDisputeRequest,
  CheckinRequest,
  VerifyCheckinRequest,
  SaveMatchStatsRequest,
} from "../types/match.dto";
import type { StatDefinition } from "../types/dto";
import {
  findStoreMatch, findStoreStandings, findStoreTournamentMatches, numOf, storeState,
  toListItem, toMatchDto, toResultDto, type MatchRef,
} from "../mocks/storeBridge";
import {
  mockMatches,
  mockMyMatches,
  mockResults,
  mockCheckins,
  mockStats,
  mockStatDefinitions,
  mockPlayers,
  takeNextMockId,
} from "../mocks/match.mock";

const notFound = <T>(what: string): Promise<T> =>
  mockReject<T>(404, { code: "NOT_FOUND", message: `ไม่พบ${what}ที่ต้องการ` });

// ══════════════ Match ══════════════

/** TODO(guide): GET /tournaments/:id/matches */
export async function getTournamentMatches(tournamentId: MatchRef): Promise<{ items: MatchDto[] }> {
  if (USE_MOCK) {
    /* ref อาจเป็น id ของ store ("t-fut") หรือเลข — แปลงให้เป็นเลขก่อนเทียบ
       ไม่งั้น Number("t-fut") เป็น NaN แล้ว fixture ที่ผูกกับทัวร์นาเมนต์นั้นหายไป */
    const numeric = Number.isFinite(Number(tournamentId))
      ? Number(tournamentId)
      : numOf(String(tournamentId));
    const own = mockMatches.filter((m) => m.tournamentId === numeric);
    const s = storeState();
    const seeded = findStoreTournamentMatches(tournamentId).map((m) => toMatchDto(s, m));
    return mockDelay({ items: [...own, ...seeded] });
  }
  return apiFetch(`/tournaments/${tournamentId}/matches`);
}

/** TODO(guide): GET /matches/:id */
export async function getMatch(matchId: MatchRef): Promise<MatchDto> {
  if (USE_MOCK) {
    const m = mockMatches.find((x) => x.id === Number(matchId));
    if (m) return mockDelay(m);
    const sm = findStoreMatch(matchId);
    return sm ? mockDelay(toMatchDto(storeState(), sm)) : notFound<MatchDto>("แมตช์");
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
  if (USE_MOCK) {
    /* ชุดที่เขียนมือ + ทุกแมตช์ใน seed ที่เราเกี่ยวข้อง — คนที่สลับ role ในเดโม
       จะได้เห็นของตัวเองจริงๆ ไม่ใช่ fixture ตายตัวสี่นัด */
    const s = storeState();
    const seeded = s.matches
      .map((m) => toListItem(s, m))
      .filter((m) => m.viewer.roles.length);
    return mockDelay({ items: [...mockMyMatches, ...seeded] });
  }
  return apiFetch("/matches?assignedToMe=true");
}

/** TODO(guide): PATCH /matches/:id — จัดตาราง/สนาม/เวลาเปิดเช็คอิน (FixturePage) */
export async function updateMatch(matchId: MatchRef, input: UpdateMatchRequest): Promise<MatchDto> {
  if (USE_MOCK) {
    const m = mockMatches.find((x) => x.id === Number(matchId));
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
export async function setLivestream(matchId: MatchRef, url: string | null): Promise<MatchDto> {
  if (USE_MOCK) {
    const m = mockMatches.find((x) => x.id === Number(matchId));
    if (!m) return notFound<MatchDto>("แมตช์");
    m.livestreamUrl = url;
    return mockDelay(m);
  }
  return apiFetch(`/matches/${matchId}/livestream`, { method: "PUT", body: JSON.stringify({ url }) });
}

/**
 * TODO(guide): PUT /matches/:id/referees
 * มอบหมายกรรมการเข้าแมตช์ — เขียนทับทั้งชุด ไม่ใช่เพิ่มทีละคน
 * ตาราง match_referees มี UNIQUE(match_id, tournament_referee_id) อยู่แล้ว
 */
export async function assignReferees(matchId: MatchRef, refereeUserIds: number[]): Promise<MatchDto> {
  if (USE_MOCK) {
    const m = mockMatches.find((x) => x.id === Number(matchId));
    if (!m) return notFound<MatchDto>("แมตช์");
    m.referees = m.availableReferees.filter((r) => refereeUserIds.includes(r.id));
    return mockDelay(m);
  }
  return apiFetch(`/matches/${matchId}/referees`, {
    method: "PUT",
    body: JSON.stringify({ refereeUserIds }),
  });
}

// ══════════════ Result ══════════════

/** TODO(guide): GET /matches/:id/result — ยังไม่มีผล = 404 ไม่ใช่ null */
export async function getResult(matchId: MatchRef): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const r = mockResults.find((x) => x.matchId === Number(matchId));
    if (r) return mockDelay(r);
    const sm = findStoreMatch(matchId);
    const built = sm ? toResultDto(storeState(), sm) : null;
    return built ? mockDelay(built) : notFound<MatchResultDto>("ผลการแข่งขัน");
  }
  return apiFetch(`/matches/${matchId}/result`);
}

/**
 * S01 POST /matches/:id/result — ยืนยันแล้วจาก schema.sql:403
 * **idempotent**: match_results.match_id เป็น UNIQUE → ส่งซ้ำ = UPDATE แถวเดิม
 * ไม่ต้องกันปุ่มกดซ้ำที่ฝั่ง UI ด้วย flag เอง กดซ้ำแล้วผลเหมือนเดิมโดยดีไซน์
 */
export async function submitResult(matchId: MatchRef, input: SubmitResultRequest): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const existing = mockResults.find((x) => x.matchId === Number(matchId));
    if (existing) {
      Object.assign(existing, input, { status: "submitted" as const });
      return mockDelay(existing);
    }
    const created: MatchResultDto = {
      id: takeNextMockId(),
      matchId: Number(matchId),
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
export async function verifyResult(matchId: MatchRef, input: VerifyResultRequest = {}): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const r = mockResults.find((x) => x.matchId === Number(matchId));
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
export async function disputeResult(matchId: MatchRef, input: DisputeResultRequest): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const r = mockResults.find((x) => x.matchId === Number(matchId));
    if (!r) return notFound<MatchResultDto>("ผลการแข่งขัน");
    r.status = "disputed";
    r.disputeReason = input.reason;
    r.disputeRaisedBy = mockPlayers[2];
    r.disputeRaisedAt = new Date().toISOString();
    const m = mockMatches.find((x) => x.id === Number(matchId));
    if (m) m.status = "disputed";
    return mockDelay(r);
  }
  return apiFetch(`/matches/${matchId}/result/dispute`, { method: "POST", body: JSON.stringify(input) });
}

/** TODO(guide): POST /matches/:id/result/resolve — Organizer/Admin เท่านั้น */
export async function resolveDispute(matchId: MatchRef, input: ResolveDisputeRequest): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const r = mockResults.find((x) => x.matchId === Number(matchId));
    if (!r) return notFound<MatchResultDto>("ผลการแข่งขัน");
    r.status = "verified";
    r.disputeResolution = input.resolution;
    r.disputeResolvedBy = mockPlayers[9];
    r.disputeResolvedAt = new Date().toISOString();
    if (input.winnerTeamId !== undefined) r.winnerTeamId = input.winnerTeamId;
    if (input.scoreData !== undefined) r.scoreData = input.scoreData;
    const m = mockMatches.find((x) => x.id === Number(matchId));
    if (m) m.status = "completed";
    return mockDelay(r);
  }
  return apiFetch(`/matches/${matchId}/result/resolve`, { method: "POST", body: JSON.stringify(input) });
}

// ══════════════ Check-in ══════════════

/** TODO(guide): GET /matches/:id/checkins */
export async function getCheckins(matchId: MatchRef): Promise<{ items: MatchCheckinDto[] }> {
  if (USE_MOCK) {
    return mockDelay({ items: mockCheckins.filter((c) => c.matchId === Number(matchId)) });
  }
  return apiFetch(`/matches/${matchId}/checkins`);
}

/** TODO(guide): POST /matches/:id/checkin */
export async function checkin(matchId: MatchRef, input: CheckinRequest): Promise<MatchCheckinDto> {
  if (USE_MOCK) {
    const created: MatchCheckinDto = {
      id: takeNextMockId(),
      matchId: Number(matchId),
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
  matchId: MatchRef,
  userId: number,
  input: VerifyCheckinRequest,
): Promise<MatchCheckinDto> {
  if (USE_MOCK) {
    const c = mockCheckins.find((x) => x.matchId === Number(matchId) && x.user.id === userId);
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
export async function getMatchStats(matchId: MatchRef): Promise<{ items: PlayerMatchStatDto[] }> {
  if (USE_MOCK) {
    return mockDelay({ items: mockStats.filter((s) => s.matchId === Number(matchId)) });
  }
  return apiFetch(`/matches/${matchId}/stats`);
}

/** TODO(guide): PUT /matches/:id/stats — บันทึกทั้งแมตช์ทีเดียว ไม่ใช่ทีละคน */
export async function saveMatchStats(
  matchId: MatchRef,
  input: SaveMatchStatsRequest,
): Promise<{ items: PlayerMatchStatDto[] }> {
  if (USE_MOCK) {
    input.entries.forEach((e) => {
      const existing = mockStats.find((s) => s.matchId === Number(matchId) && s.player.id === e.userId);
      if (existing) {
        existing.values = e.values;
        return;
      }
      mockStats.push({
        id: takeNextMockId(),
        matchId: Number(matchId),
        player: mockPlayers[e.userId] ?? { id: e.userId, fullName: `ผู้เล่น ${e.userId}`, avatarUrl: null },
        teamId: e.teamId,
        recordedByReferee: mockPlayers[3],
        values: e.values,
        createdAt: new Date().toISOString(),
      });
    });
    return mockDelay({ items: mockStats.filter((s) => s.matchId === Number(matchId)) });
  }
  return apiFetch(`/matches/${matchId}/stats`, { method: "PUT", body: JSON.stringify(input) });
}

/**
 * TODO(guide): GET /sport-types/:id/stat-definitions
 * "กีฬานี้เก็บสถิติอะไรบ้าง" — ตาราง sport_stat_definitions เป็นของสไลซ์ 3
 * แทนที่ statLabels()/statExtra() ใน rules.ts ที่ hardcode ตามชื่อกีฬา
 */
export async function getStatDefinitions(sportTypeId: number): Promise<{ items: StatDefinition[] }> {
  if (USE_MOCK) {
    return mockDelay({ items: mockStatDefinitions[sportTypeId] ?? mockStatDefinitions[0] });
  }
  return apiFetch(`/sport-types/${sportTypeId}/stat-definitions`);
}

// ══════════════ Standings ══════════════

/** TODO(guide): GET /tournaments/:id/standings */
export async function getStandings(tournamentId: MatchRef): Promise<StandingsDto | null> {
  if (USE_MOCK) return mockDelay(findStoreStandings(tournamentId));
  return apiFetch(`/tournaments/${tournamentId}/standings`);
}
