/**
 * สัญญาใบสมัครกับ origin/backend — application.routes.ts / application.service.ts
 * ปิดโหมด mock เฉพาะไฟล์นี้ แล้ว stub fetch เพื่อตรวจเส้นทาง body และ error code
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  USE_MOCK: false,
}));

import {
  applyToTournament, approveAllApplications, approveApplication, cancelMyApplication,
  completeTournament, drawTournament, getApplicationDetail, getMyApplications, getTournamentAmendmentRequests,
  getTournamentApplications, getTournaments, openRegistration, closeRegistration, rejectApplication, withdrawMyApplication,
} from "./tournament";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiError = (status: number, code: string, message = code, details?: unknown) =>
  json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status);
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return {
    path: new URL(String(url), "http://localhost").pathname.replace(/^\/api\/v1/, ""),
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
};

describe("apply to a tournament", () => {
  it("POST /tournaments/:id/applications sends the entered players and returns 201 pending", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 11, status: "pending", hardFilterPassed: true }, 201));

    await expect(applyToTournament(5, { teamId: 3, playerIds: [9201, 9202] }))
      .resolves.toEqual({ id: 11, status: "pending", hardFilterPassed: true });
    expect(lastRequest()).toEqual({
      path: "/tournaments/5/applications", method: "POST", body: { teamId: 3, playerIds: [9201, 9202] },
    });
  });

  /* `squad` เป็น id ของ store ของโหมด prototype — หลุดไปกับ body ของจริงไม่ได้
     และ playerIds ต้องมีเสมอ เพราะ applyTournamentSchema บังคับ (P01) */
  it("never sends the prototype squad list, and always sends playerIds", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 12, status: "pending" }, 201));

    await applyToTournament(5, { teamId: 3, squad: ["u-1", "u-2"] });
    expect(lastRequest()).toEqual({
      path: "/tournaments/5/applications", method: "POST", body: { teamId: 3, playerIds: [] },
    });
  });

  it("keeps the failed-member details from 422 HARD_FILTER_FAILED", async () => {
    const details = [{ userId: 8, reason: "age" }];
    fetchMock.mockResolvedValueOnce(apiError(422, "HARD_FILTER_FAILED", "A member is not eligible", details));

    await expect(applyToTournament(5, { teamId: 3 })).rejects.toMatchObject({ status: 422, code: "HARD_FILTER_FAILED", details });
  });

  it("reports 409 TEAM_NOT_READY instead of creating an application", async () => {
    fetchMock.mockResolvedValueOnce(apiError(409, "TEAM_NOT_READY"));

    await expect(applyToTournament(5, { teamId: 3 })).rejects.toMatchObject({ status: 409, code: "TEAM_NOT_READY" });
  });
});

describe("application lists", () => {
  it("GET /me/applications", async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [] }));

    await expect(getMyApplications()).resolves.toEqual({ items: [] });
    expect(lastRequest().path).toBe("/me/applications");
  });

  it("GET /tournaments/:id/applications is organizer-only", async () => {
    fetchMock.mockResolvedValueOnce(apiError(403, "NOT_ORGANIZER"));

    await expect(getTournamentApplications(5)).rejects.toMatchObject({ status: 403, code: "NOT_ORGANIZER" });
    expect(lastRequest().path).toBe("/tournaments/5/applications");
  });

  it("GET /applications/:id keeps the submitted player list", async () => {
    const detail = {
      id: 7, tournamentId: 5, team: { id: 3, name: "Blue", sportTypeId: 2 }, status: "pending",
      hardFilterDetails: [], softFilterDocuments: [],
      players: [{ userId: 9201, fullName: "Player One", avatarUrl: null }],
    };
    fetchMock.mockResolvedValueOnce(json(detail));

    await expect(getApplicationDetail(7)).resolves.toEqual(detail);
    expect(lastRequest().path).toBe("/applications/7");
  });
});

describe("application actions", () => {
  it("POST /applications/:id/cancel", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 7, status: "cancelled" }));

    await cancelMyApplication(7);
    expect(lastRequest()).toMatchObject({ path: "/applications/7/cancel", method: "POST" });
  });

  it("cancel by someone who is not the team leader is 403 NOT_TEAM_LEADER", async () => {
    fetchMock.mockResolvedValueOnce(apiError(403, "NOT_TEAM_LEADER"));

    await expect(cancelMyApplication(7)).rejects.toMatchObject({ status: 403, code: "NOT_TEAM_LEADER" });
  });

  it("withdraw before approval is 409 APPLICATION_NOT_APPROVED", async () => {
    fetchMock.mockResolvedValueOnce(apiError(409, "APPLICATION_NOT_APPROVED"));

    await expect(withdrawMyApplication(7)).rejects.toMatchObject({ status: 409, code: "APPLICATION_NOT_APPROVED" });
    expect(lastRequest()).toMatchObject({ path: "/applications/7/withdraw", method: "POST" });
  });

  it("POST /applications/:id/approve sends no body", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 7, status: "approved" }));

    await approveApplication(5, 7);
    expect(lastRequest()).toEqual({ path: "/applications/7/approve", method: "POST", body: undefined });
  });

  it("POST /applications/:id/reject sends { reason }", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 7, status: "rejected" }));

    await rejectApplication(5, 7, "เอกสารไม่ครบ");
    expect(lastRequest()).toEqual({ path: "/applications/7/reject", method: "POST", body: { reason: "เอกสารไม่ครบ" } });
  });

  it("approve by a non-organizer is 403 NOT_ORGANIZER", async () => {
    fetchMock.mockResolvedValueOnce(apiError(403, "NOT_ORGANIZER"));

    await expect(approveApplication(5, 7)).rejects.toMatchObject({ status: 403, code: "NOT_ORGANIZER" });
  });

  it("approve-all has no backend route, so it fails without calling fetch", async () => {
    await expect(approveAllApplications(5)).rejects.toMatchObject({ status: 501 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("registration lifecycle", () => {
  it("opens registration through the dedicated organizer route", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 5, registrationOpen: true }));

    await expect(openRegistration(5)).resolves.toEqual({ id: 5, registrationOpen: true });
    expect(lastRequest()).toEqual({ path: "/tournaments/5/open-registration", method: "POST", body: undefined });
  });

  it("closes registration before the bracket is drawn", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 5, registrationOpen: false }));

    await expect(closeRegistration(5)).resolves.toEqual({ id: 5, registrationOpen: false });
    expect(lastRequest()).toEqual({ path: "/tournaments/5/close-registration", method: "POST", body: undefined });
  });
});

describe("BE_KN a14d44c/a88f7ad tournament contracts", () => {
  it("GET /tournaments forwards status=completed", async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [] }));

    await getTournaments({ status: "completed" });

    expect(String(fetchMock.mock.calls[0]![0])).toContain("/tournaments?status=completed");
  });

  it("POST /tournaments/:id/complete keeps MATCHES_UNFINISHED metadata", async () => {
    const matches = [{ id: 41, status: "scheduled" }];
    fetchMock.mockResolvedValueOnce(json({ error: { code: "MATCHES_UNFINISHED", message: "unfinished", matches } }, 409));

    await expect(completeTournament(5)).rejects.toMatchObject({
      status: 409, code: "MATCHES_UNFINISHED", extra: { matches },
    });
    expect(lastRequest()).toMatchObject({ path: "/tournaments/5/complete", method: "POST" });
  });

  it("M01 sends replace=true and returns the replaced response", async () => {
    const bracket = { matchCount: 3, bracketFormat: "single_elimination", nodeCount: 3, replaced: true };
    fetchMock
      .mockResolvedValueOnce(json(bracket, 201))
      .mockResolvedValueOnce(json({ id: 5, name: "Cup" }));

    await expect(drawTournament(5, { teamIds: [11, 12], replace: true }))
      .resolves.toMatchObject({ bracket });
    expect(fetchMock.mock.calls[0]![1]?.body).toBe(JSON.stringify({
      seedingMethod: "manual", manualSeeds: [11, 12], replace: true,
    }));
  });

  it("C09b reads the organizer amendment history", async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [] }));

    await expect(getTournamentAmendmentRequests(5)).resolves.toEqual({ items: [] });
    expect(lastRequest().path).toBe("/tournaments/5/amendment-requests");
  });
});
