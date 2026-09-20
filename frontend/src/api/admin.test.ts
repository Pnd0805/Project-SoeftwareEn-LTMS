/**
 * สัญญากรรมการและคำร้องทีม Official กับ origin/backend
 * referee.routes.ts (F01–F06) · adminScope.routes.ts (team-requests, requireAdmin_U)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  USE_MOCK: false,
}));

import {
  acceptRefereeInvitation, appointReferee, approveTeamRequest, declineRefereeInvitation,
  getExternalRefereeRequests, getMyRefereeInvitations, getRefereeCoverage, getTeamRequests,
  getTournamentReferees, getUsersForAdmin, grantAdminScope, rejectTeamRequest, removeReferee,
  reviewExternalReferee, revokeAdminScope, suspendUser,
} from "./admin";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiError = (status: number, code: string, details?: unknown) =>
  json({ error: { code, message: code, ...(details === undefined ? {} : { details }) } }, status);
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

describe("referee invitations", () => {
  it("GET /me/referee-invitations", async () => {
    const items = [{ id: 4, tournament: { id: 5, name: "Spring Cup", sportTypeId: 1, eventStartDate: "2026-10-01" }, isExternal: false, createdAt: "2026-09-10T00:00:00.000Z" }];
    fetchMock.mockResolvedValueOnce(json({ items }));

    await expect(getMyRefereeInvitations()).resolves.toEqual({ items });
    expect(lastRequest().path).toBe("/me/referee-invitations");
  });

  it("POST /referee-invitations/:id/accept returns the invitation state", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 4, invitationStatus: "accepted" }));

    await expect(acceptRefereeInvitation(4)).resolves.toEqual({ id: 4, invitationStatus: "accepted" });
    expect(lastRequest()).toMatchObject({ path: "/referee-invitations/4/accept", method: "POST" });
  });

  it("POST /referee-invitations/:id/decline handles 204 with no body", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(declineRefereeInvitation(4)).resolves.toBeUndefined();
    expect(lastRequest()).toMatchObject({ path: "/referee-invitations/4/decline", method: "POST" });
  });

  it("answering twice is 409 INVITATION_ALREADY_ANSWERED", async () => {
    fetchMock.mockResolvedValueOnce(apiError(409, "INVITATION_ALREADY_ANSWERED"));

    await expect(acceptRefereeInvitation(4)).rejects.toMatchObject({ status: 409, code: "INVITATION_ALREADY_ANSWERED" });
  });
});

describe("tournament referees", () => {
  it("GET /tournaments/:id/referees returns items and acceptedCount", async () => {
    const body = { items: [{ id: 1, user: { id: 9, fullName: "Kittipong", avatarUrl: null }, invitationStatus: "accepted", isExternal: false, externalApprovalStatus: "not_required" }], acceptedCount: 1 };
    fetchMock.mockResolvedValueOnce(json(body));

    await expect(getTournamentReferees(5)).resolves.toEqual(body);
    expect(lastRequest().path).toBe("/tournaments/5/referees");
  });

  it("the referee list is organizer-only", async () => {
    fetchMock.mockResolvedValueOnce(apiError(403, "FORBIDDEN"));

    await expect(getTournamentReferees(5)).rejects.toMatchObject({ status: 403 });
  });

  it("F03 removal looks up the tournamentRefereeId of the user first", async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [{ id: 11, user: { id: 9 } }], acceptedCount: 1, effectiveCount: 1 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await removeReferee(5, 9);
    expect(lastRequest()).toEqual({ path: "/tournaments/5/referees/11", method: "DELETE", body: undefined });
  });

  it("F03 removal is 404 when that user is not a referee of the tournament", async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [], acceptedCount: 0, effectiveCount: 0 }));

    await expect(removeReferee(5, 9)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("F14 coverage sums the per-match numbers the backend returns", async () => {
    fetchMock.mockResolvedValueOnce(json({
      matchesTotal: 3, matchesCovered: 2,
      uncovered: [{ matchId: 7, roundNumber: 1, scheduledTime: null, needed: 2, assigned: 1 }],
      conflicts: [],
    }));

    await expect(getRefereeCoverage(5)).resolves.toEqual({
      tournamentId: 5, required: 2, accepted: 1, shortfall: 1, blocksStatRecording: true,
    });
    expect(lastRequest().path).toBe("/tournaments/5/referees/coverage");
  });
});

describe("admin official-team requests", () => {
  it("GET /admin/team-requests rejects admins without university-wide scope", async () => {
    fetchMock.mockResolvedValueOnce(apiError(403, "INSUFFICIENT_ADMIN_SCOPE"));

    await expect(getTeamRequests()).rejects.toMatchObject({ status: 403, code: "INSUFFICIENT_ADMIN_SCOPE" });
    expect(lastRequest().path).toBe("/admin/team-requests");
  });

  it("POST /admin/team-requests/:id/approve returns the team's new status", async () => {
    fetchMock.mockResolvedValueOnce(json({ teamId: 3, officialStatus: "Official" }));

    await expect(approveTeamRequest(2)).resolves.toEqual({ teamId: 3, officialStatus: "Official" });
    expect(lastRequest()).toEqual({ path: "/admin/team-requests/2/approve", method: "POST", body: undefined });
  });

  it("approve keeps MEMBER_CONFLICT details", async () => {
    const details = [{ userId: 8 }];
    fetchMock.mockResolvedValueOnce(apiError(422, "MEMBER_CONFLICT", details));

    await expect(approveTeamRequest(2)).rejects.toMatchObject({ status: 422, code: "MEMBER_CONFLICT", details });
  });

  it("POST /admin/team-requests/:id/reject sends { reason }", async () => {
    fetchMock.mockResolvedValueOnce(json({ status: "rejected", reason: "เอกสารไม่ครบ" }));

    await expect(rejectTeamRequest(2, "เอกสารไม่ครบ")).resolves.toEqual({ status: "rejected", reason: "เอกสารไม่ครบ" });
    expect(lastRequest()).toEqual({ path: "/admin/team-requests/2/reject", method: "POST", body: { reason: "เอกสารไม่ครบ" } });
  });

  it("reject without a reason is 400 TEAM_REJECT_REASON_REQUIRED", async () => {
    fetchMock.mockResolvedValueOnce(apiError(400, "TEAM_REJECT_REASON_REQUIRED"));

    await expect(rejectTeamRequest(2, "")).rejects.toMatchObject({ status: 400, code: "TEAM_REJECT_REASON_REQUIRED" });
  });
});

describe("routes the backend does not have yet", () => {
  it("POST /tournaments/:id/referees sends isExternal", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 7, userId: 42, invitationStatus: "pending", isExternal: true }, 201));

    await appointReferee(5, { userId: 42, isExternal: true });
    expect(lastRequest()).toEqual({
      path: "/tournaments/5/referees", method: "POST", body: { userId: 42, isExternal: true, matchIds: [] },
    });
  });

  it("AR01 flattens the per-person queue into one row per tournament", async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [{
      userId: 42,
      user: { id: 42, fullName: "External Ref", avatarUrl: null, email: "ref@ku.th" },
      docs: ["referee/42.jpg"],
      tournaments: [{ id: 5, name: "Spring Cup", tournamentRefereeId: 11 }],
      submittedAt: "2026-09-10T00:00:00.000Z",
    }] }));

    const { items } = await getExternalRefereeRequests();
    expect(lastRequest().path).toBe("/admin/referee-requests");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 42, tournament: { id: 5 }, invitedBy: null, status: "pending" });
  });

  it("AR02 approves per person, not per request row", async () => {
    fetchMock.mockResolvedValueOnce(json({ userId: 42, identityStatus: "approved", tournamentsUpdated: 2 }));

    await expect(reviewExternalReferee(42, { approve: true })).rejects.toMatchObject({ status: 404 });
    expect(lastRequest()).toEqual({ path: "/admin/referee-requests/42/approve", method: "POST", body: undefined });
  });

  it("user management and admin rights fail without calling fetch", async () => {
    await expect(getUsersForAdmin()).rejects.toMatchObject({ status: 501 });
    await expect(suspendUser(9, { suspend: true, reason: "spam" })).rejects.toMatchObject({ status: 501 });
    await expect(grantAdminScope({ userId: 9, scopeType: "university_wide" })).rejects.toMatchObject({ status: 501 });
    await expect(revokeAdminScope(10)).rejects.toMatchObject({ status: 501 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
