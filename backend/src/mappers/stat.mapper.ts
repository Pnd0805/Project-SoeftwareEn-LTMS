import type { UserProfileTotalsRow, UserSportStatRow } from "../repositories/playerStat.repo.js";

export type SportStatDto = {
    sportTypeId : number,
    sportName : string,
    matchesPlayed : number,
    wins : number,
    losses : number
};

export type OverAllStat = {
    matchesPlayed : number,
    wins : number
    losses : number,
    winRate : number,
    championCount : number

}

export type UserStatsDto = {
    userId : number,
    /**
     * OD-46 — เจ้าของโปรไฟล์ปิดการแสดงสถิติไว้ และคนที่ดูอยู่ไม่ใช่เจ้าตัว/แอดมิน
     *
     * true แล้วช่องสถิติเป็น null **ทั้งหมด ไม่ใช่ 0** โดยเจตนา — 0 อ่านได้ว่า "ลงแข่งแล้วไม่เคยชนะ"
     * ซึ่งเป็นคำตอบที่ผิดและหน้าจอแยกจากของจริงไม่ออก · null บังคับให้ FE ตัดสินใจว่าจะแสดงอะไร
     *
     * `followerCount` ก็เป็น null ด้วยไม่ได้ยกเว้น — ไม่เสียอะไรเพราะ U01 (GET /users/:id) คืนให้อยู่แล้ว
     */
    statsHidden : boolean,
    overall : OverAllStat | null,
    bySport : SportStatDto[] | null,
    mvpVotes: number | null,
    pickemPoints: number | null,
    followerCount: number | null
}

/** สถิติที่ถูกซ่อน — ไม่ส่งตัวเลขอะไรออกไปเลย แม้แต่ 0 */
export function hiddenUserStatsDto(userId : number) : UserStatsDto{
    return { userId , statsHidden : true , overall : null , bySport : null ,
             mvpVotes : null , pickemPoints : null , followerCount : null };
}

export function toSportStatDto(row : UserSportStatRow): SportStatDto{
    return {
        sportTypeId : row.sport_type_id,
        sportName : row.sport_name,
        matchesPlayed : row.matches_played,
        wins : row.wins,
        losses : row.losses
    };
};

export function toUserStatsDto(
    userId: number,
    rows: UserSportStatRow[],
    totals: UserProfileTotalsRow = { mvp_votes: 0, pickem_points: 0, follower_count: 0 }
): UserStatsDto {
    let matchesPlayed = 0, wins = 0, losses = 0, championCount = 0;
    for (const r of rows) {
        matchesPlayed += r.matches_played;
        wins += r.wins;
        losses += r.losses;
        championCount += r.championships;
    }
    const winRate = matchesPlayed === 0 ? 0 : wins / matchesPlayed;

    return {
        userId,
        statsHidden: false,
        overall: {
            matchesPlayed,
            wins,
            losses,
            winRate,
            championCount,
        },
        bySport: rows.map(toSportStatDto),
        mvpVotes: Number(totals.mvp_votes),
        pickemPoints: Number(totals.pickem_points),
        followerCount: Number(totals.follower_count),
    };
}