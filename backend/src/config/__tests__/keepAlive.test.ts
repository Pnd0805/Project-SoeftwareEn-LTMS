import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('dotenv/config', () => ({}));

/**
 * 🆕 C4 (8 ต.ค. 2569) — keep-alive ต้องยาวกว่า idle timeout ของ reverse proxy
 *
 * ★ เทสที่สำคัญที่สุดคือข้อ "headersTimeout > keepAliveTimeout" — ถ้าสองค่านี้เท่ากัน
 *   connection ที่ idle อยู่จะถูกตัดด้วย 408 แทนที่จะถูกนำกลับมาใช้ซ้ำ ซึ่งเป็นอาการ
 *   เดียวกับที่เรากำลังแก้ · เป็นกับดักที่คนตั้งค่านี้พลาดกันบ่อย จึงต้องมีเทสตรึงไว้
 */
const VALID_ENV: Record<string, string> = {
    DB_HOST: 'localhost', DB_USER: 'u', DB_PASSWORD: 'p', DB_PORT: '3306', DB_NAME: 'db',
    JWT_SECRET: 's', JWT_EXPIRES_IN: '1h', PORT: '3000',
    S3_ENDPOINT: 'http://localhost:9000', S3_REGION: 'r',
    S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b', S3_BUCKET: 'c',
};

let originalEnv: NodeJS.ProcessEnv;

async function load(overrides: Record<string, string> = {}) {
    process.env = { ...VALID_ENV, ...overrides } as NodeJS.ProcessEnv;
    vi.resetModules();
    return import('../keepAlive.js');
}

/** ค่าตั้งต้นของ Node จริง ๆ — 5 วินาที ซึ่งสั้นกว่า nginx (60) และเป็นต้นเหตุของ 502 ประปราย */
const fakeServer = () => ({ keepAliveTimeout: 5_000, headersTimeout: 60_000 });

beforeEach(() => { originalEnv = process.env; });
afterEach(() => { process.env = originalEnv; vi.resetModules(); });

describe('configureKeepAlive (C4)', () => {
    it('ไม่ตั้ง env → 65 วินาที ซึ่งยาวกว่า idle timeout ตั้งต้นของ nginx (60 วินาที)', async () => {
        const { configureKeepAlive } = await load();
        const server = fakeServer();
        configureKeepAlive(server);
        expect(server.keepAliveTimeout).toBe(65_000);
        expect(server.keepAliveTimeout).toBeGreaterThan(60_000);
    });

    it('🔴 headersTimeout ต้องมากกว่า keepAliveTimeout เสมอ (ไม่ใช่เท่ากัน)', async () => {
        const { configureKeepAlive, HEADERS_TIMEOUT_MARGIN_MS } = await load();
        const server = fakeServer();
        configureKeepAlive(server);
        expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
        expect(server.headersTimeout).toBe(server.keepAliveTimeout + HEADERS_TIMEOUT_MARGIN_MS);
    });

    it('ตั้งผ่าน env ได้ และ headersTimeout ขยับตามเสมอ', async () => {
        const { configureKeepAlive } = await load({ KEEP_ALIVE_TIMEOUT_MS: '120000' });
        const server = fakeServer();
        configureKeepAlive(server);
        expect(server.keepAliveTimeout).toBe(120_000);
        expect(server.headersTimeout).toBeGreaterThan(120_000);
    });

    it('ทับค่าตั้งต้นของ Node (5 วินาที) จริง — ไม่ใช่ปล่อยไว้เฉย ๆ', async () => {
        const { configureKeepAlive } = await load();
        const server = fakeServer();
        configureKeepAlive(server);
        expect(server.keepAliveTimeout).not.toBe(5_000);
    });
});
