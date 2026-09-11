import pool from '../config/db.js';
import * as ApplicationRepo from '../repositories/application.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as BracketNodeRepo from '../repositories/bracketNode.repo.js';
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

export async function createBracket(
    tournamentId: number,
    userId: number,
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

    const bracketFormat = tournament.bracket_format;

    if (bracketFormat === 'single_elimination') {
        const plan = planSingleElimination(teamIdsInOrder);
        const { matchCount, nodeCount } = await persistSingleElimination(tournamentId, plan);
        return { matchCount, bracketFormat, nodeCount };
    }

    if (bracketFormat === 'round_robin') {
        const pairs = planRoundRobin(teamIdsInOrder);
        const matchCount = await persistRoundRobin(tournamentId, pairs);
        return { matchCount, bracketFormat, nodeCount: 0 };
    }

    // double_elimination ยังไม่ทำ — ตัดสินใจเลื่อนออกไปเพราะซับซ้อนสุดและเวลาจำกัด (ต้องคุยทีม)
    throw new AppError(400, "BRACKET_FORMAT_NOT_SUPPORTED", "ระบบยังไม่รองรับ double_elimination ในตอนนี้");
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

async function persistSingleElimination(tournamentId: number, plan: PlannedMatch[]) {
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

async function persistRoundRobin(tournamentId: number, pairs: RoundRobinPair[]) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        for (const pair of pairs) {
            await MatchRepo.insertMatchTx(conn, {
                tournamentId,
                roundNumber: pair.round,
                teamAId: pair.teamAId,
                teamBId: pair.teamBId,
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
