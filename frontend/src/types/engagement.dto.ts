export interface FollowListDto {
  targets: string[]
  items?: { id: number; fullName: string; avatarUrl: string | null; notifyEnabled?: boolean }[]
  /** Missing means this server has not delivered follower notifications yet. */
  notifications?: Record<string, boolean>
}

export interface FollowNotificationDto {
  userId: number
  isFollowing: true
  notifyEnabled: boolean
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

export interface PickDto {
  id: string
  matchId: string
  userId: string
  teamId: string
}

export interface PickListDto {
  items: PickDto[]
  mine: PickDto | null
}
