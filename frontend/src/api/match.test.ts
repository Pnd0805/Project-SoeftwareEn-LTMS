import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  USE_MOCK: false,
}));

import { checkin, getCheckins } from "./match";

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
});
