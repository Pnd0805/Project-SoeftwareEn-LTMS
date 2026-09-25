import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifiers must match the ones in match.controller.ts exactly, so this
// paths are relative to __tests__/ (services and utils are two levels up).
//
// parseId and parsePagination are NOT mocked — both are pure (see their own
// dedicated test files). parseOptionalString/parseOptionalNumber aren't
// exported, so they're only exercised indirectly through getTournamentMatches.
vi.mock("../../services/match.service.js", () => ({
    getTournamentMatches: vi.fn(),
    getMatchDetail: vi.fn(),
    scheduleMatch: vi.fn(),
    openCheckinMatch: vi.fn(),
    closeCheckinMatch: vi.fn(),
    forfeitMatch: vi.fn(),
    startMatch: vi.fn(),
    getMatchCheckins: vi.fn(),
    verifyCheckin: vi.fn(),
    rejectCheckin: vi.fn(),
    getCheckinQr: vi.fn(),
    submitCheckin: vi.fn(),
}));

vi.mock("../../services/bracket.service.js", () => ({
    createBracket: vi.fn(),
    getBracket: vi.fn(),
}));

import * as MatchService from "../../services/match.service.js";
import * as BracketService from "../../services/bracket.service.js";
import { AppError } from "../../utils/AppError.js";
import {
    createBracket,
    getBracket,
    getTournamentMatches,
    getMatchDetail,
    scheduleMatch,
    openCheckinMatch,
    closeCheckinMatch,
    forfeitMatch,
    startMatch,
    getMatchCheckins,
    verifyCheckin,
    rejectCheckin,
    getCheckinQr,
    submitCheckin,
} from "../match.controller.js";

const svc = {
    getTournamentMatches: vi.mocked(MatchService.getTournamentMatches),
    getMatchDetail: vi.mocked(MatchService.getMatchDetail),
    scheduleMatch: vi.mocked(MatchService.scheduleMatch),
    openCheckinMatch: vi.mocked(MatchService.openCheckinMatch),
    closeCheckinMatch: vi.mocked(MatchService.closeCheckinMatch),
    forfeitMatch: vi.mocked(MatchService.forfeitMatch),
    startMatch: vi.mocked(MatchService.startMatch),
    getMatchCheckins: vi.mocked(MatchService.getMatchCheckins),
    verifyCheckin: vi.mocked(MatchService.verifyCheckin),
    rejectCheckin: vi.mocked(MatchService.rejectCheckin),
    getCheckinQr: vi.mocked(MatchService.getCheckinQr),
    submitCheckin: vi.mocked(MatchService.submitCheckin),
};

const bracketSvc = {
    createBracket: vi.mocked(BracketService.createBracket),
    getBracket: vi.mocked(BracketService.getBracket),
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
    vi.clearAllMocks();
});

describe("createBracket", () => {
    it("parses the tournament id and forwards seedingMethod/manualSeeds from the body, with replace defaulting to false", async () => {
        bracketSvc.createBracket.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "5" } as any,
            body: { seedingMethod: "RANDOM", manualSeeds: [1, 2, 3] },
        });
        await createBracket(req, makeRes());

        expect(bracketSvc.createBracket).toHaveBeenCalledWith(5, "RANDOM", [1, 2, 3], false);
    });

    it("forwards replace: true only when req.body.replace is exactly true", async () => {
        bracketSvc.createBracket.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "5" } as any,
            body: { seedingMethod: "RANDOM", manualSeeds: [1, 2, 3], replace: true },
        });
        await createBracket(req, makeRes());

        expect(bracketSvc.createBracket).toHaveBeenCalledWith(5, "RANDOM", [1, 2, 3], true);
    });

    it('treats a truthy non-boolean replace (e.g. "true" string) as false', async () => {
        bracketSvc.createBracket.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "5" } as any,
            body: { seedingMethod: "RANDOM", manualSeeds: [1, 2, 3], replace: "true" },
        });
        await createBracket(req, makeRes());

        expect(bracketSvc.createBracket).toHaveBeenCalledWith(5, "RANDOM", [1, 2, 3], false);
    });

    it("responds 201 with the service result", async () => {
        const payload = { bracketId: 1 };
        bracketSvc.createBracket.mockResolvedValue(payload as any);

        const res = makeRes();
        await createBracket(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(createBracket(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
        });
        expect(bracketSvc.createBracket).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(409, "BRACKET_EXISTS", "มีบราเก็ตอยู่แล้ว");
        bracketSvc.createBracket.mockRejectedValue(err);

        await expect(createBracket(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("getBracket", () => {
    it("parses the id and responds 200 with the service result", async () => {
        const payload = { rounds: [] };
        bracketSvc.getBracket.mockResolvedValue(payload as any);

        const res = makeRes();
        await getBracket(makeReq({ params: { id: "8" } as any }), res);

        expect(bracketSvc.getBracket).toHaveBeenCalledWith(8);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "0" } as any });

        await expect(getBracket(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(bracketSvc.getBracket).not.toHaveBeenCalled();
    });
});

describe("getTournamentMatches", () => {
    it("parses id, pagination, and numeric/string filters together", async () => {
        svc.getTournamentMatches.mockResolvedValue({ items: [] } as any);

        const req = makeReq({
            params: { id: "5" } as any,
            query: { page: "2", pageSize: "10", teamId: "3", status: "SCHEDULED", round: "1" },
        });
        await getTournamentMatches(req, makeRes());

        // page 2, size 10 -> offset 10 (real parsePagination arithmetic)
        expect(svc.getTournamentMatches).toHaveBeenCalledWith(
            5,
            { teamId: 3, status: "SCHEDULED", round: 1 },
            2,
            10,
            10,
        );
    });

    it("omits filters entirely (as undefined) when none are given", async () => {
        svc.getTournamentMatches.mockResolvedValue({ items: [] } as any);

        const req = makeReq({ params: { id: "5" } as any, query: {} });
        await getTournamentMatches(req, makeRes());

        expect(svc.getTournamentMatches).toHaveBeenCalledWith(
            5,
            { teamId: undefined, status: undefined, round: undefined },
            1,
            20,
            0,
        );
    });

    it("treats an empty-string status as absent, not as an empty filter", async () => {
        svc.getTournamentMatches.mockResolvedValue({ items: [] } as any);

        const req = makeReq({ query: { status: "" } });
        await getTournamentMatches(req, makeRes());

        expect(svc.getTournamentMatches).toHaveBeenCalledWith(
            42,
            expect.objectContaining({ status: undefined }),
            1,
            20,
            0,
        );
    });

    it("drops a non-integer teamId to undefined rather than rounding it", async () => {
        svc.getTournamentMatches.mockResolvedValue({ items: [] } as any);

        const req = makeReq({ query: { teamId: "2.5" } });
        await getTournamentMatches(req, makeRes());

        expect(svc.getTournamentMatches).toHaveBeenCalledWith(
            42,
            expect.objectContaining({ teamId: undefined }),
            1,
            20,
            0,
        );
    });

    it("drops a non-numeric round to undefined", async () => {
        svc.getTournamentMatches.mockResolvedValue({ items: [] } as any);

        const req = makeReq({ query: { round: "quarterfinal" } });
        await getTournamentMatches(req, makeRes());

        expect(svc.getTournamentMatches).toHaveBeenCalledWith(
            42,
            expect.objectContaining({ round: undefined }),
            1,
            20,
            0,
        );
    });

    it("characterization: a duplicated query param (array) is dropped to undefined, unlike parsePagination's array coercion", async () => {
        // parseOptionalString/Number check `typeof raw === 'string'`, so an array
        // value (?teamId=1&teamId=2) fails that check outright and becomes
        // undefined — a stricter, more predictable behaviour than parsePagination's
        // Number(array) coercion quirks (see pagination.test.ts).
        svc.getTournamentMatches.mockResolvedValue({ items: [] } as any);

        const req = makeReq({ query: { teamId: ["1", "2"] as any } });
        await getTournamentMatches(req, makeRes());

        expect(svc.getTournamentMatches).toHaveBeenCalledWith(
            42,
            expect.objectContaining({ teamId: undefined }),
            1,
            20,
            0,
        );
    });

    it("responds 200 with the service result", async () => {
        const payload = { items: [{ id: 1 }], total: 1 };
        svc.getTournamentMatches.mockResolvedValue(payload as any);

        const res = makeRes();
        await getTournamentMatches(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id without calling the service", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getTournamentMatches(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getTournamentMatches).not.toHaveBeenCalled();
    });
});

describe("getMatchDetail", () => {
    it("parses the id and forwards the caller's user_id, responds 200 with the service result", async () => {
        const payload = { id: 42, status: "SCHEDULED" };
        svc.getMatchDetail.mockResolvedValue(payload as any);

        const res = makeRes();
        await getMatchDetail(makeReq({ user: { user_id: 7 } as any }), res);

        expect(svc.getMatchDetail).toHaveBeenCalledWith(42, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("forwards undefined for the user id when req.user is absent (uses req.user?.user_id)", async () => {
        svc.getMatchDetail.mockResolvedValue({} as any);

        await getMatchDetail(makeReq({ user: undefined }), makeRes());

        expect(svc.getMatchDetail).toHaveBeenCalledWith(42, undefined);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getMatchDetail(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getMatchDetail).not.toHaveBeenCalled();
    });
});

describe("scheduleMatch", () => {
    it("parses the id and forwards the raw body as a single options object", async () => {
        svc.scheduleMatch.mockResolvedValue({ ok: true } as any);

        const body = {
            scheduledTime: "2026-10-01T10:00:00Z",
            scheduledEndTime: "2026-10-01T11:00:00Z",
            venue: "Court 1",
        };
        const req = makeReq({ body });
        await scheduleMatch(req, makeRes());

        expect(svc.scheduleMatch).toHaveBeenCalledWith(42, body);
    });

    it("responds 200 with the service result", async () => {
        const payload = { id: 42 };
        svc.scheduleMatch.mockResolvedValue(payload as any);

        const res = makeRes();
        await scheduleMatch(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "-1" } as any });

        await expect(scheduleMatch(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.scheduleMatch).not.toHaveBeenCalled();
    });
});

describe("openCheckinMatch / closeCheckinMatch", () => {
    it("openCheckinMatch parses the id, calls the service, responds 200", async () => {
        const payload = { status: "OPEN" };
        svc.openCheckinMatch.mockResolvedValue(payload as any);

        const res = makeRes();
        await openCheckinMatch(makeReq(), res);

        expect(svc.openCheckinMatch).toHaveBeenCalledWith(42);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("closeCheckinMatch parses the id, calls the service, responds 200", async () => {
        const payload = { status: "CLOSED" };
        svc.closeCheckinMatch.mockResolvedValue(payload as any);

        const res = makeRes();
        await closeCheckinMatch(makeReq(), res);

        expect(svc.closeCheckinMatch).toHaveBeenCalledWith(42);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("both reject with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(openCheckinMatch(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        await expect(closeCheckinMatch(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });
});

describe("forfeitMatch — unguarded req.user!", () => {
    it("forwards matchId and user_id to the service", async () => {
        svc.forfeitMatch.mockResolvedValue({ ok: true } as any);

        await forfeitMatch(makeReq({ user: { user_id: 7 } as any }), makeRes());

        expect(svc.forfeitMatch).toHaveBeenCalledWith(42, 7);
    });

    it("responds 200 with the service result", async () => {
        const payload = { status: "FORFEITED" };
        svc.forfeitMatch.mockResolvedValue(payload as any);

        const res = makeRes();
        await forfeitMatch(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    // Unlike every other handler in this file, forfeitMatch uses `req.user!.user_id`
    // rather than an explicit guard. If req.user is genuinely absent (e.g. auth
    // middleware misconfigured for this route), this throws a raw TypeError instead
    // of the 404 USER_NOT_FOUND AppError every sibling handler returns.
    it("characterization: throws a TypeError (not a 404 AppError) when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(forfeitMatch(req, makeRes())).rejects.toBeInstanceOf(TypeError);
        expect(svc.forfeitMatch).not.toHaveBeenCalled();
    });
});

describe("guarded req.user handlers (startMatch, getMatchCheckins, getCheckinQr, submitCheckin)", () => {
    it("startMatch forwards matchId and user_id, responds 200", async () => {
        const payload = { status: "IN_PROGRESS" };
        svc.startMatch.mockResolvedValue(payload as any);

        const res = makeRes();
        await startMatch(makeReq({ user: { user_id: 7 } as any }), res);

        expect(svc.startMatch).toHaveBeenCalledWith(42, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("startMatch rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(startMatch(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.startMatch).not.toHaveBeenCalled();
    });

    it("startMatch checks auth before parsing the id (auth error wins over a bad id)", async () => {
        const req = makeReq({ user: undefined, params: { id: "not-a-number" } as any });

        await expect(startMatch(req, makeRes())).rejects.toMatchObject({
            code: "USER_NOT_FOUND",
        });
    });

    it("getMatchCheckins forwards matchId and user_id, responds 200", async () => {
        const payload = [{ checkinId: 1 }];
        svc.getMatchCheckins.mockResolvedValue(payload as any);

        const res = makeRes();
        await getMatchCheckins(makeReq({ user: { user_id: 7 } as any }), res);

        expect(svc.getMatchCheckins).toHaveBeenCalledWith(42, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("getMatchCheckins rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(getMatchCheckins(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.getMatchCheckins).not.toHaveBeenCalled();
    });

    it("getCheckinQr forwards matchId and user_id, responds 200", async () => {
        const payload = { qr: "data:image/png;base64,..." };
        svc.getCheckinQr.mockResolvedValue(payload as any);

        const res = makeRes();
        await getCheckinQr(makeReq({ user: { user_id: 7 } as any }), res);

        expect(svc.getCheckinQr).toHaveBeenCalledWith(42, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("getCheckinQr rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(getCheckinQr(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.getCheckinQr).not.toHaveBeenCalled();
    });

    it("submitCheckin forwards matchId, user_id, and the raw body", async () => {
        svc.submitCheckin.mockResolvedValue({ isNew: true, data: { checkinId: 9 } } as any);

        const body = { qrToken: "abc123" };
        const req = makeReq({ user: { user_id: 7 } as any, body });
        await submitCheckin(req, makeRes());

        expect(svc.submitCheckin).toHaveBeenCalledWith(42, 7, body);
    });

    it("submitCheckin responds 201 with data when the service reports isNew: true", async () => {
        const data = { checkinId: 9, status: "PENDING" };
        svc.submitCheckin.mockResolvedValue({ isNew: true, data } as any);

        const res = makeRes();
        await submitCheckin(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(data);
    });

    it("submitCheckin responds 200 with data when the service reports isNew: false", async () => {
        const data = { checkinId: 9, status: "PENDING" };
        svc.submitCheckin.mockResolvedValue({ isNew: false, data } as any);

        const res = makeRes();
        await submitCheckin(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(data);
    });

    it("submitCheckin rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(submitCheckin(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.submitCheckin).not.toHaveBeenCalled();
    });
});

describe("verifyCheckin / rejectCheckin — two-id handlers", () => {
    it("verifyCheckin parses cid and id (in that order) and forwards them with user_id", async () => {
        svc.verifyCheckin.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "42", cid: "9" } as any,
            user: { user_id: 7 } as any,
        });
        await verifyCheckin(req, makeRes());

        expect(svc.verifyCheckin).toHaveBeenCalledWith(9, 42, 7);
    });

    it("verifyCheckin responds 200 with the service result", async () => {
        const payload = { status: "VERIFIED" };
        svc.verifyCheckin.mockResolvedValue(payload as any);

        const res = makeRes();
        await verifyCheckin(makeReq({ params: { id: "42", cid: "9" } as any }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("verifyCheckin checks auth before parsing either id", async () => {
        const req = makeReq({
            user: undefined,
            params: { id: "bad", cid: "also-bad" } as any,
        });

        await expect(verifyCheckin(req, makeRes())).rejects.toMatchObject({
            code: "USER_NOT_FOUND",
        });
    });

    it("verifyCheckin rejects with VALIDATION_FAILED for a bad checkin id (cid) before checking the match id", async () => {
        const req = makeReq({ params: { id: "42", cid: "abc" } as any });

        await expect(verifyCheckin(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสการเช็คอินต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.verifyCheckin).not.toHaveBeenCalled();
    });

    it("rejectCheckin forwards checkinId, matchId, user_id, and reason", async () => {
        svc.rejectCheckin.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "42", cid: "9" } as any,
            user: { user_id: 7 } as any,
            body: { reason: "หลักฐานไม่ชัดเจน" },
        });
        await rejectCheckin(req, makeRes());

        expect(svc.rejectCheckin).toHaveBeenCalledWith(9, 42, 7, "หลักฐานไม่ชัดเจน");
    });

    it("rejectCheckin responds 200 with the service result", async () => {
        const payload = { status: "REJECTED" };
        svc.rejectCheckin.mockResolvedValue(payload as any);

        const res = makeRes();
        await rejectCheckin(makeReq({ params: { id: "42", cid: "9" } as any }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejectCheckin rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined, params: { id: "42", cid: "9" } as any });

        await expect(rejectCheckin(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.rejectCheckin).not.toHaveBeenCalled();
    });

    it("rejectCheckin passes reason through as undefined when the body omits it", async () => {
        svc.rejectCheckin.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "42", cid: "9" } as any,
            body: {},
        });
        await rejectCheckin(req, makeRes());

        expect(svc.rejectCheckin).toHaveBeenCalledWith(9, 42, 7, undefined);
    });
});

describe("characterization: the two different labels for a match id", () => {
    // scheduleMatch uses 'รหัสการแข่งขัน' (single เ), while getMatchDetail and most
    // other match-id handlers use 'รหัสการเเข่งขัน' (double เ). These tests pin the
    // exact validation-error message each produces today, so a future cleanup that
    // unifies the label has something concrete to update.
    it("scheduleMatch's bad-id error uses the single-เ label", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(scheduleMatch(req, makeRes())).rejects.toMatchObject({
            extra: { fields: { id: "รหัสการแข่งขันต้องเป็นจำนวนเต็มบวก" } },
        });
    });

    it("getMatchDetail's bad-id error uses the double-เ label", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getMatchDetail(req, makeRes())).rejects.toMatchObject({
            extra: { fields: { id: "รหัสการเเข่งขันต้องเป็นจำนวนเต็มบวก" } },
        });
    });
});
