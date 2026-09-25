import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

// Mock specifier must match the one in upload.controller.ts exactly, so this
// file is expected to sit in a __tests__ subfolder next to the controller.
vi.mock("../../services/upload.service.js", () => ({
    createPresignedUpload: vi.fn(),
}));

import * as UploadService from "../../services/upload.service.js";
import { AppError } from "../../utils/AppError.js";
import { presignUpload } from "../upload.controller.js";

const createPresignedUpload = vi.mocked(UploadService.createPresignedUpload);

function makeRes() {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return res as unknown as Response & typeof res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        body: {},
        user: { user_id: 7 },
        ...overrides,
    } as unknown as Request;
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe("presignUpload", () => {
    it("forwards the raw body and the caller's user_id", async () => {
        createPresignedUpload.mockResolvedValue({ uploadUrl: "https://s3.example.com/..." } as any);

        const body = { fileName: "photo.jpg", contentType: "image/jpeg" };
        const req = makeReq({ user: { user_id: 7 } as any, body });
        await presignUpload(req, makeRes());

        expect(createPresignedUpload).toHaveBeenCalledWith(body, 7);
    });

    it("responds 200 with the service result", async () => {
        const payload = { uploadUrl: "https://s3.example.com/...", key: "uploads/abc.jpg" };
        createPresignedUpload.mockResolvedValue(payload as any);

        const res = makeRes();
        await presignUpload(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(payload);
    });

    it("forwards an empty body as-is when none is given", async () => {
        createPresignedUpload.mockResolvedValue({} as any);

        await presignUpload(makeReq({ body: {} }), makeRes());

        expect(createPresignedUpload).toHaveBeenCalledWith({}, 7);
    });

    it("rejects with 404 USER_NOT_FOUND when req.user is absent, and never calls the service", async () => {
        const req = makeReq({ user: undefined });

        await expect(presignUpload(req, makeRes())).rejects.toMatchObject({
            status: 404,
            code: "USER_NOT_FOUND",
        });
        expect(createPresignedUpload).not.toHaveBeenCalled();
    });

    it("propagates a service rejection", async () => {
        const err = new AppError(400, "VALIDATION_FAILED", "ประเภทไฟล์ไม่รองรับ");
        createPresignedUpload.mockRejectedValue(err);

        const res = makeRes();
        await expect(presignUpload(makeReq(), res)).rejects.toBe(err);
        expect(res.status).not.toHaveBeenCalled();
    });
});
