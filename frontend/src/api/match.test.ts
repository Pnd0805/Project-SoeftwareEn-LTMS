import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  USE_MOCK: false,
}));

import { checkin, getCheckins, getMatchLineups, getResult, getStandings } from "./match";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

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
