import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  USE_MOCK: false,
}));

import { checkin, getCheckins, getMatch, getMatchLineups, getResult, getStandings, getMyMatches, overrideResult } from "./match";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('unfiltered personal schedule', () => {
  const row = (id: number, role: 'player' | 'referee', conflicts: number[]) => ({
    id, role, myTeamId: role === 'player' ? 3 : null,
    tournament: { id: id + 20, name: `Tour ${id}`, sportTypeId: 1 }, round: 1,
    teamA: { id: 3, name: 'A' }, teamB: { id: 4, name: 'B' },
    scheduledTime: '2026-10-10T03:00:00Z', scheduledEndTime: '2026-10-10T04:00:00Z',
    mode: 'online', venue: 'Room', status: 'scheduled', conflictingMatchIds: conflicts,
  });
  const serve = (rows: unknown[], failure = false) => fetchMock.mockImplementation(input => {
    const url = String(input);
    if (url.endsWith('/me/matches')) return Promise.resolve(failure ? json({ code: 'FORBIDDEN', message: 'Denied' }, 403) : json({ items: rows }));
    if (url.endsWith('/me')) return Promise.resolve(json({ id: 9 }));
    return Promise.resolve(json({ items: [], pagination: { totalPages: 1 } }));
  });
  it('keeps cross-role conflicts and server modes, including matches outside the enrichment cap', async () => {
    const rows = Array.from({ length: 14 }, (_, i) => row(i + 1, i === 13 ? 'referee' : 'player', i === 0 ? [14] : i === 13 ? [1] : []));
    serve(rows);
    const result = await getMyMatches();
    expect(result.items).toHaveLength(14);
    expect(result.items.find(m => m.id === 1)).toMatchObject({ conflictingMatchIds: [14], mode: 'online', viewer: { roles: ['player'], myTeamId: 3 } });
    expect(result.items.find(m => m.id === 14)).toMatchObject({ conflictingMatchIds: [1], viewer: { roles: ['referee'] } });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/me/matches?'))).toBe(false);
  });
  it('merges two roles on one match and excludes a self conflict', async () => {
    serve([row(1, 'player', [1, 2]), row(1, 'referee', [2]), row(2, 'referee', [1])]);
    const result = await getMyMatches();
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ conflictingMatchIds: [2], viewer: { roles: ['player', 'referee'] } });
  });
  it('propagates a personal schedule read failure instead of claiming there are no conflicts', async () => {
    serve([], true);
    await expect(getMyMatches()).rejects.toMatchObject({ status: 403, message: 'Denied' });
  });
});

describe("match check-in contract", () => {
  const checkedInRow = {
    id: 41,
    userId: 9201,
    fullName: "Checked Player",
    method: "manual_by_referee",
    status: "checked_in",
    documentType: null,
    documentUrl: null,
    note: "QR unavailable",
    checkedInAt: "2026-09-21T10:00:00.000Z",
  };

  it("maps GET /matches/:id/checkins by the backend userId without pagination assumptions", async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [checkedInRow] }));

    await expect(getCheckins(12)).resolves.toMatchObject({
      items: [{ id: 41, user: { id: 9201, fullName: "Checked Player" }, status: "success" }],
    });
  });

  it("reads the public approved lineup and preserves check-in states", async () => {
    const lineups = {
      matchId: 12,
      teamA: { teamId: 3, players: [{
        userId: 9201, fullName: "Checked Player", avatarUrl: null,
        checkinStatus: "checked_in", checkedInAt: "2026-09-21T10:00:00.000Z",
      }] },
      teamB: null,
    };
    fetchMock.mockResolvedValueOnce(json(lineups));

    await expect(getMatchLineups(12)).resolves.toEqual(lineups);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/matches/12/lineups");
  });

  it("reconciles ALREADY_CHECKED_IN with a fresh list read for the same user", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: {
        code: "ALREADY_CHECKED_IN",
        message: "Player is already checked in",
        details: { status: "checked_in" },
      } }, 409))
      .mockResolvedValueOnce(json({ items: [checkedInRow] }));

    await expect(checkin(12, {
      method: "manual_by_referee", userId: 9201, note: "QR unavailable",
    })).resolves.toMatchObject({ user: { id: 9201 }, status: "success" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/matches/12/checkins");
  });

  it("keeps the duplicate error when the fresh list does not contain that user", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: {
        code: "ALREADY_CHECKED_IN", message: "Player is already checked in",
      } }, 409))
      .mockResolvedValueOnce(json({ items: [] }));

    await expect(checkin(12, {
      method: "manual_by_referee", userId: 9201,
    })).rejects.toMatchObject({ status: 409, code: "ALREADY_CHECKED_IN" });
  });

  it("submits an on-site participant check-in with the backend qrPayload field", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 52, status: "checked_in", checkedInAt: "2026-09-21T11:00:00.000Z" }, 201));

    await expect(checkin(12, { method: "qr_onsite", qrToken: "signed-qr" }))
      .resolves.toMatchObject({ id: 52, method: "qr_onsite", status: "success" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      method: "qr_onsite", qrPayload: "signed-qr",
    });
  });

  it("presigns and uploads an online photo before submitting its object key", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ uploadUrl: "https://upload.test/checkin", objectKey: "checkins/12/id.jpg" }))
      .mockResolvedValueOnce(new Response(new Blob(["photo"], { type: "image/jpeg" })))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json({ id: 53, status: "pending", checkedInAt: "2026-09-21T11:01:00.000Z" }, 201));

    await expect(checkin(12, {
      method: "photo_online", documentType: "student_id",
      documentS3Key: "data:image/jpeg;base64,cGhvdG8=",
    })).resolves.toMatchObject({ id: 53, method: "photo_online", status: "exception" });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/uploads/presign");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://upload.test/checkin");
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toEqual({
      method: "photo_online", documentType: "student_id", documentS3Key: "checkins/12/id.jpg",
    });
  });
});

describe("S12 standings contract", () => {
  it("uses backend points, goals and duplicate ranks without deriving or sorting", async () => {
    const items = [
      { team: { id: 11, name: "Zulu", sportTypeId: 1 }, played: 2, wins: 1, losses: 1, points: 8, goalsFor: 5, goalsAgainst: 4, goalDiff: 1, rank: 1 },
      { team: { id: 12, name: "Alpha", sportTypeId: 1 }, played: 2, wins: 1, losses: 1, points: 8, goalsFor: 5, goalsAgainst: 4, goalDiff: 1, rank: 1 },
    ];
    fetchMock
      .mockResolvedValueOnce(json({ items }))
      .mockResolvedValueOnce(json({ bracketFormat: "round_robin" }));

    const result = await getStandings(5);

    expect(result?.rows.map(row => ({
      id: row.team.id, rank: row.rank, played: row.played, points: row.points,
      for: row.scoredFor, against: row.scoredAgainst, diff: row.scoreDifference,
    }))).toEqual([
      { id: 11, rank: 1, played: 2, points: 8, for: 5, against: 4, diff: 1 },
      { id: 12, rank: 1, played: 2, points: 8, for: 5, against: 4, diff: 1 },
    ]);
  });
});

/**
 * R21 — เหตุผลที่โต้แย้งและเหตุผลที่ผลถูกยก ต้องไหลถึงหน้าจอเมื่อ backend ส่งมา
 *
 * ตอนนี้ S05 ยังไม่ส่งหกช่องนี้ ชั้น api จึงต้องอ่านแบบ optional: ไม่มี = null เหมือนเดิม
 * มี = ส่งต่อตามจริง จะได้ไม่ต้องกลับมาแก้ mapper อีกรอบวันที่ backend เติม
 */
describe("dispute detail contract (S05)", () => {
  const base = {
    matchId: 9, winnerTeamId: 9027, scoreData: { "9027": 3, "9028": 2 },
    isAmended: false, amendedAt: null, amendReason: null, verifiedAt: null,
    status: "disputed", isWalkover: false,
  };

  it("carries the dispute reason, who raised it and when, once they are sent", async () => {
    fetchMock
      .mockResolvedValueOnce(json({
        ...base,
        disputeReason: "สกอร์เซตสามไม่ตรงใบบันทึก",
        disputeRaisedBy: { id: 9213, fullName: "หัวหน้าทีม ข", avatarUrl: null },
        disputeRaisedAt: "2026-09-22T04:00:00.000Z",
      }))
      .mockResolvedValueOnce(json({ id: 9, teamA: { id: 9027 }, teamB: { id: 9028 } }));

    await expect(getResult(9)).resolves.toMatchObject({
      status: "disputed",
      disputeReason: "สกอร์เซตสามไม่ตรงใบบันทึก",
      disputeRaisedBy: { id: 9213, fullName: "หัวหน้าทีม ข" },
      disputeRaisedAt: "2026-09-22T04:00:00.000Z",
    });
  });

  it("still answers null for each of them while the backend omits the fields", async () => {
    fetchMock
      .mockResolvedValueOnce(json(base))
      .mockResolvedValueOnce(json({ id: 9, teamA: { id: 9027 }, teamB: { id: 9028 } }));

    await expect(getResult(9)).resolves.toMatchObject({
      disputeReason: null, disputeRaisedBy: null, disputeRaisedAt: null,
      disputeResolution: null, disputeResolvedBy: null, disputeResolvedAt: null,
    });
  });
});

/**
 * OD-26 (BE_KN 26 ก.ย.) — ต้องกด "จบการแข่งขัน" ก่อนส่งผล
 * S01 ตอบ `409 MATCH_NOT_FINISHED` กับทุกสถานะยกเว้น `finished`/`result_rejected`
 * เดิม FE เปิดฟอร์มผลตั้งแต่ `checkin_open`/`in_progress` และไม่มีปุ่มจบเลย (รายงาน 29 ก.ย. แมตช์ 13)
 */
describe("finish-then-submit contract (OD-26)", () => {
  const REFEREE = 9002;
  const ORGANIZER = 9001;
  const routeAs = (me: number, status: string) => (input: RequestInfo | URL) => {
    const url = String(input);
    const path = url.slice(url.indexOf("/api/v1") + "/api/v1".length).split("?")[0];
    if (path === "/matches/13") {
      return Promise.resolve(json({
        id: 13, tournamentId: 23, round: 1,
        teamA: { id: 9024, name: "A", sportTypeId: 2 }, teamB: { id: 9023, name: "B", sportTypeId: 2 },
        scheduledTime: "2026-11-20T03:00:00.000Z", scheduledEndTime: "2026-11-20T05:00:00.000Z",
        venue: "Court 1", checkinOpenAt: null, status, mode: "onsite", roomCode: null,
        nextMatchId: null, loserNextMatchId: null, resultStatus: null, score: null, outcome: null,
      }));
    }
    if (path === "/matches/13/referees") {
      return Promise.resolve(json({ items: [{ referee: { id: REFEREE, fullName: "Ref", avatarUrl: null } }] }));
    }
    if (path === "/me") return Promise.resolve(json({ id: me }));
    if (path === "/tournaments/23") {
      return Promise.resolve(json({ name: "Cup", sportTypeId: 2, organizer: { id: ORGANIZER } }));
    }
    if (path === "/matches/13/lineups") {
      return Promise.resolve(json({ matchId: 13, teamA: { teamId: 9024, players: [] }, teamB: { teamId: 9023, players: [] } }));
    }
    if (path === "/me/teams") return Promise.resolve(json({ items: [] }));
    if (path === "/matches/13/checkins") return Promise.resolve(json({ items: [] }));
    return Promise.resolve(json({ error: { code: "NOT_FOUND", message: path } }, 404));
  };

  it("allows the referee to enter scores during play and finish before submitting", async () => {
    fetchMock.mockImplementation(routeAs(REFEREE, "in_progress"));
    const m = await getMatch(13);
    expect(m.viewer.can.submitResult).toBe(true);
    expect(m.viewer.can.finishMatch).toBe(true);
  });

  it("opens the result form once the match is finished, and stops offering Finish", async () => {
    fetchMock.mockImplementation(routeAs(REFEREE, "finished"));
    const m = await getMatch(13);
    expect(m.viewer.can.submitResult).toBe(true);
    expect(m.viewer.can.finishMatch).toBe(false);
  });

  it("does not open the form at check-in either — the old rule the backend dropped", async () => {
    fetchMock.mockImplementation(routeAs(REFEREE, "checkin_open"));
    expect((await getMatch(13)).viewer.can.submitResult).toBe(false);
  });

  /* Q4b — ผู้จัดกดจบแทนได้ เพื่อไม่ให้ขั้นบังคับกลายเป็นจุดค้างเมื่อกรรมการหายไป
     แต่ on-site ผู้จัดไม่ใช่คนส่งผล (BR-13) */
  it("lets the organizer finish the match but not record an on-site result", async () => {
    fetchMock.mockImplementation(routeAs(ORGANIZER, "in_progress"));
    const playing = await getMatch(13);
    expect(playing.viewer.can.finishMatch).toBe(true);
    fetchMock.mockImplementation(routeAs(ORGANIZER, "finished"));
    expect((await getMatch(13)).viewer.can.submitResult).toBe(false);
  });

  /* R20 — M09 เปิดให้กรรมการของแมตช์แล้ว (ยืนยันสด 29 ก.ย.) */
  it("lets the match referee open check-in", async () => {
    fetchMock.mockImplementation(routeAs(REFEREE, "scheduled"));
    expect((await getMatch(13)).viewer.can.openCheckin).toBe(true);
  });
});

/* OD-59 / OD-55 (4 ต.ค.) — S05 บอกตัวผู้บันทึกแบบมีเงื่อนไข และ S02b ให้กรรมการแก้ผล online */
describe("result recorder and referee correction", () => {
  const detail = {
    id: 12, tournamentId: 21, round: 1,
    teamA: { id: 9007, name: "A", sportTypeId: 3 }, teamB: { id: 9008, name: "B", sportTypeId: 3 },
    status: "finished", mode: "online",
  };
  const route = (resultBody: Record<string, unknown>) => (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/matches/12/result")) return Promise.resolve(json(resultBody));
    if (url.endsWith("/matches/12")) return Promise.resolve(json(detail));
    return Promise.resolve(json({}));
  };
  const base = { matchId: 12, winnerTeamId: 9008, scoreData: { "9007": 1, "9008": 2 }, status: "submitted",
    submittedRole: "team_leader", isAmended: false, amendedAt: null, amendReason: null, verifiedAt: null, isWalkover: false };

  it("reads a missing submittedBy key as hidden, not as an unnamed person", async () => {
    fetchMock.mockImplementation(route(base));
    const r = await getResult(12);
    expect(r.submittedByVisibility).toBe("hidden");
    expect(r.createdAt).toBe("");
  });

  it("reads submittedBy: null as a deleted account and keeps submittedAt", async () => {
    fetchMock.mockImplementation(route({ ...base, submittedBy: null, submittedAt: "2026-10-04T08:00:00.000Z" }));
    const r = await getResult(12);
    expect(r.submittedByVisibility).toBe("deleted");
    expect(r.createdAt).toBe("2026-10-04T08:00:00.000Z");
  });

  it("names the recorder when S05 sends them", async () => {
    fetchMock.mockImplementation(route({ ...base, submittedBy: { id: 9101, fullName: "Leader A", avatarUrl: null } }));
    const r = await getResult(12);
    expect(r.submittedByVisibility).toBe("shown");
    expect(r.submittedBy.fullName).toBe("Leader A");
  });

  it("posts a correction to S02b keyed by team id, with the reason", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/matches/12/result/override")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ winnerTeamId: 9007, scoreData: { "9007": 3, "9008": 1 }, reason: "Real score 3-1" });
        return Promise.resolve(json({ id: 5, matchId: 12, status: "submitted" }));
      }
      return route(base)(input);
    });
    await expect(overrideResult(12, { winnerTeamId: 9007, scoreData: { a: 3, b: 1 }, reason: "Real score 3-1" }))
      .resolves.toMatchObject({ status: "submitted" });
  });
});

/* OD-61 — teamA/teamB เป็น TeamRef ที่มี logoUrl แล้ว · ทีมไม่มีโลโก้ ≠ ช่องไม่มีทีม */
describe("team logos on matches", () => {
  it("carries a team's logo, keeps a logo-less team, and keeps an empty slot empty", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/matches/10")) {
        return Promise.resolve(json({
          id: 10, tournamentId: 17, round: 1, status: "scheduled", mode: "onsite",
          teamA: { id: 9003, name: "With logo", sportTypeId: 2, logoUrl: "http://localhost:9000/ltms-uploads/team_logo/9003/x.png" },
          teamB: null,
        }));
      }
      if (url.endsWith("/me")) return Promise.reject(new Error("signed out"));
      return Promise.resolve(json({ items: [] }));
    });
    const m = await getMatch(10);
    expect(m.teamA?.logoUrl).toBe("http://localhost:9000/ltms-uploads/team_logo/9003/x.png");
    expect(m.teamB).toBeNull();
  });
});
