import { ApiError, mockDelay, USE_MOCK } from "./client"

/**
 * ทั้งไฟล์นี้เป็นฟีเจอร์โซเชียล (ติดตาม · โหวต MVP · คอมเมนต์ · ทายผล)
 * ซึ่ง backend ยังไม่มี endpoint ให้เลยสักตัว — โหมดจริงจึงตอบ 501 ทุกเส้น
 * แทนที่จะยิงไปพาธที่เดาไว้แล้วได้ 404 (ดู FEAT-1-REMAINING)
 */
const unavailable = <T>(what: string): Promise<T> =>
  Promise.reject(new ApiError(501, { code: "ENDPOINT_UNAVAILABLE", message: `${what} ยังไม่มีใน backend` }));
import type {
  CommentListDto,
  FollowListDto,
  MvpVoteListDto,
  PickListDto,
} from "../types/engagement.dto"
import {
  getMockFollows,
  mockFollow,
  mockUnfollow,
} from "../mocks/engagement.mock"
import { getMockMvpVotes, mockCastMvpVote } from "../mocks/mvp.mock"
import {
  getMockComments,
  mockPostComment,
  mockRemoveComment,
} from "../mocks/comment.mock"
import { getMockPicks, mockPlacePick } from "../mocks/pick.mock"

export async function getFollows(userId: number): Promise<FollowListDto> {
  if (USE_MOCK) return mockDelay(getMockFollows(userId))

  return unavailable<FollowListDto>("รายการติดตาม (/me/follows)")
}

export async function follow(
  userId: number,
  target: string,
): Promise<FollowListDto> {
  if (USE_MOCK) return mockDelay(mockFollow(userId, target))

  void target;
  return unavailable<FollowListDto>("การกดติดตาม")
}

export async function unfollow(
  userId: number,
  target: string,
): Promise<FollowListDto> {
  if (USE_MOCK) return mockDelay(mockUnfollow(userId, target))

  void target;
  return unavailable<FollowListDto>("การเลิกติดตาม")
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