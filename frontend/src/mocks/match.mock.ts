/**
 * src/mocks/match.mock.ts — Person 3
 *
 * fixture ของโดเมน Match/Result/Standings ตอน VITE_USE_MOCK=true
 * แยกจาก shared/seed.ts โดยตั้งใจ: seed.ts เป็นข้อมูลของ prototype ที่ port มา
 * (id เป็น string, shape คนละแบบ) ส่วนไฟล์นี้เป็นรูปที่ "API จริงจะส่งกลับมา"
 *
 * ตั้งใจให้ครอบคลุมทุกสถานะที่ UI ต้องรับมือ — อย่าตัดออกเวลาแก้:
 *   301 completed + verified      กรรมการ · จบแล้ว ไม่มีอะไรให้ทำ
 *   302 disputed                  ผู้จัด · ต้องตัดสินข้อพิพาท
 *   303 checkin_open              กรรมการ + ผู้เล่น · ต้องกรอกผลและคุมเช็คอิน
 *   304 scheduled + ยังไม่รู้คู่แข่ง  ผู้เล่น · TBD
 */
import type {
  MatchDto,
  MatchListItemDto,
  MatchViewerContext,
  MatchResultDto,
  MatchCheckinDto,
  PlayerMatchStatDto,
  TournamentStandingDto,
  MatchTeamRef,
  PlayerRef,
} from "../types/match.dto";

const TZ = "+07:00";
const iso = (d: string) => `${d}${TZ}`;

// ── ทีมและผู้เล่น (ref เฉยๆ — เจ้าของจริงคือสไลซ์ 4) ────────────────────────
export const mockTeams: Record<number, MatchTeamRef> = {
  11: { id: 11, name: "Byte Force", code: "BYT", color: "#E5484D", logoUrl: null },
  12: { id: 12, name: "Engineering United", code: "ENG", color: "#30A46C", logoUrl: null },
  13: { id: 13, name: "Circuit Breakers", code: "CIR", color: "#F5D90A", logoUrl: null },
  14: { id: 14, name: "Null Pointers", code: "NUL", color: "#8E4EC6", logoUrl: null },
};

export const mockPlayers: Record<number, PlayerRef> = {
  1: { id: 1, fullName: "Sirawit Kanchana", avatarUrl: null },
  2: { id: 2, fullName: "Kittipong Rojana", avatarUrl: null },
  3: { id: 3, fullName: "Thanwa Sirichai", avatarUrl: null },
  9: { id: 9, fullName: "Rattana Admin", avatarUrl: null },
};

const TOURNAMENT = { id: 201, name: "Inter-Faculty Futsal 2026", championTeamId: null };

/** ไม่มีสิทธิ์อะไรเลย — จุดตั้งต้นที่ทุกแมตช์เปิดจากตรงนี้แล้วเปิดเฉพาะที่ควรได้ */
const noPowers: MatchViewerContext["can"] = {
  submitResult: false, verifyResult: false, disputeResult: false, resolveDispute: false,
  editFixture: false, recordStats: false, manageCheckin: false,
};

const viewer = (
  roles: MatchViewerContext["roles"],
  can: Partial<MatchViewerContext["can"]> = {},
  extra: Partial<Pick<MatchViewerContext, "myTeamId" | "isTeamLeader">> = {},
): MatchViewerContext => ({
  roles,
  myTeamId: extra.myTeamId ?? null,
  isTeamLeader: extra.isTeamLeader ?? false,
  can: { ...noPowers, ...can },
});

type MatchSeed = Partial<MatchDto> & Pick<MatchDto, "id" | "status" | "mode" | "viewer" | "stage" | "tag">;

/** ค่าตั้งต้นของแมตช์ — เขียนเฉพาะที่ต่างจากนี้ */
const mk = (seed: MatchSeed): MatchDto => ({
  tournamentId: TOURNAMENT.id,
  tournament: TOURNAMENT,
  bracketNodeId: null,
  nextMatchId: null,
  loserNextMatchId: null,
  roundNumber: 1,
  teamA: null,
  teamB: null,
  scheduledTime: null,
  venue: null,
  checkinOpenAt: null,
  createdAt: iso("2026-02-20T09:00:00"),
  updatedAt: null,
  referees: [],
  roomCode: null,
  replayUrl: null,
  checkedIn: 0,
  lineupSize: 10,
  ...seed,
});

// ── Matches ────────────────────────────────────────────────────────────────
export const mockMatches: MatchDto[] = [
  mk({
    id: 301, stage: "Semi-final", tag: "SF1",
    bracketNodeId: 401, nextMatchId: 305,
    teamA: mockTeams[11], teamB: mockTeams[12],
    scheduledTime: iso("2026-03-08T13:00:00"),
    venue: "Indoor Court 1",
    checkinOpenAt: iso("2026-03-08T12:00:00"),
    status: "completed", mode: "onsite",
    updatedAt: iso("2026-03-08T15:10:00"),
    referees: [mockPlayers[3]],
    replayUrl: "https://example.test/replay/301",
    checkedIn: 10,
    // ผลยืนยันแล้ว ไม่มีอะไรให้ใครทำอีก
    viewer: viewer(["referee"], { recordStats: true }),
  }),
  mk({
    id: 302, stage: "Semi-final", tag: "SF2",
    bracketNodeId: 402, nextMatchId: 305,
    teamA: mockTeams[13], teamB: mockTeams[14],
    scheduledTime: iso("2026-03-08T15:00:00"),
    venue: "Indoor Court 1",
    checkinOpenAt: iso("2026-03-08T14:00:00"),
    status: "disputed", mode: "onsite",
    updatedAt: iso("2026-03-08T17:30:00"),
    referees: [mockPlayers[3]],
    checkedIn: 8,
    // ผู้จัดเป็นคนเดียวที่ปิดข้อพิพาทได้
    viewer: viewer(["organizer"], { resolveDispute: true }),
  }),
  mk({
    id: 303, stage: "Final", tag: "F1",
    bracketNodeId: 403,
    teamA: mockTeams[11], teamB: mockTeams[13],
    scheduledTime: iso("2026-03-09T13:00:00"),
    venue: "Indoor Court 2",
    checkinOpenAt: iso("2026-03-09T12:00:00"),
    status: "checkin_open", mode: "onsite",
    referees: [mockPlayers[3]],
    checkedIn: 3,
    // onsite: กรรมการกรอกผล และคุมเช็คอิน · เราลงเล่นด้วยและเป็นหัวหน้าทีม
    viewer: viewer(["referee", "player"],
      { submitResult: true, manageCheckin: true, recordStats: true },
      { myTeamId: 11, isTeamLeader: true }),
  }),
  mk({
    id: 304, stage: "Round 1", tag: "R1-M4",
    bracketNodeId: 404, nextMatchId: 305,
    teamA: mockTeams[12], teamB: null,  // TBD — ยังไม่รู้คู่แข่ง
    status: "scheduled", mode: "online",
    roomCode: "LTMS-8842",
    viewer: viewer(["player"], {}, { myTeamId: 12, isTeamLeader: false }),
  }),
];

// ── Results ────────────────────────────────────────────────────────────────
export const mockResults: MatchResultDto[] = [
  {
    id: 501,
    matchId: 301,
    winnerTeamId: 11,
    scoreData: { a: 3, b: 1 },
    submittedBy: mockPlayers[3],
    submittedRole: "referee",
    status: "verified",
    disputeReason: null,
    disputeRaisedBy: null,
    disputeRaisedAt: null,
    disputeResolvedBy: null,
    disputeResolution: null,
    disputeResolvedAt: null,
    verifiedBy: mockPlayers[3],
    verifiedAt: iso("2026-03-08T15:10:00"),
    amendedBy: null,
    amendReason: null,
    amendedAt: null,
    createdAt: iso("2026-03-08T15:05:00"),
  },
  {
    id: 502,
    matchId: 302,
    winnerTeamId: 13,
    scoreData: { a: 2, b: 2, decider: { a: 5, b: 4, kind: "Penalties" } },
    submittedBy: mockPlayers[1],
    submittedRole: "team_leader",
    status: "disputed",
    disputeReason: "สกอร์ครึ่งหลังไม่ตรงกับที่กรรมการขาน",
    disputeRaisedBy: mockPlayers[2],
    disputeRaisedAt: iso("2026-03-08T17:30:00"),
    disputeResolvedBy: null,
    disputeResolution: null,
    disputeResolvedAt: null,
    verifiedBy: null,
    verifiedAt: null,
    amendedBy: null,
    amendReason: null,
    amendedAt: null,
    createdAt: iso("2026-03-08T17:05:00"),
  },
];

// ── Check-ins ──────────────────────────────────────────────────────────────
export const mockCheckins: MatchCheckinDto[] = [
  {
    id: 601,
    matchId: 303,
    user: mockPlayers[1],
    method: "qr_onsite",
    status: "success",
    rejectionReason: null,
    documentType: null,
    documentS3Key: null,
    verifiedByReferee: null,
    checkedInAt: iso("2026-03-09T12:15:00"),
    verifiedAt: null,
  },
  {
    id: 602,
    matchId: 303,
    user: mockPlayers[2],
    method: "photo_online",
    status: "exception",
    rejectionReason: null,
    documentType: "student_id",
    documentS3Key: "checkins/303/2/student_id.jpg",
    verifiedByReferee: null,
    checkedInAt: iso("2026-03-09T12:20:00"),
    verifiedAt: null,
  },
];

// ── Player stats ───────────────────────────────────────────────────────────
export const mockStats: PlayerMatchStatDto[] = [
  {
    id: 701,
    matchId: 301,
    player: mockPlayers[1],
    teamId: 11,
    recordedByReferee: mockPlayers[3],
    values: { goals: 2, assists: 1, yellow_cards: 0 },
    createdAt: iso("2026-03-08T15:06:00"),
  },
  {
    id: 702,
    matchId: 301,
    player: mockPlayers[2],
    teamId: 12,
    recordedByReferee: mockPlayers[3],
    values: { goals: 1, assists: 0, yellow_cards: 1 },
    createdAt: iso("2026-03-08T15:06:00"),
  },
];

// ── Standings ──────────────────────────────────────────────────────────────
export const mockStandings: TournamentStandingDto[] = [
  { tournamentId: 201, team: mockTeams[11], played: 1, won: 1, lost: 0, points: 3, updatedAt: iso("2026-03-08T15:10:00"), rank: 1 },
  { tournamentId: 201, team: mockTeams[13], played: 1, won: 1, lost: 0, points: 3, updatedAt: iso("2026-03-08T17:05:00"), rank: 1 },
  { tournamentId: 201, team: mockTeams[12], played: 1, won: 0, lost: 1, points: 0, updatedAt: iso("2026-03-08T15:10:00"), rank: 3 },
  { tournamentId: 201, team: mockTeams[14], played: 1, won: 0, lost: 1, points: 0, updatedAt: iso("2026-03-08T17:05:00"), rank: 3 },
];

// ── รายการแมตช์ของฉัน (หน้า /matches) ─────────────────────────────────────
/** ประกอบจาก mockMatches ไม่ได้พิมพ์ซ้ำ — แก้ที่เดียวแล้วตรงกันหมด */
export const mockMyMatches: MatchListItemDto[] = mockMatches.map((m) => {
  const result = mockResults.find((r) => r.matchId === m.id);
  const sd = result?.scoreData as { a?: number; b?: number } | null | undefined;
  return {
    ...m,
    score: sd ? { a: sd.a ?? null, b: sd.b ?? null } : null,
    resultStatus: result?.status ?? null,
  };
});

/** id generator ให้ mock mutation สร้างแถวใหม่ได้ไม่ชนกัน */
let nextId = 900;
export const takeNextMockId = () => ++nextId;
