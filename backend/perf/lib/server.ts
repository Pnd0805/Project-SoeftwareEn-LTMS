import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { BACKEND_DIR, perfPort } from './env.js';

/**
 * เปิดเซิร์ฟเวอร์ตัวที่ build แล้ว (dist/server.js — แบบเดียวกับ npm start) เป็นโปรเซสแยก
 *
 * ★ ทำไมไม่ใช้ tsx/dev: วัดของที่จะขึ้นจริง ไม่ใช่ของที่ compile ตอนรัน
 * ★ cwd = perf/results — server.ts มี `import 'dotenv/config'` ซึ่งอ่าน .env ของ cwd
 *   ถ้ารันจาก backend/ ค่าใน .env (ฐาน dev) ที่ .env.perf ไม่ได้ตั้งจะรั่วเข้ามา
 * ★ stdout/stderr ทั้งหมดลง server.log — PF-06 ตรวจ log นี้หลังยิงโหลด
 */
export const RESULTS_DIR = path.join(BACKEND_DIR, 'perf', 'results');

export async function startServer(): Promise<{ proc: ChildProcess; logPath: string; stop: () => Promise<void> }> {
    const entry = path.join(BACKEND_DIR, 'dist', 'server.js');
    if (!existsSync(entry)) throw new Error('[perf] ไม่พบ dist/server.js — รัน npm run build ก่อน (npm run perf ทำให้อยู่แล้ว)');
    mkdirSync(RESULTS_DIR, { recursive: true });
    const logPath = path.join(RESULTS_DIR, 'server.log');
    const log = createWriteStream(logPath);

    const proc = spawn(process.execPath, [entry], { cwd: RESULTS_DIR, env: { ...process.env, NODE_ENV: 'production' } });
    proc.stdout.pipe(log, { end: false });
    proc.stderr.pipe(log, { end: false });

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('[perf] เซิร์ฟเวอร์ไม่ขึ้นใน 20 วินาที — ดู perf/results/server.log')), 20_000);
        proc.stdout.on('data', (d: Buffer) => { if (d.toString().includes('Server is running')) { clearTimeout(timer); resolve(); } });
        proc.on('exit', code => { clearTimeout(timer); reject(new Error(`[perf] เซิร์ฟเวอร์ปิดตัว (code ${code}) — ดู ${logPath}`)); });
    });
    console.log(`[perf] เซิร์ฟเวอร์ขึ้นแล้ว pid=${proc.pid} port=${perfPort()}`);

    return {
        proc, logPath,
        stop: () => new Promise<void>(resolve => {
            proc.removeAllListeners('exit');
            proc.once('exit', () => { log.end(); resolve(); });
            proc.kill('SIGTERM');
        }),
    };
}
