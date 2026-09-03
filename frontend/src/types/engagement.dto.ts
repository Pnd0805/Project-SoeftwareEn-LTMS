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

export interface CommentDto {
  id: string
  matchId: string
  userId: string
  userName: string
  text: string
  createdAt: string
}

export interface CommentListDto {
  items: CommentDto[]
}