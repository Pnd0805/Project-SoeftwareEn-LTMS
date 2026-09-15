import pool from '../config/db.js';
import * as ApplicationRepo from '../repositories/application.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as BracketNodeRepo from '../repositories/bracketNode.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';
import { toBracketNodeDto } from '../mappers/match.mapper.js';
import { AppError } from '../utils/AppError.js';

// ---------------------------------------------------------------
// ส่วนคำนวณล้วนๆ (pure function) — ไม่แตะ DB เลย ทดสอบแยกได้ง่าย
// ---------------------------------------------------------------

export type PlannedMatch = {
    round: number;                          // เริ่มที่ 1
    matchNumber: number;                    // เริ่มที่ 1 ภายในรอบนั้น
    teamAId: number | null;
    teamBId: number | null;
    isBye: boolean;                         // true = ไม่มีแมตช์จริงเกิดขึ้น (ทีมเดียวเดินผ่านเข้ารอบ)
};

function nextPowerOfTwo(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return p;
}

type Slot =
    | { kind: 'team'; teamId: number }
    | { kind: 'bye' }     // ช่องว่าง — เกิดได้แค่ตอน "เติม" รอบ 1 ให้ครบเลขยกกำลัง 2 เท่านั้น
    | { kind: 'tbd' };    // ยังไม่รู้ว่าใคร ต้องรอผลแมตช์จริงของรอบก่อนหน้า

export function planSingleElimination(teamIds: number[]): PlannedMatch[] {
    const bracketSize = nextPowerOfTwo(teamIds.length);
    const totalRounds = Math.log2(bracketSize);

    let slots: Slot[] = teamIds.map((id) => ({ kind: 'team', teamId: id }));
    while (slots.length < bracketSize) slots.push({ kind: 'bye' });

    const planned: PlannedMatch[] = [];

    for (let round = 1; round <= totalRounds; round++) {
        const numMatches = slots.length / 2;
        const nextSlots: Slot[] = [];

        for (let i = 0; i < numMatches; i++) {
            const a = slots[2 * i]!;
            const b = slots[2 * i + 1]!;
            const isBye = a.kind === 'bye' || b.kind === 'bye';

            planned.push({
                round,
                matchNumber: i + 1,
                teamAId: a.kind === 'team' ? a.teamId : null,
                teamBId: b.kind === 'team' ? b.teamId : null,
                isBye,
            });

            if (isBye) {
                // ฝั่งที่ไม่ใช่ bye (ถ้ามี) เดินเข้ารอบถัดไปเลย ไม่ต้องแข่ง
                const survivor = a.kind === 'team' ? a : b.kind === 'team' ? b : { kind: 'bye' as const };
                nextSlots.push(survivor);
            } else {
                // แมตช์จริง ต้องรอผลก่อนถึงจะรู้ว่าใครไปต่อ
                nextSlots.push({ kind: 'tbd' });
            }
        }

        slots = nextSlots;
    }

    return planned;
}

export type RoundRobinPair = {
    round: number;
    teamAId: number;
    teamBId: number;
};

// อัลกอริทึม circle method มาตรฐานสำหรับจัดคู่ round robin
export function planRoundRobin(teamIds: number[]): RoundRobinPair[] {
    const list: (number | null)[] = [...teamIds];
    if (list.length % 2 !== 0) list.push(null); // ทีมคี่ -> เติม bye ไว้ 1 ช่อง

    const n = list.length;
    const rounds = n - 1;
    const half = n / 2;
    const result: RoundRobinPair[] = [];

    let arr = [...list];
    for (let r = 0; r < rounds; r++) {
        for (let i = 0; i < half; i++) {
            const a = arr[i]!;
            const b = arr[n - 1 - i]!;
            if (a !== null && b !== null) {
                result.push({ round: r + 1, teamAId: a, teamBId: b });
            }
        }
        const fixed = arr[0]!;
        const rest = arr.slice(1);
        rest.unshift(rest.pop()!);
        arr = [fixed, ...rest];
    }

    return result;
}

// ---------------------------------------------------------------
// Double elimination — ต้องการจำนวนทีมเป็นเลขยกกำลัง 2 พอดี (ไม่รองรับ bye)
// เหตุผล: bye ผสมกับสาย losers ทำให้จังหวะ "ใครแพ้ตอนไหนไปลงช่องไหน" ไม่สม่ำเสมอ
// ซับซ้อนเกินขอบเขตเวลาที่มี ต้องคุยทีมถ้าอยากรองรับจำนวนทีมที่ไม่ใช่เลขยกกำลัง 2
// ---------------------------------------------------------------

type MatchKey = string; // เช่น "WB-1-1", "LB-2-1", "GF"

type InputSource =
    | { kind: 'team'; teamId: number }
    | { kind: 'winner'; matchKey: MatchKey }   // ยังไม่รู้ว่าใคร ต้องรอ "ผู้ชนะ" ของแมตช์ที่ระบุ
    | { kind: 'loser'; matchKey: MatchKey };    // ยังไม่รู้ว่าใคร ต้องรอ "ผู้แพ้" ของแมตช์ที่ระบุ (มีแค่ใน winners bracket)

export type PlannedMatchNode = {
    key: MatchKey;
    bracketType: 'winners' | 'losers' | 'grand_final';
    round: number | null;
    matchNumber: number;
    teamA: InputSource;
    teamB: InputSource;
};

// ต้อง >= 4 ทีม (ไม่ใช่แค่ >= 2) เพราะ LB รอบแรกต้องจับคู่ผู้แพ้ของ WB รอบ 1 กันเอง
// ถ้ามีแค่ 2 ทีม WB รอบ 1 จะมีผู้แพ้แค่ 1 คน จับคู่ไม่ได้เลย (0.5 แมตช์)
function isPowerOfTwoAtLeastFour(n: number): boolean {
    return n >= 4 && Math.log2(n) % 1 === 0;
}

export function planDoubleElimination(teamIds: number[]): PlannedMatchNode[] {
    const n = teamIds.length;
    const k = Math.log2(n); // จำนวนรอบของ winners bracket

    const matches: PlannedMatchNode[] = [];

    // ---- Winners bracket ----
    let currentWbSources: InputSource[] = teamIds.map((id): InputSource => ({ kind: 'team', teamId: id }));
    const wbLosersByRound: InputSource[][] = []; // wbLosersByRound[r-1] = ผู้แพ้ที่เกิดจาก WB รอบ r

    for (let round = 1; round <= k; round++) {
        const numMatches = currentWbSources.length / 2;
        const nextWbSources: InputSource[] = [];
        const losersThisRound: InputSource[] = [];

        for (let i = 0; i < numMatches; i++) {
            const matchNumber = i + 1;
            const key = `WB-${round}-${matchNumber}`;
            matches.push({
                key, bracketType: 'winners', round, matchNumber,
                teamA: currentWbSources[2 * i]!,
                teamB: currentWbSources[2 * i + 1]!,
            });
            nextWbSources.push({ kind: 'winner', matchKey: key });
            losersThisRound.push({ kind: 'loser', matchKey: key });
        }

        wbLosersByRound.push(losersThisRound);
        currentWbSources = nextWbSources;
    }
    const wbChampionSource = currentWbSources[0]!; // เหลือ WB round สุดท้ายแค่ 1 แมตช์เสมอ

    // ---- Losers bracket ----
    // รอบ 1: เอาผู้แพ้ของ WB รอบ 1 มาจับคู่กันเอง (ยังไม่มีใครรอด survive มาก่อนหน้านี้)
    let lbRoundCounter = 1;
    let lbSurvivors: InputSource[] = [];
    {
        const intake = wbLosersByRound[0]!;
        const numMatches = intake.length / 2;
        for (let i = 0; i < numMatches; i++) {
            const matchNumber = i + 1;
            const key = `LB-${lbRoundCounter}-${matchNumber}`;
            matches.push({
                key, bracketType: 'losers', round: lbRoundCounter, matchNumber,
                teamA: intake[2 * i]!, teamB: intake[2 * i + 1]!,
            });
            lbSurvivors.push({ kind: 'winner', matchKey: key });
        }
    }

    // สลับกันไปเรื่อยๆ: รอบผสม (survivor เจอผู้แพ้ใหม่จาก WB) → รอบ survivor ล้วน (ถ้ายังเหลือมากกว่า 1)
    let nextWbRoundToIntake = 2;
    while (nextWbRoundToIntake <= k) {
        lbRoundCounter++;
        const fresh = wbLosersByRound[nextWbRoundToIntake - 1]!;
        const mixedSurvivors: InputSource[] = [];
        for (let i = 0; i < lbSurvivors.length; i++) {
            const matchNumber = i + 1;
            const key = `LB-${lbRoundCounter}-${matchNumber}`;
            matches.push({
                key, bracketType: 'losers', round: lbRoundCounter, matchNumber,
                teamA: lbSurvivors[i]!, teamB: fresh[i]!,
            });
            mixedSurvivors.push({ kind: 'winner', matchKey: key });
        }
        lbSurvivors = mixedSurvivors;
        nextWbRoundToIntake++;

        if (lbSurvivors.length > 1) {
            lbRoundCounter++;
            const numMatches = lbSurvivors.length / 2;
            const nextSurvivors: InputSource[] = [];
            for (let i = 0; i < numMatches; i++) {
                const matchNumber = i + 1;
                const key = `LB-${lbRoundCounter}-${matchNumber}`;
                matches.push({
                    key, bracketType: 'losers', round: lbRoundCounter, matchNumber,
                    teamA: lbSurvivors[2 * i]!, teamB: lbSurvivors[2 * i + 1]!,
                });
                nextSurvivors.push({ kind: 'winner', matchKey: key });
            }
            lbSurvivors = nextSurvivors;
        }
    }
    const lbChampionSource = lbSurvivors[0]!; // เหลือ 1 เสมอตอนจบ loop

    // ---- Grand Final ----
    // ★ ไม่ทำ "bracket reset" (นัดที่ 2 ถ้าฝั่ง LB ชนะนัดแรก) — ตัดสินใจง่ายกว่าเวลาที่มี ต้องคุยทีมถ้าอยากได้ครบสูตร
    matches.push({
        key: 'GF', bracketType: 'grand_final', round: null, matchNumber: 1,
        teamA: wbChampionSource, teamB: lbChampionSource,
    });

    return matches;
}

function shuffle<T>(input: T[]): T[] {
    const arr = [...input];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
}

// ---------------------------------------------------------------
// ส่วนที่แตะ DB จริง — orchestration
// ---------------------------------------------------------------

// requireOrganizer (middleware) เช็คสิทธิ์ organizer ให้แล้วก่อนถึงตรงนี้
export async function createBracket(
    tournamentId: number,
    seedingMethod: 'random' | 'manual',
    manualSeeds: number[] | undefined
) {
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) {
        throw new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์นี้");
    }

    const existingCount = await MatchRepo.countMatchesByTournament(tournamentId);
    if (existingCount > 0) {
        throw new AppError(409, "BRACKET_ALREADY_EXISTS", "ทัวร์นาเมนต์นี้สร้างสายการแข่งขันไปแล้ว");
    }

    const approvedTeams = await ApplicationRepo.findApprovedTeamsByTournament(tournamentId);
    const teamIdsInOrder = orderTeamIds(approvedTeams.map(t => t.team_id), seedingMethod, manualSeeds);

    if (teamIdsInOrder.length < 2 || teamIdsInOrder.length < tournament.min_teams) {
        throw new AppError(422, "TEAM_COUNT_MISMATCH", "จำนวนทีมไม่สอดคล้องกับรูปแบบการแข่งขันที่เลือก");
    }

    // M01 ไม่มีช่องให้ organizer เลือก mode เอง (แก้ทีละแมตช์ทีหลังต้องรอ M08 ซึ่งเป็น Sprint #2)
    // เลยใช้ default_mode ของประเภทกีฬานั้นแทนการ hardcode 'onsite' มั่วๆ
    const sportType = await SportTypeRepo.findSportTypeById(tournament.sport_type_id);
    const mode = sportType?.default_mode ?? 'onsite';

    const bracketFormat = tournament.bracket_format;

    if (bracketFormat === 'single_elimination') {
        const plan = planSingleElimination(teamIdsInOrder);
        const { matchCount, nodeCount } = await persistSingleElimination(tournamentId, plan, mode);
        return { matchCount, bracketFormat, nodeCount };
    }

    if (bracketFormat === 'round_robin') {
        const pairs = planRoundRobin(teamIdsInOrder);
        const matchCount = await persistRoundRobin(tournamentId, pairs, mode);
        return { matchCount, bracketFormat, nodeCount: 0 };
    }

    if (bracketFormat === 'double_elimination') {
        // จำกัดไว้ก่อนว่าต้องเป็นเลขยกกำลัง 2 พอดี ไม่รองรับ bye ผสมสาย losers (ดู comment ตรง planDoubleElimination)
        if (!isPowerOfTwoAtLeastFour(teamIdsInOrder.length)) {
            throw new AppError(422, "TEAM_COUNT_MISMATCH", "double_elimination รองรับเฉพาะจำนวนทีมที่เป็นเลขยกกำลัง 2 ตั้งแต่ 4 ทีมขึ้นไป (4, 8, 16, ...) ในตอนนี้");
        }
        const plan = planDoubleElimination(teamIdsInOrder);
        const { matchCount, nodeCount } = await persistDoubleElimination(tournamentId, plan, mode);
        return { matchCount, bracketFormat, nodeCount };
    }

    throw new AppError(400, "BRACKET_FORMAT_NOT_SUPPORTED", "ทัวร์นาเมนต์นี้ยังไม่ได้ตั้งรูปแบบการแข่งขัน (bracket_format)");
}

function orderTeamIds(
    approvedTeamIds: number[],
    seedingMethod: 'random' | 'manual',
    manualSeeds: number[] | undefined
): number[] {
    if (seedingMethod === 'random') {
        return shuffle(approvedTeamIds);
    }

    // manual: manualSeeds ต้องเป็นการเรียงลำดับของทีมที่ approved ครบทุกทีม ไม่ขาดไม่เกิน
    const approvedSet = new Set(approvedTeamIds);
    const seeds = manualSeeds ?? [];
    const seedsSet = new Set(seeds);

    const sameSize = seeds.length === approvedTeamIds.length;
    const sameMembers = seeds.every(id => approvedSet.has(id)) && seedsSet.size === seeds.length;

    if (!sameSize || !sameMembers) {
        throw new AppError(422, "MANUAL_SEEDS_MISMATCH", "manualSeeds ต้องมีทีมครบทุกทีมที่ได้รับอนุมัติ ไม่ซ้ำและไม่ขาด");
    }

    return seeds;
}

async function persistSingleElimination(tournamentId: number, plan: PlannedMatch[], mode: 'onsite' | 'online') {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // เก็บ match_id จริงที่เพิ่ง insert ไป โดย key เป็น "round:matchNumber" ไว้เชื่อม next_match_id ทีหลัง
        const matchIdByPosition = new Map<string, number>();
        let matchCount = 0;
        let nodeCount = 0;

        const totalRounds = Math.max(...plan.map(p => p.round));

        for (let round = 1; round <= totalRounds; round++) {
            const matchesInRound = plan.filter(p => p.round === round);

            for (const m of matchesInRound) {
                let matchId: number | null = null;

                if (!m.isBye) {
                    matchId = await MatchRepo.insertMatchTx(conn, {
                        tournamentId,
                        roundNumber: m.round,
                        teamAId: m.teamAId,
                        teamBId: m.teamBId,
                        mode,
                    });
                    matchCount++;
                    matchIdByPosition.set(`${round}:${m.matchNumber}`, matchId);

                    // ถ้า "พ่อแม่" ของช่องนี้ (รอบก่อนหน้า) เป็นแมตช์จริง (ไม่ใช่ bye) ต้องตั้ง next_match_id ให้ชี้มาที่นี่
                    const parentA = matchIdByPosition.get(`${round - 1}:${2 * m.matchNumber - 1}`);
                    const parentB = matchIdByPosition.get(`${round - 1}:${2 * m.matchNumber}`);
                    if (parentA !== undefined) await MatchRepo.updateMatchNextMatchIdTx(conn, parentA, matchId);
                    if (parentB !== undefined) await MatchRepo.updateMatchNextMatchIdTx(conn, parentB, matchId);
                }

                await BracketNodeRepo.insertBracketNodeTx(conn, {
                    tournamentId,
                    nodeCode: `W-R${m.round}-M${m.matchNumber}`,
                    bracketType: 'winners',
                    round: m.round,
                    matchNumber: m.matchNumber,
                    teamAId: m.teamAId,
                    teamBId: m.teamBId,
                    matchId,
                });
                nodeCount++;
            }
        }

        await conn.commit();
        return { matchCount, nodeCount };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function persistDoubleElimination(tournamentId: number, plan: PlannedMatchNode[], mode: 'onsite' | 'online') {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // key แผนผัง (เช่น "WB-1-1") -> match_id จริงใน DB หลัง insert แล้ว
        const dbIdByKey = new Map<MatchKey, number>();
        let matchCount = 0;
        let nodeCount = 0;

        for (const m of plan) {
            const teamAId = m.teamA.kind === 'team' ? m.teamA.teamId : null;
            const teamBId = m.teamB.kind === 'team' ? m.teamB.teamId : null;

            const matchId = await MatchRepo.insertMatchTx(conn, {
                tournamentId,
                roundNumber: m.round,
                teamAId,
                teamBId,
                mode,
            });
            matchCount++;
            dbIdByKey.set(m.key, matchId);

            // ย้อนกลับไปตั้ง next_match_id / loser_next_match_id ให้แมตช์ต้นทาง (สร้างไปแล้วก่อนหน้านี้เสมอ เพราะ plan เรียงตามลำดับ topological)
            for (const source of [m.teamA, m.teamB]) {
                if (source.kind === 'winner') {
                    await MatchRepo.updateMatchNextMatchIdTx(conn, dbIdByKey.get(source.matchKey)!, matchId);
                } else if (source.kind === 'loser') {
                    await MatchRepo.updateMatchLoserNextMatchIdTx(conn, dbIdByKey.get(source.matchKey)!, matchId);
                }
            }

            const nodeCode = m.bracketType === 'grand_final'
                ? `GF-M${m.matchNumber}`
                : `${m.bracketType === 'winners' ? 'W' : 'L'}-R${m.round}-M${m.matchNumber}`;

            await BracketNodeRepo.insertBracketNodeTx(conn, {
                tournamentId,
                nodeCode,
                bracketType: m.bracketType,
                round: m.round,
                matchNumber: m.matchNumber,
                teamAId,
                teamBId,
                matchId,
            });
            nodeCount++;
        }

        await conn.commit();
        return { matchCount, nodeCount };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function persistRoundRobin(tournamentId: number, pairs: RoundRobinPair[], mode: 'onsite' | 'online') {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        for (const pair of pairs) {
            await MatchRepo.insertMatchTx(conn, {
                tournamentId,
                roundNumber: pair.round,
                teamAId: pair.teamAId,
                teamBId: pair.teamBId,
                mode,
            });
        }

        await conn.commit();
        return pairs.length;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

export async function getBracket(tournamentId: number) {
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) {
        throw new AppError(404, "TOURNAMENT_NOT_FOUND", "ไม่พบทัวร์นาเมนต์นี้");
    }

    if (tournament.bracket_format === 'round_robin') {
        return { bracketFormat: tournament.bracket_format, nodes: [] };
    }

    const rows = await BracketNodeRepo.findNodesByTournament(tournamentId);
    return { bracketFormat: tournament.bracket_format, nodes: rows.map(toBracketNodeDto) };
}
