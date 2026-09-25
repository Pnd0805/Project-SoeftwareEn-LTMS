import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in amendment.controller.ts exactly,
// so this file is expected to sit in a __tests__ subfolder next to the controller.
// parseId is NOT mocked: it's pure and side-effect-free, so exercising the
// real implementation is more honest and catches real validation regressions.
vi.mock("../../services/tournament.service.js", () => ({
    approveAmendment: vi.fn(),
    rejectAmendment: vi.fn(),
}));

import * as TournamentService from "../../services/tournament.service.js";
import { AppError } from "../../utils/AppError.js";
import { approve, reject } from "../amendment.controller.js";

const approveAmendment = vi.mocked(TournamentService.approveAmendment);
const rejectAmendment = vi.mocked(TournamentService.rejectAmendment);

function makeRes() {
    const res = {
        status: vi.fn(),
        json: vi.fn(),
    };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return res as unknown as Response & typeof res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        params: { id: "42" },
        body: {},
        user: { user_id: 7 },
        ...overrides,
    } as unknown as Request;
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe("approve", () => {
    it("parses the id from the route params and calls the service with it plus the caller's user_id", async () => {
        approveAmendment.mockResolvedValue({ ok: true } as any);

        const req = makeReq({ params: { id: "99" } as any, user: { user_id: 7 } as any });
        await approve(req, makeRes());

        expect(approveAmendment).toHaveBeenCalledWith(99, 7);
    });

    it("responds 200 with whatever the service resolves to", async () => {
        const payload = { amendment_id: 42, status: "APPROVED" };
        approveAmendment.mockResolvedValue(payload as any);

        const res = makeRes();
        await approve(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 401 NO_TOKEN when there is no authenticated user", async () => {
        const req = makeReq({ user: undefined });

        await expect(approve(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
            message: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
        });
        expect(approveAmendment).not.toHaveBeenCalled();
    });

    it("does not send a response when the id is not a positive integer", async () => {
        const req = makeReq({ params: { id: "not-a-number" } as any });
        const res = makeRes();

        await expect(approve(req, res)).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสคำขอแก้ไขต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(approveAmendment).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    it("does not send a response when the id is zero or negative", async () => {
        const req = makeReq({ params: { id: "0" } as any });

        await expect(approve(req, makeRes())).rejects.toBeInstanceOf(AppError);
        expect(approveAmendment).not.toHaveBeenCalled();
    });

    it("propagates a service rejection instead of swallowing it", async () => {
        const serviceError = new AppError(409, "ALREADY_APPROVED", "อนุมัติไปแล้ว");
        approveAmendment.mockRejectedValue(serviceError);

        const res = makeRes();
        await expect(approve(makeReq(), res)).rejects.toBe(serviceError);
        // Note: the controller is `res.status(200).json(await approveAmendment(...))`.
        // JS evaluates `res.status(200)` (which runs and returns `res`) before it
        // evaluates the argument to `.json(...)`, so res.status(200) DOES fire even
        // though the awaited call rejects — only res.json never gets called.
        expect(res.json).not.toHaveBeenCalled();
    });
});

describe("reject", () => {
    it("parses the id, then forwards it, the caller's user_id, and the reason to the service", async () => {
        const req = makeReq({
            params: { id: "13" } as any,
            user: { user_id: 7 } as any,
            body: { reason: "เอกสารไม่ครบ" },
        });

        await reject(req, makeRes());

        expect(rejectAmendment).toHaveBeenCalledWith(13, 7, "เอกสารไม่ครบ");
    });

    it("uses the same validation as approve for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(reject(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
        });
        expect(rejectAmendment).not.toHaveBeenCalled();
    });

    it("responds 200 with the service result", async () => {
        const payload = { amendment_id: 42, status: "REJECTED" };
        rejectAmendment.mockResolvedValue(payload as any);

        const res = makeRes();
        await reject(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 401 when there is no authenticated user", async () => {
        const req = makeReq({ user: undefined });

        await expect(reject(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
        expect(rejectAmendment).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const serviceError = new AppError(404, "NOT_FOUND", "ไม่พบคำขอแก้ไข");
        rejectAmendment.mockRejectedValue(serviceError);

        await expect(reject(makeReq(), makeRes())).rejects.toBe(serviceError);
    });
});

describe("characterization - current behaviour worth revisiting", () => {
    // The controller calls parseId before userId, so an unauthenticated caller with a
    // malformed id gets the VALIDATION_FAILED error rather than 401. Flip this test if
    // auth moves first.
    it("reports the id error before the auth error", async () => {
        const req = makeReq({ user: undefined, params: { id: "abc" } as any });

        await expect(approve(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    // reject() reads req.body.reason unguarded, so a request that reached this handler
    // without a body parser throws a TypeError rather than a handled AppError.
    it("throws a TypeError when req.body is undefined", async () => {
        const req = makeReq({ body: undefined });

        await expect(reject(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });

    // No reason supplied at all — currently passed straight through as undefined.
    it("passes undefined through when reason is absent", async () => {
        const req = makeReq({ user: { user_id: 7 } as any, body: {} });

        await reject(req, makeRes());

        expect(rejectAmendment).toHaveBeenCalledWith(42, 7, undefined);
    });
});
