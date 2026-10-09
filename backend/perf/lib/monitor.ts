import { existsSync, readFileSync } from 'node:fs';

/**
 * อ่าน CPU / หน่วยความจำของโปรเซส (เซิร์ฟเวอร์ Node · mysqld) จาก /proc ทุก 1 วินาที — Linux เท่านั้น
 * บนเครื่องที่ไม่มี /proc (macOS/Windows) จะคืนค่าว่างเงียบ ๆ ไม่ทำให้การวัดล้ม
 */
const TICKS = 100;   // CLK_TCK ของ Linux แทบทุกเครื่อง

/**
 * เครื่องนี้อ่าน /proc ได้ไหม — รายงานใช้ค่านี้บอกผู้อ่านว่า "วัดไม่ได้" แทนที่จะพิมพ์ NaN
 * 🔴 8 ต.ค. 2569 — รอบที่รันบน Windows ได้รายงานที่มีคำว่า `NaN%` กระจายทั้งไฟล์
 *   ซึ่งอ่านเหมือนสคริปต์พัง ทั้งที่ monitor ออกแบบมาให้คืนค่าว่างเงียบ ๆ ตามเจตนาเดิม
 */
export const PROC_STATS_AVAILABLE = existsSync('/proc/self/stat');

function cpuTicks(pid: number): number | null {
    try {
        const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
        const f = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
        return Number(f[11]) + Number(f[12]);   // utime + stime
    } catch { return null; }
}
function rssMb(pid: number): number | null {
    try {
        const m = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'));
        return m ? Number(m[1]) / 1024 : null;
    } catch { return null; }
}

export type ProcStats = { name: string; cpuAvg: number; cpuMax: number; rssMax: number };

export function monitor(procs: { name: string; pid: number }[]) {
    const state = procs.map(p => ({ ...p, last: cpuTicks(p.pid), cpu: [] as number[], rss: [] as number[] }));
    const timer = setInterval(() => {
        for (const s of state) {
            const now = cpuTicks(s.pid);
            if (now !== null && s.last !== null) s.cpu.push(((now - s.last) / TICKS) * 100);
            s.last = now;
            const r = rssMb(s.pid);
            if (r !== null) s.rss.push(r);
        }
    }, 1000);
    return {
        stop(): ProcStats[] {
            clearInterval(timer);
            return state.map(s => ({
                name: s.name,
                cpuAvg: s.cpu.length ? s.cpu.reduce((a, b) => a + b, 0) / s.cpu.length : NaN,
                cpuMax: s.cpu.length ? Math.max(...s.cpu) : NaN,
                rssMax: s.rss.length ? Math.max(...s.rss) : NaN,
            }));
        },
    };
}
