import http from 'node:http';
import { performance } from 'node:perf_hooks';

/**
 * HTTP client เบา ๆ สำหรับยิงโหลด — ใช้ node:http ตรง (keep-alive) ไม่ผ่าน fetch
 * เพื่อให้ตัวยิงกิน CPU น้อยที่สุด (เครื่องเดียวกับเซิร์ฟเวอร์และ MySQL)
 */
const agent = new http.Agent({ keepAlive: true, maxSockets: Infinity });
let base = { host: '127.0.0.1', port: 3999 };
export const setTarget = (port: number) => { base = { host: '127.0.0.1', port }; };

export type Res = { status: number; ms: number; body: any; error?: string };

export function request(method: string, path: string, o: { token?: string | undefined; body?: unknown; timeoutMs?: number; parse?: boolean } = {}): Promise<Res> {
    const payload = o.body === undefined ? undefined : Buffer.from(JSON.stringify(o.body));
    const headers: Record<string, string | number> = {};
    if (payload) { headers['content-type'] = 'application/json'; headers['content-length'] = payload.length; }
    if (o.token) headers['authorization'] = `Bearer ${o.token}`;
    const t0 = performance.now();
    return new Promise(resolve => {
        const req = http.request({ ...base, agent, method, path: `/api/v1${path}`, headers, timeout: o.timeoutMs ?? 30_000 }, res => {
            const chunks: Buffer[] = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const ms = performance.now() - t0;
                let body: any = undefined;
                if (o.parse !== false && chunks.length) {
                    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body = undefined; }
                }
                resolve({ status: res.statusCode ?? 0, ms, body });
            });
            res.on('error', e => resolve({ status: 0, ms: performance.now() - t0, body: undefined, error: e.message }));
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', e => resolve({ status: 0, ms: performance.now() - t0, body: undefined, error: e.message }));
        if (payload) req.write(payload);
        req.end();
    });
}
