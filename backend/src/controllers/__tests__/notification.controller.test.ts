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
    getMyNotificationPrefs: vi.fn(),        // OD-43
    updateMyNotificationPrefs: vi.fn(),     // OD-43
}));

vi.mock("../../services/emailNotification.service.js", () => ({
    getEmailPreferences: vi.fn(),
    updateEmailPreferences: vi.fn(),
}));

import * as NotificationService from "../../services/notification.service.js";
import * as EmailService from "../../services/emailNotification.service.js";
import { AppError } from "../../utils/AppError.js";
import {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getMyNotificationPrefs,
    updateMyNotificationPrefs,
    getMyEmailNotificationPrefs,
    updateMyEmailNotificationPrefs,
} from "../notification.controller.js";
import type { Overrides } from '../../__tests__/helpers/overrides.js';

const svc = {
    listMyNotifications: vi.mocked(NotificationService.listMyNotifications),
    markMyNotificationRead: vi.mocked(NotificationService.markMyNotificationRead),
    markAllMyNotificationsRead: vi.mocked(NotificationService.markAllMyNotificationsRead),
    getMyNotificationPrefs: vi.mocked(NotificationService.getMyNotificationPrefs),
    updateMyNotificationPrefs: vi.mocked(NotificationService.updateMyNotificationPrefs),
};

const emailSvc = {
    getEmailPreferences: vi.mocked(EmailService.getEmailPreferences),
    updateEmailPreferences: vi.mocked(EmailService.updateEmailPreferences),
};

function makeRes() {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return res as unknown as Response & typeof res;
}

function makeReq(overrides: Overrides<Request> = {}): Request {
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

        expect(svc.listMyNotifications).toHaveBeenCalledWith(7, false, 1, 20, 0, false);
    });

    it("forwards computed pagination for explicit page/pageSize", async () => {
        svc.listMyNotifications.mockResolvedValue([] as any);

        const req = makeReq({ query: { page: "2", pageSize: "10" } });
        await getMyNotifications(req, makeRes());

        // page 2, size 10 -> offset (page - 1) * pageSize = 10 — real parsePagination logic.
        expect(svc.listMyNotifications).toHaveBeenCalledWith(7, false, 2, 10, 10, false);
    });

    it("sets unreadOnly true only for the exact string 'true'", async () => {
        svc.listMyNotifications.mockResolvedValue([] as any);

        const req = makeReq({ query: { unread: "true" } });
        await getMyNotifications(req, makeRes());

        expect(svc.listMyNotifications).toHaveBeenCalledWith(7, true, 1, 20, 0, false);
    });

    it.each(["false", "1", "yes", ""])(
        "treats unread=%j as unreadOnly false",
        async (unread) => {
            svc.listMyNotifications.mockResolvedValue([] as any);

            const req = makeReq({ query: { unread } });
            await getMyNotifications(req, makeRes());

            expect(svc.listMyNotifications).toHaveBeenCalledWith(7, false, 1, 20, 0, false);
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

// OD-43 — hidden categories are shown again only with includeMuted=true (history view)
describe("getMyNotifications — includeMuted", () => {
    it.each([
        ["true", true],
        ["false", false],
        ["1", false],
        ["TRUE", false],
    ])("includeMuted=%s → %s", async (raw, expected) => {
        svc.listMyNotifications.mockResolvedValue([] as any);

        await getMyNotifications(makeReq({ query: { includeMuted: raw } as any }), makeRes());

        expect(svc.listMyNotifications.mock.calls[0]![5]).toBe(expected);
    });

    it("unread and includeMuted are independent of each other", async () => {
        svc.listMyNotifications.mockResolvedValue([] as any);

        await getMyNotifications(makeReq({ query: { unread: "true", includeMuted: "true" } as any }), makeRes());

        expect(svc.listMyNotifications).toHaveBeenCalledWith(7, true, 1, 20, 0, true);
    });
});

describe("in-app notification prefs (OD-43)", () => {
    it("getMyNotificationPrefs reads the caller's prefs, responds 200", async () => {
        const prefs = { match: true, team: false };
        svc.getMyNotificationPrefs.mockResolvedValue(prefs as any);

        const res = makeRes();
        await getMyNotificationPrefs(makeReq(), res);

        expect(svc.getMyNotificationPrefs).toHaveBeenCalledWith(7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(prefs);
    });

    it("updateMyNotificationPrefs forwards the body as the patch, responds 200", async () => {
        const body = { team: false };
        const updated = { match: true, team: false };
        svc.updateMyNotificationPrefs.mockResolvedValue(updated as any);

        const res = makeRes();
        await updateMyNotificationPrefs(makeReq({ body }), res);

        expect(svc.updateMyNotificationPrefs).toHaveBeenCalledWith(7, body);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(updated);
    });

    it("updateMyNotificationPrefs propagates a service error", async () => {
        const err = new AppError(400, "VALIDATION_FAILED", "x");
        svc.updateMyNotificationPrefs.mockRejectedValue(err);
        await expect(updateMyNotificationPrefs(makeReq({ body: {} }), makeRes())).rejects.toBe(err);
    });
});

describe("email notification prefs", () => {
    it("getMyEmailNotificationPrefs reads the caller's email prefs, responds 200", async () => {
        const prefs = { enabled: true, digest: "daily" };
        emailSvc.getEmailPreferences.mockResolvedValue(prefs as any);

        const res = makeRes();
        await getMyEmailNotificationPrefs(makeReq(), res);

        expect(emailSvc.getEmailPreferences).toHaveBeenCalledWith(7);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(prefs);
    });

    it("updateMyEmailNotificationPrefs forwards the body as the patch, responds 200", async () => {
        const body = { enabled: false };
        emailSvc.updateEmailPreferences.mockResolvedValue({ enabled: false } as any);

        const res = makeRes();
        await updateMyEmailNotificationPrefs(makeReq({ body }), res);

        expect(emailSvc.updateEmailPreferences).toHaveBeenCalledWith(7, body);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ enabled: false });
    });

    it("email prefs do not touch the in-app prefs service", async () => {
        emailSvc.getEmailPreferences.mockResolvedValue({} as any);
        await getMyEmailNotificationPrefs(makeReq(), makeRes());
        expect(svc.getMyNotificationPrefs).not.toHaveBeenCalled();
    });
});

describe("prefs handlers — missing req.user", () => {
    it.each([
        ["getMyNotificationPrefs", getMyNotificationPrefs],
        ["updateMyNotificationPrefs", updateMyNotificationPrefs],
        ["getMyEmailNotificationPrefs", getMyEmailNotificationPrefs],
        ["updateMyEmailNotificationPrefs", updateMyEmailNotificationPrefs],
    ] as const)("%s rejects with 404 USER_NOT_FOUND and calls no service", async (_n, handler) => {
        await expect(handler(makeReq({ user: undefined, body: {} }), makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(svc.getMyNotificationPrefs).not.toHaveBeenCalled();
        expect(svc.updateMyNotificationPrefs).not.toHaveBeenCalled();
        expect(emailSvc.getEmailPreferences).not.toHaveBeenCalled();
        expect(emailSvc.updateEmailPreferences).not.toHaveBeenCalled();
    });
});
