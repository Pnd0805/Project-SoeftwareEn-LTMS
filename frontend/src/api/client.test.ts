import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, hasAccessToken, setAccessToken } from "./client";

const response = (body: unknown, status = 200) => new Response(
  body === undefined ? null : JSON.stringify(body),
  { status, headers: { "Content-Type": "application/json" } },
);

afterEach(() => { vi.unstubAllGlobals(); setAccessToken(null); });

describe("apiFetch", () => {
  it('preserves a missing target user as 404 without clearing the current session', async () => {
    setAccessToken('existing-session')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { code: 'USER_NOT_FOUND', message: 'Target missing' } }, 404)))
    await expect(apiFetch('/users/999')).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
    expect(hasAccessToken()).toBe(true)
  })
  it("accepts a 204 invitation decline without attempting JSON parsing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiFetch<void>("/invitations/12/decline", { method: "POST" })).resolves.toBeUndefined();
  });

  it("preserves hard-filter details from the backend error envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      error: {
        code: "HARD_FILTER_FAILED",
        message: "A team member is not eligible",
        details: [{ userId: 7, reason: "age" }],
      },
    }, 422)));

    await expect(apiFetch("/tournaments/1/applications", { method: "POST" })).rejects.toMatchObject({
      status: 422,
      code: "HARD_FILTER_FAILED",
      details: [{ userId: 7, reason: "age" }],
    });
  });

  it("preserves endpoint-specific error metadata from the backend envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      error: {
        code: "PLAYER_ALREADY_REGISTERED",
        message: "Player is already registered",
        players: [{ userId: 7, fullName: "Seven", teamId: 3, teamName: "Blue" }],
      },
    }, 409)));

    await expect(apiFetch("/tournaments/1/applications", { method: "POST" })).rejects.toMatchObject({
      status: 409,
      code: "PLAYER_ALREADY_REGISTERED",
      extra: { players: [{ userId: 7, fullName: "Seven", teamId: 3, teamName: "Blue" }] },
    });
  });

  it("exposes forbidden team-member reads as a 403 API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { code: "FORBIDDEN", message: "Not a team member" } }, 403)));

    await expect(apiFetch("/teams/9/members")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});

it('preserves the bestOf field error delivered by the backend error envelope', async () => {
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { code: 'BEST_OF_NOT_SUPPORTED', message: 'Sport does not support BO', fields: { bestOf: 'Choose no BO limit' } } }, 400)))
 await expect(apiFetch('/matches/23/format', { method: 'PATCH' })).rejects.toMatchObject({ code: 'BEST_OF_NOT_SUPPORTED', fields: { bestOf: 'Choose no BO limit' } })
})
it('retains token-version expiry as the existing 401 TOKEN_EXPIRED contract', async () => {
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { code: 'TOKEN_EXPIRED', message: 'Session expired' } }, 401)))
 await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' })
})
