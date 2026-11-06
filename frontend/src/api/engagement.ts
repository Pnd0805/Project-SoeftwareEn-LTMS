import { apiFetch, ApiError, mockDelay, USE_MOCK } from "./client"

/** Real player following uses BE_KN; unsupported prototype-only routes remain unavailable. */
const unavailable = <T>(what: string): Promise<T> =>
  Promise.reject(new ApiError(501, { code: "ENDPOINT_UNAVAILABLE", message: `${what} ยังไม่มีใน backend` }));
import type {
  CommentListDto,
  FollowListDto,
  FollowNotificationDto,
  MvpVoteListDto,
  PickListDto,
} from "../types/engagement.dto"
import {
  getMockFollows,
  mockFollow,
  mockUnfollow,
  mockSetFollowNotifications,
} from "../mocks/engagement.mock"
import { getMockMvpVotes, mockCastMvpVote } from "../mocks/mvp.mock"
import {
  getMockComments,
  mockPostComment,
  mockRemoveComment,
} from "../mocks/comment.mock"
import { getMockPicks, mockPlacePick } from "../mocks/pick.mock"
import { numOf } from '../mocks/storeBridge'

export async function getFollows(userId: number): Promise<FollowListDto> {
  if (USE_MOCK) return mockDelay(getMockFollows(userId))

  const data = await apiFetch<{ items: NonNullable<FollowListDto['items']> }>("/me/following")
  return { targets: data.items.map(row => `player:${row.id}`), items: data.items,
    notifications: Object.fromEntries(data.items.filter(row => typeof row.notifyEnabled === 'boolean').map(row => [`player:${row.id}`, row.notifyEnabled!])) }
}

export async function follow(
  userId: number,
  target: string,
  current?: FollowListDto,
): Promise<FollowListDto> {
  if (USE_MOCK) return mockDelay(mockFollow(userId, target))

  const matched = /^player:([1-9]\d*)$/.exec(target)
  if (!matched) return unavailable<FollowListDto>("Team following")
  const result = await apiFetch<{ notifyEnabled?: boolean }>(`/users/${matched[1]}/follow`, { method: "POST" })
  if (current) return { ...current, targets: [...new Set([...current.targets, target])],
    notifications: { ...current.notifications, ...(typeof result.notifyEnabled === 'boolean' ? { [target]: result.notifyEnabled } : {}) } }
  return getFollows(userId)
}

export async function setFollowNotifications(userId: number, target: string, notifyEnabled: boolean, current: FollowListDto): Promise<FollowNotificationDto> {
  if (!current.targets.includes(target)) throw new ApiError(404, { code: 'NOT_FOLLOWING', message: 'Follow this player before enabling notifications.' })
  const matched = /^player:([1-9]\d*)$/.exec(target)
  if (!USE_MOCK && !matched) return unavailable('Team notifications')
  // รุ่นเก่ายังไม่มี PATCH นี้: ต้องเห็น boolean จาก server ก่อน จึงไม่ยิงเส้นที่ยังไม่ส่งมอบ
  if (!USE_MOCK && typeof current.notifications?.[target] !== 'boolean') return unavailable('Player notifications')
  if (USE_MOCK) {
    if (!getMockFollows(userId).targets.includes(target)) throw new ApiError(404, { code: 'NOT_FOLLOWING', message: 'Follow this player before enabling notifications.' })
    mockSetFollowNotifications(userId, target, notifyEnabled)
    return mockDelay({ userId: matched ? Number(matched[1]) : numOf(target.slice(7)), isFollowing: true, notifyEnabled })
  }
  if (!matched) return unavailable('Player notifications')
  const result = await apiFetch<FollowNotificationDto>(`/users/${matched[1]}/follow`, { method: 'PATCH', body: JSON.stringify({ notifyEnabled }) })
  if (!result || result.userId !== Number(matched[1]) || result.isFollowing !== true || typeof result.notifyEnabled !== 'boolean') {
    throw new ApiError(502, { code: 'INVALID_RESPONSE', message: 'Could not confirm player notification preferences. Please retry.' })
  }
  return result
}

export async function unfollow(
  userId: number,
  target: string,
): Promise<FollowListDto> {
  if (USE_MOCK) return mockDelay(mockUnfollow(userId, target))

  const matched = /^player:([1-9]\d*)$/.exec(target)
  if (!matched) return unavailable<FollowListDto>("Team following")
  await apiFetch(`/users/${matched[1]}/follow`, { method: "DELETE" })
  return getFollows(userId)
}

export async function getMvpVotes(
  tournamentId: string,
  userId: string,
): Promise<MvpVoteListDto> {
  if (USE_MOCK) return mockDelay(getMockMvpVotes(tournamentId, userId))

  return unavailable<MvpVoteListDto>("การโหวต MVP")
}

export async function castMvpVote(
  tournamentId: string,
  userId: string,
  playerId: string,
): Promise<MvpVoteListDto> {
  if (USE_MOCK) return mockDelay(mockCastMvpVote(tournamentId, userId, playerId))

  void playerId;
  return unavailable<MvpVoteListDto>("การโหวต MVP")
}

export async function getComments(matchId: string): Promise<CommentListDto> {
  if (USE_MOCK) return mockDelay(getMockComments(matchId))

  return unavailable<CommentListDto>("คอมเมนต์ใต้แมตช์ (FR-CM-01)")
}

export async function postComment(
  matchId: string,
  userId: string,
  userName: string,
  text: string,
): Promise<CommentListDto> {
  if (USE_MOCK) return mockDelay(mockPostComment(matchId, userId, userName, text))

  void text;
  return unavailable<CommentListDto>("การโพสต์คอมเมนต์ (FR-CM-01)")
}

export async function removeComment(
  matchId: string,
  commentId: string,
): Promise<CommentListDto> {
  if (USE_MOCK) return mockDelay(mockRemoveComment(matchId, commentId))

  void commentId;
  return unavailable<CommentListDto>("การลบคอมเมนต์")
}

export async function getPicks(matchId: string, userId: string): Promise<PickListDto> {
  if (USE_MOCK) return mockDelay(getMockPicks(matchId, userId))

  return unavailable<PickListDto>("Pick'em ทายผล (FR-PK-01)")
}

export async function placePick(
  matchId: string,
  userId: string,
  teamId: string,
): Promise<PickListDto> {
  if (USE_MOCK) return mockDelay(mockPlacePick(matchId, userId, teamId))

  void teamId;
  return unavailable<PickListDto>("การทายผล (FR-PK-01)")
}
