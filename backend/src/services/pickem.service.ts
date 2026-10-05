import * as PickemRepo from '../repositories/pickem.repo.js';
import type { MyPickRow, PredictionRow } from '../repositories/pickem.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as FeedbackRepo from '../repositories/feedback.repo.js';
import type { MatchRow, TournamentRow } from '../types/db.js';
import { AppError } from '../utils/AppError.js';
import { isBestOf , scorePairError , possibleScores } from '../utils/matchFormat.js';
import { toPublicImageUrl } from '../utils/imageUrl.js';

/**
 * C7 — Pick'em (FR-PK-01 · spec 08 §6 · OD-24 มติ 22 ก.ย. 2569)
 *   cutoff: แมตช์ออกจาก scheduled (เปิดเช็คอิน) หรือถึงเวลาแข่ง อย่างไหนถึงก่อน
 *   ทายถูก 10 แต้ม · ผิด 0 · ให้แต้มเฉพาะผลที่ยืนยันแล้ว — ชนะบาย/ปรับแพ้/แมตช์ที่ไม่มีการแข่ง = void (ไม่ได้ไม่เสีย)
 *   ห้ามทาย: คนในทัวร์ทั้งหมด (ผู้เล่นในรายชื่อ · สมาชิกทีมที่ผ่าน · กรรมการ · ผู้จัด) — กฎเดียวกับโหวต MVP
 *   ทาย/เปลี่ยน/ยกเลิก ได้จนถึง cutoff · ทายได้เมื่อรู้ทั้งสองทีมแล้ว
 *   ทัวร์ต้อง public (มติ 22 ก.ย.) — ORG unpublish กลับเป็น private แล้วทาย/ยกเลิกไม่ได้ (อ่านสรุปได้เหมือนหน้าแมตช์)
 */

type CutoffReason = 'teams_not_set' | 'checkin_open' | 'match_started' | 'time_passed';
type ClosedReason = CutoffReason | 'tournament_not_public';

/** เหตุผลที่ทายไม่ได้ตอนนี้ (null = ยังทายได้) */
export function cutoffReason(match: MatchRow, now = new Date()): CutoffReason | null {
    if (match.match_status !== 'scheduled') {
        return match.match_status === 'checkin_open' ? 'checkin_open' : 'match_started';
    }
    if (match.scheduled_time && now >= new Date(match.scheduled_time)) return 'time_passed';
    if (match.team_a_id === null || match.team_b_id === null) return 'teams_not_set';
    return null;
}

const CLOSED_MESSAGE: Record<ClosedReason, string> = {
    tournament_not_public: 'ทัวร์นาเมนต์นี้ไม่ได้เปิดเผยแพร่ ทายผลไม่ได้',
    teams_not_set: 'แมตช์นี้ยังไม่รู้ทั้งสองทีม (รอผลรอบก่อน) ยังทายไม่ได้',
    checkin_open: 'ปิดทายผลแล้ว — แมตช์เปิดเช็คอินแล้ว',
    match_started: 'ปิดทายผลแล้ว — แมตช์เริ่มหรือจบไปแล้ว',
    time_passed: 'ปิดทายผลแล้ว — ถึงเวลาแข่งแล้ว',
};

async function getMatchOr404(matchId: number): Promise<MatchRow> {
    const match = await MatchRepo.findById(matchId);
    if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', 'ไม่พบแมตช์นี้');
    return match;
}

/** เหตุผลของแมตช์มาก่อน (แมตช์จบแล้วบอกว่าจบ) แล้วค่อยดูว่าทัวร์ยังเปิดเผยแพร่อยู่ไหม */
function closedReason(match: MatchRow, tournament: TournamentRow | null): ClosedReason | null {
    return cutoffReason(match) ?? (tournament?.tournament_status === 'public' ? null : 'tournament_not_public');
}

function assertOpen(match: MatchRow, tournament: TournamentRow | null): void {
    const reason = closedReason(match, tournament);
    if (reason === 'teams_not_set') throw new AppError(409, 'PICKEM_TEAMS_NOT_SET', CLOSED_MESSAGE[reason]);
    if (reason === 'tournament_not_public') throw new AppError(409, 'TOURNAMENT_NOT_PUBLIC', CLOSED_MESSAGE[reason]);
    if (reason) throw new AppError(409, 'PICKEM_CLOSED', CLOSED_MESSAGE[reason], { reason });
}

/** คนในทัวร์ทายไม่ได้ — เช็คจากทัวร์ของแมตช์ */
async function conflictOf(match: MatchRow, tournament: TournamentRow | null, userId: number): Promise<AppError | null> {
    if (tournament?.requested_by_user_id === userId || await FeedbackRepo.isTournamentInsider(match.tournament_id, userId)) {
        return new AppError(403, 'PICKEM_CONFLICT', 'ผู้เล่น สมาชิกทีม กรรมการ และผู้จัดของทัวร์นาเมนต์นี้ทายผลไม่ได้');
    }
    return null;
}

/** สถานะของการทาย — void = แมตช์จบโดยไม่มีผลยืนยัน (ชนะบาย/ปรับแพ้/แมตช์ตาย) จึงไม่ได้ไม่เสีย */
export function pickStatus(pick: Pick<PredictionRow, 'points_earned'>, matchStatus: string): 'pending' | 'won' | 'lost' | 'void' {
    if (pick.points_earned === null) return matchStatus === 'completed' ? 'void' : 'pending';
    return pick.points_earned > 0 ? 'won' : 'lost';
}

// ───────── ทาย / ยกเลิก ─────────

/**
 * OD-56 (4 ต.ค.) — ตรวจสกอร์ที่ทาย แล้วคืนผู้ชนะที่อนุมานได้
 *
 * ★ แยกเป็นฟังก์ชันเพื่อให้ตรึงด้วยเทสได้ตรง ๆ และเพื่อให้สูตรคะแนน (ก้าวที่สอง)
 *   เอาตรรกะชุดเดียวกันไปใช้ได้โดยไม่ต้องลอก
 *
 * ★ เงื่อนไข key ชุดเดียวกับ ensureScoreData ของผลการแข่ง (matchResult.service) โดยเจตนา
 *   ถ้าสองฝั่งใช้กฎไม่ตรงกัน จะมีเคสที่ "ทายได้แต่ผลจริงใส่ไม่ได้" หรือกลับกัน
 *   แล้วการเทียบสกอร์ตอนคิดคะแนนจะเจอรูปร่างที่ไม่คาด
 */
export function resolvePredictedWinner(match: MatchRow, scoreData: Record<string, number>): number {
    const teamIds = [match.team_a_id, match.team_b_id].map(String);
    const keys = Object.keys(scoreData);
    if (keys.length !== 2 || !teamIds.every(id => keys.includes(id))) {
        throw new AppError(422, 'PICK_TEAM_NOT_IN_MATCH',
            `ต้องทายคะแนนของสองทีมที่ลงแมตช์นี้ (${teamIds.join(', ')}) เท่านั้น`,
            { fields: { scoreData: `key ต้องเป็น ${teamIds.join(' และ ')}` }, expectedKeys: teamIds });
    }

    const a = scoreData[teamIds[0]!]!, b = scoreData[teamIds[1]!]!;
    if (a === b) {
        // ระบบไม่รองรับผลเสมอ (ensureScoreData บังคับผู้ชนะต้องแต้มมากกว่า) ⇒ ทายเสมอก็อนุมานผู้ชนะไม่ได้
        throw new AppError(422, 'PICK_SCORE_TIE', 'ทายผลเสมอไม่ได้ — ต้องมีฝ่ายที่คะแนนมากกว่า',
            { fields: { scoreData: 'คะแนนสองฝั่งต้องไม่เท่ากัน' } });
    }
    // 🆕 BO-N (มติ 5 ต.ค.) — ด่านเดียวกับข้อ d. ของ ensureScoreData และเรียกสูตรตัวเดียวกัน
    // ★ ต้องตรวจที่นี่ด้วย ไม่ใช่แค่ตอนส่งผล: ถ้าคนทาย 3-1 ไว้ในแมตช์ BO3 ผลจริงจะไม่มีทาง
    //   เป็น 3-1 ได้เลย ⇒ ใบนั้นแพ้แน่นอนตั้งแต่กดส่ง ซึ่งไม่ใช่ความผิดของผู้ใช้ แต่เป็นของเรา
    //   ที่ปล่อยให้กรอกค่าที่เป็นไปไม่ได้ ⇒ บอกเขาตอนกดส่งดีกว่าให้รู้ตอนแพ้
    // 🔴 ใช้ 422 ไม่ใช่ 400 ตามแบบของเส้นนี้ (PICK_* ทั้งหมดเป็น 422)
    if (isBestOf(match.best_of)) {
        const problem = scorePairError(match.best_of, Math.max(a, b), Math.min(a, b));
        if (problem !== null) {
            throw new AppError(422, 'PICK_SCORE_NOT_IN_MATCH_FORMAT', problem,
                { fields: { scoreData: problem },
                  bestOf: match.best_of, possibleScores: possibleScores(match.best_of) });
        }
    }

    return a > b ? Number(teamIds[0]) : Number(teamIds[1]);
}

/** เทียบสกอร์สองก้อนว่าเหมือนกันทุก key ไหม — ใช้บอกว่า "เปลี่ยนการทาย" จริงหรือกดซ้ำ */
function sameScore(x: Record<string, number> | null, y: Record<string, number>): boolean {
    if (x === null) return false;
    const kx = Object.keys(x);
    return kx.length === Object.keys(y).length && kx.every(k => x[k] === y[k]);
}

export async function predict(matchId: number, userId: number, scoreData: Record<string, number>) {
    const match = await getMatchOr404(matchId);
    const tournament = await TournamentRepo.findTournamentById(match.tournament_id);
    assertOpen(match, tournament);

    // ★ อนุมานผู้ชนะจากสกอร์ — ไม่รับ teamId จาก request อีกแล้ว (OD-56 มติข้อ ①)
    const teamId = resolvePredictedWinner(match, scoreData);

    const conflict = await conflictOf(match, tournament, userId);
    if (conflict) throw conflict;

    const before = await PickemRepo.findMine(userId, matchId);
    await PickemRepo.upsert(userId, matchId, teamId, scoreData);
    return {
        isNew: before === null,
        // ★ คง `teamId` ไว้ใน response ทั้งที่ request ไม่ส่งมาแล้ว — FE (feat/1) ใช้ type
        //   `{ matchId, teamId, changed }` อยู่ ⇒ เปลี่ยนแค่ขาส่ง ขารับไม่ต้องแก้
        matchId, teamId, scoreData,
        // เปลี่ยนผู้ชนะ **หรือ** เปลี่ยนแค่สกอร์ ก็ถือว่าเปลี่ยน — ของเดิมดูแค่ผู้ชนะ
        // ซึ่งจะทำให้ "2-1 → 5-0" รายงานว่าไม่มีอะไรเปลี่ยน ทั้งที่โบนัสสกอร์ต่างกันคนละเรื่อง
        changed: before !== null
                 && (before.predicted_winner_team_id !== teamId || !sameScore(before.predicted_score_data, scoreData)),
    };
}

/** ยกเลิกการทาย (ก่อน cutoff) — ไม่ได้ทายไว้ก็ไม่ error */
export async function cancelPrediction(matchId: number, userId: number): Promise<void> {
    const match = await getMatchOr404(matchId);
    assertOpen(match, await TournamentRepo.findTournamentById(match.tournament_id));
    await PickemRepo.remove(userId, matchId);
}

// ───────── อ่าน ─────────

/** สรุปผลทายของแมตช์ (สาธารณะ) + ของตัวเอง + canPredict ถ้าล็อกอิน */
export async function getSummary(matchId: number, viewerId?: number) {
    const match = await getMatchOr404(matchId);
    const counts = await PickemRepo.countByTeam(matchId);
    const total = counts.reduce((sum, c) => sum + c.picks, 0);
    const teams = [match.team_a_id, match.team_b_id].filter((id): id is number => id !== null).map(teamId => {
        const picks = counts.find(c => c.team_id === teamId)?.picks ?? 0;
        return { teamId, picks, percent: total === 0 ? 0 : Math.round((picks / total) * 100) };
    });
    // ปัดเศษแยกกันอาจรวมได้ 101 (เช่น 5:3 → 63+38) → ให้ทีมสุดท้ายเป็นส่วนที่เหลือ
    if (total > 0 && teams.length === 2) teams[1]!.percent = 100 - teams[0]!.percent;
    const tournament = await TournamentRepo.findTournamentById(match.tournament_id);
    const reason = closedReason(match, tournament);

    let mine = null;
    let canPredict = false;
    if (viewerId !== undefined) {
        const own = await PickemRepo.findMine(viewerId, matchId);
        mine = own ? { teamId: own.predicted_winner_team_id, scoreData: own.predicted_score_data,
                       pointsEarned: own.points_earned, status: pickStatus(own, match.match_status) } : null;
        canPredict = reason === null && (await conflictOf(match, tournament, viewerId)) === null;
    }

    return { matchId, isOpen: reason === null, closedReason: reason, closesAt: match.scheduled_time, total, teams, mine, canPredict };
}

export async function getMine(matchId: number, userId: number) {
    const match = await getMatchOr404(matchId);
    const own = await PickemRepo.findMine(userId, matchId);
    // OD-56 — คืน scoreData กลับมาด้วย เพราะ FE ต้องเอาไปเติมฟอร์มตอนแก้การทาย
    // null = แถวก่อน migration 038 (ทายแค่ฝั่ง ไม่มีสกอร์เก่าให้เติม)
    return own ? { matchId, teamId: own.predicted_winner_team_id, scoreData: own.predicted_score_data,
                   pointsEarned: own.points_earned, status: pickStatus(own, match.match_status) } : null;
}

function toHistoryItem(row: MyPickRow) {
    return {
        matchId: row.match_id,
        tournament: { id: row.tournament_id, name: row.tournament_name },
        teamA: row.team_a_id === null ? null : { id: row.team_a_id, name: row.team_a_name },
        teamB: row.team_b_id === null ? null : { id: row.team_b_id, name: row.team_b_name },
        predicted: { id: row.predicted_winner_team_id, name: row.predicted_team_name },
        scoreData: row.predicted_score_data,   // OD-56 · null = แถวก่อน migration 038
        scheduledTime: row.scheduled_time,
        pointsEarned: row.points_earned,
        status: pickStatus(row, row.match_status),
        createdAt: row.created_at,
    };
}

/** ประวัติการทายของตัวเอง + แต้มรวม (users.total_points) */
export async function getMyHistory(userId: number) {
    const rows = await PickemRepo.findHistory(userId);
    const items = rows.map(toHistoryItem);
    return {
        totalPoints: await PickemRepo.findTotalPoints(userId),
        correct: items.filter(i => i.status === 'won').length,
        settled: items.filter(i => i.status === 'won' || i.status === 'lost').length,
        items,
    };
}

/**
 * E29 — แต้ม + อันดับของตัวเองในทัวร์เดียว
 *
 * มีเพราะ E28 คืนมาทั้งทัวร์และไม่มี pagination ⇒ FE ที่อยากโชว์แค่ "ของฉัน" ต้องโหลดทั้งก้อนมาหาแถวตัวเอง
 *
 * ★ ยังไม่มีการทายที่ตัดสินแล้วในทัวร์นี้ → `rank: null` และแต้มเป็น **0 ไม่ใช่ null**
 *   ต่างจาก U04 ที่ซ่อนสถิติแล้วส่ง null ทั้งชุด — ที่นั่น null แปลว่า "ไม่บอก" ส่วนที่นี่
 *   0 แต้มเป็นความจริง (ยังไม่ได้แต้ม) แต่ **อันดับยังไม่มีจริง** จึงเป็น null
 *   ถ้าส่ง rank เป็นเลขอะไรไปด้วยจะกลายเป็นโกหกว่าอยู่อันดับท้ายตาราง ทั้งที่ไม่ได้อยู่ในตารางเลย
 *
 * ไม่เช็คว่าทัวร์ public ไหม — กฎเดียวกับ E28 ที่อ่านได้ตลอด (ตั้งใจไม่เพิ่มกฎใหม่ให้ต่างกัน)
 */
export async function getMyStanding(tournamentId: number, userId: number) {
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) throw new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้');
    const row = await PickemRepo.findMyStanding(tournamentId, userId);
    if (row === null) return { tournamentId, points: 0, correct: 0, settled: 0, rank: null };
    return { tournamentId, points: row.points, correct: row.correct, settled: row.settled, rank: row.rank_no };
}

/** อันดับ Pick'em ในทัวร์ (สาธารณะ) · แต้มเท่ากันได้อันดับเดียวกัน (1,1,3) */
export async function getLeaderboard(tournamentId: number) {
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) throw new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้');
    const rows = await PickemRepo.findLeaderboard(tournamentId);
    let rank = 0;
    return {
        items: rows.map((r, i) => {
            if (i === 0 || r.points !== rows[i - 1]!.points || r.correct !== rows[i - 1]!.correct) rank = i + 1;
            return { rank, user: { id: r.user_id, fullName: r.full_name, avatarUrl: toPublicImageUrl(r.profile_image_key) },
                     points: r.points, correct: r.correct, settled: r.settled };
        }),
    };
}
