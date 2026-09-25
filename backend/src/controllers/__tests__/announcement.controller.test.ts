import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifiers must match the ones in announcement.controller.ts exactly,
// so this file is expected to sit in a __tests__ subfolder next to the controller.
//
// Neither parseId nor parsePagination is mocked — both are pure, side-effect-free
// utilities (see pagination.test.ts and amendment.controller.test.ts for their
// dedicated unit tests), so exercising the real implementations here is more
// honest than stubbing them.
vi.mock("../../services/announcement.service.js", () => ({
    createAnnouncement: vi.fn(),
    listAnnouncements: vi.fn(),
    updateAnnouncement: vi.fn(),
    deleteAnnouncement: vi.fn(),
}));

import * as AnnouncementService from "../../services/announcement.service.js";
import { AppError } from "../../utils/AppError.js";
import {
    createAnnouncement,
    listAnnouncements,
    updateAnnouncement,
    deleteAnnouncement,
} from "../announcement.controller.js";

const createAnnouncementSvc = vi.mocked(AnnouncementService.createAnnouncement);
const listAnnouncementsSvc = vi.mocked(AnnouncementService.listAnnouncements);
const updateAnnouncementSvc = vi.mocked(AnnouncementService.updateAnnouncement);
const deleteAnnouncementSvc = vi.mocked(AnnouncementService.deleteAnnouncement);

function makeRes() {
    const res = {
        status: vi.fn(),
        json: vi.fn(),
        send: vi.fn(),
    };
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

describe("createAnnouncement", () => {
    it("parses the tournament id, pulls title/body/user_id, and calls the service", async () => {
        createAnnouncementSvc.mockResolvedValue({ id: 1 } as any);

        const req = makeReq({
            params: { id: "5" } as any,
            user: { user_id: 7 } as any,
            body: { title: "ปิดสนาม", body: "งดแข่งวันนี้" },
        });

        await createAnnouncement(req, makeRes());

        expect(createAnnouncementSvc).toHaveBeenCalledWith(
            5,
            "ปิดสนาม",
            "งดแข่งวันนี้",
            7,
        );
    });

    it("responds 201 with the service result", async () => {
        const payload = { id: 1, title: "ปิดสนาม" };
        createAnnouncementSvc.mockResolvedValue(payload as any);

        const res = makeRes();
        await createAnnouncement(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a non-numeric tournament id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(createAnnouncement(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสทัวร์นาเมนต์ต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(createAnnouncementSvc).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const serviceError = new AppError(403, "FORBIDDEN", "ไม่มีสิทธิ์สร้างประกาศ");
        createAnnouncementSvc.mockRejectedValue(serviceError);

        const res = makeRes();
        await expect(createAnnouncement(makeReq(), res)).rejects.toBe(serviceError);
        // Note: the controller is `return res.status(201).json(await createAnnouncement(...))`.
        // res.status(201) is evaluated (and fires) before the awaited argument to
        // .json(...) settles, so only res.json never gets called on rejection.
        expect(res.json).not.toHaveBeenCalled();
    });
});

describe("listAnnouncements", () => {
    it("parses the tournament id and forwards computed pagination to the service", async () => {
        listAnnouncementsSvc.mockResolvedValue([] as any);

        const req = makeReq({
            params: { id: "5" } as any,
            query: { page: "2", pageSize: "10" },
        });

        await listAnnouncements(req, makeRes());

        // page 2, size 10 -> offset (page - 1) * pageSize = 10 — real parsePagination logic.
        expect(listAnnouncementsSvc).toHaveBeenCalledWith(5, 10, 2, 10);
    });

    it("falls back to page 1 / size 20 when no query params are given", async () => {
        listAnnouncementsSvc.mockResolvedValue([] as any);

        const req = makeReq({ params: { id: "5" } as any, query: {} });
        await listAnnouncements(req, makeRes());

        expect(listAnnouncementsSvc).toHaveBeenCalledWith(5, 0, 1, 20);
    });

    it("responds 200 with the service result", async () => {
        const payload = [{ id: 1 }, { id: 2 }];
        listAnnouncementsSvc.mockResolvedValue(payload as any);

        const res = makeRes();
        await listAnnouncements(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad tournament id without calling the service", async () => {
        const req = makeReq({ params: { id: "-1" } as any });

        await expect(listAnnouncements(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
        });
        expect(listAnnouncementsSvc).not.toHaveBeenCalled();
    });
});

describe("updateAnnouncement", () => {
    it("parses the announcement id and forwards a { title, body } patch plus user_id", async () => {
        updateAnnouncementSvc.mockResolvedValue({ ok: true } as any);

        const req = makeReq({
            params: { id: "9" } as any,
            user: { user_id: 7 } as any,
            body: { title: "แก้ไขแล้ว", body: "รายละเอียดใหม่" },
        });

        await updateAnnouncement(req, makeRes());

        expect(updateAnnouncementSvc).toHaveBeenCalledWith(
            9,
            { title: "แก้ไขแล้ว", body: "รายละเอียดใหม่" },
            7,
        );
    });

    it("responds 200 with the service result", async () => {
        const payload = { id: 9, title: "แก้ไขแล้ว" };
        updateAnnouncementSvc.mockResolvedValue(payload as any);

        const res = makeRes();
        await updateAnnouncement(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with VALIDATION_FAILED for a bad announcement id", async () => {
        const req = makeReq({ params: { id: "" } as any });

        await expect(updateAnnouncement(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสประกาศต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(updateAnnouncementSvc).not.toHaveBeenCalled();
    });

    it("still forwards undefined title/body untouched when the body omits them", async () => {
        updateAnnouncementSvc.mockResolvedValue({} as any);

        const req = makeReq({ body: {} });
        await updateAnnouncement(req, makeRes());

        expect(updateAnnouncementSvc).toHaveBeenCalledWith(
            42,
            { title: undefined, body: undefined },
            7,
        );
    });
});

describe("deleteAnnouncement", () => {
    it("parses the id and calls the service with it and user_id", async () => {
        deleteAnnouncementSvc.mockResolvedValue(undefined as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        await deleteAnnouncement(req, makeRes());

        expect(deleteAnnouncementSvc).toHaveBeenCalledWith(9, 7);
    });

    it("responds 204 with no body", async () => {
        deleteAnnouncementSvc.mockResolvedValue(undefined as any);

        const res = makeRes();
        await deleteAnnouncement(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
        expect(res.json).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad id and never calls the service", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(deleteAnnouncement(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
        });
        expect(deleteAnnouncementSvc).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const serviceError = new AppError(404, "NOT_FOUND", "ไม่พบประกาศ");
        deleteAnnouncementSvc.mockRejectedValue(serviceError);

        const res = makeRes();
        await expect(deleteAnnouncement(makeReq(), res)).rejects.toBe(serviceError);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe("characterization - unguarded req.user!", () => {
    // Every handler here uses `req.user!.user_id` (a non-null assertion) rather than
    // the guarded `userId(req)` helper seen in amendment.controller.ts. If req.user is
    // actually absent at runtime, this throws a raw TypeError instead of a 401 AppError.
    // These tests document that as current behaviour, not as something to preserve.
    it("createAnnouncement throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(createAnnouncement(req, makeRes())).rejects.toBeInstanceOf(TypeError);
        expect(createAnnouncementSvc).not.toHaveBeenCalled();
    });

    it("updateAnnouncement throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(updateAnnouncement(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });

    it("deleteAnnouncement throws a TypeError when req.user is absent", async () => {
        const req = makeReq({ user: undefined });

        await expect(deleteAnnouncement(req, makeRes())).rejects.toBeInstanceOf(TypeError);
    });

    // listAnnouncements never reads req.user, so it's unaffected — included for contrast.
    it("listAnnouncements does not require req.user at all", async () => {
        listAnnouncementsSvc.mockResolvedValue([] as any);
        const req = makeReq({ user: undefined });

        const res = makeRes();
        await listAnnouncements(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });
});
