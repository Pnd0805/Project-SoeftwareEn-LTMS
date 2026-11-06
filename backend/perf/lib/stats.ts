/**
 * เก็บเวลาตอบสนอง "ทุกคำขอ" แล้วคำนวณ percentile จากค่าจริง (ไม่ใช้ histogram ประมาณ)
 *
 * นิยามความผิดพลาด (PF-06): HTTP 5xx · ต่อไม่ติด · timeout  ⇒ นับเป็น error
 * 4xx นับแยก — ในชุดคำขอที่ถูกต้อง ไม่ควรมีเลย ถ้ามีแปลว่าสคริปต์ยิงผิด หรือ API ตอบผิดสัญญา
 */
export type Summary = {
    name: string; count: number; rps: number; errors: number; client4xx: number; errorRate: number;
    p50: number; p95: number; p99: number; max: number; mean: number;
};

export function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return NaN;
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)]!;
}

export class Recorder {
    private by = new Map<string, { ms: number[]; errors: number; c4: number }>();
    readonly samples4xx: string[] = [];
    readonly samples5xx: string[] = [];
    startedAt = Date.now();
    endedAt = 0;

    record(name: string, ms: number, status: number, detail = ''): void {
        const b = this.by.get(name) ?? { ms: [], errors: 0, c4: 0 };
        b.ms.push(ms);
        if (status === 0 || status >= 500) {
            b.errors++;
            if (this.samples5xx.length < 20) this.samples5xx.push(`${name} → ${status} ${detail}`);
        } else if (status >= 400) {
            b.c4++;
            if (this.samples4xx.length < 20) this.samples4xx.push(`${name} → ${status} ${detail}`);
        }
        this.by.set(name, b);
    }

    stop(): this { this.endedAt = Date.now(); return this; }

    private summarize(name: string, ms: number[], errors: number, c4: number): Summary {
        const sorted = [...ms].sort((a, b) => a - b);
        const secs = ((this.endedAt || Date.now()) - this.startedAt) / 1000;
        return {
            name, count: ms.length, rps: ms.length / secs, errors, client4xx: c4, errorRate: ms.length ? errors / ms.length : 0,
            p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99),
            max: sorted[sorted.length - 1] ?? NaN, mean: ms.reduce((s, x) => s + x, 0) / (ms.length || 1),
        };
    }

    perEndpoint(): Summary[] {
        return [...this.by.entries()].map(([n, b]) => this.summarize(n, b.ms, b.errors, b.c4)).sort((a, b) => b.p95 - a.p95);
    }

    overall(filter: (name: string) => boolean = () => true): Summary {
        const all: number[] = []; let e = 0, c4 = 0;
        for (const [n, b] of this.by) if (filter(n)) { all.push(...b.ms); e += b.errors; c4 += b.c4; }
        return this.summarize('ALL', all, e, c4);
    }
}

export const fmt = (ms: number) => Number.isNaN(ms) ? '–' : ms === Infinity ? 'ล้มเหลว' : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(0)} ms`;
export const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
