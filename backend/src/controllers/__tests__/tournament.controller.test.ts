import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in tournament.controller.ts exactly, so
// this file is expected to sit in a __tests__ subfolder next to the
// controller. parseId and parsePagination are NOT mocked — both are pure
// (see their own dedicated tests elsewhere in this codebase).
//
// req.tournament! reachability, per tournament.routes.ts + requireOrganizer.ts
// (which also exports requireRequester): RESOLVED for all handlers below.
// - publishTournament, unpublishTournament, completeTournament,
//   openRegistration, closeRegistration are gated by requireOrganizer.
// - deleteTournament, getTournamentAmendments, setEligibilityRules are gated
//   by requireRequester instead.
// Both middleware functions have the identical shape: every path either
// calls next(err) or falls through to `req.tournament = tournament; next();`
// — no branch skips setting req.tournament. So for all 8 handlers, the
// "req.tournament is undefined" tests below document defense-in-depth-only
// behavior in the controller, not a state reachable via correct routing.
vi.mock("../../services/tournament.service.js", () => ({
    createTournament: vi.fn(),
    getMyTournamentRequests: vi.fn(),
    getMyTournaments: vi.fn(),
    getPendingTournamentRequests: vi.fn(),
    getPendingAmendments: vi.fn(),
    approveTournament: vi.fn(),
    rejectTournament: vi.fn(),
    getPublicTournaments: vi.fn(),
    getTournament: vi.fn(),
    updateTournament: vi.fn(),
    getTournamentAmendments: vi.fn(),
    requestAmendment: vi.fn(),
    publishTournament: vi.fn(),
    completeTournament: vi.fn(),
    deleteTournament: vi.fn(),
    unpublishTournament: vi.fn(),
    openRegistration: vi.fn(),
    closeRegistration: vi.fn(),
    setEligibilityRules: vi.fn(),
    getEligibilityRules: vi.fn(),
}));

import * as TournamentService from "../../services/tournament.service.js";
import { AppError } from "../../utils/AppError.js";
import {
    createTournament,
    getMyTournamentRequests,
    getMyTournaments,
    getPendingTournamentRequests,
    getPendingAmendments,
    approveTournament,
    rejectTournament,
    getPublicTournaments,
    getTournament,
    updateTournament,
    getTournamentAmendments,
    requestAmendment,
    publishTournament,
    completeTournament,
    deleteTournament,
    unpublishTournament,
    openRegistration,
    closeRegistration,
    setEligibilityRules,
    getEligibilityRules,
} from "../tournament.controller.js";

const svc = {
    createTournament: vi.mocked(TournamentService.createTournament),
    getMyTournamentRequests: vi.mocked(TournamentService.getMyTournamentRequests),
    getMyTournaments: vi.mocked(TournamentService.getMyTournaments),
    getPendingTournamentRequests: vi.mocked(TournamentService.getPendingTournamentRequests),
    getPendingAmendments: vi.mocked(TournamentService.getPendingAmendments),
    approveTournament: vi.mocked(TournamentService.approveTournament),
    rejectTournament: vi.mocked(TournamentService.rejectTournament),
    getPublicTournaments: vi.mocked(TournamentService.getPublicTournaments),
    getTournament: vi.mocked(TournamentService.getTournament),
    updateTournament: vi.mocked(TournamentService.updateTournament),
    getTournamentAmendments: vi.mocked(TournamentService.getTournamentAmendments),
    requestAmendment: vi.mocked(TournamentService.requestAmendment),
    publishTournament: vi.mocked(TournamentService.publishTournament),
    completeTournament: vi.mocked(TournamentService.completeTournament),
    deleteTournament: vi.mocked(TournamentService.deleteTournament),
    unpublishTournament: vi.mocked(TournamentService.unpublishTournament),
    openRegistration: vi.mocked(TournamentService.openRegistration),
    closeRegistration: vi.mocked(TournamentService.closeRegistration),
    setEligibilityRules: vi.mocked(TournamentService.setEligibilityRules),
    getEligibilityRules: vi.mocked(TournamentService.getEligibilityRules),
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

describe("createTournament", () => {
    it("forwards the body and the caller's user_id, responds 201", async () => {
        const payload = { id: 1 };
        svc.createTournament.mockResolvedValue(payload as any);

        const body = { name: "ทัวร์นาเมนต์ A" };
        const res = makeRes();
        await createTournament(makeReq({ user: { user_id: 7 } as any, body }), res);

        expect(svc.createTournament).toHaveBeenCalledWith(body, 7);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 401 NO_TOKEN when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(createTournament(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
        expect(svc.createTournament).not.toHaveBeenCalled();
    });
});

describe("getMyTournamentRequests / getPendingTournamentRequests / getPendingAmendments", () => {
    it("getMyTournamentRequests forwards user_id and pagination, responds 200", async () => {
        svc.getMyTournamentRequests.mockResolvedValue({ items: [] } as any);

        const req = makeReq({ query: { page: "2", pageSize: "10" } });
        await getMyTournamentRequests(req, makeRes());

        expect(svc.getMyTournamentRequests).toHaveBeenCalledWith(7, 10, 2, 10);
    });

    it("getPendingTournamentRequests forwards user_id and pagination", async () => {
        svc.getPendingTournamentRequests.mockResolvedValue({ items: [] } as any);

        await getPendingTournamentRequests(makeReq({ query: {} }), makeRes());

        expect(svc.getPendingTournamentRequests).toHaveBeenCalledWith(7, 0, 1, 20);
    });

    it("getPendingAmendments forwards user_id and pagination", async () => {
        svc.getPendingAmendments.mockResolvedValue({ items: [] } as any);

        await getPendingAmendments(makeReq({ query: {} }), makeRes());

        expect(svc.getPendingAmendments).toHaveBeenCalledWith(7, 0, 1, 20);
    });

    it.each([
        ["getMyTournamentRequests", getMyTournamentRequests],
        ["getPendingTournamentRequests", getPendingTournamentRequests],
        ["getPendingAmendments", getPendingAmendments],
    ])("%s rejects with 401 NO_TOKEN when req.user is absent", async (_name, handler) => {
        const req = makeReq({ user: undefined });

        await expect(handler(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
    });
});

describe("getMyTournaments", () => {
    it("forwards user_id, an optional status string, and pagination, responds 200", async () => {
        const payload = { items: [] };
        svc.getMyTournaments.mockResolvedValue(payload as any);

        const req = makeReq({ query: { page: "1", pageSize: "20", status: "draft" } });
        const res = makeRes();
        await getMyTournaments(req, res);

        expect(svc.getMyTournaments).toHaveBeenCalledWith(7, "draft", 0, 1, 20);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("forwards status: undefined when no status query is given", async () => {
        svc.getMyTournaments.mockResolvedValue({ items: [] } as any);

        await getMyTournaments(makeReq({ query: {} }), makeRes());

        expect(svc.getMyTournaments).toHaveBeenCalledWith(7, undefined, 0, 1, 20);
    });

    it("treats a non-string status (duplicated query param -> array) as undefined rather than passing it through", async () => {
        svc.getMyTournaments.mockResolvedValue({ items: [] } as any);

        await getMyTournaments(makeReq({ query: { status: ["draft", "published"] as any } }), makeRes());

        expect(svc.getMyTournaments).toHaveBeenCalledWith(7, undefined, 0, 1, 20);
    });

    it("does NOT validate status against any enum — any string passes through as-is", async () => {
        // Unlike getPublicTournaments' status (constrained to 'public' | 'completed'),
        // getMyTournaments accepts any string here; filtering is left to the service.
        svc.getMyTournaments.mockResolvedValue({ items: [] } as any);

        await getMyTournaments(makeReq({ query: { status: "not-a-real-status" } }), makeRes());

        expect(svc.getMyTournaments).toHaveBeenCalledWith(7, "not-a-real-status", 0, 1, 20);
    });

    it("rejects with 401 NO_TOKEN when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(getMyTournaments(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
        expect(svc.getMyTournaments).not.toHaveBeenCalled();
    });
});

describe("approveTournament", () => {
    it("parses the id, forwards user_id, responds 200", async () => {
        const payload = { status: "APPROVED" };
        svc.approveTournament.mockResolvedValue(payload as any);

        const req = makeReq({ params: { id: "5" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await approveTournament(req, res);

        expect(svc.approveTournament).toHaveBeenCalledWith(5, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad id, before the auth check", async () => {
        const req = makeReq({ user: undefined, params: { id: "abc" } as any });

        await expect(approveTournament(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.approveTournament).not.toHaveBeenCalled();
    });

    it("rejects with 401 NO_TOKEN for a valid id but missing auth", async () => {
        const req = makeReq({ user: undefined, params: { id: "5" } as any });

        await expect(approveTournament(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
    });
});

describe("rejectTournament", () => {
    it("parses id, requires a non-empty reason, forwards trimmed reason and user_id", async () => {
        const payload = { status: "REJECTED" };
        svc.rejectTournament.mockResolvedValue(payload as any);

        const req = makeReq({
            params: { id: "5" } as any,
            user: { user_id: 7 } as any,
            body: { reason: "  เอกสารไม่ครบ  " },
        });
        const res = makeRes();
        await rejectTournament(req, res);

        expect(svc.rejectTournament).toHaveBeenCalledWith(5, 7, "เอกสารไม่ครบ");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with TOURNAMENT_REJECT_REASON_REQUIRED when reason is missing", async () => {
        const req = makeReq({ body: {} });

        await expect(rejectTournament(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "TOURNAMENT_REJECT_REASON_REQUIRED",
        });
        expect(svc.rejectTournament).not.toHaveBeenCalled();
    });

    it("rejects with TOURNAMENT_REJECT_REASON_REQUIRED when reason is whitespace-only", async () => {
        const req = makeReq({ body: { reason: "   " } });

        await expect(rejectTournament(req, makeRes())).rejects.toMatchObject({
            code: "TOURNAMENT_REJECT_REASON_REQUIRED",
        });
    });

    it("rejects with TOURNAMENT_REJECT_REASON_REQUIRED when reason is not a string", async () => {
        const req = makeReq({ body: { reason: 12345 } });

        await expect(rejectTournament(req, makeRes())).rejects.toMatchObject({
            code: "TOURNAMENT_REJECT_REASON_REQUIRED",
        });
    });

    it("rejects with VALIDATION_FAILED for a bad id before checking the reason", async () => {
        const req = makeReq({ params: { id: "abc" } as any, body: {} });

        await expect(rejectTournament(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    it("characterization: the missing-reason check runs before the auth check", async () => {
        const req = makeReq({ user: undefined, body: {} });

        await expect(rejectTournament(req, makeRes())).rejects.toMatchObject({
            code: "TOURNAMENT_REJECT_REASON_REQUIRED",
        });
    });

    it("rejects with 401 NO_TOKEN when id and reason are both valid but auth is missing", async () => {
        const req = makeReq({ user: undefined, body: { reason: "เหตุผล" } });

        await expect(rejectTournament(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
    });
});

describe("getPublicTournaments", () => {
    it("parses pagination and optional filters (including status), responds 200", async () => {
        const payload = { items: [] };
        svc.getPublicTournaments.mockResolvedValue(payload as any);

        const req = makeReq({
            query: {
                page: "1",
                pageSize: "20",
                sportTypeId: "3",
                facultyId: "9",
                q: "  ฟุตบอล  ",
                status: "public",
            },
        });
        const res = makeRes();
        await getPublicTournaments(req, res);

        expect(svc.getPublicTournaments).toHaveBeenCalledWith(
            { sportTypeId: 3, facultyId: 9, query: "ฟุตบอล", status: "public" },
            0,
            1,
            20,
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("accepts status: 'completed' as well as 'public'", async () => {
        svc.getPublicTournaments.mockResolvedValue({ items: [] } as any);

        await getPublicTournaments(makeReq({ query: { status: "completed" } }), makeRes());

        expect(svc.getPublicTournaments).toHaveBeenCalledWith(
            expect.objectContaining({ status: "completed" }),
            0,
            1,
            20,
        );
    });

    it("forwards status: undefined when no status query is given (not required)", async () => {
        svc.getPublicTournaments.mockResolvedValue({ items: [] } as any);

        await getPublicTournaments(makeReq({ query: {} }), makeRes());

        expect(svc.getPublicTournaments).toHaveBeenCalledWith(
            { sportTypeId: undefined, facultyId: undefined, query: undefined, status: undefined },
            0,
            1,
            20,
        );
    });

    it("rejects with VALIDATION_FAILED for a status outside the enum", async () => {
        const req = makeReq({ query: { status: "draft" } });

        await expect(getPublicTournaments(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            message: "status ต้องเป็น public หรือ completed",
            extra: { fields: { status: "public | completed" } },
        });
        expect(svc.getPublicTournaments).not.toHaveBeenCalled();
    });

    it("rejects a status that only differs by case (case-sensitive check)", async () => {
        const req = makeReq({ query: { status: "Public" } });

        await expect(getPublicTournaments(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
    });

    it("rejects a non-string status (duplicated query param -> array)", async () => {
        const req = makeReq({ query: { status: ["public", "completed"] as any } });

        await expect(getPublicTournaments(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getPublicTournaments).not.toHaveBeenCalled();
    });

    it("checks status before the sportTypeId/facultyId/q filters", async () => {
        const req = makeReq({ query: { status: "bogus", sportTypeId: "also-bad" } });

        await expect(getPublicTournaments(req, makeRes())).rejects.toMatchObject({
            message: "status ต้องเป็น public หรือ completed",
        });
    });

    it("does not require req.user", async () => {
        svc.getPublicTournaments.mockResolvedValue({ items: [] } as any);

        const res = makeRes();
        await getPublicTournaments(makeReq({ user: undefined, query: {} }), res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects with VALIDATION_FAILED for a non-integer sportTypeId", async () => {
        const req = makeReq({ query: { sportTypeId: "3.5" } });

        await expect(getPublicTournaments(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { sportTypeId: "ต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.getPublicTournaments).not.toHaveBeenCalled();
    });

    it("accepts a zero-padded sportTypeId ('007') since the regex allows leading zeros", async () => {
        svc.getPublicTournaments.mockResolvedValue({ items: [] } as any);

        await getPublicTournaments(makeReq({ query: { sportTypeId: "007" } }), makeRes());

        expect(svc.getPublicTournaments).toHaveBeenCalledWith(
            expect.objectContaining({ sportTypeId: 7 }),
            0,
            1,
            20,
        );
    });

    it("rejects with VALIDATION_FAILED for a bad facultyId independently of sportTypeId", async () => {
        const req = makeReq({ query: { sportTypeId: "3", facultyId: "abc" } });

        await expect(getPublicTournaments(req, makeRes())).rejects.toMatchObject({
            extra: { fields: { facultyId: "ต้องเป็นจำนวนเต็มบวก" } },
        });
    });
});

describe("getTournament", () => {
    it("parses the id and passes req.user?.user_id through when logged in", async () => {
        const payload = { id: 42, isPublic: false };
        svc.getTournament.mockResolvedValue(payload as any);

        const res = makeRes();
        await getTournament(makeReq({ user: { user_id: 7 } as any }), res);

        expect(svc.getTournament).toHaveBeenCalledWith(42, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("passes undefined when req.user is absent — public access is allowed", async () => {
        svc.getTournament.mockResolvedValue({ id: 42 } as any);

        const res = makeRes();
        await getTournament(makeReq({ user: undefined }), res);

        expect(svc.getTournament).toHaveBeenCalledWith(42, undefined);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getTournament(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getTournament).not.toHaveBeenCalled();
    });
});

describe("updateTournament", () => {
    it("parses the id, forwards user_id and body, responds 200", async () => {
        const payload = { id: 42, name: "ชื่อใหม่" };
        svc.updateTournament.mockResolvedValue(payload as any);

        const body = { name: "ชื่อใหม่" };
        const req = makeReq({ params: { id: "5" } as any, user: { user_id: 7 } as any, body });
        const res = makeRes();
        await updateTournament(req, res);

        expect(svc.updateTournament).toHaveBeenCalledWith(5, 7, body);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(updateTournament(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.updateTournament).not.toHaveBeenCalled();
    });

    it("rejects with 401 NO_TOKEN when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(updateTournament(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
    });
});

describe("getTournamentAmendments — new handler", () => {
    it("forwards req.tournament.tournament_id to the service, responds 200, does not require req.user", async () => {
        const payload = [{ id: 1, field: "venue" }];
        svc.getTournamentAmendments.mockResolvedValue(payload as any);

        const req = makeReq({ user: undefined, tournament: { tournament_id: 42 } } as any);
        const res = makeRes();
        await getTournamentAmendments(req, res);

        expect(svc.getTournamentAmendments).toHaveBeenCalledWith(42);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("characterization: throws a TypeError (loudly, via the .tournament_id property access) when req.tournament is absent — gated by requireRequester, which (like requireOrganizer) always sets req.tournament before a bare next(), so this is not reachable given correct routing", async () => {
        const req = makeReq({ tournament: undefined } as any);

        await expect(getTournamentAmendments(req, makeRes())).rejects.toBeInstanceOf(TypeError);
        expect(svc.getTournamentAmendments).not.toHaveBeenCalled();
    });
});

describe("requestAmendment", () => {
    it("parses the id, forwards user_id and body, responds 201", async () => {
        const payload = { id: 1 };
        svc.requestAmendment.mockResolvedValue(payload as any);

        const body = { field: "venue", newValue: "สนาม 2" };
        const req = makeReq({ params: { id: "5" } as any, user: { user_id: 7 } as any, body });
        const res = makeRes();
        await requestAmendment(req, res);

        expect(svc.requestAmendment).toHaveBeenCalledWith(5, 7, body);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(requestAmendment(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.requestAmendment).not.toHaveBeenCalled();
    });

    it("rejects with 401 NO_TOKEN when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(requestAmendment(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
    });
});

describe("publishTournament / completeTournament / unpublishTournament / openRegistration / closeRegistration — bare req.tournament!, chained response", () => {
    const handlers = [
        ["publishTournament", publishTournament, svc.publishTournament] as const,
        ["completeTournament", completeTournament, svc.completeTournament] as const,
        ["unpublishTournament", unpublishTournament, svc.unpublishTournament] as const,
        ["openRegistration", openRegistration, svc.openRegistration] as const,
        ["closeRegistration", closeRegistration, svc.closeRegistration] as const,
    ];

    it.each(handlers)("%s forwards req.tournament and user_id, responds 200", async (_name, handler, mockedSvc) => {
        const tournament = { id: 42, status: "DRAFT" };
        const payload = { id: 42, status: "UPDATED" };
        mockedSvc.mockResolvedValue(payload as any);

        const req = makeReq({ tournament, user: { user_id: 7 } as any } as any);
        const res = makeRes();
        await handler(req, res);

        expect(mockedSvc).toHaveBeenCalledWith(tournament, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it.each(handlers)(
        "%s rejects with 401 NO_TOKEN when req.user is absent (evaluated after req.tournament!, which never throws on its own)",
        async (_name, handler, mockedSvc) => {
            const req = makeReq({ tournament: { id: 42 }, user: undefined } as any);

            await expect(handler(req, makeRes())).rejects.toMatchObject({
                status: 401,
                code: "NO_TOKEN",
            });
            expect(mockedSvc).not.toHaveBeenCalled();
        },
    );

    it.each(handlers)(
        "%s: silently forwards undefined and still returns 200 — no thrown error — when req.tournament is absent but req.user is present (not reachable given correct routing: requireOrganizer guarantees req.tournament for all 5 of these routes)",
        async (_name, handler, mockedSvc) => {
            // Concrete demonstration, not just a claim: with req.tournament missing and
            // req.user present, res.status(200) fires, the service is called with
            // `undefined` as its first argument, and the response completes normally
            // with whatever the (mocked) service returns — no error surfaces anywhere
            // in this flow. `req.tournament!` has no property access after it, so
            // TypeScript's non-null assertion (compile-time only) does nothing at
            // runtime here.
            //
            // RESOLVED via tournament.routes.ts + requireOrganizer.ts: all 5 of these
            // routes (publish/unpublish/complete/open-registration/close-registration)
            // are gated by requireOrganizer, which always either calls next(err) or
            // sets req.tournament before a bare next(). So this state is not reachable
            // given correct routing — this test documents defense-in-depth-only
            // behavior, not a live gap.
            mockedSvc.mockResolvedValue({ id: undefined } as any);

            const req = makeReq({ tournament: undefined, user: { user_id: 7 } as any } as any);
            const res = makeRes();
            await handler(req, res);

            expect(mockedSvc).toHaveBeenCalledWith(undefined, 7);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ id: undefined });
        },
    );
});

describe("deleteTournament — bare req.tournament!, separate-statement response (204); gated by requireRequester", () => {
    it("forwards req.tournament and user_id, responds 204 with no body", async () => {
        svc.deleteTournament.mockResolvedValue(undefined as any);

        const tournament = { id: 42 };
        const req = makeReq({ tournament, user: { user_id: 7 } as any } as any);
        const res = makeRes();
        await deleteTournament(req, res);

        expect(svc.deleteTournament).toHaveBeenCalledWith(tournament, 7);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
        expect(res.json).not.toHaveBeenCalled();
    });

    it("rejects with 401 NO_TOKEN when req.user is absent", async () => {
        const req = makeReq({ tournament: { id: 42 }, user: undefined } as any);

        await expect(deleteTournament(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
        expect(svc.deleteTournament).not.toHaveBeenCalled();
    });

    it("not reachable given correct routing (requireRequester guarantees req.tournament, same shape as requireOrganizer): silently forwards undefined and still responds 204 when req.tournament is absent but req.user is present", async () => {
        svc.deleteTournament.mockResolvedValue(undefined as any);

        const req = makeReq({ tournament: undefined, user: { user_id: 7 } as any } as any);
        const res = makeRes();
        await deleteTournament(req, res);

        expect(svc.deleteTournament).toHaveBeenCalledWith(undefined, 7);
        expect(res.status).toHaveBeenCalledWith(204);
    });

    it("propagates a service rejection without calling res.status (await is on its own line, before res is touched)", async () => {
        const serviceError = new AppError(409, "HAS_ACTIVE_MATCHES", "ทัวร์นาเมนต์มีแมตช์ที่ยังดำเนินอยู่");
        svc.deleteTournament.mockRejectedValue(serviceError);

        const req = makeReq({ tournament: { id: 42 } } as any);
        const res = makeRes();
        await expect(deleteTournament(req, res)).rejects.toBe(serviceError);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("setEligibilityRules — gated by requireRequester", () => {
    it("forwards req.tournament, user_id, and the body, responds 200", async () => {
        const payload = { rules: [] };
        svc.setEligibilityRules.mockResolvedValue(payload as any);

        const tournament = { id: 42 };
        const body = { minAge: 18, maxTeamSize: 11 };
        const req = makeReq({ tournament, user: { user_id: 7 } as any, body } as any);
        const res = makeRes();
        await setEligibilityRules(req, res);

        expect(svc.setEligibilityRules).toHaveBeenCalledWith(tournament, 7, body);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 401 NO_TOKEN when req.user is absent", async () => {
        const req = makeReq({ tournament: { id: 42 }, user: undefined } as any);

        await expect(setEligibilityRules(req, makeRes())).rejects.toMatchObject({
            status: 401,
            code: "NO_TOKEN",
        });
        expect(svc.setEligibilityRules).not.toHaveBeenCalled();
    });

    it("not reachable given correct routing (requireRequester guarantees req.tournament): silently forwards undefined and still returns 200 when req.tournament is absent but req.user is present", async () => {
        svc.setEligibilityRules.mockResolvedValue({ rules: [] } as any);

        const req = makeReq({ tournament: undefined, user: { user_id: 7 } as any, body: {} } as any);
        const res = makeRes();
        await setEligibilityRules(req, res);

        expect(svc.setEligibilityRules).toHaveBeenCalledWith(undefined, 7, {});
        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe("getEligibilityRules", () => {
    it("parses the id and passes req.user?.user_id through when logged in", async () => {
        const payload = { rules: [] };
        svc.getEligibilityRules.mockResolvedValue(payload as any);

        const res = makeRes();
        await getEligibilityRules(makeReq({ user: { user_id: 7 } as any }), res);

        expect(svc.getEligibilityRules).toHaveBeenCalledWith(42, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("passes undefined when req.user is absent — public access is allowed", async () => {
        svc.getEligibilityRules.mockResolvedValue({ rules: [] } as any);

        await getEligibilityRules(makeReq({ user: undefined }), makeRes());

        expect(svc.getEligibilityRules).toHaveBeenCalledWith(42, undefined);
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getEligibilityRules(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getEligibilityRules).not.toHaveBeenCalled();
    });
});
