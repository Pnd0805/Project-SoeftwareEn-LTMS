/**
 * สัญญา Team กับ origin/backend — ยิงผ่าน apiFetch จริง แต่ stub fetch
 * ปิดโหมด mock เฉพาะไฟล์นี้ เพื่อทดสอบเส้นทาง/เมธอด/body และการส่งต่อ error ของ backend
 * ชื่อ field ใน body ตรงกับ backend/src/schemas/team.schema.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  USE_MOCK: false,
}));

import {
  answerBackendInvitation, cancelTeamInvitation, createTeam, disbandTeam, getBackendMyInvitations,
  getBackendMyTeams, getBackendTeam, getBackendTeamMembers, inviteMember, kickMember,
  requestOfficialStatus, setMemberPosition, transferLeader, updateTeam,
} from "./team";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const apiError = (status: number, code: string) => json({ error: { code, message: code } }, status);
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return {
    path: new URL(String(url)).pathname.replace(/^\/api\/v1/, ""),
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
};

describe("team reads", () => {
  it("GET /me/teams returns the signed-in user's teams", async () => {
    const items = [{ id: 3, name: "Byte Force", sportTypeId: 6, readinessStatus: "Ready", officialStatus: "Unofficial", memberCount: 6, role: "leader" }];
    fetchMock.mockResolvedValueOnce(json({ items }));

    await expect(getBackendMyTeams()).resolves.toEqual({ items });
    expect(lastRequest()).toMatchObject({ path: "/me/teams", method: "GET" });
  });

  it("GET /teams/:id returns team detail with a numeric id", async () => {
    const team = { id: 3, name: "Byte Force", sportTypeId: 6, readinessStatus: "Ready", officialStatus: "Unofficial", leader: { id: 7, fullName: "Sirawit", avatarUrl: null }, memberCount: 6, createdAt: "2026-09-01T00:00:00.000Z" };
    fetchMock.mockResolvedValueOnce(json(team));

    await expect(getBackendTeam(3)).resolves.toEqual(team);
    expect(lastRequest().path).toBe("/teams/3");
  });

  it("GET /teams/:id/members returns members for a team member", async () => {
    const items = [{ userId: 7, fullName: "Sirawit", avatarUrl: null, position: "starter", joinedAt: "2026-09-01T00:00:00.000Z" }];
    fetchMock.mockResolvedValueOnce(json({ items }));

    await expect(getBackendTeamMembers(3)).resolves.toEqual({ items });
    expect(lastRequest().path).toBe("/teams/3/members");
  });

  it("GET /teams/:id/members surfaces 403 as an access error, not an empty team", async () => {
    fetchMock.mockResolvedValueOnce(apiError(403, "FORBIDDEN"));

    await expect(getBackendTeamMembers(9)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("GET /me/invitations lists pending team invitations", async () => {
    const items = [{ id: 12, team: { id: 3, name: "Byte Force", sportTypeId: 6 }, invitedBy: { id: 7, fullName: "Sirawit", avatarUrl: null }, expiresAt: "2026-09-20T00:00:00.000Z" }];
    fetchMock.mockResolvedValueOnce(json({ items }));

    await expect(getBackendMyInvitations()).resolves.toEqual({ items });
    expect(lastRequest().path).toBe("/me/invitations");
  });
});

describe("team writes", () => {
  it("POST /teams sends only name and sportTypeId", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 9, name: "Byte Force Academy" }, 201));

    await createTeam({ name: "Byte Force Academy", sportTypeId: 5, code: "BFA", color: "#ffffff" });
    expect(lastRequest()).toEqual({ path: "/teams", method: "POST", body: { name: "Byte Force Academy", sportTypeId: 5 } });
  });

  it("POST /teams keeps 409 TEAM_NAME_TAKEN", async () => {
    fetchMock.mockResolvedValueOnce(apiError(409, "TEAM_NAME_TAKEN"));

    await expect(createTeam({ name: "Byte Force", sportTypeId: 6 })).rejects.toMatchObject({ status: 409, code: "TEAM_NAME_TAKEN" });
  });

  it("DELETE /teams/:id resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(disbandTeam(3)).resolves.toBeUndefined();
    expect(lastRequest()).toMatchObject({ path: "/teams/3", method: "DELETE" });
  });

  it("POST /teams/:id/official-request sends supportingDocs", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 1, status: "pending" }, 201));

    await requestOfficialStatus(3, { supportingDocs: ["club-letter.pdf"] });
    expect(lastRequest()).toEqual({ path: "/teams/3/official-request", method: "POST", body: { supportingDocs: ["club-letter.pdf"] } });
  });

  it("PATCH /teams/:id sends only the name", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 3, name: "Byte Force II" }));

    await updateTeam(3, { name: "Byte Force II", code: "BF2" });
    expect(lastRequest()).toEqual({ path: "/teams/3", method: "PATCH", body: { name: "Byte Force II" } });
  });

  it("leader transfer has no backend route, so it fails without calling fetch", async () => {
    await expect(transferLeader(3, { targetUserId: 42 })).rejects.toMatchObject({ status: 501, code: "ENDPOINT_UNAVAILABLE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("members and invitations", () => {
  it("PATCH /teams/:id/members/:uid sends the position", async () => {
    fetchMock.mockResolvedValueOnce(json({ userId: 42, position: "substitute" }));

    await setMemberPosition(3, { userId: 42, position: "substitute" });
    expect(lastRequest()).toEqual({ path: "/teams/3/members/42", method: "PATCH", body: { position: "substitute" } });
  });

  it("DELETE /teams/:id/members/:uid resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(kickMember(3, 42)).resolves.toBeUndefined();
    expect(lastRequest()).toMatchObject({ path: "/teams/3/members/42", method: "DELETE" });
  });

  it("removing the team leader surfaces 403", async () => {
    fetchMock.mockResolvedValueOnce(apiError(403, "FORBIDDEN"));

    await expect(kickMember(3, 7)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("POST /teams/:id/invitations sends invitedUserId", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 30, status: "pending" }, 201));

    await inviteMember(3, { userId: 42 });
    expect(lastRequest()).toEqual({ path: "/teams/3/invitations", method: "POST", body: { invitedUserId: 42 } });
  });

  it("inviting an existing member surfaces 409 ALREADY_MEMBER", async () => {
    fetchMock.mockResolvedValueOnce(apiError(409, "ALREADY_MEMBER"));

    await expect(inviteMember(3, { userId: 7 })).rejects.toMatchObject({ status: 409, code: "ALREADY_MEMBER" });
  });

  it("POST /invitations/:id/accept", async () => {
    fetchMock.mockResolvedValueOnce(json({ teamId: 3 }));

    await answerBackendInvitation(12, true);
    expect(lastRequest()).toMatchObject({ path: "/invitations/12/accept", method: "POST" });
  });

  it("POST /invitations/:id/decline accepts a 204 with no body", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(answerBackendInvitation(12, false)).resolves.toBeUndefined();
    expect(lastRequest()).toMatchObject({ path: "/invitations/12/decline", method: "POST" });
  });

  it("DELETE /teams/:id/invitations/:iid rejects a non-leader with 403", async () => {
    fetchMock.mockResolvedValueOnce(apiError(403, "FORBIDDEN"));

    await expect(cancelTeamInvitation(3, 30)).rejects.toMatchObject({ status: 403 });
    expect(lastRequest()).toMatchObject({ path: "/teams/3/invitations/30", method: "DELETE" });
  });
});
