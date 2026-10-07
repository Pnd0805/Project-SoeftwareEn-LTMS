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
  requestMatchReferee, reviewExternalReferee, revokeAdminScope, suspendUser,
  requestRefereeWithdrawal, submitRefereeIdentityDocs, requestExternalRefereeDocs,
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
    const body = { items: [{ id: 1, user: { id: 9, fullName: "Kittipong", avatarUrl: null }, invitationStatus: "accepted", isExternal: false, externalApprovalStatus: "not_required", status: "active" }], acceptedCount: 1, awaitingAdminCount: 0 };
    fetchMock.mockResolvedValueOnce(json(body));

    await expect(getTournamentReferees(5)).resolves.toMatchObject({
      acceptedCount: 1, awaitingAdminCount: 0,
      items: [{ id: 1, tournamentId: 5, isActive: true, user: { id: 9, fullName: "Kittipong" } }],
    });
    expect(lastRequest().path).toBe("/tournaments/5/referees");
  });

  it("FR02 requests one active tournament referee for one match", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 81, status: "open" }, 201));

    await requestMatchReferee(5, 17, 23);
    expect(lastRequest()).toEqual({
      path: "/tournaments/5/referee-requests/add-match", method: "POST",
      body: { tournamentRefereeId: 17, matchId: 23 },
    });
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
      // รางของผู้จัดต้องรู้ว่าขาดที่นัดไหน ยอดรวมอย่างเดียวบอกไม่ได้ (SetupTrail ขั้น 6)
      uncoveredMatchIds: [7],
      crossTournamentConflicts: [],
    });
    expect(lastRequest().path).toBe("/tournaments/5/referees/coverage");
  });

  it('retains local conflict IDs/counts without leaking unexpected private schedule fields', async () => {
    fetchMock.mockResolvedValueOnce(json({
      matchesTotal: 2, matchesCovered: 2, uncovered: [], conflicts: [],
      crossTournamentConflicts: [
        { userId: 70, matchId: 41, conflictCount: 2, tournamentName: 'Private Cup', outsideMatchId: 999 },
        { userId: 70, matchId: 42, conflictCount: 1 },
      ],
    }));
    const coverage = await getRefereeCoverage(5);
    expect(coverage.crossTournamentConflicts).toEqual([
      { userId: 70, matchId: 41, conflictCount: 2 },
      { userId: 70, matchId: 42, conflictCount: 1 },
    ]);
    expect(coverage.blocksStatRecording).toBe(false);
    expect(JSON.stringify(coverage)).not.toMatch(/Private Cup|outsideMatchId/);
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

describe("delivered admin-user contracts", () => {
  it('FR09 submits discriminated withdrawal scopes and U12/AR04 preserve docs and review reasons', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 3, status: 'open', matchA: null }));
    await requestRefereeWithdrawal({ scope: 'tournament', tournamentId: 14, reason: 'Unable to attend' });
    expect(lastRequest()).toEqual({ path: '/referee-requests/withdraw', method: 'POST', body: { scope: 'tournament', tournamentId: 14, reason: 'Unable to attend' } });
    fetchMock.mockResolvedValueOnce(json({ id: 4, status: 'open' }));
    await requestRefereeWithdrawal({ scope: 'match', matchId: 23, reason: 'Schedule overlap' });
    expect(lastRequest().body).toEqual({ scope: 'match', matchId: 23, reason: 'Schedule overlap' });
    fetchMock.mockResolvedValueOnce(json({ status: 'pending' }));
    await submitRefereeIdentityDocs(['referee_identity/42/test.png']);
    expect(lastRequest()).toEqual({ path: '/me/referee-identity/docs', method: 'PUT', body: { docs: ['referee_identity/42/test.png'] } });
    fetchMock.mockResolvedValueOnce(json({ identityStatus: 'needs_docs' }));
    await requestExternalRefereeDocs(42, 'Please send a clearer image');
    expect(lastRequest()).toEqual({ path: '/admin/referee-requests/42/request-docs', method: 'POST', body: { reason: 'Please send a clearer image' } });
  });
  it("POST /tournaments/:id/referees leaves external classification to the server", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 7, userId: 42, invitationStatus: "pending", isExternal: true }, 201));

    await expect(appointReferee(5, { userId: 42, isExternal: false })).resolves.toMatchObject({ isExternal: true });
    expect(lastRequest()).toEqual({
      path: "/tournaments/5/referees", method: "POST", body: { userId: 42, matchIds: [] },
    });
  });

  it("AR01 flattens the per-person queue into one row per tournament", async () => {
    fetchMock.mockResolvedValueOnce(json({ items: [{
      userId: 42,
      user: { id: 42, fullName: "External Ref", avatarUrl: null, email: "ref@ku.th" },
      docs: ["referee/42.jpg"],
      docsSubmitted: true,
      tournaments: [{ id: 5, name: "Spring Cup", tournamentRefereeId: 11 }],
      submittedAt: "2026-09-10T00:00:00.000Z",
    }] }));

    const { items } = await getExternalRefereeRequests();
    expect(lastRequest().path).toBe("/admin/referee-requests");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 42, tournament: { id: 5 }, invitedBy: null, status: "pending", docsSubmitted: true });
  });

  it("AR02 approves per person, not per request row", async () => {
    fetchMock.mockResolvedValueOnce(json({ userId: 42, identityStatus: "approved", tournamentsUpdated: 2 }));

    await expect(reviewExternalReferee(42, { approve: true })).resolves.toBeUndefined();
    expect(lastRequest()).toEqual({ path: "/admin/referee-requests/42/approve", method: "POST", body: undefined });
  });

  it("AR03 accepts a successful rejection and forwards its reason", async () => {
    fetchMock.mockResolvedValueOnce(json({ userId: 42, identityStatus: "rejected", tournamentsUpdated: 2 }));
    await expect(reviewExternalReferee(42, { approve: false, reason: "Documents do not match" })).resolves.toBeUndefined();
    expect(lastRequest()).toEqual({ path: "/admin/referee-requests/42/reject", method: "POST", body: { reason: "Documents do not match" } });
  });

  it("AR02 preserves a real backend failure", async () => {
    fetchMock.mockResolvedValueOnce(apiError(409, "REFEREE_DUPLICATE_ROWS"));
    await expect(reviewExternalReferee(42, { approve: true })).rejects.toMatchObject({ status: 409, code: "REFEREE_DUPLICATE_ROWS" });
  });

  it("uses delivered admin-user contracts and preserves suspension details", async () => {
    const user = { id: 9, fullName: 'Player', email: 'p@test', userType: 'student', facultyId: 1, isSuspended: false, suspendedReason: null, suspendedUntil: null, suspendedCategoryLabel: null, adminScope: null };
    fetchMock.mockResolvedValueOnce(json({ items: [user], pagination: { totalPages: 1 } }));
    expect((await getUsersForAdmin()).items[0]).toMatchObject({ user: { id: 9 }, teamCount: null });
    fetchMock.mockResolvedValueOnce(json({ ...user, isSuspended: true }));
    await suspendUser(9, { suspend: true, reason: "spam", category: "spam", days: 7 });
    expect(lastRequest()).toMatchObject({ path: '/admin/users/9/suspend', method: 'PATCH', body: { suspended: true, reason: 'spam', category: 'spam', days: 7 } });
    fetchMock.mockResolvedValueOnce(json({ id: 10, user: { id: 9, fullName: 'Player' }, scopeType: 'faculty', facultyId: 1, createdAt: '2026-10-01' }));
    await grantAdminScope({ userId: 9, scopeType: 'faculty', facultyId: 1 });
    expect(lastRequest()).toMatchObject({ path: '/admin/scopes', method: 'POST', body: { userId: 9, scopeType: 'faculty', facultyId: 1 } });
    fetchMock.mockResolvedValueOnce(json({ id: 10 }));
    await revokeAdminScope(10);
    expect(lastRequest()).toMatchObject({ path: '/admin/scopes/10', method: 'DELETE' });
  });
});
