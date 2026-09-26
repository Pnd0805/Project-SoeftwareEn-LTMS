import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in matchResult.controller.ts exactly, so
// paths are relative to __tests__/ (services and utils are two levels up). parseId is NOT
// mocked — it's pure (see its own dedicated tests via amendment/announcement
// controller suites).
vi.mock("../../services/matchResult.service.js", () => ({
    createSubmitMatchRes: vi.fn(),
    verifyMatchResult: vi.fn(),
    disputeMatchResult: vi.fn(),
    resolveMatchResult: vi.fn(),
    getVerifiedResult: vi.fn(),
    updatePlayerStat: vi.fn(),
    getPlayerMatchStat: vi.fn(),
    getChampion: vi.fn(),
    getDashboard: vi.fn(),
    getStandings: vi.fn(),
    updateLivestream: vi.fn(),
}));

import * as MatchResService from "../../services/matchResult.service.js";
import { AppError } from "../../utils/AppError.js";
import {
    createSubmitMatchRes,
    updateVerifyMatchResult,
    updateDisputeMatchResult,
    updateResolveMatchResult,
    getVerifiedResult,
    updatePlayerStat,
    getPlayerMatchStat,
    getChampion,
    getDashboard,
    getStandings,
    updateLivestream,
} from "../matchResult.controller.js";

const svc = {
    createSubmitMatchRes: vi.mocked(MatchResService.createSubmitMatchRes),
    verifyMatchResult: vi.mocked(MatchResService.verifyMatchResult),
    disputeMatchResult: vi.mocked(MatchResService.disputeMatchResult),
    resolveMatchResult: vi.mocked(MatchResService.resolveMatchResult),
    getVerifiedResult: vi.mocked(MatchResService.getVerifiedResult),
    updatePlayerStat: vi.mocked(MatchResService.updatePlayerStat),
    getPlayerMatchStat: vi.mocked(MatchResService.getPlayerMatchStat),
    getChampion: vi.mocked(MatchResService.getChampion),
    getDashboard: vi.mocked(MatchResService.getDashboard),
    getStandings: vi.mocked(MatchResService.getStandings),
    updateLivestream: vi.mocked(MatchResService.updateLivestream),
};

function makeRes() {
    const res = { status: vi.fn(), json: vi.fn() };
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
    vi.clearAllMocks();
});

describe("createSubmitMatchRes", () => {
    it("forwards matchId, winnerTeamId, scoreData, userId, and submitrole", async () => {
        svc.createSubmitMatchRes.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "5" } as any,
            user: { user_id: 7 } as any,
            body: { winnerTeamId: 3, scoreData: { home: 21, away: 15 } },
            submitrole: "CAPTAIN",
        } as any);
        await createSubmitMatchRes(req, makeRes());

        expect(svc.createSubmitMatchRes).toHaveBeenCalledWith(
            5,
            3,
            { home: 21, away: 15 },
            7,
            "CAPTAIN",
        );
    });

    it("responds 201 with the service result", async () => {
        const payload = { resultId: 1, status: "PENDING" };
        svc.createSubmitMatchRes.mockResolvedValue(payload as any);

        const res = makeRes();
        await createSubmitMatchRes(makeReq({ submitrole: "CAPTAIN" } as any), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad match id", async () => {
        const req = makeReq({ params: { id: "abc" } as any, submitrole: "CAPTAIN" } as any);

        await expect(createSubmitMatchRes(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
        });
        expect(svc.createSubmitMatchRes).not.toHaveBeenCalled();
    });

    it("rejects with 500 INTERNAL_ERROR when req.submitrole is missing", async () => {
        const req = makeReq({ submitrole: undefined } as any);

        await expect(createSubmitMatchRes(req, makeRes())).rejects.toMatchObject({
            status: 500,
            code: "INTERNAL_ERROR",
        });
        expect(svc.createSubmitMatchRes).not.toHaveBeenCalled();
    });

    it("checks the match id before checking submitrole", async () => {
        // parseId runs first in the function body, so a bad id is reported even
        // when submitrole is also missing.
        const req = makeReq({
            params: { id: "abc" } as any,
            submitrole: undefined,
        } as any);

        await expect(createSubmitMatchRes(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    it("characterization: throws a TypeError (not a handled AppError) when req.user is absent", async () => {
        const req = makeReq({ user: undefined, submitrole: "CAPTAIN" } as any);

        await expect(createSubmitMatchRes(req, makeRes())).rejects.toBeInstanceOf(TypeError);
        expect(svc.createSubmitMatchRes).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(409, "RESULT_ALREADY_SUBMITTED", "ส่งผลไปแล้ว");
        svc.createSubmitMatchRes.mockRejectedValue(err);

        const req = makeReq({ submitrole: "CAPTAIN" } as any);
        await expect(createSubmitMatchRes(req, makeRes())).rejects.toBe(err);
    });
});

describe("updateVerifyMatchResult", () => {
    it("forwards matchId and userId, responds 200", async () => {
        const payload = { status: "VERIFIED" };
        svc.verifyMatchResult.mockResolvedValue(payload as any);

        const res = makeRes();
        await updateVerifyMatchResult(makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any }), res);

        expect(svc.verifyMatchResult).toHaveBeenCalledWith(9, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(updateVerifyMatchResult(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.verifyMatchResult).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(updateVerifyMatchResult(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });
});

describe("updateDisputeMatchResult", () => {
    // มติ 26 ก.ย. — การค้านไม่ได้มีแค่เหตุผลแล้ว จึงส่งทั้ง body ต่อไปให้ service (schema ตรวจมาก่อนที่ route)
    it("forwards matchId, userId, and the whole validated body, responds 200", async () => {
        const payload = { status: "DISPUTED" };
        svc.disputeMatchResult.mockResolvedValue(payload as any);

        const body = { reason: "คะแนนผิด", claimedWinnerTeamId: 12, claimedScoreData: { 11: 1, 12: 3 } };
        const req = makeReq({
            params: { id: "9" } as any,
            user: { user_id: 7 } as any,
            body,
        });
        const res = makeRes();
        await updateDisputeMatchResult(req, res);

        expect(svc.disputeMatchResult).toHaveBeenCalledWith(9, 7, body);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("passes an empty body straight through (the schema is what rejects it)", async () => {
        svc.disputeMatchResult.mockResolvedValue({} as any);

        await updateDisputeMatchResult(makeReq({ body: {} }), makeRes());

        expect(svc.disputeMatchResult).toHaveBeenCalledWith(42, 7, {});
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "-1" } as any });

        await expect(updateDisputeMatchResult(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.disputeMatchResult).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(updateDisputeMatchResult(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });
});

describe("updateResolveMatchResult", () => {
    it("forwards matchId, the raw body as a single options object, then userId", async () => {
        // The service signature is (matchId, body, userId) — the whole body is
        // forwarded as one object rather than destructured into positional args.
        svc.resolveMatchResult.mockResolvedValue({ status: "RESOLVED" } as any);

        const body = { resolution: "HOME_WINS", resolutionNote: "ตรวจสอบวิดีโอแล้ว" };
        const req = makeReq({
            params: { id: "9" } as any,
            user: { user_id: 7 } as any,
            body,
        });
        await updateResolveMatchResult(req, makeRes());

        expect(svc.resolveMatchResult).toHaveBeenCalledWith(9, body, 7);
    });

    it("responds 200 with the service result", async () => {
        const payload = { status: "RESOLVED" };
        svc.resolveMatchResult.mockResolvedValue(payload as any);

        const res = makeRes();
        await updateResolveMatchResult(makeReq({ body: { resolution: "DRAW" } }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(updateResolveMatchResult(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.resolveMatchResult).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(updateResolveMatchResult(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });
});

describe("getVerifiedResult", () => {
    it("does not require req.user; forwards undefined for the user id when absent (req.user?.user_id)", async () => {
        const payload = { winnerTeamId: 3, score: {} };
        svc.getVerifiedResult.mockResolvedValue(payload as any);

        const res = makeRes();
        await getVerifiedResult(makeReq({ user: undefined, params: { id: "9" } as any }), res);

        expect(svc.getVerifiedResult).toHaveBeenCalledWith(9, undefined);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("forwards the caller's user_id when present", async () => {
        svc.getVerifiedResult.mockResolvedValue({} as any);

        await getVerifiedResult(makeReq({ user: { user_id: 7 } as any, params: { id: "9" } as any }), makeRes());

        expect(svc.getVerifiedResult).toHaveBeenCalledWith(9, 7);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getVerifiedResult(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getVerifiedResult).not.toHaveBeenCalled();
    });
});

describe("updatePlayerStat", () => {
    it("forwards matchId, userId, and playerStats", async () => {
        svc.updatePlayerStat.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "9" } as any,
            user: { user_id: 7 } as any,
            body: { playerStats: [{ playerId: 1, points: 10 }] },
        });
        await updatePlayerStat(req, makeRes());

        expect(svc.updatePlayerStat).toHaveBeenCalledWith(9, 7, [{ playerId: 1, points: 10 }]);
    });

    it("responds 201 (not 200, unlike the other update handlers) with the service result", async () => {
        const payload = { updated: 1 };
        svc.updatePlayerStat.mockResolvedValue(payload as any);

        const res = makeRes();
        await updatePlayerStat(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(updatePlayerStat(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.updatePlayerStat).not.toHaveBeenCalled();
    });

    it("characterization: throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(updatePlayerStat(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });
});

describe("getPlayerMatchStat", () => {
    it("does not require req.user and forwards only matchId", async () => {
        const payload = [{ playerId: 1, points: 10 }];
        svc.getPlayerMatchStat.mockResolvedValue(payload as any);

        const res = makeRes();
        await getPlayerMatchStat(makeReq({ user: undefined, params: { id: "9" } as any }), res);

        expect(svc.getPlayerMatchStat).toHaveBeenCalledWith(9);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getPlayerMatchStat(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });
});

describe("getChampion / getDashboard / getStandings — tournament-scoped reads", () => {
    it("getChampion forwards tournamentId, responds 200", async () => {
        const payload = { teamId: 3, name: "ทีม A" };
        svc.getChampion.mockResolvedValue(payload as any);

        const res = makeRes();
        await getChampion(makeReq({ user: undefined, params: { id: "5" } as any }), res);

        expect(svc.getChampion).toHaveBeenCalledWith(5);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("getDashboard forwards tournamentId, responds 200", async () => {
        const payload = { totalMatches: 32 };
        svc.getDashboard.mockResolvedValue(payload as any);

        const res = makeRes();
        await getDashboard(makeReq({ user: undefined, params: { id: "5" } as any }), res);

        expect(svc.getDashboard).toHaveBeenCalledWith(5);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("getStandings forwards tournamentId, responds 200", async () => {
        const payload = [{ teamId: 1, rank: 1 }];
        svc.getStandings.mockResolvedValue(payload as any);

        const res = makeRes();
        await getStandings(makeReq({ user: undefined, params: { id: "5" } as any }), res);

        expect(svc.getStandings).toHaveBeenCalledWith(5);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it.each([
        ["getChampion", getChampion],
        ["getDashboard", getDashboard],
        ["getStandings", getStandings],
    ])("%s rejects with VALIDATION_FAILED for a bad tournament id", async (_name, handler) => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(handler(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสทัวร์นาเมนต์ต้องเป็นจำนวนเต็มบวก" } },
        });
    });
});

describe("updateLivestream", () => {
    it("forwards matchId and youtubeUrl, responds 200", async () => {
        const payload = { youtubeUrl: "https://youtube.com/watch?v=abc123" };
        svc.updateLivestream.mockResolvedValue(payload as any);

        const req = makeReq({
            params: { id: "9" } as any,
            body: { youtubeUrl: "https://youtube.com/watch?v=abc123" },
        });
        const res = makeRes();
        await updateLivestream(req, res);

        expect(svc.updateLivestream).toHaveBeenCalledWith(9, "https://youtube.com/watch?v=abc123");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("does not require req.user", async () => {
        svc.updateLivestream.mockResolvedValue({} as any);

        const res = makeRes();
        await updateLivestream(makeReq({ user: undefined }), res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("uses its own distinct id label ('รหัสแมตช์') on validation failure", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(updateLivestream(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสแมตช์ต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.updateLivestream).not.toHaveBeenCalled();
    });
});
