import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in refereeIdentity.controller.ts exactly,
// so this file is expected to sit in a __tests__ subfolder next to the controller.
vi.mock("../../services/refereeIdentity.service.js", () => ({
    getMyIdentity: vi.fn(),
    submitMyDocs: vi.fn(),
}));

import * as IdentityService from "../../services/refereeIdentity.service.js";
import { getMine, submitDocs } from "../refereeIdentity.controller.js";

const svc = {
    getMyIdentity: vi.mocked(IdentityService.getMyIdentity),
    submitMyDocs: vi.mocked(IdentityService.submitMyDocs),
};

function makeRes() {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return res as unknown as Response & typeof res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        body: {},
        user: { user_id: 7 },
        ...overrides,
    } as unknown as Request;
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe("getMine", () => {
    it("forwards the caller's user_id to the service", async () => {
        svc.getMyIdentity.mockResolvedValue({ verified: false } as any);

        await getMine(makeReq({ user: { user_id: 7 } as any }), makeRes());

        expect(svc.getMyIdentity).toHaveBeenCalledWith(7);
    });

    it("responds 200 with the service result", async () => {
        const payload = { userId: 7, verified: true };
        svc.getMyIdentity.mockResolvedValue(payload as any);

        const res = makeRes();
        await getMine(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("characterization: throws a TypeError (not a handled AppError) when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(getMine(req, makeRes())).rejects.toBeInstanceOf(TypeError);
        expect(svc.getMyIdentity).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const { AppError } = await import("../../utils/AppError.js");
        const err = new AppError(404, "IDENTITY_NOT_FOUND", "ไม่พบข้อมูลยืนยันตัวตน");
        svc.getMyIdentity.mockRejectedValue(err);

        await expect(getMine(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("submitDocs", () => {
    it("forwards the caller's user_id and the raw request body", async () => {
        svc.submitMyDocs.mockResolvedValue({ status: "SUBMITTED" } as any);

        const body = { idCardUrl: "https://cdn.example.com/id.jpg" };
        const req = makeReq({ user: { user_id: 7 } as any, body });
        await submitDocs(req, makeRes());

        expect(svc.submitMyDocs).toHaveBeenCalledWith(7, body);
    });

    it("responds 200 with the service result", async () => {
        const payload = { status: "SUBMITTED" };
        svc.submitMyDocs.mockResolvedValue(payload as any);

        const res = makeRes();
        await submitDocs(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("forwards an empty body as-is when none is given", async () => {
        svc.submitMyDocs.mockResolvedValue({} as any);

        await submitDocs(makeReq({ body: {} }), makeRes());

        expect(svc.submitMyDocs).toHaveBeenCalledWith(7, {});
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(submitDocs(req, makeRes())).rejects.toBeInstanceOf(TypeError);
        expect(svc.submitMyDocs).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const { AppError } = await import("../../utils/AppError.js");
        const err = new AppError(400, "VALIDATION_FAILED", "เอกสารไม่ถูกต้อง");
        svc.submitMyDocs.mockRejectedValue(err);

        await expect(submitDocs(makeReq(), makeRes())).rejects.toBe(err);
    });
});
