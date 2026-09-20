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
import { ApiError, apiFetch, mockDelay, mockReject, USE_MOCK } from "./client";
import type {
  MatchDto,
  MatchListItemDto,
  MatchTeamRef,
  PlayerRef,
  BackendTeamRef,
  BackendCheckinRequest,
  BackendManualCheckinDto,
  BackendRefereeMatchDto,
  BackendManualCheckinRequest,
  BackendMyCheckinDto,
  MatchResultDto,
  MatchCheckinDto,
  PlayerMatchStatDto,
  StandingsDto,
  StandingsFormat,
  UpdateMatchRequest,
  SubmitResultRequest,
  VerifyResultRequest,
  DisputeResultRequest,
  ResolveDisputeRequest,
  CheckinRequest,
  VerifyCheckinRequest,
  SaveMatchStatsRequest,
  BackendBracketDto,
  BackendCheckinDto,
  BackendCheckinQrDto,
  BackendMatchDetailDto,
  BackendMatchListItemDto,
  BackendMatchRefereeDto,
  BackendPaged,
  BackendPlayerStatDto,
  BackendForfeitResultDto,
  BackendResultDto,
  BackendStandingDto,
  BackendSubmittedCheckinDto,
  BackendSubmittedResultDto,
  BackendTournamentDashboardDto,
  BackendTournamentWinnerDto,
  BackendVerifiedResultDto,
  CreateBracketRequest,
  RecordMatchStatsRequest,
  ScheduleMatchRequest,
} from "../types/match.dto";
import type { StatDefinition } from "../types/dto";
import type { Mode } from "../types/enums";
import { getSportTypes } from "./reference";
import {
  findStoreMatch, findStoreStandings, findStoreTournamentMatches, numOf,
  storeCheckinDtos, storeState, storeStatDefinitions, storeStatDtos, toListItem, toMatchDto,
  toResultDto,
  type MatchRef,
} from "../mocks/storeBridge";
import {
  buildMockMyMatches,
  mockMatches,
  mockResults,
  mockCheckins,
  mockStats,
  mockStatDefinitions,
  mockPlayers,
  takeNextMockId,
} from "../mocks/match.mock";
import {
  storeSquadHas, whyResultBlocked, writeApproveCheckin, writeCheckin, writeDispute, writeLivestream,
  writeMatchReferees, writeRejectCheckin,
  writeResolve, writeResult, writeSchedule, writeStats, writeVerify,
} from "../mocks/matchWrites";

/**
 * สร้าง DTO กลับจาก store หลังเขียนเสร็จ — ผู้เรียกได้ของที่ตรงกับสิ่งที่เพิ่งบันทึก
 * ไม่ใช่ของที่ค้างอยู่ในอาร์เรย์เขียนมือ
 */
const storeMatchDto = (ref: MatchRef): MatchDto | null => {
  const sm = findStoreMatch(ref);
  return sm ? toMatchDto(storeState(), sm) : null;
};
/** scoreData เป็น Record<string, unknown> ตามสัญญา — คลี่ให้เป็นตัวเลขก่อนเขียน store */
const asScore = (d: Record<string, unknown> | null | undefined) => {
  if (!d) return undefined;
  const dec = d.decider as Record<string, unknown> | undefined;
  return {
    a: typeof d.a === "number" ? d.a : null,
    b: typeof d.b === "number" ? d.b : null,
    decider: dec && typeof dec.a === "number" && typeof dec.b === "number"
      ? { a: dec.a, b: dec.b, kind: String(dec.kind ?? "Decider") }
      : null,
  };
};

/**
 * ปฏิเสธเพราะสถานะของแมตช์ ไม่ใช่เพราะหาไม่เจอ
 *
 * ทางเขียนของ store คืน false ได้สองความหมาย — "ไม่ใช่แมตช์ของ seed" กับ
 * "เป็นแมตช์ของ seed แต่สถานะไม่ให้ทำ" ถ้าไม่แยก ตัวที่ถูกกฎปฏิเสธจะไหลไปเข้า
 * ทาง fixture ที่เขียนมือแล้วสำเร็จเงียบๆ ซึ่งเท่ากับไม่มีด่านเลย
 */
const blocked = <T>(why: string): Promise<T> =>
  mockReject<T>(409, { code: "MATCH_STATE", message: why });

const storeResultDto = (ref: MatchRef): MatchResultDto | null => {
  const sm = findStoreMatch(ref);
  return sm ? toResultDto(storeState(), sm) : null;
};

const notFound = <T>(what: string): Promise<T> =>
  mockReject<T>(404, { code: "NOT_FOUND", message: `ไม่พบ${what}ที่ต้องการ` });

/**
 * backend ยังไม่มี endpoint นี้ — ตอบ 501 ทันทีแทนการยิงไปเส้นทางที่ไม่มีอยู่
 * (แพตเทิร์นเดียวกับ api/admin.ts · รายการทั้งหมดอยู่ใน FEAT-1-REMAINING)
 */
const unavailable = <T>(what: string): Promise<T> =>
  Promise.reject(new ApiError(501, { code: "ENDPOINT_UNAVAILABLE", message: `${what} ยังไม่มีใน backend` }));

/**
 * ทำให้เป็นเวลาจริงหนึ่งจุดก่อนส่ง
 *
 * เดิมจำเป็นเพราะ PATCH /matches/:id/schedule รับเฉพาะรูปแบบ Z ขณะที่ POST /tournaments
 * ต้องมี offset — A4 (`c9773ca`) แก้ให้รับทั้งสองแบบแล้ว ที่เหลือไว้คือการแปลงค่าจากช่อง
 * `datetime-local` (ไม่มีโซนเวลาติดมา) ให้เป็นเวลาจริง ซึ่งยังต้องทำอยู่
 */
const toZulu = (value: string): string => new Date(value).toISOString();

/**
 * แปลงแมตช์จากรูปของ backend เป็นรูปที่หน้าจอใช้
 *
 * DTO ของ prototype รวยกว่าที่ backend มีจริงมาก (viewer.can, ชื่อรอบ, สกอร์,
 * ยอดเช็คอิน, รายชื่อกรรมการ) — ถ้าปล่อยของดิบไป หน้าจอจะอ่าน `m.viewer.can`
 * แล้วพังทั้งหน้า (จอดับ) ตรงนี้จึงเติมค่าที่ปลอดภัยให้ครบทุกช่อง
 * และตั้งสิทธิ์ทุกอย่างเป็น false เพราะ backend ยังไม่ได้บอกว่าคนดูทำอะไรได้บ้าง
 */
const teamFromBackend = (t: BackendTeamRef | null): MatchTeamRef | null =>
  t ? { id: t.id, name: t.name, code: t.name.slice(0, 3).toUpperCase(), color: null, logoUrl: null, players: [] } : null;

const roundLabel = (round: number | null) => (round === null ? "" : `Round ${round}`);

function matchFromBackend(m: BackendMatchListItemDto & Partial<BackendMatchDetailDto>): MatchListItemDto {
  const sportTypeId = m.teamA?.sportTypeId ?? m.teamB?.sportTypeId ?? 0;
  return {
    id: m.id,
    tournamentId: m.tournamentId ?? 0,
    bracketNodeId: null,
    nextMatchId: m.nextMatchId ?? null,
    loserNextMatchId: m.loserNextMatchId ?? null,
    roundNumber: m.round,
    teamA: teamFromBackend(m.teamA),
    teamB: teamFromBackend(m.teamB),
    scheduledTime: m.scheduledTime,
    venue: m.venue,
    checkinOpenAt: m.checkinOpenAt ?? null,
    status: m.status,
    mode: m.mode ?? "onsite",
    createdAt: m.scheduledTime ?? new Date().toISOString(),
    updatedAt: null,
    livestreamUrl: null,
    tournament: { id: m.tournamentId ?? 0, name: "", championTeamId: null, sportTypeId, sportName: "" },
    stage: roundLabel(m.round),
    tag: roundLabel(m.round),
    referees: [],
    availableReferees: [],
    roomCode: null,
    checkinToken: null,
    replayUrl: null,
    checkedIn: 0,
    lineupSize: 0,
    viewer: {
      roles: [],
      myUserId: null,
      myTeamId: null,
      isTeamLeader: false,
      can: {
        submitResult: false, verifyResult: false, disputeResult: false, resolveDispute: false,
        editFixture: false, recordStats: false, manageCheckin: false, verifyCheckin: false,
      },
    },
    score: scoreFor(m.teamA, m.teamB, m.score),
    /* B5: ใช้สถานะใบผลจริงที่ backend ส่งมา ไม่ต้องเดาจาก match_status อีก
       แมตช์ที่จบโดยไม่มีใบผลเลย (แพ้ทั้งคู่ / แมตช์ตาย) ได้ null แล้วไปบอกผ่าน outcome แทน */
    resultStatus: m.resultStatus ?? null,
    outcome: m.outcome ?? null,
  };
}


/**
 * "แมตช์ของฉัน" — backend ไม่มีเส้นนี้ (ไม่มี GET /matches) จึงประกอบเอาเองจากของที่มี
 *
 *   ผู้เล่น   → GET /me/teams + GET /me/applications  (ทีมเราลงรายการไหนบ้าง)
 *   ผู้จัด    → GET /me/tournament-requests           (รายการที่เราขอจัดและผ่านแล้ว)
 *   กรรมการ  → GET /matches/:id/referees               (ต้องไล่ถามรายแมตช์)
 *
 * ⚠️ ข้อจำกัดที่ต้องรู้: GET /me/referee-invitations คืนเฉพาะคำเชิญที่ "ยังไม่ตอบ"
 *    พอกรรมการกดรับแล้วคำเชิญหายไป ไม่มีเส้นไหนบอกได้ว่าเราเป็นกรรมการของรายการใดบ้าง
 *    ตรงนี้จึงต้องกวาดจากรายการที่ publish แล้วมาไล่เช็ครายแมตช์ ซึ่งเปลืองคำขอ
 *    (จำกัดจำนวนไว้ด้วยค่าคงที่ข้างล่าง) — ควรขอให้ backend เพิ่ม GET /me/matches
 */
const MAX_TOURNAMENTS = 12;
const MAX_CHECKIN_PROBES = 8;

type MyMatchSource = {
  tournamentId: number;
  tournamentName: string;
  sportTypeId: number;
  match: BackendMatchListItemDto;
};

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

/** สกอร์ของ backend เป็น map `teamId → แต้ม` ทั้ง M04/M05 และ S05 — แถวหน้าจอคิดเป็นฝั่ง a/b */
function scoreFor(
  teamA: { id: number } | null,
  teamB: { id: number } | null,
  scoreData: Record<string, number> | null | undefined,
): { a: number | null; b: number | null } | null {
  if (!scoreData) return null;
  return {
    a: teamA ? scoreData[String(teamA.id)] ?? null : null,
    b: teamB ? scoreData[String(teamB.id)] ?? null : null,
  };
}

/**
 * โหมดของแมตช์ตามชนิดกีฬา
 *
 * M04 ไม่ส่ง `mode` มากับแถว ของเดิมจึงเขียน `?? "onsite"` ทิ้งไว้ ทำให้แมตช์ออนไลน์
 * ทุกนัดในทุกรายการกลายเป็น on-site — คิวของกรรมการเข้าถังผิด: นัดออนไลน์ที่มีผลรอ
 * ยืนยันตกไปอยู่ "Waiting on the squads" และนัดที่ยังไม่มีผลถูกสั่งให้กรรมการกรอกสกอร์
 * ทั้งที่โหมดออนไลน์หัวหน้าทีมที่ชนะเป็นคนกรอกก่อน
 *
 * ไม่ใช่การเดา: backend ตั้ง `matches.mode` จาก `sport_types.default_mode` ตอนสร้างสาย
 * (`bracket.service.ts`) และตัวแก้โหมดรายแมตช์ (M08) ยังไม่มี ค่าของกีฬาจึงเป็นค่าจริง
 * ของทุกแมตช์ในตอนนี้ · ถือ map ไว้ทั้งเซสชัน ตารางกีฬาไม่เปลี่ยนระหว่างใช้งาน
 */
let sportModes: Promise<Map<number, Mode>> | null = null;

function sportModeMap(): Promise<Map<number, Mode>> {
  if (!sportModes) {
    sportModes = getSportTypes()
      .then((r) => new Map(r.items.map((sport) => [sport.id, sport.defaultMode] as const)))
      .catch(() => new Map<number, Mode>());
  }
  return sportModes;
}

/** เติมโหมดให้แถวที่มาจาก M04 — แถวจาก M05 มี `mode` จริงมาแล้ว อย่าเรียกทับ */
async function fillModes(items: MatchListItemDto[]): Promise<void> {
  if (!items.length) return;
  const modes = await sportModeMap();
  items.forEach((m) => {
    const mode = modes.get(m.tournament.sportTypeId);
    if (mode) m.mode = mode;
  });
}

/** ใบผลที่ยังไม่ถือว่าจบ — backend ไม่แนบสกอร์มากับแถวแมตช์ให้ ต้องถามเป็นรายนัด */
const UNSETTLED_RESULT = new Set<string>(["submitted", "disputed", "rejected"]);

/**
 * เติมสกอร์ของใบผลที่ยังไม่ยืนยัน
 *
 * ตั้งแต่ B5 (`7d25994`) M04/M05 แนบ `score` มาให้เองสำหรับผลที่ verified/walkover
 * แมตช์ส่วนใหญ่จึงไม่ต้องยิงอะไรต่ออีกแล้ว เหลือเฉพาะใบผลที่ยังไม่ยืนยัน ซึ่ง backend
 * กันไว้ให้เฉพาะคนเกี่ยวข้องอ่านผ่าน S05 (A7) — ไม่มีสิทธิ์ก็ได้ 404 แล้วคงขีดกลางไว้
 * ยังจำกัดจำนวนไว้กันยิงรัวเวลารายการใหญ่
 */
async function fillScores(items: MatchListItemDto[], limit = 32): Promise<void> {
  const unsettled = items
    .filter((m) => m.score === null && UNSETTLED_RESULT.has(m.resultStatus ?? ""))
    .slice(0, limit);
  await Promise.all(unsettled.map(async (m) => {
    const result = await apiFetch<BackendResultDto>(`/matches/${m.id}/result`).catch(() => null);
    const score = scoreFor(m.teamA, m.teamB, result?.scoreData);
    if (score) m.score = score;
  }));
}

export async function composeMyMatches(): Promise<{ items: MatchListItemDto[] }> {
  const me = await apiFetch<{ id: number }>("/me");

  const [teams, applications, requests, publicTournaments, refereeMatches] = await Promise.all([
    safe(apiFetch<{ items: Array<{ id: number; role: string; sportTypeId: number }> }>("/me/teams"), { items: [] }),
    safe(apiFetch<{ items: Array<{ tournament: { id: number; name: string }; team: { id: number }; status: string }> }>("/me/applications"), { items: [] }),
    safe(apiFetch<{ items: Array<{ id: number; name: string; status: string }> }>("/me/tournament-requests"), { items: [] }),
    safe(apiFetch<{ items: Array<{ id: number; name: string }> }>("/tournaments"), { items: [] }),
    /* B7 (`c43f497`): กรรมการอ่านแมตช์ของตัวเองได้ตรงๆ แล้ว */
    safe(apiFetch<{ items: BackendRefereeMatchDto[] }>("/me/referee-matches"), { items: [] }),
  ]);

  /* กรรมการรับเชิญทัวร์ไหนก็ได้ ไม่จำเป็นต้องลงแข่งหรือเป็นผู้จัดของทัวร์นั้น — เดิมต้อง
     เดาชุดทัวร์ที่เราน่าจะเกี่ยวข้องแล้วไล่ถาม /matches/:id/referees ทีละนัด จึงพลาด
     แมตช์ที่เราถูกมอบหมายในทัวร์ที่ไม่เกี่ยวกับเราด้านอื่นเสมอ */
  const refereeMatchIds = new Set(refereeMatches.items.map((m) => m.id));

  const myTeamIds = new Set(teams.items.map((t) => t.id));
  const myLedTeamIds = new Set(teams.items.filter((t) => t.role === "leader").map((t) => t.id));
  const organizedIds = new Set(
    requests.items
      .filter((r) => r.status !== "pending_approval" && r.status !== "rejected")
      .map((r) => r.id),
  );

  /* ชื่อรายการ — เก็บจากทุกแหล่งที่ผ่านมา หน้าจอโชว์ชื่อ ไม่ใช่เลข */
  const names = new Map<number, string>();
  applications.items.forEach((a) => names.set(a.tournament.id, a.tournament.name));
  requests.items.forEach((r) => names.set(r.id, r.name));
  publicTournaments.items.forEach((t) => names.set(t.id, t.name));
  refereeMatches.items.forEach((m) => names.set(m.tournament.id, m.tournament.name));

  /* รายการที่ต้องไปดูแมตช์: ของเราแน่ๆ ก่อน แล้วค่อยเติมรายการสาธารณะไว้หากรรมการ */
  const mine = new Set<number>([
    ...applications.items
      .filter((a) => a.status !== "cancelled" && a.status !== "withdrawn")
      .map((a) => a.tournament.id),
    ...organizedIds,
    /* ทัวร์ที่เราเป็นกรรมการ ดึงรายการแมตช์มาด้วย จะได้ผลสรุปแบบ M04 (สกอร์/สถานะผล)
       ซึ่ง B7 ไม่ได้แนบมากับแถวของมันเอง */
    ...refereeMatches.items.map((m) => m.tournament.id),
  ]);
  const candidates = [...mine, ...publicTournaments.items.map((t) => t.id).filter((id) => !mine.has(id))]
    .slice(0, MAX_TOURNAMENTS);

  const pages = await Promise.all(
    candidates.map((id) =>
      safe(apiFetch<BackendPaged<BackendMatchListItemDto>>(`/tournaments/${id}/matches`), {
        items: [],
        pagination: { page: 1, pageSize: 0, totalItems: 0, totalPages: 0 },
      }).then((page) => ({ id, page })),
    ),
  );

  const sources: MyMatchSource[] = [];
  pages.forEach(({ id, page }) => {
    page.items.forEach((match) =>
      sources.push({
        tournamentId: id,
        tournamentName: names.get(id) ?? "",
        sportTypeId: match.teamA?.sportTypeId ?? match.teamB?.sportTypeId ?? 0,
        match,
      }),
    );
  });

  /* ทัวร์ที่ถูกตัดออกเพราะเกิน MAX_TOURNAMENTS — ใช้แถวจาก B7 แทน ดีกว่าปล่อยให้แมตช์
     ที่เรารับเป็นกรรมการหายไปจากคิว (แถวนั้นไม่มีสกอร์กับสถานะผล ก็ขึ้นเป็นขีดกลางไป) */
  const known = new Set(sources.map((src) => src.match.id));
  refereeMatches.items
    .filter((m) => !known.has(m.id))
    .forEach((m) => {
      const teamRef = (t: { id: number; name: string } | null) =>
        t ? { ...t, sportTypeId: m.tournament.sportTypeId } : null;
      sources.push({
        tournamentId: m.tournament.id,
        tournamentName: m.tournament.name,
        sportTypeId: m.tournament.sportTypeId,
        match: {
          id: m.id,
          round: m.round,
          teamA: teamRef(m.teamA),
          teamB: teamRef(m.teamB),
          scheduledTime: m.scheduledTime,
          scheduledEndTime: m.scheduledEndTime,
          venue: m.venue,
          status: m.status,
          nextMatchId: null,
          loserNextMatchId: null,
          resultStatus: null,
          score: null,
          outcome: null,
        },
      });
    });

  const roleOf = (src: MyMatchSource) => {
    const roles: MatchListItemDto["viewer"]["roles"] = [];
    const teamIds = [src.match.teamA?.id, src.match.teamB?.id];
    if (teamIds.some((id) => id !== undefined && myTeamIds.has(id))) roles.push("player");
    if (organizedIds.has(src.tournamentId)) roles.push("organizer");
    return roles;
  };

  const items: MatchListItemDto[] = [];
  sources.forEach((src) => {
    const roles = roleOf(src);
    if (refereeMatchIds.has(src.match.id)) roles.push("referee");
    if (!roles.length) return;

    const dto = matchFromBackend({ ...src.match, tournamentId: src.tournamentId });
    dto.tournament = {
      id: src.tournamentId,
      name: src.tournamentName,
      championTeamId: null,
      sportTypeId: src.sportTypeId,
      sportName: "",
    };
    const myTeamId = [src.match.teamA?.id, src.match.teamB?.id]
      .find((id) => id !== undefined && myTeamIds.has(id)) ?? null;
    dto.viewer = {
      ...dto.viewer,
      roles,
      myUserId: me.id,
      myTeamId,
      isTeamLeader: myTeamId !== null && myLedTeamIds.has(myTeamId),
    };
    items.push(dto);
  });

  /* ยอดเช็คอิน — ดึงเฉพาะแมตช์ที่กำลังจะแข่งหรือแข่งอยู่ ไม่งั้นยิงเยอะเกินจำเป็น
     และเฉพาะคนที่อ่านได้จริง: GET /matches/:id/checkins เปิดให้ผู้จัดกับกรรมการเท่านั้น
     เดิมยิงให้ทุกคน ผู้เล่นจึงเก็บ 403 ครบทุกนัดทุกครั้งที่เปิดหน้า โดยไม่ได้อะไรกลับมา */
  const live = items
    .filter((m) =>
      (m.status === "checkin_open" || m.status === "in_progress") &&
      (m.viewer.roles.includes("organizer") || m.viewer.roles.includes("referee")))
    .slice(0, MAX_CHECKIN_PROBES);
  await Promise.all(
    live.map(async (m) => {
      const checkins = await safe(
        apiFetch<{ items: BackendCheckinDto[] }>(`/matches/${m.id}/checkins`),
        { items: [] },
      );
      m.checkedIn = checkins.items.filter((c) => c.status === "checked_in").length;
      m.lineupSize = checkins.items.length;
    }),
  );

  await Promise.all([fillScores(items), fillModes(items)]);

  items.sort((a, b) => {
    if (!a.scheduledTime) return 1;
    if (!b.scheduledTime) return -1;
    return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
  });
  return { items };
}

/**
 * อัปโหลดรูปบัตรของการเช็คอิน — presign (M16) แล้ว PUT ขึ้น MinIO ตรงๆ
 * backend รับเฉพาะ image/jpeg กับ image/png และคืน objectKey มาให้ใช้ต่อ
 */
async function uploadCheckinPhoto(matchId: number, dataUrl: string): Promise<string> {
  const contentType = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
  const presign = await apiFetch<{ uploadUrl: string; objectKey: string }>("/uploads/presign", {
    method: "POST",
    body: JSON.stringify({
      purpose: "checkin_document",
      contentType: contentType === "image/png" ? "image/png" : "image/jpeg",
      matchId,
    }),
  });
  const blob = await (await fetch(dataUrl)).blob();
  const put = await fetch(presign.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
  if (!put.ok) {
    throw new ApiError(put.status, { code: "UPLOAD_FAILED", message: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่" });
  }
  return presign.objectKey;
}

/** สถานะเช็คอินของ backend ↔ ของหน้าจอ (prototype ใช้ exception = "รอกรรมการดู") */
const checkinStatusFromBackend = (status: BackendCheckinDto["status"]): MatchCheckinDto["status"] =>
  status === "checked_in" ? "success" : status === "rejected" ? "rejected" : "exception";

function checkinFromBackend(matchId: number, row: BackendCheckinDto): MatchCheckinDto {
  return {
    id: row.id,
    matchId,
    user: { id: row.userId, fullName: row.fullName, avatarUrl: null },
    method: row.method,
    status: checkinStatusFromBackend(row.status),
    rejectionReason: null,
    note: row.note,
    documentType: row.documentType,
    /* backend ส่ง presigned URL มาให้เลย (เฉพาะกรรมการของแมตช์) — หน้าจอเอาไปแสดงรูปได้ตรงๆ */
    documentS3Key: row.documentUrl,
    verifiedByReferee: null,
    checkedInAt: row.checkedInAt,
    verifiedAt: null,
  };
}

/** รายชื่อผู้เล่นของทีม — match DTO ของ backend ไม่มีมาให้ ต้องขอจากทีมเอง */
async function rosterOf(teamId: number | undefined): Promise<PlayerRef[]> {
  if (teamId === undefined) return [];
  try {
    const members = await apiFetch<{ items: Array<{ userId: number; fullName: string; avatarUrl: string | null }> }>(
      `/teams/${teamId}/members`,
    );
    return members.items.map((m) => ({ id: m.userId, fullName: m.fullName, avatarUrl: m.avatarUrl }));
  } catch {
    return [];
  }
}

// ══════════════ Match ══════════════

/** TODO(guide): GET /tournaments/:id/matches */
/** คืน MatchListItemDto (มีสกอร์กับสถานะผล) — เป็น superset ของ MatchDto ที่ผู้เรียกเดิมใช้ */
export async function getTournamentMatches(tournamentId: MatchRef): Promise<{ items: MatchListItemDto[] }> {
  if (USE_MOCK) {
    /* ref อาจเป็น id ของ store ("t-fut") หรือเลข — แปลงให้เป็นเลขก่อนเทียบ
       ไม่งั้น Number("t-fut") เป็น NaN แล้ว fixture ที่ผูกกับทัวร์นาเมนต์นั้นหายไป */
    const numeric = Number.isFinite(Number(tournamentId))
      ? Number(tournamentId)
      : numOf(String(tournamentId));
    /* buildMockMyMatches() แนบสกอร์จาก mockResults มาให้แล้ว — ใช้ mockMatches ตรงๆ
       ไม่ได้ เพราะมันไม่มีสกอร์ สายการแข่งเลยขึ้นขีดกลางทั้งที่แข่งจบไปแล้ว */
    const own = buildMockMyMatches().filter((m) => m.tournamentId === numeric);
    const s = storeState();
    /* แนบสกอร์กับสถานะผลมาด้วย (MatchListItemDto เป็น superset ของ MatchDto) — แดชบอร์ด
       ต้องแยก "รอยืนยันผล" ออกจาก "ยังไม่แข่ง" ซึ่ง MatchDto ของ store ยุบเป็น scheduled ทั้งคู่ */
    const seeded = findStoreTournamentMatches(tournamentId).map((m) => toListItem(s, m));
    return mockDelay({ items: [...own, ...seeded] });
  }
  /* B5: แถวแมตช์บอก next_match_id/loser_next_match_id เองแล้ว — เลิกดึงผังสาย (M02)
     มาซ้อนเพื่อไล่หา advancesToNodeId เส้นโยงในหน้า Bracket จึงขึ้นจากคำขอเดียว */
  const raw = await apiFetch<BackendPaged<BackendMatchListItemDto>>(
    `/tournaments/${tournamentId}/matches`,
  );
  const items = raw.items.map((item) => matchFromBackend(item));

  await Promise.all([fillScores(items), fillModes(items)]);
  return { items };
}

/** TODO(guide): GET /matches/:id */
export async function getMatch(matchId: MatchRef): Promise<MatchDto> {
  if (USE_MOCK) {
    const m = mockMatches.find((x) => x.id === Number(matchId));
    if (m) return mockDelay(m);
    const sm = findStoreMatch(matchId);
    return sm ? mockDelay(toMatchDto(storeState(), sm)) : notFound<MatchDto>("แมตช์");
  }
  const raw = await apiFetch<BackendMatchDetailDto>(`/matches/${matchId}`);
  const dto = matchFromBackend(raw);

  /* ของที่หน้าแมตช์และหน้าเช็คอินต้องใช้ แต่ backend แยกไว้คนละเส้น:
     กรรมการของแมตช์ (F12) · รายชื่อผู้เล่นของทั้งสองทีม · ผู้จัดของรายการ · ตัวเราเอง */
  const [refs, me, tournament, playersA, playersB, myTeams] = await Promise.all([
    apiFetch<{ items: BackendMatchRefereeDto[] }>(`/matches/${matchId}/referees`)
      .catch(() => ({ items: [] as BackendMatchRefereeDto[] })),
    apiFetch<{ id: number }>("/me").catch(() => null),
    raw.tournamentId
      ? apiFetch<{ name: string; sportTypeId: number; organizer?: { id: number } }>(`/tournaments/${raw.tournamentId}`)
        .catch(() => null)
      : Promise.resolve(null),
    rosterOf(raw.teamA?.id),
    rosterOf(raw.teamB?.id),
    /* ⚠️ GET /teams/:id/members เปิดให้เฉพาะสมาชิกของทีม กรรมการกับผู้จัดได้ 403
       "ทีมของฉัน" จึงต้องถามจาก /me/teams แทนการหาชื่อตัวเองในรายชื่อผู้เล่น */
    apiFetch<{ items: Array<{ id: number; role: string }> }>("/me/teams").catch(() => ({ items: [] })),
  ]);

  dto.referees = refs.items.map((r) => r.referee);
  if (dto.teamA) dto.teamA.players = playersA;
  if (dto.teamB) dto.teamB.players = playersB;
  if (tournament) {
    dto.tournament = {
      ...dto.tournament,
      name: tournament.name,
      sportTypeId: tournament.sportTypeId ?? dto.tournament.sportTypeId,
    };
  }

  const myId = me?.id ?? null;
  const isReferee = myId !== null && refs.items.some((r) => r.referee.id === myId);
  const isOrganizer = myId !== null && tournament?.organizer?.id === myId;
  const myTeamRow = myTeams.items.find((t) => t.id === dto.teamA?.id || t.id === dto.teamB?.id) ?? null;
  const myTeam = myTeamRow
    ? [dto.teamA, dto.teamB].find((t) => t?.id === myTeamRow.id) ?? null
    : null;
  const isTeamLeader = myTeamRow?.role === "leader";
  const onsite = dto.mode === "onsite";
  const playable = dto.status === "checkin_open" || dto.status === "in_progress";

  /* backend ไม่ได้บอกว่าคนที่กำลังดูทำอะไรได้บ้าง — ประกอบจากบทบาทที่รู้
     (กฎจริงยังอยู่ที่ backend เสมอ ตรงนี้แค่ตัดสินว่าจะโชว์ปุ่มไหม) */
  dto.viewer = {
    roles: [
      ...(isReferee ? (["referee"] as const) : []),
      ...(myTeam ? (["player"] as const) : []),
      ...(isOrganizer ? (["organizer"] as const) : []),
    ],
    myUserId: myId,
    myTeamId: myTeam?.id ?? null,
    isTeamLeader,
    can: {
      /* BR-13 — ผู้ส่งกับผู้ยืนยันสลับข้างกันตามโหมด และทั้งคู่ต้องเป็น "หัวหน้าทีม"
         ไม่ใช่ผู้เล่นคนไหนก็ได้ (backend ใช้ isTeamLeaderOfMatch / isLeaderOfTeam)
         ผู้เล่นธรรมดาที่เห็นปุ่มเหล่านี้กดแล้วได้ 403 WRONG_SUBMITTER_ROLE เสมอ
         ⚠️ on-site ผู้ยืนยันคือหัวหน้า "ทีมที่ชนะ" เท่านั้น — ใครชนะยังไม่รู้จนกว่าจะมี
         ใบผล (M05 ส่ง outcome มาเฉพาะแมตช์ที่ completed) ด่านนั้นจึงอยู่ที่หน้าจอ
         ตรงที่อ่าน result.winnerTeamId ได้ ไม่ใช่ตรงนี้ */
      submitResult: playable && (onsite ? isReferee : isTeamLeader),
      verifyResult: onsite ? isTeamLeader : isReferee,
      disputeResult: isTeamLeader || isReferee,
      resolveDispute: isOrganizer,
      editFixture: isOrganizer && dto.status === "scheduled",
      recordStats: isReferee,
      manageCheckin: isReferee || isOrganizer,
      /* ผู้จัดเปิด/ปิดเช็คอินและดูคอนโซลได้ แต่ทั้งสามเส้นที่ตัดสินการเช็คอินของคนอื่น
         เป็น requireReferee — ถ้าโชว์ปุ่มให้ผู้จัดด้วย กดแล้วได้ 403 NOT_REFEREE ทุกครั้ง */
      verifyCheckin: isReferee,
    },
  };

  /* ยอดเช็คอิน — อ่านได้เฉพาะผู้จัด/กรรมการของแมตช์ (ผู้เล่นได้ 403)
     lineupSize เอาจากรายชื่อทีมที่อ่านได้ ถ้าอ่านไม่ได้ปล่อย 0 แล้วหน้าจอจะไม่แสดงตัวหาร */
  if (isReferee || isOrganizer) {
    const checkins = await apiFetch<{ items: BackendCheckinDto[] }>(`/matches/${matchId}/checkins`)
      .catch(() => null);
    if (checkins) {
      dto.checkedIn = checkins.items.filter((c) => c.status === "checked_in").length;
      dto.lineupSize = playersA.length + playersB.length || checkins.items.length;
    }
  }
  /* เดิมเติม lineupSize = จำนวนผู้เล่นในทีมตัวเองให้ผู้เล่นด้วย แต่ตัวเศษยังเป็น 0 เพราะ
     อ่าน /checkins ไม่ได้ หน้าจอจึงขึ้น "0 of 2 checked in" ให้ทีมที่เช็คอินครบแล้ว
     ตัวหารที่ไม่มีตัวเศษคู่กันไม่ใช่ข้อมูล — ปล่อย 0 ไว้แล้วหน้าจอจะไม่แสดงบรรทัดนั้น */

  /* โค้ด QR ขอได้เฉพาะผู้จัดหรือกรรมการของแมตช์ และเฉพาะตอนเปิดเช็คอิน */
  if ((isReferee || isOrganizer) && dto.status === "checkin_open") {
    const qr = await apiFetch<BackendCheckinQrDto>(`/matches/${matchId}/checkin-qr`).catch(() => null);
    dto.checkinToken = qr?.qrPayload ?? null;
  }
  return dto;
}

/**
 * TODO(guide): GET /matches?assignedToMe=true
 * แมตช์ที่ "ฉัน" เกี่ยวข้อง ไม่ว่าจะในฐานะกรรมการ ผู้เล่น หรือผู้จัด
 * หน้า /matches (MatchesPage) ใช้ตัวนี้ตัวเดียว จึงคืน MatchListItemDto ที่
 * denormalize ชื่อทัวร์นาเมนต์ สกอร์ และยอดเช็คอินมาให้แล้ว — กัน N+1 ต่อแถว
 */
export async function getMyMatches(): Promise<{ items: MatchListItemDto[] }> {
  if (USE_MOCK) {
    /**
     * เฉพาะแมตช์ใน seed ที่เราเกี่ยวข้อง
     *
     * เคยรวม fixture ที่เขียนมือ (id 301–304) เข้ามาด้วย แต่ทีมของ fixture ใช้ id
     * ชุดที่สาม (11–14) ซึ่งไม่ใช่ทั้ง id ของ store และไม่ใช่ `numOf` — ลิงก์ชื่อทีม
     * จากแถวพวกนั้นจึงพาไป `/team/13` แล้วขึ้น "No such squad" และสองในสี่ทีมนั้น
     * ไม่มีตัวตนใน store เลย จะ join ด้วยชื่อก็ไม่รอด
     *
     * seed ครอบคลุมทุกสถานะที่ fixture เคยสาธิตอยู่แล้ว — confirmed 11 นัด
     * disputed 1 · pending 1 · scheduled 3 · คู่ที่ยังไม่รู้คู่แข่ง 1 · ทัวร์นาเมนต์
     * แบบ online 2 รายการ จึงไม่ได้เสียอะไรไป และทุกลิงก์ในรายการชี้ของที่เปิดได้จริง
     *
     * fixture ยังเปิดตรงๆ ได้ที่ /m/301 ถึง /m/304 สำหรับทดสอบรูปร่าง DTO
     */
    const s = storeState();
    const seeded = s.matches
      .map((m) => toListItem(s, m))
      .filter((m) => m.viewer.roles.length);
    return mockDelay({ items: seeded });
  }
  /* ไม่มีเส้นเดียวจบ — ประกอบจากทีมของเรา รายการที่เราจัด และกรรมการรายแมตช์
     (ดูหมายเหตุที่ composeMyMatches ว่าทำไมต้องกวาดหลายคำขอ) */
  return composeMyMatches();
}

/**
 * PATCH /matches/:id/schedule — จัดตาราง/สนาม (FixturePage)
 * backend บังคับ scheduledTime + scheduledEndTime + venue ครบทั้งสามช่อง
 * และคืน match detail รูปของ backend — ผู้เรียกในโหมดจริงจึงควรใช้ scheduleMatch() แทน
 */
export async function updateMatch(matchId: MatchRef, input: UpdateMatchRequest): Promise<MatchDto> {
  if (USE_MOCK) {
    if (writeSchedule(matchId, {
      kickoffAt: input.scheduledTime, venue: input.venue, roomCode: input.roomCode,
    })) {
      const d = storeMatchDto(matchId);
      if (d) return mockDelay(d);
    }
    const m = mockMatches.find((x) => x.id === Number(matchId));
    if (!m) return notFound<MatchDto>("แมตช์");
    Object.assign(m, input, { updatedAt: new Date().toISOString() });
    return mockDelay(m);
  }
  /* B9 (`c43f497`): ส่งเฉพาะช่องที่แก้ได้แล้ว — เลื่อนเวลาอย่างเดียวหรือย้ายสนามอย่างเดียว
     ไม่ต้องกรอกอีกสองช่องซ้ำ · ครั้งแรกที่แมตช์ยังไม่เคยมีตาราง backend ยังบังคับครบสามช่อง
     แล้วตอบ 400 SCHEDULE_INCOMPLETE ซึ่งหน้าจอแสดงข้อความของ server ตรงๆ อยู่แล้ว */
  const body: Partial<ScheduleMatchRequest> = {};
  if (input.scheduledTime) body.scheduledTime = toZulu(input.scheduledTime);
  if (input.scheduledEndTime) body.scheduledEndTime = toZulu(input.scheduledEndTime);
  if (input.venue) body.venue = input.venue;
  if (!Object.keys(body).length) {
    return blocked<MatchDto>("ต้องระบุอย่างน้อยหนึ่งอย่าง: เวลาเริ่ม เวลาจบ หรือสนาม");
  }
  return apiFetch(`/matches/${matchId}/schedule`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * E12 PUT /matches/:id/livestream — ผู้จัดของแมตช์เท่านั้น
 * backend ใช้ชื่อช่อง `youtubeUrl` (ไม่ใช่ `url`) และตรวจว่าเป็นลิงก์ YouTube จริง
 * ลบลิงก์ไม่ได้ — livestreamSchema บังคับให้เป็นสตริง
 */
export async function setLivestream(matchId: MatchRef, url: string | null): Promise<MatchDto> {
  if (USE_MOCK) {
    if (writeLivestream(matchId, url)) {
      const d = storeMatchDto(matchId);
      if (d) return mockDelay(d);
    }
    const m = mockMatches.find((x) => x.id === Number(matchId));
    if (!m) return notFound<MatchDto>("แมตช์");
    m.livestreamUrl = url;
    return mockDelay(m);
  }
  /* A6 — ส่ง null เพื่อล้างลิงก์ได้แล้ว (เดิม backend ไม่รับ null จึงตอบ 501 ไปก่อน) */
  return apiFetch(`/matches/${matchId}/livestream`, {
    method: "PUT",
    body: JSON.stringify({ youtubeUrl: url }),
  });
}

/**
 * มอบหมายกรรมการเข้าแมตช์ทั้งชุดในครั้งเดียว — backend ไม่มีทางนี้
 *
 * ของจริงต้องยื่นคำขอทีละคน (POST /tournaments/:id/referee-requests/add-match)
 * แล้วกรรมการกดรับเอง · และทำได้เฉพาะตอนแมตช์ยังเป็น scheduled เท่านั้น
 * ดู requestMatchReferee() / getMatchReferees() / unassignMatchReferee() ข้างล่าง
 */
export async function assignReferees(matchId: MatchRef, refereeUserIds: number[]): Promise<MatchDto> {
  if (USE_MOCK) {
    if (writeMatchReferees(matchId, refereeUserIds)) {
      const d = storeMatchDto(matchId);
      if (d) return mockDelay(d);
    }
    const m = mockMatches.find((x) => x.id === Number(matchId));
    if (!m) return notFound<MatchDto>("แมตช์");
    m.referees = m.availableReferees.filter((r) => refereeUserIds.includes(r.id));
    return mockDelay(m);
  }
  return unavailable<MatchDto>("การมอบหมายกรรมการเข้าแมตช์ทีเดียวทั้งชุด");
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
  /* เดิม backend คืนเฉพาะผลที่ยืนยันแล้ว — ตอนนี้ (A7) ส่ง submitted/disputed/rejected
     ให้ผู้จัด กรรมการของแมตช์ และหัวหน้าทีมทั้งสองฝั่งด้วย พร้อมช่อง `status`
     ยังส่งมาไม่กี่ช่อง จึงเติมที่เหลือให้ครบรูปที่หน้าจอใช้ */
  const raw = await apiFetch<BackendResultDto>(`/matches/${matchId}/result`);
  /* สกอร์ของ backend คีย์ด้วย teamId ส่วนหน้าจอ (scorebug/ตาราง) อ่าน a/b — ต้องรู้ว่าทีมไหนเป็นฝั่งไหน */
  const match = await apiFetch<BackendMatchDetailDto>(`/matches/${matchId}`).catch(() => null);
  const byTeam = raw.scoreData ?? {};
  const scoreData: Record<string, unknown> = { ...byTeam };
  if (match?.teamA) scoreData.a = byTeam[String(match.teamA.id)] ?? null;
  if (match?.teamB) scoreData.b = byTeam[String(match.teamB.id)] ?? null;
  const unknownPerson = { id: 0, fullName: "—", avatarUrl: null };
  return {
    id: raw.matchId,
    matchId: raw.matchId,
    winnerTeamId: raw.winnerTeamId,
    scoreData,
    submittedBy: unknownPerson,
    submittedRole: "referee",
    /* อย่าตีขลุมว่า verified — ผู้จัดที่มาตัดสินข้อพิพาทต้องเห็นว่ามันยัง disputed อยู่
       walkover ก็ส่งต่อตามจริง: จบแล้วเหมือนกันแต่ไม่ได้ลงแข่ง หน้าจอต้องพูดคนละแบบ
       และแบบแพ้ทั้งคู่ไม่มีผู้ชนะให้ประกาศ (GUIDE/11 §10.5) */
    status: raw.status ?? "verified",
    disputeReason: null,
    disputeRaisedBy: null,
    disputeRaisedAt: null,
    disputeResolvedBy: null,
    disputeResolution: null,
    disputeResolvedAt: null,
    verifiedBy: unknownPerson,
    verifiedAt: raw.verifiedAt,
    amendedBy: null,
    amendReason: raw.amendReason,
    amendedAt: raw.amendedAt,
    createdAt: raw.verifiedAt ?? new Date().toISOString(),
  };
}

/**
 * S01 POST /matches/:id/result — ยืนยันแล้วจาก schema.sql:403
 * **idempotent**: match_results.match_id เป็น UNIQUE → ส่งซ้ำ = UPDATE แถวเดิม
 * ไม่ต้องกันปุ่มกดซ้ำที่ฝั่ง UI ด้วย flag เอง กดซ้ำแล้วผลเหมือนเดิมโดยดีไซน์
 */
export async function submitResult(matchId: MatchRef, input: SubmitResultRequest): Promise<MatchResultDto> {
  if (USE_MOCK) {
    /* แมตช์จาก seed เขียนกลับ store — ที่เดียวกับที่ฝั่งอ่านใช้ */
    const sm = findStoreMatch(matchId);
    if (sm) {
      const why = whyResultBlocked(sm);
      if (why) return blocked<MatchResultDto>(why);
      writeResult(matchId, asScore(input.scoreData) ?? { a: null, b: null, decider: null });
      const r = storeResultDto(matchId);
      if (r) return mockDelay(r);
    }
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
  /* submitResultSchema: winnerTeamId เป็น int บังคับ และ scoreData เป็น Record<teamId, int>
     — ผลเสมอส่งไม่ได้ (ยังไม่มีทางแทนใน backend) */
  if (input.winnerTeamId == null) {
    return unavailable<MatchResultDto>("การบันทึกผลเสมอ (backend บังคับให้มีผู้ชนะเสมอ)");
  }
  const scoreData = await toBackendScore(matchId, input.scoreData);
  return apiFetch(`/matches/${matchId}/result`, {
    method: "POST",
    body: JSON.stringify({ winnerTeamId: input.winnerTeamId, scoreData }),
  });
}

/**
 * แปลงสกอร์ภาษา prototype (`a`/`b`) เป็น map `teamId → แต้ม` ที่ backend เก็บจริง
 *
 * ส่ง a/b ตรงๆ แล้วแถวผลจะถูกเขียนด้วยคีย์ที่ไม่มีใครอ่านออก — หน้าแมตช์ยังโชว์ได้เพราะ
 * อ่าน a/b กลับเอง แต่ตารางแข่ง สาย แดชบอร์ด และ `score` ของ M04 อ่านด้วย teamId
 * จึงขึ้น "—" ตลอดทั้งที่กรอกผลไปแล้ว · ใช้ทั้งตอนส่งผล (S01) และตอนผู้จัดแก้ผล (S04 amend)
 */
async function toBackendScore(
  matchId: MatchRef,
  scoreData: Record<string, unknown> | null | undefined,
): Promise<Record<string, number>> {
  const sides = await apiFetch<BackendMatchDetailDto>(`/matches/${matchId}`);
  const teamIdOf = (key: string): string | null =>
    key === "a" ? (sides.teamA ? String(sides.teamA.id) : null)
      : key === "b" ? (sides.teamB ? String(sides.teamB.id) : null)
        : key;
  const out: Record<string, number> = {};
  Object.entries(scoreData ?? {}).forEach(([key, value]) => {
    /* `decider` ของ prototype เป็นอ็อบเจ็กต์ซ้อน ซึ่ง z.record(z.string(), z.int())
       ปฏิเสธทั้งคำขอ — ทิ้งไปก่อนส่ง จนกว่า backend จะมีที่เก็บผลเสมอกับตัวตัดสิน */
    if (typeof value !== "number") return;
    const teamId = teamIdOf(key);
    if (teamId !== null) out[teamId] = value;
  });
  return out;
}

/** TODO(guide): POST /matches/:id/result/verify */
export async function verifyResult(matchId: MatchRef, input: VerifyResultRequest = {}): Promise<MatchResultDto> {
  if (USE_MOCK) {
    if (writeVerify(matchId)) {
      const r = storeResultDto(matchId);
      if (r) return mockDelay(r);
    }
    const r = mockResults.find((x) => x.matchId === Number(matchId));
    if (!r) return notFound<MatchResultDto>("ผลการแข่งขัน");
    r.status = "verified";
    r.verifiedBy = mockPlayers[3];
    r.verifiedAt = new Date().toISOString();
    return mockDelay(r);
  }
  /* backend ไม่มี validate บนเส้นนี้ และอ่านผู้ยืนยันจาก token — ไม่ต้องส่ง body
     (onsite = หัวหน้าทีมที่ชนะเป็นคนยืนยัน · online = กรรมการของแมตช์) */
  void input;
  return apiFetch(`/matches/${matchId}/result/verify`, { method: "POST" });
}

/**
 * TODO(guide): POST /matches/:id/result/dispute
 * กฎจาก schema.sql: พอ status เป็น 'disputed' backend ต้อง UPDATE
 * matches.match_status='disputed' ในทรานแซกชันเดียวกันเสมอ → invalidate ทั้ง 2 key
 */
export async function disputeResult(matchId: MatchRef, input: DisputeResultRequest): Promise<MatchResultDto> {
  if (USE_MOCK) {
    const smD = findStoreMatch(matchId);
    if (smD) {
      if (smD.status !== "pending") {
        return blocked<MatchResultDto>(
          "ค้านได้เฉพาะตอนที่ผลยังรอการยืนยัน — ผลที่ปิดแล้วต้องให้ผู้จัดเปิดใหม่",
        );
      }
      writeDispute(matchId, input.reason);
      const r = storeResultDto(matchId);
      if (r) return mockDelay(r);
    }
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
  /* disputeSchema รับเฉพาะ { reason } — teamId ของ prototype ไม่มีในสัญญา
     backend อ่านผู้ค้านจาก token และบันทึกเป็น "ทีมของคนนั้น" เอง */
  return apiFetch(`/matches/${matchId}/result/dispute`, {
    method: "POST",
    body: JSON.stringify({ reason: input.reason }),
  });
}

/** TODO(guide): POST /matches/:id/result/resolve — Organizer/Admin เท่านั้น */
export async function resolveDispute(matchId: MatchRef, input: ResolveDisputeRequest): Promise<MatchResultDto> {
  if (USE_MOCK) {
    if (writeResolve(matchId, asScore(input.scoreData))) {
      const r = storeResultDto(matchId);
      if (r) return mockDelay(r);
    }
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
  /* B4 (`c43f497`): resolveSchema รับ `amend` แล้ว — ผู้จัดเขียนผู้ชนะกับสกอร์ที่ถูกต้อง
     ลงไปในคำตัดสินได้เลย ผลกลับเป็น verified ทันทีและติดธง isAmended
     เดิมทำไม่ได้ ต้องยกผลทิ้งแล้วรอให้คนกรอกใหม่ ซึ่งเป็นเหตุผลที่คนค้านส่วนใหญ่ค้าน */
  const amending = input.decision === "amend";
  if (amending && (input.winnerTeamId == null || input.scoreData == null)) {
    return blocked<MatchResultDto>("การแก้ผลต้องระบุทั้งผู้ชนะและสกอร์");
  }
  return apiFetch(`/matches/${matchId}/result/resolve`, {
    method: "POST",
    body: JSON.stringify({
      resolution: input.decision ?? "uphold",
      resolutionNote: input.resolution,
      ...(amending
        ? {
            winnerTeamId: input.winnerTeamId,
            scoreData: await toBackendScore(matchId, input.scoreData),
          }
        : {}),
    }),
  });
}

// ══════════════ Check-in ══════════════

/** TODO(guide): GET /matches/:id/checkins */
export async function getCheckins(matchId: MatchRef): Promise<{ items: MatchCheckinDto[] }> {
  if (USE_MOCK) {
    /* แมตช์จาก seed อ่านจาก store — ที่เดียวกับที่ฝั่งเขียนใช้ */
    const fromStore = storeCheckinDtos(matchId);
    if (fromStore.length) return mockDelay({ items: fromStore });
    return mockDelay({ items: mockCheckins.filter((c) => c.matchId === Number(matchId)) });
  }
  const raw = await apiFetch<{ items: BackendCheckinDto[] }>(`/matches/${matchId}/checkins`);
  return { items: raw.items.map((row) => checkinFromBackend(Number(matchId), row)) };
}

/** TODO(guide): POST /matches/:id/checkin */
export async function checkin(matchId: MatchRef, input: CheckinRequest): Promise<MatchCheckinDto> {
  if (USE_MOCK) {
    const smC = findStoreMatch(matchId);
    if (smC && (smC.status === "confirmed" || smC.status === "void")) {
      return blocked<MatchCheckinDto>("แมตช์นี้จบไปแล้ว เช็คอินไม่ได้");
    }
    if (smC && input.userId !== undefined && !storeSquadHas(matchId, input.userId)) {
      return mockReject<MatchCheckinDto>(403, {
        code: "NOT_IN_SQUAD",
        message: "คนนี้ไม่ได้อยู่ในทีมที่ลงแมตช์นี้",
      });
    }
    if (writeCheckin(matchId, input.userId, {
      method: input.method,
      documentUrl: input.documentS3Key ?? null,
      documentType: input.documentType ?? null,
    })) {
      const c = storeCheckinDtos(matchId).find((x) => x.user.id === (input.userId ?? x.user.id));
      if (c) return mockDelay(c);
    }
    const created: MatchCheckinDto = {
      id: takeNextMockId(),
      matchId: Number(matchId),
      user: mockPlayers[input.userId ?? 1] ?? mockPlayers[1],
      method: input.method,
      status: input.method === "photo_online" ? "exception" : "success",
      rejectionReason: null,
      note: input.note?.trim() || null,
      documentType: input.documentType ?? null,
      documentS3Key: input.documentS3Key ?? null,
      verifiedByReferee: null,
      checkedInAt: new Date().toISOString(),
      verifiedAt: null,
    };
    mockCheckins.push(created);
    return mockDelay(created);
  }
  /* เส้นจริงคือ /checkins (พหูพจน์) และ body เป็น discriminated union ตาม method
     ชื่อช่องของ QR คือ qrPayload ไม่ใช่ qrToken */
  if (input.method === "manual_by_referee") {
    /* A5 (M19): คนละเส้นและคนละรูป body — ไม่มีหลักฐานรูป มีแต่ผู้เล่นกับเหตุผล
       backend ตอบ 403 NOT_IN_APPROVED_ROSTER / 409 ALREADY_CHECKED_IN เอง */
    if (input.userId === undefined) {
      return blocked<MatchCheckinDto>("ต้องระบุว่าจะเช็คอินแทนผู้เล่นคนไหน");
    }
    let manual: BackendManualCheckinDto;
    try {
      manual = await apiFetch<BackendManualCheckinDto>(`/matches/${matchId}/checkins/manual`, {
        method: "POST",
        body: JSON.stringify({
          userId: input.userId,
          ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        } satisfies BackendManualCheckinRequest),
      });
    } catch (error) {
      /* A duplicate response means the write already exists, while the roster query may still
         contain an older empty snapshot. Re-read the authoritative collection and return that
         row as the mutation result only when the same numeric user id is present. */
      const code = typeof error === "object" && error !== null
        ? (error as { code?: unknown }).code
        : undefined;
      if (code !== "ALREADY_CHECKED_IN") throw error;
      try {
        const current = await getCheckins(matchId);
        const existing = current.items.find((row) => row.user.id === input.userId);
        if (existing) return existing;
      } catch {
        // Preserve the useful duplicate response when reconciliation itself cannot be read.
      }
      throw error;
    }
    return {
      id: manual.id,
      matchId: Number(matchId),
      user: { id: manual.userId, fullName: "", avatarUrl: null },
      method: "manual_by_referee",
      status: checkinStatusFromBackend(manual.status),
      rejectionReason: null,
      note: input.note?.trim() || null,
      documentType: null,
      documentS3Key: null,
      verifiedByReferee: null,
      checkedInAt: manual.checkedInAt,
      verifiedAt: null,
    };
  }
  let body: BackendCheckinRequest;
  if (input.method === "qr_onsite") {
    body = { method: "qr_onsite", qrPayload: input.qrToken ?? "" };
  } else {
    /* หน้าจอส่งรูปมาเป็น data URL จากกล้อง — backend รับเฉพาะ S3 key
       จึงต้องขอที่อัปโหลด (M16) แล้วอัปโหลดรูปขึ้นไปก่อน */
    const source = input.documentS3Key ?? "";
    const key = source.startsWith("data:")
      ? await uploadCheckinPhoto(Number(matchId), source)
      : source;
    body = {
      method: "photo_online",
      documentType: input.documentType ?? "student_id",
      documentS3Key: key,
    };
  }
  const created = await apiFetch<BackendSubmittedCheckinDto>(`/matches/${matchId}/checkins`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  /* ⚠️ ผู้เล่นอ่าน GET /matches/:id/checkins ไม่ได้ (403 — เปิดให้เฉพาะกรรมการ/ผู้จัด)
     คำตอบของการเช็คอินจึงเป็นหลักฐานเดียวที่เจ้าตัวได้เห็นว่าผ่านหรือรอตรวจ */
  return {
    id: created.id,
    matchId: Number(matchId),
    user: { id: input.userId ?? 0, fullName: "", avatarUrl: null },
    method: input.method,
    status: checkinStatusFromBackend(created.status),
    rejectionReason: null,
    note: null,
    documentType: input.documentType ?? null,
    documentS3Key: null,
    verifiedByReferee: null,
    checkedInAt: created.checkedInAt,
    verifiedAt: null,
  };
}

/**
 * GET /matches/:id/checkins/me (A9) — แถวเช็คอินของตัวเอง
 *
 * ผู้เล่นอ่าน GET /matches/:id/checkins ไม่ได้ (403 เปิดให้เฉพาะกรรมการกับผู้จัด) หน้าเช็คอิน
 * จึงเคยขึ้นว่าเขายังไม่เช็คอินตลอด แม้เพิ่งกดไปเมื่อกี้ · null = ยังไม่ได้เช็คอินจริงๆ
 * โหมด mock ไม่ต้องใช้ — รายการทั้งแมตช์อ่านได้อยู่แล้ว
 */
export async function getMyCheckin(matchId: MatchRef): Promise<MatchCheckinDto | null> {
  if (USE_MOCK) return mockDelay(null);
  const raw = await apiFetch<BackendMyCheckinDto>(`/matches/${matchId}/checkins/me`);
  if (!raw.checkin) return null;
  return {
    id: raw.checkin.id,
    matchId: Number(matchId),
    /* เส้นนี้ไม่ส่งชื่อกลับมา เพราะเป็นของคนที่ถามเอง — หน้าจอจับคู่ด้วย id ของตัวเอง */
    user: { id: 0, fullName: "", avatarUrl: null },
    method: raw.checkin.method,
    status: checkinStatusFromBackend(raw.checkin.status),
    rejectionReason: raw.checkin.rejectionReason,
    note: raw.checkin.note,
    documentType: null,
    documentS3Key: null,
    verifiedByReferee: null,
    checkedInAt: raw.checkin.checkedInAt,
    verifiedAt: raw.checkin.verifiedAt,
  };
}

/**
 * POST /matches/:id/checkins/:cid/verify | /reject — กรรมการตรวจรูปบัตร (M14/M15)
 * backend อ้างด้วย "รหัสแถวเช็คอิน" ไม่ใช่รหัสผู้ใช้ — ชั้นนี้แปลงให้จากรายการเช็คอิน
 * ผู้เรียกจึงยังส่ง userId เหมือนเดิมได้
 */
export async function verifyCheckin(
  matchId: MatchRef,
  userId: number,
  input: VerifyCheckinRequest,
): Promise<MatchCheckinDto> {
  if (USE_MOCK) {
    if (input.status === "rejected"
      ? writeRejectCheckin(matchId, userId, input.rejectionReason ?? undefined)
      : writeApproveCheckin(matchId, userId)) {
      const c = storeCheckinDtos(matchId).find((x) => x.user.id === userId);
      if (c) return mockDelay(c);
    }
    const c = mockCheckins.find((x) => x.matchId === Number(matchId) && x.user.id === userId);
    if (!c) return notFound<MatchCheckinDto>("การเช็คอิน");
    c.status = input.status;
    c.rejectionReason = input.rejectionReason ?? null;
    c.verifiedByReferee = mockPlayers[3];
    c.verifiedAt = new Date().toISOString();
    return mockDelay(c);
  }
  const { items } = await apiFetch<{ items: BackendCheckinDto[] }>(`/matches/${matchId}/checkins`);
  const row = items.find((c) => c.userId === userId);
  if (!row) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "ไม่พบการเช็คอินของผู้เล่นคนนี้" });
  }
  if (input.status === "rejected") {
    return apiFetch(`/matches/${matchId}/checkins/${row.id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: input.rejectionReason ?? "เอกสารไม่ผ่านการตรวจ" }),
    });
  }
  return apiFetch(`/matches/${matchId}/checkins/${row.id}/verify`, { method: "POST" });
}

// ══════════════ Player stats ══════════════

/** TODO(guide): GET /matches/:id/stats */
export async function getMatchStats(matchId: MatchRef): Promise<{ items: PlayerMatchStatDto[] }> {
  if (USE_MOCK) {
    const fromStore = storeStatDtos(matchId);
    if (fromStore.length) return mockDelay({ items: fromStore });
    return mockDelay({ items: mockStats.filter((s) => s.matchId === Number(matchId)) });
  }
  /* backend ตอบเป็น { userId, fullName, stats:[{statKey, value}] } — หน้าจอต้องการ
     { player, teamId, values } · ทีมกับผู้บันทึกไม่ได้ส่งมา จึงเติมจากรายชื่อผู้เล่นของแมตช์ */
  const [raw, match] = await Promise.all([
    apiFetch<{ items: BackendPlayerStatDto[] }>(`/matches/${matchId}/stats`),
    apiFetch<BackendMatchDetailDto>(`/matches/${matchId}`).catch(() => null),
  ]);
  const rosterA = await rosterOf(match?.teamA?.id);
  const rosterB = await rosterOf(match?.teamB?.id);
  const teamOf = (userId: number) =>
    rosterA.some((p) => p.id === userId) ? match?.teamA?.id ?? 0
      : rosterB.some((p) => p.id === userId) ? match?.teamB?.id ?? 0
        : 0;
  return {
    items: raw.items.map((row) => ({
      id: row.userId,
      matchId: Number(matchId),
      player: { id: row.userId, fullName: row.fullName, avatarUrl: null },
      teamId: teamOf(row.userId),
      recordedByReferee: { id: 0, fullName: "—", avatarUrl: null },
      values: Object.fromEntries(row.stats.map((stat) => [stat.statKey, stat.value])),
      createdAt: new Date().toISOString(),
    })),
  };
}

/**
 * POST /matches/:id/stats — บันทึกทั้งแมตช์ทีเดียว ไม่ใช่ทีละคน (กรรมการของแมตช์เท่านั้น)
 * backend อ้างสถิติด้วย statDefinitionId ส่วน prototype ใช้ statKey — ชั้นนี้แปลงให้
 * โดยอ่านชนิดกีฬาจากทีมในแมตช์แล้วขอตารางนิยามสถิติมาเทียบ
 */
export async function saveMatchStats(
  matchId: MatchRef,
  input: SaveMatchStatsRequest,
): Promise<{ items: PlayerMatchStatDto[] }> {
  if (USE_MOCK) {
    if (writeStats(matchId, input.entries)) {
      return mockDelay({ items: storeStatDtos(matchId) });
    }
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
  const match = await apiFetch<BackendMatchDetailDto>(`/matches/${matchId}`);
  const sportTypeId = match.teamA?.sportTypeId ?? match.teamB?.sportTypeId;
  if (!sportTypeId) return unavailable<{ items: PlayerMatchStatDto[] }>("การบันทึกสถิติของแมตช์ที่ยังไม่มีทีมครบ");
  const defs = await apiFetch<{ items: StatDefinition[] }>(`/sport-types/${sportTypeId}/stat-definitions`);
  const idOf = new Map(defs.items.map((d) => [d.statKey, d.statDefinitionId]));
  const playerStats = input.entries.map((entry) => ({
    userId: entry.userId,
    values: Object.entries(entry.values)
      .filter(([key]) => idOf.has(key))
      .map(([key, value]) => ({ statDefinitionId: idOf.get(key)!, value })),
  }));
  await apiFetch(`/matches/${matchId}/stats`, {
    method: "POST",
    body: JSON.stringify({ playerStats } satisfies RecordMatchStatsRequest),
  });
  return apiFetch(`/matches/${matchId}/stats`);
}

/**
 * TODO(guide): GET /sport-types/:id/stat-definitions
 * "กีฬานี้เก็บสถิติอะไรบ้าง" — ตาราง sport_stat_definitions เป็นของสไลซ์ 3
 * แทนที่ statLabels()/statExtra() ใน rules.ts ที่ hardcode ตามชื่อกีฬา
 */
export async function getStatDefinitions(sportTypeId: number): Promise<{ items: StatDefinition[] }> {
  if (USE_MOCK) {
    /* ชุดที่เขียนมือก่อน แล้วค่อยสร้างจากตารางกีฬาใน rules.ts
       ฟุตบอลจึงได้ ประตู/แอสซิสต์/ใบเหลือง/ใบแดง ไม่ใช่ "แต้ม" ช่องเดียว */
    const fixture = mockStatDefinitions[sportTypeId];
    if (fixture) return mockDelay({ items: fixture });
    const derived = storeStatDefinitions(sportTypeId);
    return mockDelay({ items: derived.length ? derived : mockStatDefinitions[0] });
  }
  return apiFetch(`/sport-types/${sportTypeId}/stat-definitions`);
}

// ══════════════ Standings ══════════════

/** TODO(guide): GET /tournaments/:id/standings */
export async function getStandings(tournamentId: MatchRef): Promise<StandingsDto | null> {
  if (USE_MOCK) return mockDelay(findStoreStandings(tournamentId));
  /* backend ตอบ { items: [{ team, wins, losses, rank }] } ส่วนหน้าจอต้องการ { format, rows: [...] }
     ช่องที่ backend ยังไม่มี (คะแนน ฟอร์ม 5 นัดหลัง ได้/เสีย ป้ายรอบที่ตกรอบ) เติมเป็นค่าว่าง
     ถ้าไม่แปลง หน้า Leaderboard กับ Dashboard จะอ่าน data.rows ไม่เจอแล้วจอดับ */
  /* รูปแบบการแข่งเป็นตัวเลือกว่าจะวาดตารางแบบไหน (LeaderboardTab แยก round robin ออกจาก
     แพ้คัดออก และ topOfTable ก็ใช้) ของเดิมฮาร์ดโค้ดไว้ว่าแพ้คัดออกเสมอ — พอมีทัวร์แบบ
     พบกันหมดเมื่อไหร่ก็วาดผิดทันที ทั้งที่ฟอร์มสร้างทัวร์นาเมนต์เลือกได้อยู่แล้ว */
  const [raw, tournament] = await Promise.all([
    apiFetch<{ items: BackendStandingDto[] }>(`/tournaments/${tournamentId}/standings`),
    apiFetch<{ bracketFormat: StandingsFormat | null }>(`/tournaments/${tournamentId}`)
      .catch(() => null),
  ]);
  return {
    tournamentId: Number(tournamentId),
    format: tournament?.bracketFormat ?? "single_elimination",
    scoreUnit: "Points",
    updatedAt: new Date().toISOString(),
    rows: raw.items.map((row) => ({
      team: teamFromBackend(row.team)!,
      rank: row.rank,
      played: row.wins + row.losses,
      won: row.wins,
      lost: row.losses,
      points: row.wins * 3,
      level: 0,
      scoredFor: 0,
      scoredAgainst: 0,
      scoreDifference: 0,
      form: [],
      outLabel: "",
    })),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// เส้นจริงของ BE_KN 98aa300 — คืน "รูปที่ backend ตอบ" ไม่ใช่รูป prototype
//
// ฟังก์ชันข้างบนมีไว้ให้หน้าจอที่ยังเดินบน store (โหมด mock) ใช้ต่อได้เหมือนเดิม
// ส่วนหน้าจอที่ต่อ backend จริงให้เรียกชุดนี้ — ชนิดข้อมูลตรงกับที่ server ส่งมาจริง
// ══════════════════════════════════════════════════════════════════════════

/** GET /tournaments/:id/matches — สาธารณะ · มี pagination */
export function getBackendTournamentMatches(
  tournamentId: number,
): Promise<BackendPaged<BackendMatchListItemDto>> {
  return apiFetch(`/tournaments/${tournamentId}/matches`);
}

/** GET /matches/:id — สาธารณะ */
export function getBackendMatch(matchId: number): Promise<BackendMatchDetailDto> {
  return apiFetch(`/matches/${matchId}`);
}

/** PATCH /matches/:id/schedule — ผู้จัดของแมตช์ · เฉพาะแมตช์ที่ยัง scheduled */
export function scheduleMatch(
  matchId: number,
  input: ScheduleMatchRequest,
): Promise<BackendMatchDetailDto> {
  return apiFetch(`/matches/${matchId}/schedule`, {
    method: "PATCH",
    body: JSON.stringify({
      scheduledTime: toZulu(input.scheduledTime),
      scheduledEndTime: toZulu(input.scheduledEndTime),
      venue: input.venue,
    }),
  });
}

/**
 * POST /matches/:id/open-checkin — ผู้จัดของแมตช์
 * ⚠️ เปิดแล้วมอบหมายกรรมการเข้าแมตช์ไม่ได้อีก — ต้องจัดกรรมการให้ครบก่อน
 *    (ปิดกลับได้ด้วย closeMatchCheckin ถ้ายังไม่มีใครเริ่มแข่ง)
 */
export function openMatchCheckin(
  matchId: number,
): Promise<{ id: number; status: string; checkinOpenAt: string | null }> {
  return apiFetch(`/matches/${matchId}/open-checkin`, { method: "POST" });
}

/**
 * POST /matches/:id/close-checkin (M18) — ผู้จัดของแมตช์ ถอยกลับเป็น scheduled
 *
 * ใช้ตอนเปิดเช็คอินผิดนัดหรือต้องเลื่อน — แมตช์กลับไปรอเตะ เช็คอินที่ทำไปแล้วยังอยู่
 * 409 INVALID_STATUS_TRANSITION ถ้าแมตช์ไม่ได้อยู่สถานะ checkin_open
 */
export function closeMatchCheckin(
  matchId: MatchRef,
): Promise<{ id: number; status: string; checkinOpenAt: string | null }> {
  if (USE_MOCK) return unavailable("การปิดเช็คอิน (M18)");
  return apiFetch(`/matches/${matchId}/close-checkin`, { method: "POST" });
}

/**
 * POST /matches/:id/forfeit (M17) — ผู้จัดตัดสินแมตช์ที่ทีมไม่มาตามนัด
 *
 * ฝั่งที่เช็คอินไม่ถึง sport_types.min_members แพ้บาย · ไม่ถึงทั้งคู่ = แพ้ทั้งคู่
 * ไม่ต้องรอกรรมการเพราะไม่มีการแข่ง ต่างจาก M10 (กรรมการกดเริ่ม)
 *
 * ต้องอยู่สถานะ checkin_open — ทีมต้องมีโอกาสเช็คอินก่อน
 * 409 TEAMS_PRESENT ถ้าทั้งสองทีมมาครบ (ให้กรรมการเริ่มแข่งแทน) มาพร้อม
 * details `{ minMembers, checkedIn }` ซึ่งหน้าจอเอามาบอกผู้จัดได้ว่าใครมาแล้วกี่คน
 */
export function forfeitMatch(matchId: MatchRef): Promise<BackendForfeitResultDto> {
  if (USE_MOCK) return unavailable("การตัดสินทีมไม่มาตามนัด (M17)");
  return apiFetch(`/matches/${matchId}/forfeit`, { method: "POST" });
}

/** POST /matches/:id/start — กรรมการของแมตช์เท่านั้น · ต้องมีคนเช็คอินแล้วฝั่งละ 1 คน */
export function startMatch(matchId: number): Promise<{ id: number; status: string }> {
  return apiFetch(`/matches/${matchId}/start`, { method: "POST" });
}

/** GET /matches/:id/checkin-qr — ผู้จัดหรือกรรมการของแมตช์ · ต้องเปิดเช็คอินแล้ว */
export function getCheckinQr(matchId: number): Promise<BackendCheckinQrDto> {
  return apiFetch(`/matches/${matchId}/checkin-qr`);
}

/** GET /matches/:id/checkins — ผู้จัดเห็นรายการแต่ documentUrl เป็น null (PDPA) */
export function getBackendCheckins(matchId: number): Promise<{ items: BackendCheckinDto[] }> {
  return apiFetch(`/matches/${matchId}/checkins`);
}

/** POST /matches/:id/checkins — ผู้เล่นเช็คอินด้วยตัวเอง (กดซ้ำได้ ผลเดิม) */
export function submitCheckin(
  matchId: number,
  input:
    | { method: "qr_onsite"; qrPayload: string }
    | { method: "photo_online"; documentType: "student_id" | "national_id"; documentS3Key: string },
): Promise<BackendSubmittedCheckinDto> {
  return apiFetch(`/matches/${matchId}/checkins`, { method: "POST", body: JSON.stringify(input) });
}

/** POST /matches/:id/checkins/:cid/verify — กรรมการของแมตช์ · ใช้กับเช็คอินแบบรูปที่รอตรวจเท่านั้น */
export function verifyBackendCheckin(
  matchId: number,
  checkinId: number,
): Promise<{ id: number; status: string }> {
  return apiFetch(`/matches/${matchId}/checkins/${checkinId}/verify`, { method: "POST" });
}

/** POST /matches/:id/checkins/:cid/reject — ต้องมีเหตุผล (400 CHECKIN_REJECT_REASON_REQUIRED) */
export function rejectBackendCheckin(
  matchId: number,
  checkinId: number,
  reason: string,
): Promise<{ id: number; status: string; reason: string }> {
  return apiFetch(`/matches/${matchId}/checkins/${checkinId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** POST /matches/:id/result — onsite = กรรมการของแมตช์ · online = หัวหน้าทีม */
export function submitBackendResult(
  matchId: number,
  winnerTeamId: number,
  scoreData: Record<string, number>,
): Promise<BackendSubmittedResultDto> {
  return apiFetch(`/matches/${matchId}/result`, {
    method: "POST",
    body: JSON.stringify({ winnerTeamId, scoreData }),
  });
}

/** POST /matches/:id/result/verify — คนละคนกับผู้ส่งผลเสมอ */
export function verifyBackendResult(matchId: number): Promise<BackendVerifiedResultDto> {
  return apiFetch(`/matches/${matchId}/result/verify`, { method: "POST" });
}

/** POST /matches/:id/result/dispute — หัวหน้าทีมหรือกรรมการของแมตช์ ภายในกรอบเวลาโต้แย้ง */
export function disputeBackendResult(
  matchId: number,
  reason: string,
): Promise<{ matchId: number; status: string }> {
  return apiFetch(`/matches/${matchId}/result/dispute`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** POST /matches/:id/result/resolve — ผู้จัดของแมตช์เท่านั้น */
export function resolveBackendResult(
  matchId: number,
  resolution: "uphold" | "reject",
  resolutionNote: string,
): Promise<{ matchId: number; status: string }> {
  return apiFetch(`/matches/${matchId}/result/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolution, resolutionNote }),
  });
}

/** GET /matches/:id/result — ⚠️ 404 ระหว่างที่ผลถูกโต้แย้ง ไม่ใช่แค่ตอนยังไม่มีผล */
export function getBackendResult(matchId: number): Promise<BackendResultDto> {
  return apiFetch(`/matches/${matchId}/result`);
}

/** GET /matches/:id/stats — สาธารณะ */
export function getBackendMatchStats(matchId: number): Promise<{ items: BackendPlayerStatDto[] }> {
  return apiFetch(`/matches/${matchId}/stats`);
}

/** POST /matches/:id/stats — กรรมการของแมตช์ · on-site ที่เก็บสถิติต้องมีกรรมการครบ 2 คน */
export function recordMatchStats(
  matchId: number,
  input: RecordMatchStatsRequest,
): Promise<{ matchId: number; recordedCount: number }> {
  return apiFetch(`/matches/${matchId}/stats`, { method: "POST", body: JSON.stringify(input) });
}

/** GET /matches/:id/referees — สาธารณะ · กรรมการที่รับแมตช์นี้แล้ว */
export function getMatchReferees(matchId: number): Promise<{ items: BackendMatchRefereeDto[] }> {
  return apiFetch(`/matches/${matchId}/referees`);
}

/** DELETE /matches/:id/referees/:rid — ผู้จัดของแมตช์ · rid คือ tournamentRefereeId */
export function unassignMatchReferee(matchId: number, tournamentRefereeId: number): Promise<void> {
  return apiFetch(`/matches/${matchId}/referees/${tournamentRefereeId}`, { method: "DELETE" });
}

/** POST /tournaments/:id/bracket — จับสาย (ต้องปิดรับสมัครและจำนวนทีมตรงกับที่ประกาศ) */
export function createBracket(
  tournamentId: number,
  input: CreateBracketRequest,
): Promise<{ matchCount: number; bracketFormat: string; nodeCount: number }> {
  return apiFetch(`/tournaments/${tournamentId}/bracket`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /tournaments/:id/bracket — ⚠️ ทีมของรอบถัดไปยังเป็น null เสมอ (บั๊ก backend) */
export function getBracket(tournamentId: number): Promise<BackendBracketDto> {
  return apiFetch(`/tournaments/${tournamentId}/bracket`);
}

/** GET /tournaments/:id/standings — สาธารณะ */
export function getBackendStandings(
  tournamentId: number,
): Promise<{ items: BackendStandingDto[] }> {
  return apiFetch(`/tournaments/${tournamentId}/standings`);
}

/** GET /tournaments/:id/dashboard — สาธารณะ · ตัวเลขสรุปของรายการ */
export function getTournamentDashboard(
  tournamentId: number,
): Promise<BackendTournamentDashboardDto> {
  return apiFetch(`/tournaments/${tournamentId}/dashboard`);
}

/** GET /tournaments/:id/winner — ⚠️ 404 เสมอ เพราะยังไม่มีทางทำให้ทัวร์นาเมนต์เป็น completed */
export function getTournamentWinner(
  tournamentId: number,
): Promise<BackendTournamentWinnerDto> {
  return apiFetch(`/tournaments/${tournamentId}/winner`);
}
