import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// env.ts imports "dotenv/config" for its side effect (reading a real .env file).
// Stub it out so tests never depend on what's on disk.
vi.mock("dotenv/config", () => ({}));

/** A complete, valid set of variables. Individual tests override or delete keys. */
const VALID_ENV: Record<string, string> = {
    DB_HOST: "localhost",
    DB_USER: "app_user",
    DB_PASSWORD: "s3cr3t",
    DB_PORT: "5432",
    DB_NAME: "app_db",

    JWT_SECRET: "jwt-secret-value",
    JWT_EXPIRES_IN: "1h",

    PORT: "3000",

    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "minioadmin",
    S3_SECRET_ACCESS_KEY: "minioadmin",
    S3_BUCKET: "uploads",
};

const REQUIRED_VARS = Object.keys(VALID_ENV);

let originalEnv: NodeJS.ProcessEnv;

/**
 * Re-imports env.ts with a fresh process.env.
 * Pass `undefined` as a value to delete that variable.
 */
async function loadEnv(overrides: Record<string, string | undefined> = {}) {
    const next: Record<string, string> = { ...VALID_ENV };

    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) {
            delete next[key];
        } else {
            next[key] = value;
        }
    }

    process.env = next as NodeJS.ProcessEnv;
    vi.resetModules();

    // env.ts lives at backend/src/config/env.ts; this test is in backend/src/config/__tests__/.
    const mod = await import("../env");
    return mod.env;
}

beforeEach(() => {
    originalEnv = process.env;
});

afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
});

describe("env - happy path", () => {
    it("exposes every value with the expected type", async () => {
        const env = await loadEnv();

        expect(env).toEqual({
            HOST: "localhost",
            USER: "app_user",
            PASSWORD: "s3cr3t",
            DB_PORT: 5432,
            DB_NAME: "app_db",

            JWT_SECRET: "jwt-secret-value",
            JWT_EXPIRES_IN: "1h",
            CHECKIN_QR_SECRET: "jwt-secret-value",

            PORT: 3000,

            S3_ENDPOINT: "http://localhost:9000",
            S3_REGION: "us-east-1",
            S3_ACCESS_KEY_ID: "minioadmin",
            S3_SECRET_ACCESS_KEY: "minioadmin",
            S3_BUCKET: "uploads",
            S3_FORCE_PATH_STYLE: true,
        });
    });

    it("maps DB_HOST/DB_USER/DB_PASSWORD onto HOST/USER/PASSWORD", async () => {
        const env = await loadEnv({
            DB_HOST: "db.internal",
            DB_USER: "reader",
            DB_PASSWORD: "pw",
        });

        expect(env.HOST).toBe("db.internal");
        expect(env.USER).toBe("reader");
        expect(env.PASSWORD).toBe("pw");
    });

    it("coerces DB_PORT and PORT to numbers", async () => {
        const env = await loadEnv({ DB_PORT: "3306", PORT: "8080" });

        expect(env.DB_PORT).toBe(3306);
        expect(env.PORT).toBe(8080);
        expect(typeof env.DB_PORT).toBe("number");
        expect(typeof env.PORT).toBe("number");
    });
});

describe("env - required variables", () => {
    it.each(REQUIRED_VARS)("throws when %s is missing", async (name) => {
        await expect(loadEnv({ [name]: undefined })).rejects.toThrow(
            `Missing require environment variable ${name}`,
        );
    });

    it.each(REQUIRED_VARS)("throws when %s is an empty string", async (name) => {
        // requireEnv uses a falsy check, so "" is treated the same as unset.
        await expect(loadEnv({ [name]: "" })).rejects.toThrow(
            `Missing require environment variable ${name}`,
        );
    });

    it("names the first missing variable in the error", async () => {
        await expect(
            loadEnv({ DB_HOST: undefined, DB_USER: undefined }),
        ).rejects.toThrow(/DB_HOST/);
    });

    it("throws an Error instance", async () => {
        await expect(loadEnv({ DB_NAME: undefined })).rejects.toBeInstanceOf(Error);
    });
});

describe("env - CHECKIN_QR_SECRET fallback", () => {
    it("uses CHECKIN_QR_SECRET when it is set", async () => {
        const env = await loadEnv({ CHECKIN_QR_SECRET: "qr-only-secret" });

        expect(env.CHECKIN_QR_SECRET).toBe("qr-only-secret");
        expect(env.CHECKIN_QR_SECRET).not.toBe(env.JWT_SECRET);
    });

    it("falls back to JWT_SECRET when unset", async () => {
        const env = await loadEnv({ JWT_SECRET: "login-secret" });

        expect(env.CHECKIN_QR_SECRET).toBe("login-secret");
    });

    it("falls back to JWT_SECRET when set to an empty string", async () => {
        const env = await loadEnv({
            CHECKIN_QR_SECRET: "",
            JWT_SECRET: "login-secret",
        });

        expect(env.CHECKIN_QR_SECRET).toBe("login-secret");
    });

    it("still throws when both CHECKIN_QR_SECRET and JWT_SECRET are missing", async () => {
        await expect(
            loadEnv({ CHECKIN_QR_SECRET: undefined, JWT_SECRET: undefined }),
        ).rejects.toThrow("Missing require environment variable JWT_SECRET");
    });
});

describe("env - S3_FORCE_PATH_STYLE", () => {
    it("defaults to true when unset (MinIO/dev behaviour)", async () => {
        const env = await loadEnv({ S3_FORCE_PATH_STYLE: undefined });

        expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    });

    it('is false only for the exact string "false"', async () => {
        const env = await loadEnv({ S3_FORCE_PATH_STYLE: "false" });

        expect(env.S3_FORCE_PATH_STYLE).toBe(false);
    });

    it('is true for "true"', async () => {
        const env = await loadEnv({ S3_FORCE_PATH_STYLE: "true" });

        expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    });

    // Characterization tests: the comparison is case-sensitive and string-only,
    // so these all resolve to true. Change the assertions if the parsing is tightened.
    it.each(["FALSE", "False", "0", "no", "", " false "])(
        'treats %j as true',
        async (value) => {
            const env = await loadEnv({ S3_FORCE_PATH_STYLE: value });

            expect(env.S3_FORCE_PATH_STYLE).toBe(true);
        },
    );
});

describe("env - numeric parsing (current behaviour)", () => {
    // These document a gap: Number() is never validated, so a bad port becomes NaN
    // instead of failing fast at startup.
    it("yields NaN for a non-numeric DB_PORT", async () => {
        const env = await loadEnv({ DB_PORT: "not-a-port" });

        expect(Number.isNaN(env.DB_PORT)).toBe(true);
    });

    it("yields NaN for a non-numeric PORT", async () => {
        const env = await loadEnv({ PORT: "abc" });

        expect(Number.isNaN(env.PORT)).toBe(true);
    });

    it("accepts a float DB_PORT without complaint", async () => {
        const env = await loadEnv({ DB_PORT: "5432.9" });

        expect(env.DB_PORT).toBe(5432.9);
    });
});
