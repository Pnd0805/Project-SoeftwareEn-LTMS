import type { UserSportStatRow } from "../repositories/playerStat.repo.js";

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
    overall : OverAllStat, 
    bySport : SportStatDto[]
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

export  function toUserStatsDto(userId : number , rows: UserSportStatRow[]) : UserStatsDto{
    let  matchesPlayed = 0, wins = 0, losses = 0, championCount = 0;
    for(const r of rows){
        matchesPlayed += r.matches_played
        wins += r.wins;
        losses += r.losses;
        championCount += r.championships
    }
    const winRate = matchesPlayed === 0 ? 0 : wins / matchesPlayed;

    const ov = { matchesPlayed : matchesPlayed,
        wins : wins,
        losses : losses,
        winRate : winRate,
        championCount : championCount
    };

    return {
        userId : userId,
        overall : ov,
        bySport : rows.map(toSportStatDto)
    }
}