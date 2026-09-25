import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in notification.controller.ts exactly.
// paths are relative to __tests__/ (services and utils are two levels up).
// parseId and parsePagination are NOT mocked: they're pure and side-effect-free,
// so exercising the real implementations is more honest.
vi.mock("../../services/notification.service.js", () => ({
    listMyNotifications: vi.fn(),
    markMyNotificationRead: vi.fn(),
    markAllMyNotificationsRead: vi.fn(),
}));

import * as NotificationService from "../../services/notification.service.js";
import { AppError } from "../../utils/AppError.js";
import {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../notification.controller.js";

const svc = {
    listMyNotifications: vi.mocked(NotificationService.listMyNotifications),
    markMyNotificationRead: vi.mocked(NotificationService.markMyNotificationRead),
    markAllMyNotificationsRead: vi.mocked(NotificationService.markAllMyNotificationsRead),
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
        query: {},
        user: { user_id: 7 },
        ...overrides,
    } as unknown as Request;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("getMyNotifications", () => {
    it("falls back to page 1 / size 20 / unreadOnly false when no query params are given", async () => {
        svc.listMyNotifications.mockResolvedValue([] as any);

        const req = makeReq({ user: { user_id: 7 } as any, query: {} });
        await getMyNotifications(req, makeRes());

        expect(svc.listMyNotifications).toHaveBeenCalledWith(7, false, 1, 20, 0);
    });

    it("forwards computed pagination for explicit page/pageSize", async () => {
        svc.listMyNotifications.mockResolvedValue([] as any);

        const req = makeReq({ query: { page: "2", pageSize: "10" } });
        await getMyNotifications(req, makeRes());

        // page 2, size 10 -> offset (page - 1) * pageSize = 10 — real parsePagination logic.
        expect(svc.listMyNotifications).toHaveBeenCalledWith(7, false, 2, 10, 10);
    });

    it("sets unreadOnly true only for the exact string 'true'", async () => {
        svc.listMyNotifications.mockResolvedValue([] as any);

        const req = makeReq({ query: { unread: "true" } });
        await getMyNotifications(req, makeRes());

        expect(svc.listMyNotifications).toHaveBeenCalledWith(7, true, 1, 20, 0);
    });

    it.each(["false", "1", "yes", ""])(
        "treats unread=%j as unreadOnly false",
        async (unread) => {
            svc.listMyNotifications.mockResolvedValue([] as any);

            const req = makeReq({ query: { unread } });
            await getMyNotifications(req, makeRes());

            expect(svc.listMyNotifications).toHaveBeenCalledWith(7, false, 1, 20, 0);
        },
    );

    it("responds 200 with the service result", async () => {
        const payload = [{ id: 1, read: false }];
        svc.listMyNotifications.mockResolvedValue(payload as any);

        const res = makeRes();
        await getMyNotifications(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, and never calls the service", async () => {
        const req = makeReq({ user: undefined });

        await expect(getMyNotifications(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.listMyNotifications).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        // The handler calls res.status(200).json(await service()) as one chained
        // expression, so res.status(200) runs synchronously before the await is
        // reached — it still fires even though the service call goes on to reject.
        // Only res.json (whose argument is the awaited value) never runs.
        const err = new AppError(500, "INTERNAL_ERROR", "โหลดการแจ้งเตือนไม่สำเร็จ");
        svc.listMyNotifications.mockRejectedValue(err);

        const res = makeRes();
        await expect(getMyNotifications(makeReq(), res)).rejects.toBe(err);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).not.toHaveBeenCalled();
    });
});

describe("markNotificationRead", () => {
    it("parses the id and forwards it with the caller's user_id", async () => {
        svc.markMyNotificationRead.mockResolvedValue({ id: 9, read: true } as any);

        const req = makeReq({ params: { id: "9" } as any, user: { user_id: 7 } as any });
        await markNotificationRead(req, makeRes());

        expect(svc.markMyNotificationRead).toHaveBeenCalledWith(9, 7);
    });

    it("responds 200 with the service result", async () => {
        const payload = { id: 9, read: true };
        svc.markMyNotificationRead.mockResolvedValue(payload as any);

        const res = makeRes();
        await markNotificationRead(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, checked before the id", async () => {
        const req = makeReq({ user: undefined, params: { id: "abc" } as any });

        await expect(markNotificationRead(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.markMyNotificationRead).not.toHaveBeenCalled();
    });

    it("rejects with VALIDATION_FAILED for a bad id", async () => {
        const req = makeReq({ params: { id: "abc" } as any });

        await expect(markNotificationRead(req, makeRes())).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_FAILED",
            extra: { fields: { id: "รหัสการแจ้งเตือนต้องเป็นจำนวนเต็มบวก" } },
        });
        expect(svc.markMyNotificationRead).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(404, "NOTIFICATION_NOT_FOUND", "ไม่พบการแจ้งเตือน");
        svc.markMyNotificationRead.mockRejectedValue(err);

        await expect(markNotificationRead(makeReq(), makeRes())).rejects.toBe(err);
    });
});

describe("markAllNotificationsRead", () => {
    it("forwards the caller's user_id, responds 200 with the service result", async () => {
        const payload = { updated: 5 };
        svc.markAllMyNotificationsRead.mockResolvedValue(payload as any);

        const res = makeRes();
        await markAllNotificationsRead(makeReq({ user: { user_id: 7 } as any }), res);

        expect(svc.markAllMyNotificationsRead).toHaveBeenCalledWith(7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, and never calls the service", async () => {
        const req = makeReq({ user: undefined });

        await expect(markAllNotificationsRead(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.markAllMyNotificationsRead).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        // Same chained-call caveat as getMyNotifications: res.status(200) fires
        // synchronously before the awaited service call is reached, so it's still
        // called even though the promise goes on to reject. Only res.json isn't.
        const err = new AppError(500, "INTERNAL_ERROR", "อัปเดตสถานะไม่สำเร็จ");
        svc.markAllMyNotificationsRead.mockRejectedValue(err);

        const res = makeRes();
        await expect(markAllNotificationsRead(makeReq(), res)).rejects.toBe(err);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).not.toHaveBeenCalled();
    });
});
