import type { FollowerRow, FollowingTeamRow, FollowingUserRow } from '../repositories/follow.repo.js';
import type { CareerRow } from '../repositories/profile.repo.js';

export function toFollowerDto(row: FollowerRow | FollowingUserRow) {
    return { id: row.user_id, fullName: row.full_name, avatarUrl: row.profile_image_key, followedAt: row.followed_at };
}

export function toFollowingTeamDto(row: FollowingTeamRow) {
    return { id: row.team_id, name: row.name, sportTypeId: row.sport_type_id, followedAt: row.followed_at };
}

export function toCareerItemDto(row: CareerRow) {
    const played = Number(row.played);
    const wins = Number(row.wins);
    return {
        tournament: { id: row.tournament_id, name: row.tournament_name, sportTypeId: row.sport_type_id, status: row.tournament_status },
        team: { id: row.team_id, name: row.team_name },
        played,
        wins,
        losses: played - wins,
        champion: row.champion_team_id !== null && row.champion_team_id === row.team_id,
    };
}
