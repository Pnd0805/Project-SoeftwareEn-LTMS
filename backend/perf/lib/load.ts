import { setTimeout as sleep } from 'node:timers/promises';
import { Recorder } from './stats.js';

/**
 * ผู้ใช้เสมือน (VU) แบบวงปิด: ยิงคำขอ → รอผล → "คิด" 1–3 วินาที → ยิงคำขอถัดไป
 *
 * ★ ทำไมต้องมีเวลาคิด: SRS พูดถึง "ผู้ใช้พร้อมกัน" ไม่ใช่ "คำขอพร้อมกัน"
 *   คนจริงเปิดหน้า อ่าน แล้วค่อยกดต่อ — ถ้าไม่มีเวลาคิด 500 VU = คำขอค้างพร้อมกัน 500 อันตลอดเวลา
 *   ซึ่งเท่ากับผู้ใช้จริงหลายพันคน · ค่าเฉลี่ย 2 วิ ⇒ 500 VU ≈ 250 คำขอ/วินาที
 *   ≈ 900,000 คำขอ/ชม. — มากกว่าภาระช่วงพีคใน SRS (2,000–5,000 อ่าน/ชม.) ราว 180 เท่า
 * ★ วัดเพดานจริงแยกไว้อีกชุด (thinkMs = [0,0]) ใน scenario "saturation"
 */
export type Action = { name: string; run: () => Promise<{ status: number; ms: number; error?: string; body?: any }> };

export async function runLoad(o: {
    vus: number; durationMs: number; rampMs: number; thinkMs: [number, number];
    pick: (vu: number, iter: number) => Action; recorder?: Recorder; label?: string;
}): Promise<Recorder> {
    const rec = o.recorder ?? new Recorder();
    rec.startedAt = Date.now();
    const end = Date.now() + o.durationMs;
    const think = () => o.thinkMs[0] + Math.random() * (o.thinkMs[1] - o.thinkMs[0]);

    const vu = async (i: number) => {
        await sleep((o.rampMs * i) / o.vus);   // ไล่เพิ่ม VU เป็นเส้นตรงตลอดช่วง ramp
        let iter = 0;
        while (Date.now() < end) {
            const a = o.pick(i, iter++);
            const r = await a.run();
            rec.record(a.name, r.ms, r.status, r.error ?? (r.status >= 400 ? JSON.stringify(r.body?.error?.code ?? '') : ''));
            const t = think();
            if (t > 0) await sleep(t);
        }
    };
    await Promise.all(Array.from({ length: o.vus }, (_, i) => vu(i)));
    return rec.stop();
}

/** โหลดพื้นหลังที่หยุดได้ — ใช้ตอนวัด PF-04 / PF-05 "ระหว่างที่ระบบมีคนใช้อยู่" */
export function backgroundLoad(o: { vus: number; thinkMs: [number, number]; pick: (vu: number, iter: number) => Action }) {
    const rec = new Recorder();
    let stopped = false;
    const done = Promise.all(Array.from({ length: o.vus }, async (_, i) => {
        await sleep((5000 * i) / o.vus);
        let iter = 0;
        while (!stopped) {
            const a = o.pick(i, iter++);
            const r = await a.run();
            rec.record(a.name, r.ms, r.status, r.error ?? '');
            await sleep(o.thinkMs[0] + Math.random() * (o.thinkMs[1] - o.thinkMs[0]));
        }
    }));
    return { rec, stop: async () => { stopped = true; await done; return rec.stop(); } };
}
