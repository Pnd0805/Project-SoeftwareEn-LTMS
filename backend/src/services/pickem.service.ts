import * as PickemRepo from '../repositories/pickem.repo.js';
import type { MyPickRow, PredictionRow } from '../repositories/pickem.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as FeedbackRepo from '../repositories/feedback.repo.js';
import type { MatchRow, TournamentRow } from '../types/db.js';
import { AppError } from '../utils/AppError.js';

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

export async function predict(matchId: number, userId: number, teamId: number) {
    const match = await getMatchOr404(matchId);
    const tournament = await TournamentRepo.findTournamentById(match.tournament_id);
    assertOpen(match, tournament);
    if (teamId !== match.team_a_id && teamId !== match.team_b_id) {
        throw new AppError(422, 'PICK_TEAM_NOT_IN_MATCH', 'ทายได้เฉพาะสองทีมที่ลงแมตช์นี้');
    }
    const conflict = await conflictOf(match, tournament, userId);
    if (conflict) throw conflict;

    const before = await PickemRepo.findMine(userId, matchId);
    await PickemRepo.upsert(userId, matchId, teamId);
    return {
        isNew: before === null,
        matchId, teamId,
        changed: before !== null && before.predicted_winner_team_id !== teamId,
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
        mine = own ? { teamId: own.predicted_winner_team_id, pointsEarned: own.points_earned, status: pickStatus(own, match.match_status) } : null;
        canPredict = reason === null && (await conflictOf(match, tournament, viewerId)) === null;
    }

    return { matchId, isOpen: reason === null, closedReason: reason, closesAt: match.scheduled_time, total, teams, mine, canPredict };
}

export async function getMine(matchId: number, userId: number) {
    const match = await getMatchOr404(matchId);
    const own = await PickemRepo.findMine(userId, matchId);
    return own ? { matchId, teamId: own.predicted_winner_team_id, pointsEarned: own.points_earned, status: pickStatus(own, match.match_status) } : null;
}

function toHistoryItem(row: MyPickRow) {
    return {
        matchId: row.match_id,
        tournament: { id: row.tournament_id, name: row.tournament_name },
        teamA: row.team_a_id === null ? null : { id: row.team_a_id, name: row.team_a_name },
        teamB: row.team_b_id === null ? null : { id: row.team_b_id, name: row.team_b_name },
        predicted: { id: row.predicted_winner_team_id, name: row.predicted_team_name },
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

/** อันดับ Pick'em ในทัวร์ (สาธารณะ) · แต้มเท่ากันได้อันดับเดียวกัน (1,1,3) */
export async function getLeaderboard(tournamentId: number) {
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) throw new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้');
    const rows = await PickemRepo.findLeaderboard(tournamentId);
    let rank = 0;
    return {
        items: rows.map((r, i) => {
            if (i === 0 || r.points !== rows[i - 1]!.points || r.correct !== rows[i - 1]!.correct) rank = i + 1;
            return { rank, user: { id: r.user_id, fullName: r.full_name, avatarUrl: r.profile_image_key },
                     points: r.points, correct: r.correct, settled: r.settled };
        }),
    };
}
