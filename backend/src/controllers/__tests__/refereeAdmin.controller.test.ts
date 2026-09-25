import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in refereeAdmin.controller.ts exactly, so
// this file is expected to sit in a __tests__ subfolder next to the controller. parseId is NOT
// mocked — it's pure (see its own dedicated tests elsewhere).
vi.mock("../../services/refereeAdmin.service.js", () => ({
    listPendingExternalReferees: vi.fn(),
    approveExternalReferee: vi.fn(),
    requestDocsFromExternalReferee: vi.fn(),
    rejectExternalReferee: vi.fn(),
}));

import * as AdminService from "../../services/refereeAdmin.service.js";
import { AppError } from "../../utils/AppError.js";
import { listPending, approve, requestDocs, reject } from "../refereeAdmin.controller.js";

const svc = {
    listPendingExternalReferees: vi.mocked(AdminService.listPendingExternalReferees),
    approveExternalReferee: vi.mocked(AdminService.approveExternalReferee),
    requestDocsFromExternalReferee: vi.mocked(AdminService.requestDocsFromExternalReferee),
    rejectExternalReferee: vi.mocked(AdminService.rejectExternalReferee),
};

function makeRes() {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return res as unknown as Response & typeof res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        params: { userId: "42" },
        body: {},
        user: { user_id: 7 },
        ...overrides,
    } as unknown as Request;
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe("listPending", () => {
    it("takes no params/user and forwards the service result", async () => {
        const payload = [{ userId: 1, name: "ผู้ตัดสิน A" }];
        svc.listPendingExternalReferees.mockResolvedValue(payload as any);

        const res = makeRes();
        // _req is unused by the handler, so an empty object stands in fine.
        await listPending({} as Request, res);

        expect(svc.listPendingExternalReferees).toHaveBeenCalledWith();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(500, "INTERNAL_ERROR", "โหลดรายการไม่สำเร็จ");
        svc.listPendingExternalReferees.mockRejectedValue(err);

        await expect(listPending({} as Request, makeRes())).rejects.toBe(err);
    });
});

describe("approve", () => {
    it("parses userId from params (field 'userId', not the 'id' default) and forwards the approver's user_id", async () => {
        svc.approveExternalReferee.mockResolvedValue({ status: "APPROVED" } as any);

        const req = makeReq({ params: { userId: "5" } as any, user: { user_id: 7 } as any });
        await approve(req, makeRes());

        expect(svc.approveExternalReferee).toHaveBeenCalledWith(5, 7);
    });

    it("responds 200 with the service result", async () => {
        const payload = { status: "APPROVED" };
        svc.approveExternalReferee.mockResolvedValue(payload as any);

        const res = makeRes();
        await approve(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED, keyed under 'userId' (not 'id'), for a bad userId", async () => {
        const req = makeReq({ params: { userId: "abc" } as any });

        await expect(approve(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { userId: "รหัสผู้ใช้ต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.approveExternalReferee).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError (not a handled AppError) when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(approve(req, makeRes())).rejects.toBeInstanceOf(TypeError);
        expect(svc.approveExternalReferee).not.toHaveBeenCalled();
    });

    it("checks the userId param before touching req.user", async () => {
        // parseId runs first in the function body, so a malformed userId is
        // reported as VALIDATION_FAILED even when req.user is also missing.
        const req = makeReq({ user: undefined, params: { userId: "abc" } as any });

        await expect(approve(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(404, "REFEREE_NOT_FOUND", "ไม่พบผู้ตัดสิน");
        svc.approveExternalReferee.mockRejectedValue(err);

        await expect(approve(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("requestDocs", () => {
    it("forwards userId, the requester's user_id, and the raw request body", async () => {
        svc.requestDocsFromExternalReferee.mockResolvedValue({ status: "DOCS_REQUESTED" } as any);

        const body = { requiredDocs: ["id_card", "certificate"] };
        const req = makeReq({
            params: { userId: "5" } as any,
            user: { user_id: 7 } as any,
            body,
        });
        await requestDocs(req, makeRes());

        expect(svc.requestDocsFromExternalReferee).toHaveBeenCalledWith(5, 7, body);
    });

    it("responds 200 with the service result", async () => {
        const payload = { status: "DOCS_REQUESTED" };
        svc.requestDocsFromExternalReferee.mockResolvedValue(payload as any);

        const res = makeRes();
        await requestDocs(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("forwards an empty body as-is when none is given", async () => {
        svc.requestDocsFromExternalReferee.mockResolvedValue({} as any);

        await requestDocs(makeReq({ body: {} }), makeRes());

        expect(svc.requestDocsFromExternalReferee).toHaveBeenCalledWith(42, 7, {});
    });

    it("rejects with VALIDATION_FAILED for a bad userId", async () => {
        const req = makeReq({ params: { userId: "-1" } as any });

        await expect(requestDocs(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.requestDocsFromExternalReferee).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(requestDocs(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });
});

describe("reject", () => {
    it("forwards userId, the rejecter's user_id, and the raw request body", async () => {
        svc.rejectExternalReferee.mockResolvedValue({ status: "REJECTED" } as any);

        const body = { reason: "เอกสารไม่ครบ" };
        const req = makeReq({
            params: { userId: "5" } as any,
            user: { user_id: 7 } as any,
            body,
        });
        await reject(req, makeRes());

        expect(svc.rejectExternalReferee).toHaveBeenCalledWith(5, 7, body);
    });

    it("responds 200 with the service result", async () => {
        const payload = { status: "REJECTED" };
        svc.rejectExternalReferee.mockResolvedValue(payload as any);

        const res = makeRes();
        await reject(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad userId", async () => {
        const req = makeReq({ params: { userId: "abc" } as any });

        await expect(reject(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.rejectExternalReferee).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(reject(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(409, "ALREADY_DECIDED", "ตัดสินใจไปแล้ว");
        svc.rejectExternalReferee.mockRejectedValue(err);

        await expect(reject(makeReq(), makeRes())).rejects.toBe(err);
    });
});
