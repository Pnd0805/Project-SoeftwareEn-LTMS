export interface FollowListDto {
  targets: string[]
}

export interface MvpVoteDto {
  id: string
  tournamentId: string
  userId: string
  playerId: string
}

export interface MvpVoteListDto {
  items: MvpVoteDto[]
  mine: MvpVoteDto | null
}