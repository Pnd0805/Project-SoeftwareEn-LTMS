import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";

const response = (body: unknown, status = 200) => new Response(
  body === undefined ? null : JSON.stringify(body),
  { status, headers: { "Content-Type": "application/json" } },
);

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
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

  it("exposes forbidden team-member reads as a 403 API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { code: "FORBIDDEN", message: "Not a team member" } }, 403)));

    await expect(apiFetch("/teams/9/members")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});
