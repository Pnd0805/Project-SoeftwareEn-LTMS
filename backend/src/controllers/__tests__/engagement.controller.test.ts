import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in engagement.controller.ts exactly.
// paths are relative to __tests__/ (services and utils are two levels up).
// parseId is NOT mocked: it's pure and side-effect-free, so exercising the
// real implementation is more honest and catches real validation regressions.
vi.mock("../../services/pickem.service.js", () => ({
    predict: vi.fn(),
    cancelPrediction: vi.fn(),
    getMine: vi.fn(),
    getSummary: vi.fn(),
    getMyHistory: vi.fn(),
    getLeaderboard: vi.fn(),
}));

import * as PickemService from "../../services/pickem.service.js";
import {
    predict,
    cancelPrediction,
    getMyPrediction,
    getPredictionSummary,
    getMyPickem,
    getPickemLeaderboard,
} from "../engagement.controller.js";

const svc = {
    predict: vi.mocked(PickemService.predict),
    cancelPrediction: vi.mocked(PickemService.cancelPrediction),
    getMine: vi.mocked(PickemService.getMine),
    getSummary: vi.mocked(PickemService.getSummary),
    getMyHistory: vi.mocked(PickemService.getMyHistory),
    getLeaderboard: vi.mocked(PickemService.getLeaderboard),
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
        body: {},
        user: { user_id: 7 },
        ...overrides,
    } as unknown as Request;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("predict", () => {
    it("parses the match id and forwards userId and body.teamId", async () => {
        svc.predict.mockResolvedValue({ isNew: true, id: 1 } as any);

        const req = makeReq({
            params: { id: "5" } as any,
            user: { user_id: 7 } as any,
            body: { teamId: 3 },
        });
        await predict(req, makeRes());

        expect(svc.predict).toHaveBeenCalledWith(5, 7, 3);
    });

    it("responds 201 and strips isNew when the service reports a new prediction", async () => {
        svc.predict.mockResolvedValue({ isNew: true, teamId: 3 } as any);

        const res = makeRes();
        await predict(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ teamId: 3 });
    });

    it("responds 200 and strips isNew when the service reports an existing prediction (update)", async () => {
        svc.predict.mockResolvedValue({ isNew: false, teamId: 3 } as any);

        const res = makeRes();
        await predict(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ teamId: 3 });
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, and never calls the service", async () => {
        const req = makeReq({ user: undefined });

        await expect(predict(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.predict).not.toHaveBeenCalled();
    });

    it("checks req.user before the match id (auth error wins over a bad id)", async () => {
        const req = makeReq({ user: undefined, params: { id: "abc" } as any });

        await expect(predict(req, makeRes())).rejects.toMatchObject({
            code: "USER_NOT_FOUND",
        });
        expect(svc.predict).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a non-numeric match id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(predict(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสการแข่งขันต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.predict).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a zero/negative match id", async () => {
        const req = makeReq({ params: { id: "0" } as any });

        await expect(predict(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.predict).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const { AppError } = await import("../../utils/AppError.js");
        const err = new AppError(409, "MATCH_LOCKED", "แมตช์นี้ปิดการทายผลแล้ว");
        svc.predict.mockRejectedValue(err);

        const res = makeRes();
        await expect(predict(makeReq(), res)).rejects.toBe(err);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("cancelPrediction", () => {
    it("parses the match id and forwards it with userId, responds 204 with no body", async () => {
        svc.cancelPrediction.mockResolvedValue(undefined as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await cancelPrediction(req, res);

        expect(svc.cancelPrediction).toHaveBeenCalledWith(9, 7);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
        expect(res.json).not.toHaveBeenCalled();
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(cancelPrediction(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.cancelPrediction).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad match id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(cancelPrediction(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.cancelPrediction).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const { AppError } = await import("../../utils/AppError.js");
        const err = new AppError(404, "PREDICTION_NOT_FOUND", "ไม่พบการทายผล");
        svc.cancelPrediction.mockRejectedValue(err);

        await expect(cancelPrediction(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("getMyPrediction", () => {
    it("parses the match id and forwards userId, responds 200 with the service result", async () => {
        const payload = { teamId: 3 };
        svc.getMine.mockResolvedValue(payload as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await getMyPrediction(req, res);

        expect(svc.getMine).toHaveBeenCalledWith(9, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(getMyPrediction(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.getMine).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad match id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getMyPrediction(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getMine).not.toHaveBeenCalled();
    });
});

describe("getPredictionSummary", () => {
    it("parses the match id and forwards the caller's user_id, responds 200 with the service result", async () => {
        const payload = { teamA: 12, teamB: 8 };
        svc.getSummary.mockResolvedValue(payload as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await getPredictionSummary(req, res);

        expect(svc.getSummary).toHaveBeenCalledWith(9, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("does not require req.user; forwards undefined for the user id when absent (req.user?.user_id)", async () => {
        svc.getSummary.mockResolvedValue({} as any);

        await getPredictionSummary(makeReq({ user: undefined }), makeRes());

        expect(svc.getSummary).toHaveBeenCalledWith(42, undefined);
    });

    it("rejects with VALIDATION_FAILED for a bad match id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getPredictionSummary(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getSummary).not.toHaveBeenCalled();
    });
});

describe("getMyPickem", () => {
    it("forwards the caller's user_id, responds 200 with the service result", async () => {
        const payload = [{ matchId: 1, correct: true }];
        svc.getMyHistory.mockResolvedValue(payload as any);

        const res = makeRes();
        await getMyPickem(makeReq({ user: { user_id: 7 } as any }), res);

        expect(svc.getMyHistory).toHaveBeenCalledWith(7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, and never calls the service", async () => {
        const req = makeReq({ user: undefined });

        await expect(getMyPickem(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.getMyHistory).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const { AppError } = await import("../../utils/AppError.js");
        const err = new AppError(500, "INTERNAL_ERROR", "โหลดประวัติไม่สำเร็จ");
        svc.getMyHistory.mockRejectedValue(err);

        await expect(getMyPickem(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("getPickemLeaderboard", () => {
    it("parses the tournament id, responds 200 with the service result, and does not require req.user", async () => {
        const payload = [{ userId: 1, score: 10 }];
        svc.getLeaderboard.mockResolvedValue(payload as any);

        const req = makeReq({ params: { id: "5" } as any, user: undefined });
        const res = makeRes();
        await getPickemLeaderboard(req, res);

        expect(svc.getLeaderboard).toHaveBeenCalledWith(5);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getPickemLeaderboard(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสทัวร์นาเมนต์ต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.getLeaderboard).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const { AppError } = await import("../../utils/AppError.js");
        const err = new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์");
        svc.getLeaderboard.mockRejectedValue(err);

        await expect(getPickemLeaderboard(makeReq(), makeRes())).rejects.toBe(err);
    });
});
