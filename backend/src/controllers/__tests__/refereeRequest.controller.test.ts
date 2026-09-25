import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in refereeRequest.controller.ts exactly,
// so this file is expected to sit in a __tests__ subfolder next to the controller. parseId is NOT
// mocked — it's pure (see its own dedicated tests elsewhere).
vi.mock("../../services/refereeRequest.service.js", () => ({
    createRefRequest: vi.fn(),
    createOrgAddMatch: vi.fn(),
    createOrgSwap: vi.fn(),
    listMyRequests: vi.fn(),
    listTournamentRequests: vi.fn(),
    respondToRequest: vi.fn(),
    cancelRequest: vi.fn(),
}));

import * as RequestService from "../../services/refereeRequest.service.js";
import { AppError } from "../../utils/AppError.js";
import {
    createRefRequest,
    createOrgAddMatch,
    createOrgSwap,
    listMine,
    listByTournament,
    accept,
    decline,
    cancel,
} from "../refereeRequest.controller.js";

const svc = {
    createRefRequest: vi.mocked(RequestService.createRefRequest),
    createOrgAddMatch: vi.mocked(RequestService.createOrgAddMatch),
    createOrgSwap: vi.mocked(RequestService.createOrgSwap),
    listMyRequests: vi.mocked(RequestService.listMyRequests),
    listTournamentRequests: vi.mocked(RequestService.listTournamentRequests),
    respondToRequest: vi.mocked(RequestService.respondToRequest),
    cancelRequest: vi.mocked(RequestService.cancelRequest),
};

function makeRes() {
    const res = { status: vi.fn(), json: vi.fn(), send: vi.fn() };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    res.send.mockReturnValue(res);
    return res as unknown as Response & typeof res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        params: { id: "42" },
        query: {},
        body: {},
        user: { user_id: 7 },
        ...overrides,
    } as unknown as Request;
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe("createRefRequest", () => {
    it("forwards the caller's user_id and the raw body, responds 201", async () => {
        const payload = { id: 1, status: "open" };
        svc.createRefRequest.mockResolvedValue(payload as any);

        const body = { matchId: 5, note: "ว่างช่วงเช้า" };
        const req = makeReq({ user: { user_id: 7 } as any, body });
        const res = makeRes();
        await createRefRequest(req, res);

        expect(svc.createRefRequest).toHaveBeenCalledWith(7, body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(createRefRequest(req, makeRes())).rejects.toBeInstanceOf(TypeError);
        expect(svc.createRefRequest).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(409, "ALREADY_REQUESTED", "มีคำขออยู่แล้ว");
        svc.createRefRequest.mockRejectedValue(err);

        await expect(createRefRequest(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("createOrgAddMatch", () => {
    it("parses the tournament id and forwards user_id and body, responds 201", async () => {
        const payload = { id: 2 };
        svc.createOrgAddMatch.mockResolvedValue(payload as any);

        const body = { matchId: 9 };
        const req = makeReq({
            params: { id: "5" } as any,
            user: { user_id: 7 } as any,
            body,
        });
        const res = makeRes();
        await createOrgAddMatch(req, res);

        expect(svc.createOrgAddMatch).toHaveBeenCalledWith(5, 7, body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(createOrgAddMatch(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
        });
        expect(svc.createOrgAddMatch).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(createOrgAddMatch(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });
});

describe("createOrgSwap", () => {
    it("parses the tournament id and forwards user_id and body, responds 201", async () => {
        const payload = { id: 3 };
        svc.createOrgSwap.mockResolvedValue(payload as any);

        const body = { fromMatchId: 1, toMatchId: 2 };
        const req = makeReq({
            params: { id: "5" } as any,
            user: { user_id: 7 } as any,
            body,
        });
        const res = makeRes();
        await createOrgSwap(req, res);

        expect(svc.createOrgSwap).toHaveBeenCalledWith(5, 7, body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "-1" } as any });

        await expect(createOrgSwap(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.createOrgSwap).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(createOrgSwap(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });
});

describe("listMine", () => {
    it("forwards the caller's user_id, responds 200", async () => {
        const payload = [{ id: 1 }];
        svc.listMyRequests.mockResolvedValue(payload as any);

        const res = makeRes();
        await listMine(makeReq({ user: { user_id: 7 } as any }), res);

        expect(svc.listMyRequests).toHaveBeenCalledWith(7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(listMine(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });
});

describe("listByTournament", () => {
    it("parses the tournament id and forwards status: undefined when no status query is given", async () => {
        svc.listTournamentRequests.mockResolvedValue([] as any);

        const req = makeReq({ params: { id: "5" } as any, query: {} });
        await listByTournament(req, makeRes());

        expect(svc.listTournamentRequests).toHaveBeenCalledWith(5, undefined);
    });

    it.each(["open", "applied", "declined", "cancelled"])(
        "accepts the valid status %j and forwards it",
        async (status) => {
            svc.listTournamentRequests.mockResolvedValue([] as any);

            const req = makeReq({ params: { id: "5" } as any, query: { status } });
            await listByTournament(req, makeRes());

            expect(svc.listTournamentRequests).toHaveBeenCalledWith(5, status);
        },
    );

    it("responds 200 with the service result", async () => {
        const payload = [{ id: 1, status: "open" }];
        svc.listTournamentRequests.mockResolvedValue(payload as any);

        const res = makeRes();
        await listByTournament(makeReq({ query: { status: "open" } }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 400 VALIDATION_FAILED for a status outside the enum", async () => {
        const req = makeReq({ query: { status: "pending" } });

        await expect(listByTournament(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            message: "status ต้องเป็นหนึ่งใน open, applied, declined, cancelled",
        });
        expect(svc.listTournamentRequests).not.toHaveBeenCalled();
    });

    it("rejects a status that only differs by case (case-sensitive check)", async () => {
        const req = makeReq({ query: { status: "Open" } });

        await expect(listByTournament(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    it("rejects an empty-string status rather than treating it as absent", async () => {
        // raw !== undefined is true for '', so this falls into the enum check
        // and fails it — unlike the parseOptionalString() pattern seen in other
        // controllers, an empty string here is a validation error, not "unset".
        const req = makeReq({ query: { status: "" } });

        await expect(listByTournament(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    it("rejects a non-string status (duplicated query param -> array)", async () => {
        const req = makeReq({ query: { status: ["open", "applied"] as any } });

        await expect(listByTournament(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.listTournamentRequests).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id before checking status", async () => {
        const req = makeReq({ params: { id: "abc" } as any, query: { status: "bogus" } });

        await expect(listByTournament(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสทัวร์นาเมนต์ต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.listTournamentRequests).not.toHaveBeenCalled();
    });

    it("does not require req.user", async () => {
        svc.listTournamentRequests.mockResolvedValue([] as any);

        const res = makeRes();
        await listByTournament(makeReq({ user: undefined }), res);

        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe("accept / decline — same service call, different status literal", () => {
    it("accept calls respondToRequest with 'accepted'", async () => {
        svc.respondToRequest.mockResolvedValue({ status: "accepted" } as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        await accept(req, makeRes());

        expect(svc.respondToRequest).toHaveBeenCalledWith(9, 7, "accepted");
    });

    it("decline calls respondToRequest with 'declined'", async () => {
        svc.respondToRequest.mockResolvedValue({ status: "declined" } as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        await decline(req, makeRes());

        expect(svc.respondToRequest).toHaveBeenCalledWith(9, 7, "declined");
    });

    it("both respond 200 with the service result", async () => {
        const payload = { status: "accepted" };
        svc.respondToRequest.mockResolvedValue(payload as any);

        const res = makeRes();
        await accept(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("both reject with VALIDATION_FAILED for a bad request id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(accept(req, makeRes())).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
        await expect(decline(req, makeRes())).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
        expect(svc.respondToRequest).not.toHaveBeenCalled();
    });

    it("both characterization: throw a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(accept(req, makeRes())).rejects.toBeInstanceOf(TypeError);
        await expect(decline(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });
});

describe("cancel", () => {
    it("forwards requestId and user_id, responds 204 with no body", async () => {
        svc.cancelRequest.mockResolvedValue(undefined as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await cancel(req, res);

        expect(svc.cancelRequest).toHaveBeenCalledWith(9, 7);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
        expect(res.json).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad request id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(cancel(req, makeRes())).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
        expect(svc.cancelRequest).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(cancel(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(404, "REQUEST_NOT_FOUND", "ไม่พบคำขอ");
        svc.cancelRequest.mockRejectedValue(err);

        await expect(cancel(makeReq(), makeRes())).rejects.toBe(err);
    });
});
