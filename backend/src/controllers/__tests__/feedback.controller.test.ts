import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in feedback.controller.ts exactly.
// paths are relative to __tests__/ (services and utils are two levels up).
// parseId, parsePagination, and the zod schemas are NOT mocked: they're pure
// and side-effect-free, so exercising the real implementations is more
// honest and catches real validation regressions.
vi.mock("../../services/feedback.service.js", () => ({
    submitOrganizerFeedback: vi.fn(),
    getOrganizerFeedback: vi.fn(),
    castMvpVote: vi.fn(),
    getMvpVotes: vi.fn(),
    listTournamentComments: vi.fn(),
    postTournamentComment: vi.fn(),
    deleteOwnTournamentComment: vi.fn(),
    removeCommentByOrganizer: vi.fn(),
    restoreFeedback: vi.fn(),
    reportFeedback: vi.fn(),
    removeFeedback: vi.fn(),
}));

import * as FeedbackService from "../../services/feedback.service.js";
import { AppError } from "../../utils/AppError.js";
import {
    submitOrganizerFeedback,
    getOrganizerFeedback,
    castMvpVote,
    getMvpVotes,
    listTournamentComments,
    postTournamentComment,
    deleteOwnTournamentComment,
    removeCommentByOrganizer,
    restoreFeedback,
    reportFeedback,
    removeFeedback,
} from "../feedback.controller.js";

const svc = {
    submitOrganizerFeedback: vi.mocked(FeedbackService.submitOrganizerFeedback),
    getOrganizerFeedback: vi.mocked(FeedbackService.getOrganizerFeedback),
    castMvpVote: vi.mocked(FeedbackService.castMvpVote),
    getMvpVotes: vi.mocked(FeedbackService.getMvpVotes),
    listTournamentComments: vi.mocked(FeedbackService.listTournamentComments),
    postTournamentComment: vi.mocked(FeedbackService.postTournamentComment),
    deleteOwnTournamentComment: vi.mocked(FeedbackService.deleteOwnTournamentComment),
    removeCommentByOrganizer: vi.mocked(FeedbackService.removeCommentByOrganizer),
    restoreFeedback: vi.mocked(FeedbackService.restoreFeedback),
    reportFeedback: vi.mocked(FeedbackService.reportFeedback),
    removeFeedback: vi.mocked(FeedbackService.removeFeedback),
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

describe("submitOrganizerFeedback", () => {
    it("parses the tournament id and forwards userId and the raw body", async () => {
        svc.submitOrganizerFeedback.mockResolvedValue({ isNew: true, rating: 5 } as any);

        const body = { rating: 5, content: "ดีมาก" };
        const req = makeReq({
            params: { id: "5" } as any,
            user: { user_id: 7 } as any,
            body,
        });
        await submitOrganizerFeedback(req, makeRes());

        expect(svc.submitOrganizerFeedback).toHaveBeenCalledWith(5, 7, body);
    });

    it("responds 201 and strips isNew for a first-time submission", async () => {
        svc.submitOrganizerFeedback.mockResolvedValue({ isNew: true, rating: 5 } as any);

        const res = makeRes();
        await submitOrganizerFeedback(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ rating: 5 });
    });

    it("responds 200 and strips isNew when the feedback already existed (update)", async () => {
        svc.submitOrganizerFeedback.mockResolvedValue({ isNew: false, rating: 4 } as any);

        const res = makeRes();
        await submitOrganizerFeedback(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ rating: 4 });
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, and never calls the service", async () => {
        const req = makeReq({ user: undefined });

        await expect(submitOrganizerFeedback(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.submitOrganizerFeedback).not.toHaveBeenCalled();
    });

    it("checks req.user before the tournament id (auth error wins over a bad id)", async () => {
        const req = makeReq({ user: undefined, params: { id: "abc" } as any });

        await expect(submitOrganizerFeedback(req, makeRes())).rejects.toMatchObject({
            code: "USER_NOT_FOUND",
        });
        expect(svc.submitOrganizerFeedback).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(submitOrganizerFeedback(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสทัวร์นาเมนต์ต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.submitOrganizerFeedback).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(403, "NOT_A_PARTICIPANT", "คุณไม่ได้เข้าร่วมทัวร์นี้");
        svc.submitOrganizerFeedback.mockRejectedValue(err);

        const res = makeRes();
        await expect(submitOrganizerFeedback(makeReq(), res)).rejects.toBe(err);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("getOrganizerFeedback", () => {
    it("parses the tournament id and forwards the caller's user_id, responds 200", async () => {
        const payload = { averageRating: 4.2 };
        svc.getOrganizerFeedback.mockResolvedValue(payload as any);

        const req = makeReq({ params: { id: "5" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await getOrganizerFeedback(req, res);

        expect(svc.getOrganizerFeedback).toHaveBeenCalledWith(5, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("does not require req.user; forwards undefined for the user id when absent", async () => {
        svc.getOrganizerFeedback.mockResolvedValue({} as any);

        await getOrganizerFeedback(makeReq({ user: undefined }), makeRes());

        expect(svc.getOrganizerFeedback).toHaveBeenCalledWith(42, undefined);
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getOrganizerFeedback(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getOrganizerFeedback).not.toHaveBeenCalled();
    });
});

describe("castMvpVote", () => {
    it("parses the tournament id and forwards the voter's userId and the voted-for body.userId", async () => {
        svc.castMvpVote.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "5" } as any,
            user: { user_id: 7 } as any,
            body: { userId: 12 },
        });
        await castMvpVote(req, makeRes());

        expect(svc.castMvpVote).toHaveBeenCalledWith(5, 7, 12);
    });

    it("responds 200 with the service result", async () => {
        const payload = { votedFor: 12 };
        svc.castMvpVote.mockResolvedValue(payload as any);

        const res = makeRes();
        await castMvpVote(makeReq({ body: { userId: 12 } }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(castMvpVote(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.castMvpVote).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(castMvpVote(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.castMvpVote).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(400, "NOT_A_PLAYER", "ผู้ถูกโหวตไม่ได้ลงแข่งขัน");
        svc.castMvpVote.mockRejectedValue(err);

        await expect(castMvpVote(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("getMvpVotes", () => {
    it("parses the tournament id and forwards the caller's user_id, responds 200", async () => {
        const payload = [{ userId: 12, votes: 3 }];
        svc.getMvpVotes.mockResolvedValue(payload as any);

        const req = makeReq({ params: { id: "5" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await getMvpVotes(req, res);

        expect(svc.getMvpVotes).toHaveBeenCalledWith(5, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("does not require req.user; forwards undefined for the user id when absent", async () => {
        svc.getMvpVotes.mockResolvedValue([] as any);

        await getMvpVotes(makeReq({ user: undefined }), makeRes());

        expect(svc.getMvpVotes).toHaveBeenCalledWith(42, undefined);
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(getMvpVotes(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.getMvpVotes).not.toHaveBeenCalled();
    });
});

describe("listTournamentComments", () => {
    it("falls back to page 1 / size 20 / reportedOnly false when no query params are given", async () => {
        svc.listTournamentComments.mockResolvedValue([] as any);

        const req = makeReq({ params: { id: "5" } as any, user: { user_id: 7 } as any, query: {} });
        await listTournamentComments(req, makeRes());

        expect(svc.listTournamentComments).toHaveBeenCalledWith(5, 7, 1, 20, 0, false);
    });

    it("forwards computed pagination for explicit page/pageSize", async () => {
        svc.listTournamentComments.mockResolvedValue([] as any);

        const req = makeReq({
            params: { id: "5" } as any,
            query: { page: "2", pageSize: "10" },
        });
        await listTournamentComments(req, makeRes());

        // page 2, size 10 -> offset (page - 1) * pageSize = 10 — real parsePagination logic.
        expect(svc.listTournamentComments).toHaveBeenCalledWith(5, 7, 2, 10, 10, false);
    });

    it("sets reportedOnly true only for the exact string 'true'", async () => {
        svc.listTournamentComments.mockResolvedValue([] as any);

        const req = makeReq({ query: { reported: "true" } });
        await listTournamentComments(req, makeRes());

        expect(svc.listTournamentComments).toHaveBeenCalledWith(42, 7, 1, 20, 0, true);
    });

    it.each(["false", "1", "yes", ""])(
        "treats reported=%j as reportedOnly false",
        async (reported) => {
            svc.listTournamentComments.mockResolvedValue([] as any);

            const req = makeReq({ query: { reported } });
            await listTournamentComments(req, makeRes());

            expect(svc.listTournamentComments).toHaveBeenCalledWith(42, 7, 1, 20, 0, false);
        },
    );

    it("does not require req.user; forwards undefined for the user id when absent", async () => {
        svc.listTournamentComments.mockResolvedValue([] as any);

        await listTournamentComments(makeReq({ user: undefined }), makeRes());

        expect(svc.listTournamentComments).toHaveBeenCalledWith(42, undefined, 1, 20, 0, false);
    });

    it("responds 200 with the service result", async () => {
        const payload = [{ id: 1, content: "เยี่ยมมาก" }];
        svc.listTournamentComments.mockResolvedValue(payload as any);

        const res = makeRes();
        await listTournamentComments(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id without calling the service", async () => {
        const req = makeReq({ params: { id: "-1" } as any });

        await expect(listTournamentComments(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
        });
        expect(svc.listTournamentComments).not.toHaveBeenCalled();
    });
});

describe("postTournamentComment", () => {
    it("parses the tournament id and forwards userId and body.content", async () => {
        svc.postTournamentComment.mockResolvedValue({ isNew: true, content: "ดีมาก" } as any);

        const req = makeReq({
            params: { id: "5" } as any,
            user: { user_id: 7 } as any,
            body: { content: "ดีมาก" },
        });
        await postTournamentComment(req, makeRes());

        expect(svc.postTournamentComment).toHaveBeenCalledWith(5, 7, "ดีมาก");
    });

    it("responds 201 and strips isNew for a first-time comment", async () => {
        svc.postTournamentComment.mockResolvedValue({ isNew: true, content: "ดีมาก" } as any);

        const res = makeRes();
        await postTournamentComment(makeReq({ body: { content: "ดีมาก" } }), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ content: "ดีมาก" });
    });

    it("responds 200 and strips isNew when the comment already existed (edit)", async () => {
        svc.postTournamentComment.mockResolvedValue({ isNew: false, content: "แก้ไขแล้ว" } as any);

        const res = makeRes();
        await postTournamentComment(makeReq({ body: { content: "แก้ไขแล้ว" } }), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ content: "แก้ไขแล้ว" });
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(postTournamentComment(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.postTournamentComment).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(postTournamentComment(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.postTournamentComment).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(403, "NOT_A_PARTICIPANT", "คุณไม่ได้เข้าร่วมทัวร์นี้");
        svc.postTournamentComment.mockRejectedValue(err);

        await expect(postTournamentComment(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("deleteOwnTournamentComment", () => {
    it("forwards the parsed id and userId, responds 204 with no body", async () => {
        svc.deleteOwnTournamentComment.mockResolvedValue(undefined as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await deleteOwnTournamentComment(req, res);

        expect(svc.deleteOwnTournamentComment).toHaveBeenCalledWith(9, 7);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
        expect(res.json).not.toHaveBeenCalled();
    });

    // Characterization: the handler labels its id error 'รหัสทัวร์นาเมนต์' (tournament id)
    // even though :id here is the comment id being deleted. This may be a copy/paste
    // leftover worth revisiting, not something to silently "fix" in the test.
    it("uses the tournament-id label on a bad id, not a comment-id label", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(deleteOwnTournamentComment(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสทัวร์นาเมนต์ต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.deleteOwnTournamentComment).not.toHaveBeenCalled();
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, and never calls the service", async () => {
        const req = makeReq({ user: undefined });

        await expect(deleteOwnTournamentComment(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.deleteOwnTournamentComment).not.toHaveBeenCalled();
    });

    it("checks req.user before the id (auth error wins over a bad id)", async () => {
        const req = makeReq({ user: undefined, params: { id: "abc" } as any });

        await expect(deleteOwnTournamentComment(req, makeRes())).rejects.toMatchObject({
            code: "USER_NOT_FOUND",
        });
        expect(svc.deleteOwnTournamentComment).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(404, "COMMENT_NOT_FOUND", "ไม่พบความเห็น");
        svc.deleteOwnTournamentComment.mockRejectedValue(err);

        await expect(deleteOwnTournamentComment(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("removeCommentByOrganizer", () => {
    function makeReqWithCid(overrides: Partial<Request> = {}): Request {
        return makeReq({ params: { id: "5", cid: "9" } as any, ...overrides });
    }

    it("parses tournament id and comment id (param 'cid'), and forwards the trimmed reason", async () => {
        svc.removeCommentByOrganizer.mockResolvedValue(undefined as any);

        const req = makeReqWithCid({
            user: { user_id: 7 } as any,
            body: { reason: "  หยาบคาย  " },
        });
        await removeCommentByOrganizer(req, makeRes());

        // reason is trimmed by the zod schema before being forwarded.
        expect(svc.removeCommentByOrganizer).toHaveBeenCalledWith(5, 9, 7, "หยาบคาย");
    });

    it("responds 204 with no body", async () => {
        svc.removeCommentByOrganizer.mockResolvedValue(undefined as any);

        const res = makeRes();
        await removeCommentByOrganizer(makeReqWithCid({ body: { reason: "หยาบคาย" } }), res);

        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
        expect(res.json).not.toHaveBeenCalled();
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, checked before params/body", async () => {
        const req = makeReqWithCid({ user: undefined, body: {} });

        await expect(removeCommentByOrganizer(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.removeCommentByOrganizer).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED (keyed under 'id') for a bad tournament id", async () => {
        const req = makeReq({ params: { id: "abc", cid: "9" } as any, body: { reason: "หยาบคาย" } });

        await expect(removeCommentByOrganizer(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสทัวร์นาเมนต์ต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.removeCommentByOrganizer).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED (keyed under 'cid') for a bad comment id", async () => {
        const req = makeReq({ params: { id: "5", cid: "abc" } as any, body: { reason: "หยาบคาย" } });

        await expect(removeCommentByOrganizer(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { cid: "รหัสความเห็นต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.removeCommentByOrganizer).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED when reason is missing (empty body)", async () => {
        const req = makeReqWithCid({ body: {} });

        await expect(removeCommentByOrganizer(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { reason: "กรุณาระบุเหตุผลที่ลบ" } },
        });
        expect(svc.removeCommentByOrganizer).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED when req.body itself is undefined (falls back to {})", async () => {
        const req = makeReqWithCid({ body: undefined });

        await expect(removeCommentByOrganizer(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            extra: { fields: { reason: "กรุณาระบุเหตุผลที่ลบ" } },
        });
        expect(svc.removeCommentByOrganizer).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only reason (trimmed to empty, fails the min-length check)", async () => {
        const req = makeReqWithCid({ body: { reason: "   " } });

        await expect(removeCommentByOrganizer(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            extra: { fields: { reason: "กรุณาระบุเหตุผลที่ลบ" } },
        });
        expect(svc.removeCommentByOrganizer).not.toHaveBeenCalled();
    });

    it("rejects a reason over 255 characters", async () => {
        const req = makeReqWithCid({ body: { reason: "a".repeat(256) } });

        await expect(removeCommentByOrganizer(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            extra: { fields: { reason: "เหตุผลยาวได้ไม่เกิน 255 ตัวอักษร" } },
        });
        expect(svc.removeCommentByOrganizer).not.toHaveBeenCalled();
    });

    it("accepts a reason at exactly the 255-character limit", async () => {
        svc.removeCommentByOrganizer.mockResolvedValue(undefined as any);
        const reason = "a".repeat(255);

        await removeCommentByOrganizer(makeReqWithCid({ body: { reason } }), makeRes());

        expect(svc.removeCommentByOrganizer).toHaveBeenCalledWith(5, 9, 7, reason);
    });

    it("rejects a non-string reason with the same message as a missing one", async () => {
        const req = makeReqWithCid({ body: { reason: 12345 } });

        await expect(removeCommentByOrganizer(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
            extra: { fields: { reason: "กรุณาระบุเหตุผลที่ลบ" } },
        });
        expect(svc.removeCommentByOrganizer).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(404, "COMMENT_NOT_FOUND", "ไม่พบความเห็น");
        svc.removeCommentByOrganizer.mockRejectedValue(err);

        const res = makeRes();
        await expect(
            removeCommentByOrganizer(makeReqWithCid({ body: { reason: "หยาบคาย" } }), res),
        ).rejects.toBe(err);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("restoreFeedback", () => {
    it("parses the id and forwards it with userId, responds 200 with the service result", async () => {
        const payload = { id: 42, status: "restored" };
        svc.restoreFeedback.mockResolvedValue(payload as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await restoreFeedback(req, res);

        expect(svc.restoreFeedback).toHaveBeenCalledWith(9, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(restoreFeedback(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.restoreFeedback).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(restoreFeedback(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.restoreFeedback).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(409, "NOT_REMOVED", "ความเห็นนี้ไม่ได้ถูกลบ");
        svc.restoreFeedback.mockRejectedValue(err);

        await expect(restoreFeedback(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("reportFeedback", () => {
    it("parses the id and forwards it with userId, responds 200 with the service result", async () => {
        const payload = { id: 42, reportCount: 1 };
        svc.reportFeedback.mockResolvedValue(payload as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        const res = makeRes();
        await reportFeedback(req, res);

        expect(svc.reportFeedback).toHaveBeenCalledWith(9, 7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(reportFeedback(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.reportFeedback).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(reportFeedback(req, makeRes())).rejects.toMatchObject({
            code: "VALIDATION_FAILED",
        });
        expect(svc.reportFeedback).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(409, "ALREADY_REPORTED", "คุณรายงานความเห็นนี้ไปแล้ว");
        svc.reportFeedback.mockRejectedValue(err);

        await expect(reportFeedback(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("removeFeedback", () => {
    it("parses the id and forwards it, userId, and the trimmed reason when given", async () => {
        svc.removeFeedback.mockResolvedValue(undefined as any);

        const req = makeReq({
            params: { id: "9" } as any,
            user: { user_id: 7 } as any,
            body: { reason: "  ผิดกฎ  " },
        });
        await removeFeedback(req, makeRes());

        expect(svc.removeFeedback).toHaveBeenCalledWith(9, 7, "ผิดกฎ");
    });

    it("forwards undefined for reason when the body omits it (reason is optional here)", async () => {
        svc.removeFeedback.mockResolvedValue(undefined as any);

        await removeFeedback(makeReq({ body: {} }), makeRes());

        expect(svc.removeFeedback).toHaveBeenCalledWith(42, 7, undefined);
    });

    it("forwards undefined for reason when req.body itself is undefined (falls back to {})", async () => {
        svc.removeFeedback.mockResolvedValue(undefined as any);

        await removeFeedback(makeReq({ body: undefined }), makeRes());

        expect(svc.removeFeedback).toHaveBeenCalledWith(42, 7, undefined);
    });

    it("characterization: a whitespace-only reason trims to '' and is forwarded as '', not treated as absent", async () => {
        // removeFeedbackSchema has no min-length check (reason is optional), so
        // an empty string after trim() passes validation as-is.
        svc.removeFeedback.mockResolvedValue(undefined as any);

        await removeFeedback(makeReq({ body: { reason: "   " } }), makeRes());

        expect(svc.removeFeedback).toHaveBeenCalledWith(42, 7, "");
    });

    it("responds 204 with no body", async () => {
        svc.removeFeedback.mockResolvedValue(undefined as any);

        const res = makeRes();
        await removeFeedback(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
        expect(res.json).not.toHaveBeenCalled();
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, checked before params/body", async () => {
        const req = makeReq({ user: undefined, body: {} });

        await expect(removeFeedback(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.removeFeedback).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(removeFeedback(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
        });
        expect(svc.removeFeedback).not.toHaveBeenCalled();
    });

    it("rejects a reason over 500 characters", async () => {
        const req = makeReq({ body: { reason: "a".repeat(501) } });

        await expect(removeFeedback(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { reason: "เหตุผลยาวได้ไม่เกิน 500 ตัวอักษร" } },
        });
        expect(svc.removeFeedback).not.toHaveBeenCalled();
    });

    it("accepts a reason at exactly the 500-character limit", async () => {
        svc.removeFeedback.mockResolvedValue(undefined as any);
        const reason = "a".repeat(500);

        await removeFeedback(makeReq({ body: { reason } }), makeRes());

        expect(svc.removeFeedback).toHaveBeenCalledWith(42, 7, reason);
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(404, "FEEDBACK_NOT_FOUND", "ไม่พบความเห็น");
        svc.removeFeedback.mockRejectedValue(err);

        const res = makeRes();
        await expect(removeFeedback(makeReq(), res)).rejects.toBe(err);
        expect(res.status).not.toHaveBeenCalled();
    });
});
