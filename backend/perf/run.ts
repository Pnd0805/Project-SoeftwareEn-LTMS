import { execSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { RowDataPacket } from 'mysql2/promise';
import { loadPerfEnv, perfPort } from './lib/env.js';
import { setupPerfDb } from './lib/setupDb.js';
import {
    BACKGROUND_TOURS, CHECKIN_TOUR, HOT_TOUR, PF03_FORMATS, PF03_SIZES, REFEREES, VU_USERS,
    pf03TourId, perfPool, seedBulk, seedPredictions, type SeedInfo,
} from './lib/seed.js';
import { RESULTS_DIR, startServer } from './lib/server.js';
import { request, setTarget, type Res } from './lib/http.js';
import { tokenFor } from './lib/token.js';
import { Recorder, fmt, pct, type Summary } from './lib/stats.js';
import { backgroundLoad, runLoad, type Action } from './lib/load.js';
import { PROC_STATS_AVAILABLE, monitor, type ProcStats } from './lib/monitor.js';

/**
 * npm run perf — Performance & Load Test ตาม SRS 3.2 (PF-01 … PF-06)
 *
 *   1. สร้างฐาน ltms_perf ใหม่ + seed ปริมาณตามตารางปริมาณงานของ SRS
 *   2. เปิดเซิร์ฟเวอร์ตัวที่ build แล้ว (dist/server.js) เป็นโปรเซสแยก
 *   3. เตรียมสถานะผ่าน API จริง: สร้างสายทุกทัวร์ · ส่งผล+ยืนยัน 16 แมตช์ (ตัดสินแต้ม pick'em 64,000 ใบ)
 *   4. วัดทีละข้อ แล้วเขียน perf/results/report.md + results.json
 *
 * PF-02 (หน้าเว็บโหลดบน 4G) เป็นเรื่องของ frontend — ไม่อยู่ในสคริปต์นี้
 *
 * เลือกรันบางข้อ: npm run perf -- pf01 pf05   (ค่าตั้งต้น = ทุกข้อ · seed ใหม่ทุกครั้งเพื่อให้ผลเทียบกันได้)
 */

loadPerfEnv();
setTarget(perfPort());
const only = new Set(process.argv.slice(2).map(s => s.toLowerCase()));
const want = (k: string) => only.size === 0 || only.has(k);
const QUICK = process.env['PERF_QUICK'] === '1';          // รอบลองสคริปต์ — ย่อเวลาทุกช่วงลง ~5 เท่า
const T = (ms: number) => (QUICK ? Math.round(ms / 5) : ms);

type Verdict = { id: string; title: string; target: string; measured: string; pass: boolean | null; notes: string[] };
const verdicts: Verdict[] = [];
const results: Record<string, unknown> = {};
const rand = (n: number) => Math.floor(Math.random() * n);
const randIn = (r: { from: number; to: number }) => r.from + rand(r.to - r.from + 1);

// ───────────────────────────── เตรียมข้อมูล ─────────────────────────────

type HotMatch = { id: number; a: number; b: number; next: number | null };
let info: SeedInfo;
let hot: HotMatch[] = [];            // แมตช์รอบแรกของทัวร์ร้อน (32)
let maxMatchId = 0;
let checkinMatches: number[] = [];
let checkinReferee = 0;

async function prepare(pf03Extra: number[]) {
    const pool = perfPool();
    try {
        // สายของทัวร์ร้อน + ทัวร์พื้นหลังทั้งหมด (ผ่าน API จริง — เก็บเวลาไว้เป็นข้อมูลเสริมของ PF-03)
        for (const id of [HOT_TOUR, ...range(BACKGROUND_TOURS.from, BACKGROUND_TOURS.to)]) {
            const r = await request('POST', `/tournaments/${id}/bracket`, { token: tokenFor(info.organizerOf[id]!), body: { seedingMethod: 'random' } });
            if (r.status !== 201) throw new Error(`[perf] สร้างสายทัวร์ ${id} ไม่ได้: ${r.status} ${JSON.stringify(r.body)}`);
            pf03Extra.push(r.ms);
        }
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT match_id, team_a_id, team_b_id, next_match_id FROM matches WHERE tournament_id = ? AND round_number = 1 ORDER BY match_id`, [HOT_TOUR]);
        hot = rows.map(r => ({ id: r['match_id'], a: r['team_a_id'], b: r['team_b_id'], next: r['next_match_id'] }));

        const n = await seedPredictions(hot);
        console.log(`[perf] pick'em: ${n.toLocaleString()} การทายใน ${hot.length} แมตช์`);

        // แมตช์ 1–16: ส่งผล + ยืนยันผ่าน API (ตัดสินแต้ม 4,000 ใบต่อแมตช์) ⇒ ตารางอันดับ pick'em มีของจริงให้คำนวณ
        // แมตช์ 17–21 เก็บไว้ให้ PF-04 · 22–32 เปิดให้ทายระหว่างยิงโหลด (PF-06)
        for (const m of hot.slice(0, 16)) await submitAndVerify(pool, m);
        console.log('[perf] ส่งผล+ยืนยัน 16 แมตช์แรกของทัวร์ร้อนแล้ว');

        // PF-05: แมตช์เช็คอิน 3 นัด (นิ่ง · ระหว่างโหลด 100 · ระหว่างโหลด 500) ระหว่างสองทีม 15 คน
        const [teamA, teamB] = info.teamsOf[CHECKIN_TOUR]!;
        const [[tr]] = await pool.query<RowDataPacket[]>('SELECT tournament_referee_id AS id FROM tournament_referees WHERE tournament_id = ?', [CHECKIN_TOUR]);
        checkinReferee = REFEREES.from + 20;
        const soon = new Date(Date.now() + 30 * 60_000);
        for (let i = 0; i < 3; i++) {
            const [res] = await pool.query<any>(
                `INSERT INTO matches (tournament_id, team_a_id, team_b_id, mode, match_status, round_number, scheduled_time, scheduled_end_time, venue, checkin_open_at)
                 VALUES (?, ?, ?, 'onsite', 'checkin_open', 1, ?, ?, 'สนามฟุตบอลกลาง', UTC_TIMESTAMP())`,
                [CHECKIN_TOUR, teamA, teamB, soon, new Date(soon.getTime() + 2 * 3600_000)]);
            checkinMatches.push(res.insertId);
            await pool.query(`INSERT INTO match_referees (match_id, tournament_referee_id, assignment_status) VALUES (?, ?, 'accepted')`, [res.insertId, tr!['id']]);
        }
        const [[mx]] = await pool.query<RowDataPacket[]>('SELECT MAX(match_id) AS m, COUNT(*) AS c FROM matches');
        maxMatchId = mx!['m'];
        console.log(`[perf] matches ทั้งระบบ = ${mx!['c']}`);
    } finally {
        await pool.end();
    }
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
let refRotation = 0;

/**
 * แมตช์ → finished (ข้ามขั้นเช็คอิน/เริ่มแข่ง ซึ่งไม่ใช่เป้าของข้อนี้) → กรรมการส่งผล → หัวหน้าทีมชนะยืนยัน
 * คืนเวลาของ "ยืนยัน" (คำขอที่ทำให้สาย/ตารางอันดับเปลี่ยน)
 */
async function submitAndVerify(pool: ReturnType<typeof perfPool>, m: HotMatch, onBeforeVerify?: () => void): Promise<{ submit: Res; verify: Res }> {
    const [[tr]] = await pool.query<RowDataPacket[]>(
        'SELECT tournament_referee_id AS id, user_id AS u FROM tournament_referees WHERE tournament_id = ? ORDER BY tournament_referee_id LIMIT 1 OFFSET ?',
        [HOT_TOUR, refRotation++ % 10]);
    await pool.query(`UPDATE matches SET match_status = 'finished', started_at = UTC_TIMESTAMP() - INTERVAL 1 HOUR, actual_end_time = UTC_TIMESTAMP() WHERE match_id = ?`, [m.id]);
    await pool.query(`INSERT INTO match_referees (match_id, tournament_referee_id, assignment_status) VALUES (?, ?, 'accepted')`, [m.id, tr!['id']]);
    const submit = await request('POST', `/matches/${m.id}/result`, { token: tokenFor(tr!['u']), body: { winnerTeamId: m.a, scoreData: { [m.a]: 78, [m.b]: 70 } } });
    if (submit.status !== 201) throw new Error(`[perf] ส่งผลแมตช์ ${m.id} ไม่ได้: ${submit.status} ${submit.error ?? JSON.stringify(submit.body)} (${fmt(submit.ms)})`);
    onBeforeVerify?.();
    const verify = await request('POST', `/matches/${m.id}/result/verify`, { token: tokenFor(info.leaderOf[m.a]!) });
    if (verify.status !== 200) throw new Error(`[perf] ยืนยันผลแมตช์ ${m.id} ไม่ได้: ${verify.status} ${verify.error ?? JSON.stringify(verify.body)} (${fmt(verify.ms)})`);
    return { submit, verify };
}

// ───────────────────────────── ชุดคำขอ ─────────────────────────────

/** ทัวร์ที่ถูกเปิดดู: 60% ทัวร์ร้อน (วันแข่งคนดูกระจุกที่ทัวร์เดียว) · 40% ทัวร์อื่น */
const pickTour = () => (Math.random() < 0.6 ? HOT_TOUR : randIn(BACKGROUND_TOURS));
const get = (name: string, p: string, token?: string): Action => ({ name, run: () => request('GET', p, { token, parse: false }) });

/** ชุดอ่านตามที่ SRS ยกตัวอย่าง (สาย · ตารางคะแนน · ตารางอันดับ) + หน้าหลักที่คนเปิดคู่กัน — น้ำหนักรวม 100 */
const READ_MIX: [number, (vu: number) => Action][] = [
    [12, () => get('GET /tournaments', '/tournaments')],
    [12, () => get('GET /tournaments/:id', `/tournaments/${pickTour()}`)],
    [14, () => get('GET /tournaments/:id/bracket', `/tournaments/${pickTour()}/bracket`)],
    [10, () => get('GET /tournaments/:id/matches', `/tournaments/${pickTour()}/matches`)],
    [10, () => get('GET /tournaments/:id/standings', `/tournaments/${pickTour()}/standings`)],
    [6, () => get('GET /tournaments/:id/dashboard', `/tournaments/${pickTour()}/dashboard`)],
    [12, () => get('GET /tournaments/:id/pickem-leaderboard', `/tournaments/${HOT_TOUR}/pickem-leaderboard`)],
    [12, () => get('GET /matches/:id', `/matches/${Math.random() < 0.6 ? 1 + rand(63) : 1 + rand(maxMatchId)}`)],
    [6, () => get('GET /teams/:id', `/teams/${1 + rand(1000)}`)],
    [3, vu => get('GET /me', '/me', tokenFor(VU_USERS.from + vu))],
    [3, vu => get('GET /me/notifications', '/me/notifications', tokenFor(VU_USERS.from + vu))],
];
const TOTAL_W = READ_MIX.reduce((s, [w]) => s + w, 0);
function pickRead(vu: number): Action {
    let x = Math.random() * TOTAL_W;
    for (const [w, f] of READ_MIX) { if ((x -= w) < 0) return f(vu); }
    return READ_MIX[0]![1](vu);
}

/** PF-06 ผสมการเขียน: 8% ทาย pick'em (แมตช์ 22–32 ที่ยังเปิดทาย) — ผู้ใช้เสมือนทายซ้ำได้ (upsert) */
function pickMixed(vu: number): Action {
    if (Math.random() < 0.08) {
        const m = hot[21 + rand(hot.length - 21)]!;
        const hi = 60 + rand(30), lo = hi - 1 - rand(10);
        const aWins = Math.random() < 0.5;
        return {
            name: 'POST /matches/:id/predictions',
            run: () => request('POST', `/matches/${m.id}/predictions`, {
                token: tokenFor(VU_USERS.from + vu), parse: false,
                body: { scoreData: aWins ? { [m.a]: hi, [m.b]: lo } : { [m.a]: lo, [m.b]: hi } },
            }),
        };
    }
    return pickRead(vu);
}

// ───────────────────────────── ตัวช่วยรายงาน ─────────────────────────────

let serverPid = 0, mysqldPid = 0;
const watch = () => monitor([{ name: 'node (API)', pid: serverPid }, { name: 'mysqld', pid: mysqldPid }]);
/**
 * บรรทัด CPU/RAM ของโปรเซส — `—` เมื่อวัดไม่ได้
 * 🔴 8 ต.ค. 2569 — เดิมเรียก `.toFixed(0)` บน NaN ตรง ๆ ⇒ รายงานเต็มไปด้วย `NaN%`
 *   (monitor คืน NaN ตามเจตนาเมื่อไม่มี /proc — ตัวที่ผิดคือการพิมพ์ ไม่ใช่การวัด)
 *   เหตุที่วัดไม่ได้อยู่ในหัวข้อ "สภาพแวดล้อม" ครั้งเดียว ไม่ซ้ำทุกช่อง
 */
const num = (v: number, unit: string, digits = 0) => (Number.isNaN(v) ? '—' : `${v.toFixed(digits)}${unit}`);
const procLine = (ps: ProcStats[]) => ps.map(p =>
    `${p.name} CPU เฉลี่ย ${num(p.cpuAvg, '%')} (สูงสุด ${num(p.cpuMax, '%')}) · RAM สูงสุด ${num(p.rssMax, ' MB')}`).join(' · ');

function endpointTable(rows: Summary[]): string {
    const head = '| Endpoint | คำขอ | req/s | p50 | p95 | p99 | max | error | 4xx |\n|---|--:|--:|--:|--:|--:|--:|--:|--:|';
    return [head, ...rows.map(r => `| \`${r.name}\` | ${r.count} | ${r.rps.toFixed(1)} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.p99)} | ${fmt(r.max)} | ${r.errors} | ${r.client4xx} |`)].join('\n');
}
const sections: string[] = [];
const say = (s: string) => { console.log(s); };

// ───────────────────────────── PF-03 สร้างสาย ─────────────────────────────

async function pf03(extra: number[]) {
    say('\n▶ PF-03 สร้างสาย ≤ 64 ทีม < 5 วินาที');
    const rows: { format: string; size: number; runs: number[] }[] = [];
    for (const format of PF03_FORMATS) {
        for (const size of PF03_SIZES) {
            const id = pf03TourId(format, size);
            const runs: number[] = [];
            for (let i = 0; i < 3; i++) {   // ครั้งแรก = สร้าง · ครั้ง 2–3 = จับใหม่ (replace: ลบสายเดิมในทรานแซกชันเดียวกัน ⇒ งานหนักกว่า)
                const r = await request('POST', `/tournaments/${id}/bracket`, {
                    token: tokenFor(info.organizerOf[id]!), body: { seedingMethod: 'random', ...(i > 0 ? { replace: true } : {}) },
                });
                if (r.status !== 201) throw new Error(`[perf] PF-03 ${format} ${size}: ${r.status} ${JSON.stringify(r.body)}`);
                runs.push(r.ms);
            }
            rows.push({ format, size, runs });
            say(`  ${format.padEnd(18)} ${String(size).padStart(2)} ทีม  ${runs.map(fmt).join(' / ')}`);
        }
    }
    const worst = Math.max(...rows.flatMap(r => r.runs), ...extra);
    results['pf03'] = { rows, backgroundBrackets: extra };
    verdicts.push({ id: 'PF-03', title: 'สร้างสายการแข่งขัน ≤ 64 ทีม', target: '< 5 วินาที ทุกขนาด (8/16/32/64)',
        measured: `ช้าสุด ${fmt(worst)}`, pass: worst < 5000,
        notes: [`3 รูปแบบ × 4 ขนาด × 3 ครั้ง (ครั้งที่ 2–3 เป็นการจับใหม่ replace:true) + สายจริงอีก ${extra.length} ทัวร์ตอนเตรียมข้อมูล`] });
    sections.push(`## PF-03 — สร้างสายการแข่งขัน\n\nเกณฑ์: ≤ 64 ทีม เสร็จภายใน 5 วินาที · วัดที่ \`POST /tournaments/:id/bracket\` (เวลาตั้งแต่ส่งจนได้ 201)\n\n` +
        `| รูปแบบ | ทีม | ครั้งที่ 1 (สร้าง) | ครั้งที่ 2 (จับใหม่) | ครั้งที่ 3 (จับใหม่) |\n|---|--:|--:|--:|--:|\n` +
        rows.map(r => `| ${r.format} | ${r.size} | ${r.runs.map(fmt).join(' | ')} |`).join('\n') +
        `\n\nสายจริงที่สร้างตอนเตรียมข้อมูล (${extra.length} ทัวร์ ขนาด 8–64 ทีม): ช้าสุด ${fmt(Math.max(...extra))} · เฉลี่ย ${fmt(extra.reduce((a, b) => a + b, 0) / extra.length)}`);
}

// ───────────────────────────── เพดาน (ข้อมูลประกอบ) ─────────────────────────────

async function saturation() {
    say('\n▶ เพดานความสามารถ — 50 VU ไม่มีเวลาคิด (ข้อมูลประกอบ ไม่ใช่เกณฑ์ SRS)');
    const mon = watch();
    const rec = await runLoad({ vus: 50, durationMs: T(30_000), rampMs: 2000, thinkMs: [0, 0], pick: pickRead });
    const ps = mon.stop();
    const o = rec.overall();
    say(`  ${o.rps.toFixed(0)} req/s · p95 ${fmt(o.p95)} · error ${o.errors}`);
    results['saturation'] = { overall: o, endpoints: rec.perEndpoint(), proc: ps };
    sections.push(`## เพดานความสามารถ (ข้อมูลประกอบ)\n\n50 ผู้ใช้เสมือน ยิงต่อเนื่องไม่มีเวลาคิด ${T(30_000) / 1000} วินาที ⇒ **${o.rps.toFixed(0)} คำขอ/วินาที** ` +
        `(≈ ${(o.rps * 3600).toLocaleString('en-US', { maximumFractionDigits: 0 })} คำขอ/ชม. เทียบ SRS ช่วงพีค 2,000–5,000 อ่าน/ชม.) · p95 ${fmt(o.p95)}\n\n` +
        `${procLine(ps)}\n\n${endpointTable(rec.perEndpoint())}`);
}

// ───────────────────────────── PF-01 ─────────────────────────────

async function pf01() {
    say('\n▶ PF-01 อ่าน 100 ผู้ใช้พร้อมกัน p95 < 1.5 วินาที');
    const mon = watch();
    const rec = await runLoad({ vus: 100, durationMs: T(75_000), rampMs: T(15_000), thinkMs: [1000, 3000], pick: pickRead });
    const ps = mon.stop();
    const o = rec.overall();
    const worst = rec.perEndpoint()[0]!;
    say(`  ${o.count} คำขอ · ${o.rps.toFixed(1)} req/s · p95 ${fmt(o.p95)} · ช้าสุดราย endpoint p95 ${fmt(worst.p95)} (${worst.name}) · error ${o.errors}`);
    results['pf01'] = { overall: o, endpoints: rec.perEndpoint(), proc: ps, samples4xx: rec.samples4xx, samples5xx: rec.samples5xx };
    verdicts.push({ id: 'PF-01', title: 'API อ่านข้อมูล (สาย · ตารางคะแนน · ตารางอันดับ ฯลฯ)', target: 'p95 < 1.5 วินาที ที่ 100 ผู้ใช้พร้อมกัน',
        measured: `p95 รวม ${fmt(o.p95)} · endpoint ที่ช้าสุด p95 ${fmt(worst.p95)}`, pass: o.p95 < 1500 && worst.p95 < 1500 && o.errors === 0,
        notes: [`${o.count.toLocaleString()} คำขอใน ${T(75_000) / 1000} วินาที (${o.rps.toFixed(1)} req/s) · error ${o.errors} · 4xx ${o.client4xx}`] });
    sections.push(`## PF-01 — API อ่านข้อมูลที่ 100 ผู้ใช้พร้อมกัน\n\nเกณฑ์: p95 < 1.5 วินาที · 100 VU · เวลาคิด 1–3 วินาที · ไล่เพิ่ม VU ${T(15_000) / 1000} วินาที แล้วคงไว้จนครบ ${T(75_000) / 1000} วินาที\n\n` +
        `**รวมทุกคำขอ: p50 ${fmt(o.p50)} · p95 ${fmt(o.p95)} · p99 ${fmt(o.p99)} · max ${fmt(o.max)} · ${o.rps.toFixed(1)} req/s · error ${o.errors}**\n\n${procLine(ps)}\n\n${endpointTable(rec.perEndpoint())}`);
}

// ───────────────────────────── PF-04 ─────────────────────────────

async function pf04() {
    say('\n▶ PF-04 ยืนยันผล → สาย + ตารางอันดับ pick\'em + ตารางคะแนน อัปเดตภายใน 10 วินาที (ระหว่างโหลด 100 VU)');
    const bg = backgroundLoad({ vus: 100, thinkMs: [1000, 3000], pick: pickRead });
    await sleep(T(10_000));
    const pool = perfPool();
    const samples: { match: number; verifyMs: number; bracketMs: number; leaderboardMs: number; standingsMs: number; settled: number; error?: string }[] = [];
    try {
        for (const m of hot.slice(16, 21)) {
            // ค่าก่อนยืนยัน — ต้องอ่านสำเร็จ (ถ้า timeout ระหว่างโหลดแล้วได้ 0 จะเทียบผิด) ⇒ ลองซ้ำจนได้ 200
            const okGet = async (p: string) => { for (;;) { const r = await request('GET', p); if (r.status === 200) return r.body; } };
            const before = ((await okGet(`/tournaments/${HOT_TOUR}/pickem-leaderboard`)).items as { settled: number }[]).reduce((s, r) => s + r.settled, 0);
            const standingsBefore = JSON.stringify(await okGet(`/tournaments/${HOT_TOUR}/standings`));
            const [[{ c }]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS c FROM pickem_predictions WHERE match_id = ?', [m.id]) as any;

            let t0 = 0;
            let verify: Res;
            try {
                ({ verify } = await submitAndVerify(pool, m, () => { t0 = performance.now(); }));
            } catch (err) {
                // ส่งผล/ยืนยันล้มระหว่างโหลด (เช่น timeout 30 วิ) = ข้อนี้ไม่ผ่าน · บันทึกแล้วไปแมตช์ถัดไป
                say(`  แมตช์ ${m.id}: ❌ ${(err as Error).message}`);
                samples.push({ match: m.id, verifyMs: NaN, bracketMs: NaN, leaderboardMs: NaN, standingsMs: NaN, settled: c, error: (err as Error).message });
                continue;
            }
            const seen = { bracket: 0, leaderboard: 0, standings: 0 };
            const deadline = t0 + 15_000;
            while ((!seen.bracket || !seen.leaderboard || !seen.standings) && performance.now() < deadline) {
                const [b, l, s] = await Promise.all([
                    request('GET', `/tournaments/${HOT_TOUR}/bracket`),
                    request('GET', `/tournaments/${HOT_TOUR}/pickem-leaderboard`),
                    request('GET', `/tournaments/${HOT_TOUR}/standings`),
                ]);
                const at = performance.now() - t0;
                const node = (b.body?.nodes ?? []).find((n: any) => n.matchId === m.next);
                if (!seen.bracket && node && (node.teamA?.id === m.a || node.teamB?.id === m.a)) seen.bracket = at;
                if (!seen.leaderboard && (l.body?.items ?? []).reduce((x: number, r: { settled: number }) => x + r.settled, 0) >= before + c) seen.leaderboard = at;
                if (!seen.standings && JSON.stringify(s.body) !== standingsBefore) seen.standings = at;
                if (!seen.bracket || !seen.leaderboard || !seen.standings) await sleep(250);
            }
            samples.push({ match: m.id, verifyMs: verify.ms, bracketMs: seen.bracket || NaN, leaderboardMs: seen.leaderboard || NaN, standingsMs: seen.standings || NaN, settled: c });
            say(`  แมตช์ ${m.id}: ยืนยัน ${fmt(verify.ms)} (ตัดสิน ${c} ใบ) · สาย ${fmt(seen.bracket || NaN)} · ตารางอันดับ ${fmt(seen.leaderboard || NaN)} · ตารางคะแนน ${fmt(seen.standings || NaN)}`);
            await sleep(T(3000));
        }
    } finally {
        await pool.end();
    }
    const bgRec = await bg.stop();
    const worst = Math.max(...samples.flatMap(s => [s.bracketMs, s.leaderboardMs, s.standingsMs].map(x => (Number.isNaN(x) ? Infinity : x))));
    results['pf04'] = { samples, background: bgRec.overall() };
    verdicts.push({ id: 'PF-04', title: 'ตารางอันดับ/สายอัปเดตหลังยืนยันผล', target: '≤ 10 วินาที หลังผลถูกยืนยัน',
        measured: `ช้าสุด ${fmt(worst)} (จากกดยืนยันถึงหน้าอ่านเห็นผล)`, pass: worst <= 10_000,
        notes: [`${samples.length} แมตช์ · แต่ละครั้งตัดสินแต้ม pick'em ~4,000 ใบในทรานแซกชันเดียวกัน · วัดระหว่างโหลดพื้นหลัง 100 VU (p95 พื้นหลัง ${fmt(bgRec.overall().p95)})`,
                'ระบบอัปเดตแบบ synchronous (ธุรกรรมเดียวกับการยืนยัน) ⇒ เวลาที่วัดได้ ≈ เวลาของคำขอยืนยัน + รอบ poll ถัดไป (ทุก 250 ms)'] });
    sections.push(`## PF-04 — ตารางอันดับและสายอัปเดตหลังยืนยันผล\n\nเกณฑ์: ≤ 10 วินาที · จับเวลาตั้งแต่ส่ง \`POST /matches/:id/result/verify\` จนคำขออ่านเห็นผลใหม่ (poll ทุก 250 ms) · ระหว่างนั้นมีโหลดอ่านพื้นหลัง 100 VU\n\n` +
        `| แมตช์ | คำขอยืนยัน | ใบ pick'em ที่ตัดสิน | สาย (ผู้ชนะไปรอบถัดไป) | ตารางอันดับ pick'em | ตารางคะแนน |\n|--:|--:|--:|--:|--:|--:|\n` +
        samples.map(s => `| ${s.match} | ${fmt(s.verifyMs)} | ${s.settled.toLocaleString()} | ${fmt(s.bracketMs)} | ${fmt(s.leaderboardMs)} | ${fmt(s.standingsMs)} |`).join('\n') +
        `\n\nโหลดพื้นหลังระหว่างวัด: ${bgRec.overall().count} คำขอ · p95 ${fmt(bgRec.overall().p95)} · error ${bgRec.overall().errors}`);
}

// ───────────────────────────── PF-05 ─────────────────────────────

async function checkinBurst(matchId: number): Promise<{ qr: Res; scans: Res[] }> {
    const qr = await request('GET', `/matches/${matchId}/checkin-qr`, { token: tokenFor(checkinReferee) });
    // ขอ QR ไม่สำเร็จ (เช่น timeout ระหว่างโหลดหนัก) = ทั้ง 30 คนเช็คอินไม่ได้ ⇒ บันทึกเป็นผลไม่ผ่าน ไม่ล้มทั้งสคริปต์
    if (qr.status !== 200) return { qr, scans: [] };
    const players = info.teamsOf[CHECKIN_TOUR]!.flatMap(t => info.membersOf[t]!);
    // 30 คนสแกนพร้อมกันเป๊ะ — หนักกว่าที่ SRS กำหนด (30 คนภายใน 5 นาที) โดยเจตนา
    const scans = await Promise.all(players.map(u => request('POST', `/matches/${matchId}/checkins`, {
        token: tokenFor(u), body: { method: 'qr_onsite', qrPayload: qr.body.qrPayload },
    })));
    return { qr, scans };
}

async function pf05() {
    say('\n▶ PF-05 เช็คอิน QR — 30 คนสแกนพร้อมกัน แต่ละคน < 3 วินาที');
    const runs: { label: string; qrMs: number; qrOk: boolean; ms: number[]; ok: number; statuses: Record<string, number> }[] = [];
    const conditions: [string, number][] = [['ระบบว่าง', 0], ['ระหว่างโหลดอ่าน 100 VU', 100], ['ระหว่างโหลดผสม 500 VU', 500]];
    for (const [i, [label, vus]] of conditions.entries()) {
        const bg = vus ? backgroundLoad({ vus, thinkMs: [1000, 3000], pick: vus >= 500 ? pickMixed : pickRead }) : null;
        if (bg) await sleep(T(15_000));
        const { qr, scans } = await checkinBurst(checkinMatches[i]!);
        if (bg) await bg.stop();
        const statuses: Record<string, number> = {};
        for (const s of scans) statuses[s.status] = (statuses[s.status] ?? 0) + 1;
        if (qr.status !== 200) statuses[`QR ${qr.status}${qr.error ? ` ${qr.error}` : ''}`] = 1;
        const ms = scans.map(s => s.ms).sort((a, b) => a - b);
        runs.push({ label, qrMs: qr.ms, qrOk: qr.status === 200, ms, ok: scans.filter(s => s.status >= 200 && s.status < 300).length, statuses });
        say(`  ${label}: ขอ QR ${fmt(qr.ms)} (${qr.status}) · สแกน ${scans.length} คน ช้าสุด ${fmt(ms[ms.length - 1] ?? NaN)} · สำเร็จ ${runs.at(-1)!.ok}/30 ${JSON.stringify(statuses)}`);
    }
    // ★ เวลาขอ QR นับด้วย — ผู้เล่นสแกนไม่ได้จนกว่ากรรมการจะได้ QR บนจอ
    const worst = Math.max(...runs.flatMap(r => [r.qrMs, ...r.ms]));
    const allOk = runs.every(r => r.qrOk && r.ok === 30);
    results['pf05'] = runs;
    verdicts.push({ id: 'PF-05', title: 'เช็คอินด้วย QR ที่สนาม', target: 'ตอบกลับ < 3 วินาที ต่อคน · ทดสอบ 30 คนใน 5 นาที',
        measured: `30 คนพร้อมกัน ช้าสุด ${fmt(worst)} · สำเร็จ ${runs.map(r => `${r.ok}/30`).join(', ')}`, pass: worst < 3000 && allOk,
        notes: ['ยิง 30 คนพร้อมกันในวินาทีเดียว (หนักกว่าเกณฑ์ 30 คนใน 5 นาที) · 3 สภาวะ: ว่าง / โหลดอ่าน 100 VU / โหลดผสม 500 VU'] });
    sections.push(`## PF-05 — เช็คอินด้วย QR\n\nเกณฑ์: แต่ละคนได้คำตอบ < 3 วินาที · SRS ให้ทดสอบ 30 คนภายใน 5 นาที — ที่นี่ยิง **30 คนพร้อมกัน** (กรรมการขอ QR → ผู้เล่นทั้งสองทีมสแกนพร้อมกัน)\n\n` +
        `| สภาวะ | ขอ QR | สแกน p50 | สแกน p95 | สแกนช้าสุด | สำเร็จ | สถานะ HTTP |\n|---|--:|--:|--:|--:|--:|---|\n` +
        runs.map(r => `| ${r.label} | ${fmt(r.qrMs)}${r.qrOk ? '' : ' ❌'} | ${fmt(r.ms[Math.floor(r.ms.length / 2)] ?? NaN)} | ${fmt(r.ms[Math.ceil(r.ms.length * 0.95) - 1] ?? NaN)} | ${fmt(r.ms[r.ms.length - 1] ?? NaN)} | ${r.ok}/30 | ${JSON.stringify(r.statuses)} |`).join('\n'));
}

// ───────────────────────────── PF-06 ─────────────────────────────

async function pf06(logPath: string) {
    say('\n▶ PF-06 ไล่ขั้น 100 → 250 → 500 ผู้ใช้ (+1,000 สำรวจ) · error ≤ 1% · ตรวจ log');
    const logStart = statSync(logPath).size;
    const steps = [
        { vus: 100, holdMs: T(60_000), required: true },
        { vus: 250, holdMs: T(60_000), required: true },
        { vus: 500, holdMs: T(90_000), required: true },
        { vus: 1000, holdMs: T(60_000), required: false },   // เกินเกณฑ์ — ช่วงพีคบนสุดในตารางปริมาณงาน (500–1,000)
    ];
    const recs = steps.map(() => new Recorder());
    const procs: ProcStats[][] = [];
    const t0 = Date.now();
    let stepIdx = 0, stopAll = false;
    const vuLoop = async (vu: number, startDelay: number) => {
        await sleep(startDelay);
        let iter = 0;
        while (!stopAll) {
            const a = pickMixed(vu);
            const r = await a.run();
            recs[stepIdx]!.record(a.name, r.ms, r.status, r.error ?? '');
            await sleep(1000 + Math.random() * 2000);
            iter++;
        }
    };
    const loops: Promise<void>[] = [];
    let running = 0;
    for (const [i, s] of steps.entries()) {
        stepIdx = i;
        recs[i]!.startedAt = Date.now();
        const mon = watch();
        const add = s.vus - running;
        for (let k = 0; k < add; k++) loops.push(vuLoop(running + k, (T(10_000) * k) / add));   // เพิ่ม VU ใหม่ไล่ใน 10 วินาที
        running = s.vus;
        await sleep(s.holdMs);
        recs[i]!.stop();
        procs.push(mon.stop());
        const o = recs[i]!.overall();
        say(`  ${s.vus} VU: ${o.count} คำขอ · ${o.rps.toFixed(0)} req/s · p95 ${fmt(o.p95)} · p99 ${fmt(o.p99)} · error ${o.errors} (${pct(o.errorRate)}) · 4xx ${o.client4xx}`);
    }
    stopAll = true;
    await Promise.all(loops);

    const log = readFileSync(logPath, 'utf8').slice(logStart);
    const logLines = log.split('\n').filter(l => l.trim() !== '');
    const errorLines = logLines.filter(l => /error|exception|ECONN|ER_|timeout/i.test(l));

    /**
     * ★ บรรทัด `[slow]` จาก middleware C2 (`SLOW_REQUEST_MS` ค่าตั้งต้น 2000)
     *
     * 🔴 8 ต.ค. 2569 — เดิมด่านนี้นับแต่บรรทัดที่เป็น error ⇒ รายงานเขียนว่า
     *   "บรรทัดที่เป็น error 0" ทั้งที่ log มีสัญญาณคอขวดอยู่ 9,647 บรรทัด
     *   ซึ่งตรงกับข้อสังเกตใน PERF-RESULTS ว่า "ตรวจ log ใน PF-06 จับปัญหาแบบนี้ไม่ได้"
     *   ⇒ เมื่อมี middleware แล้ว ด่านนี้ต้องอ่านมันด้วย ไม่งั้นของที่เพิ่มมาก็ไม่มีใครเห็น
     *
     * 🔴 **ไม่เอาไปตัดสินผ่าน/ไม่ผ่าน** — เกณฑ์ PF-06 ของ SRS คือ error rate เท่านั้น
     *   และขั้น 1,000 VU (เกินเกณฑ์) ทำให้มีคำขอช้าเป็นเรื่องปกติที่คาดไว้แล้ว
     *   ตัวเลขนี้มีไว้ "ชี้ว่า log จับอะไรได้" ไม่ใช่ด่านใหม่ที่ไม่มีใครตกลง
     *
     * 🔴 **ห้ามใช้จำนวนครั้งจัดอันดับคอขวด** — พอระบบอิ่มตัว ทุกเส้นเข้าคิวพร้อมกัน
     *   ตัวเลขจะเกลี่ยเท่ากันหมด: รอบ 8 ต.ค. 2569 หกอันดับแรกอยู่ที่ 1,148–1,310 ครั้ง ต่างกันไม่ถึง 15%
     *   ตัวที่แยก "คิวรีแพง" ออกจาก "คิวรีถูกแต่ติดคิว" ได้คือตารางราย endpoint ที่โหลดต่ำใน PF-01
     */
    const slowMs = Number(process.env['SLOW_REQUEST_MS'] ?? 2000);   // ค่าตั้งต้นเดียวกับ config/env.ts
    const SLOW = /^\[slow\] (\d+)ms (\w+) (\S+)/;
    // รวมเลข id ให้เป็น :id เหมือนตารางราย endpoint อื่น ๆ ไม่งั้น POST /matches/23|24|29/predictions
    // จะแตกเป็นสิบแถวแถวละ 20 ครั้ง แล้วหลุดจากตารางสิบอันดับ ทั้งที่รวมกันเป็นตัวที่ช้าบ่อยที่สุด
    const normPath = (p: string) => p.replace(/\/\d+/g, '/:id');
    const slow = logLines.flatMap(l => {
        const m = SLOW.exec(l);
        return m ? [{ ms: Number(m[1]), ep: `${m[2]} ${normPath(m[3]!)}`, aborted: l.includes('ไม่ได้ส่งคำตอบ') }] : [];
    });
    const slowByEp = [...slow.reduce((acc, s) => {
        const cur = acc.get(s.ep) ?? { count: 0, max: 0 };
        acc.set(s.ep, { count: cur.count + 1, max: Math.max(cur.max, s.ms) });
        return acc;
    }, new Map<string, { count: number; max: number }>())].sort((a, b) => b[1].count - a[1].count);
    const aborted = slow.filter(s => s.aborted).length;

    const req = recs.slice(0, 3);
    const total = req.reduce((s, r) => s + r.overall().count, 0);
    const errs = req.reduce((s, r) => s + r.overall().errors, 0);
    const rate = total ? errs / total : 0;
    results['pf06'] = { steps: steps.map((s, i) => ({ ...s, overall: recs[i]!.overall(), endpoints: recs[i]!.perEndpoint(), proc: procs[i], samples5xx: recs[i]!.samples5xx, samples4xx: recs[i]!.samples4xx })),
                        log: { lines: logLines.length, errorLines: errorLines.length, sample: errorLines.slice(0, 20),
                               slow: { total: slow.length, aborted, byEndpoint: slowByEp.map(([ep, v]) => ({ ep, ...v })) } },
                        durationMs: Date.now() - t0 };
    const s500 = recs[2]!.overall();
    verdicts.push({ id: 'PF-06', title: 'รองรับ 500 ผู้ใช้พร้อมกัน', target: 'error rate ≤ 1% · ไล่ขั้น + ตรวจ log ของ API',
        measured: `error ${pct(rate)} (${errs}/${total.toLocaleString()} ในขั้น 100–500) · ขั้น 500: p95 ${fmt(s500.p95)} · log ผิดปกติ ${errorLines.length} บรรทัด`
            + ` · คำขอช้าเกิน ${slowMs} ms ${slow.length.toLocaleString()} ครั้ง (ไม่ใช่เกณฑ์ตัดสิน)`,
        pass: rate <= 0.01 && errorLines.length === 0,
        notes: [`ขั้น 1,000 VU (เกินเกณฑ์): error ${pct(recs[3]!.overall().errorRate)} · p95 ${fmt(recs[3]!.overall().p95)}`,
                'ชุดคำขอผสม: อ่าน 92% + ทาย pick\'em 8% · เวลาคิด 1–3 วินาที'] });
    sections.push(`## PF-06 — ไล่ขั้นถึง 500 ผู้ใช้พร้อมกัน\n\nเกณฑ์: error rate ≤ 1% (5xx · ต่อไม่ติด · timeout 30 วิ) · ไล่ขั้นแบบไม่หยุดเซิร์ฟเวอร์ (VU ขั้นก่อนยังอยู่ต่อ) · ชุดคำขอ = อ่าน 92% + ทาย pick'em 8% · ตรวจ server log หลังจบ\n\n` +
        `| ขั้น | ระยะ | คำขอ | req/s | p50 | p95 | p99 | max | error | error rate | 4xx | เซิร์ฟเวอร์ |\n|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|\n` +
        steps.map((s, i) => { const o = recs[i]!.overall(); return `| ${s.vus} VU${s.required ? '' : ' (สำรวจ)'} | ${s.holdMs / 1000} วิ | ${o.count.toLocaleString()} | ${o.rps.toFixed(0)} | ${fmt(o.p50)} | ${fmt(o.p95)} | ${fmt(o.p99)} | ${fmt(o.max)} | ${o.errors} | ${pct(o.errorRate)} | ${o.client4xx} | ${procLine(procs[i]!)} |`; }).join('\n') +
        `\n\n**ตรวจ log ของ API ระหว่าง PF-06:** ${logLines.length} บรรทัด · บรรทัดที่เป็น error ${errorLines.length}` +
        (errorLines.length ? `\n\n\`\`\`\n${errorLines.slice(0, 10).join('\n')}\n\`\`\`` : '') +
        (slow.length
            ? `\n\n**คำขอที่ช้าเกิน ${slowMs} ms (middleware \`slowRequestLog\`):** ${slow.length.toLocaleString()} ครั้ง` +
              ` · ช้าสุด ${fmt(Math.max(...slow.map(s => s.ms)))}` +
              ` · ไม่ได้ส่งคำตอบเพราะ client ยกเลิกก่อน ${aborted.toLocaleString()} ครั้ง` +
              `\n\n🔴 ไม่ใช่เกณฑ์ตัดสิน PF-06 (SRS กำหนดแค่ error rate) · ขั้น 1,000 VU เกินเกณฑ์อยู่แล้วจึงมีคำขอช้าเป็นปกติ` +
              ` · ★ ตอนระบบอิ่มตัวทุกเส้นเข้าคิวพร้อมกัน จำนวนครั้งจึงเกลี่ยเท่ากันหมด ⇒ **จัดอันดับคอขวดจากคอลัมน์ “ครั้งที่ช้า” ไม่ได้** — ใช้ช่อง “ช้าสุด” กับตารางราย endpoint ที่โหลดต่ำ (PF-01) แทน\n\n` +
              `| Endpoint | ครั้งที่ช้า | ช้าสุด |\n|---|--:|--:|\n` +
              slowByEp.slice(0, 10).map(([ep, v]) => `| \`${ep}\` | ${v.count.toLocaleString()} | ${fmt(v.max)} |`).join('\n')
            : `\n\n**คำขอที่ช้าเกิน ${slowMs} ms:** ไม่มีเลย (middleware \`slowRequestLog\`)`) +
        `\n\n### ราย endpoint ที่ขั้น 500 VU\n\n${endpointTable(recs[2]!.perEndpoint())}` +
        `\n\n### ราย endpoint ที่ขั้น 1,000 VU (สำรวจ — เกินเกณฑ์)\n\n${endpointTable(recs[3]!.perEndpoint())}`);
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
    const started = new Date();
    await setupPerfDb();
    info = await seedBulk();
    const srv = await startServer();
    serverPid = srv.proc.pid!;
    try { mysqldPid = Number(execSync('pgrep -xo mysqld').toString().trim()) || 0; } catch { mysqldPid = 0; }

    try {
        const extra: number[] = [];
        await prepare(extra);
        if (want('pf03')) await pf03(extra);
        if (want('saturation')) await saturation();
        if (want('pf01')) await pf01();
        if (want('pf04')) await pf04();
        if (want('pf05')) await pf05();
        if (want('pf06')) await pf06(srv.logPath);
    } finally {
        await srv.stop();
    }

    const pool = perfPool();
    const [[vol]] = await pool.query<RowDataPacket[]>(
        `SELECT VERSION() mysql_version, @@global.time_zone global_tz,
                (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM tournaments) tours, (SELECT COUNT(*) FROM teams) teams,
                (SELECT COUNT(*) FROM matches) matches, (SELECT COUNT(*) FROM pickem_predictions) picks,
                (SELECT COUNT(*) FROM pickem_predictions WHERE points_earned IS NOT NULL) settled,
                (SELECT COUNT(*) FROM match_checkins) checkins, (SELECT COUNT(*) FROM notifications) notifs`);
    await pool.end();

    /**
      * 🔴 8 ต.ค. 2569 — เดิมอ่านเวอร์ชันจาก `mysqld --version` ของ **เครื่อง**
      *   เครื่องที่มี MySQL ติดตั้งไว้เองแต่วัดกับ Docker จะได้เวอร์ชันผิด
      *   (รอบ 8 ต.ค. รายงานเขียน 8.0.44 ทั้งที่ฐานที่วัดคือ 8.4.11) ⇒ อ่านจาก connection ที่วัดจริง
      * ★ `@@global.time_zone` อยู่ในบรรทัดนี้ด้วยเพราะมันเปลี่ยนผลของ `NOW()`/`INTERVAL`
      *   ในคิวรีที่วัด (กฎกวาดทีม) ⇒ เป็นส่วนหนึ่งของสภาพแวดล้อม ไม่ใช่รายละเอียดปลีกย่อย
      */
    const env = `${os.cpus().length} CPU (${os.cpus()[0]?.model ?? '?'}) · RAM ${(os.totalmem() / 2 ** 30).toFixed(1)} GB · Node ${process.version} · ` +
        `MySQL ${vol!['mysql_version']} (ฐานที่วัดจริง · time_zone ${vol!['global_tz']})` +
        (PROC_STATS_AVAILABLE ? '' : '\n- **CPU/RAM ของโปรเซสวัดไม่ได้บนเครื่องนี้** — `perf/lib/monitor.ts` อ่าน `/proc` ซึ่งมีแต่บน Linux ⇒ ช่อง CPU/RAM ในรายงานนี้เป็น `—` ทั้งหมด');
    const report = [
        `# ผลทดสอบประสิทธิภาพและโหลด (SRS 3.2 PF-01 – PF-06)`,
        `\nรันเมื่อ ${started.toISOString()}${QUICK ? ' · **โหมด PERF_QUICK (ย่อเวลา — ไม่ใช่ผลทางการ)**' : ''}\n`,
        `## สรุป\n`,
        `| ข้อ | เรื่อง | เกณฑ์ | ผลที่วัดได้ | ผล |\n|---|---|---|---|:-:|`,
        ...verdicts.map(v => `| ${v.id} | ${v.title} | ${v.target} | ${v.measured} | ${v.pass === null ? '–' : v.pass ? '✅ ผ่าน' : '❌ ไม่ผ่าน'} |`),
        `| PF-02 | หน้าเว็บแสดงเนื้อหาแรกบน 4G | < 2.5 วินาที | ไม่อยู่ในขอบเขตสคริปต์นี้ (frontend — วัดด้วย Lighthouse throttling 4G) | – |`,
        `\n${verdicts.flatMap(v => v.notes.map(n => `- **${v.id}:** ${n}`)).join('\n')}`,
        `\n## สภาพแวดล้อม\n`,
        `- เครื่อง: ${env}`,
        `- **เซิร์ฟเวอร์ API · MySQL · ตัวยิงโหลด อยู่เครื่องเดียวกัน แย่ง CPU กัน** ⇒ ตัวเลขนี้เป็น "พื้นล่าง" ของเครื่องจริง`,
        `- เซิร์ฟเวอร์: \`dist/server.js\` (build จริง) โปรเซสเดียว · mysql2 pool ค่าตั้งต้น (connectionLimit 10) · NODE_ENV=production`,
        `- ข้อมูลในฐานตอนจบ: ผู้ใช้ ${vol!['users'].toLocaleString()} · ทัวร์ ${vol!['tours']} · ทีม ${vol!['teams'].toLocaleString()} · แมตช์ ${vol!['matches'].toLocaleString()} · ` +
            `การทาย pick'em ${vol!['picks'].toLocaleString()} (ตัดสินแล้ว ${vol!['settled'].toLocaleString()}) · เช็คอิน ${vol!['checkins']} · แจ้งเตือน ${vol!['notifs'].toLocaleString()}`,
        `- ผู้ใช้เสมือน: ใช้ token ที่เซ็นเอง (ไม่ผ่าน /auth/login — bcrypt ตั้งใจให้ช้าและมี rate limit) · เวลาคิด 1–3 วินาทีระหว่างคำขอ`,
        `\n${sections.join('\n\n')}`,
        `\n---\nสร้างโดย \`npm run perf\` · ข้อมูลดิบทั้งหมดอยู่ใน \`perf/results/results.json\` · log เซิร์ฟเวอร์ \`perf/results/server.log\``,
    ].join('\n');
    writeFileSync(path.join(RESULTS_DIR, 'report.md'), report);
    writeFileSync(path.join(RESULTS_DIR, 'results.json'), JSON.stringify({ started, env, volume: vol, verdicts, results }, null, 2));
    say(`\n${verdicts.map(v => `${v.id} ${v.pass ? 'PASS' : 'FAIL'} — ${v.measured}`).join('\n')}`);
    say(`\n[perf] รายงาน: perf/results/report.md`);
    if (verdicts.some(v => v.pass === false)) process.exitCode = 1;
}

main().catch(err => { console.error(err); process.exit(2); });
