import { apiFetch, mockDelay, USE_MOCK } from "./client"
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

  // TODO(guide): confirm the follows endpoint path.
  return apiFetch<FollowListDto>("/me/follows")
}

export async function follow(
  userId: number,
  target: string,
): Promise<FollowListDto> {
  if (USE_MOCK) return mockDelay(mockFollow(userId, target))

  // TODO(guide): confirm the follow action endpoint.
  return apiFetch<FollowListDto>("/me/follows", {
    method: "POST",
    body: JSON.stringify({ target }),
  })
}

export async function unfollow(
  userId: number,
  target: string,
): Promise<FollowListDto> {
  if (USE_MOCK) return mockDelay(mockUnfollow(userId, target))

  // TODO(guide): confirm the unfollow action endpoint.
  return apiFetch<FollowListDto>(
    `/me/follows/${encodeURIComponent(target)}`,
    { method: "DELETE" },
  )
}

export async function getMvpVotes(
  tournamentId: string,
  userId: string,
): Promise<MvpVoteListDto> {
  if (USE_MOCK) return mockDelay(getMockMvpVotes(tournamentId, userId))

  // TODO(guide): confirm the MVP vote list endpoint path.
  return apiFetch<MvpVoteListDto>(
    `/tournaments/${encodeURIComponent(tournamentId)}/mvp-votes`,
  )
}

export async function castMvpVote(
  tournamentId: string,
  userId: string,
  playerId: string,
): Promise<MvpVoteListDto> {
  if (USE_MOCK) return mockDelay(mockCastMvpVote(tournamentId, userId, playerId))

  // TODO(guide): confirm the MVP vote action endpoint path.
  return apiFetch<MvpVoteListDto>(
    `/tournaments/${encodeURIComponent(tournamentId)}/mvp-votes`,
    {
      method: "POST",
      body: JSON.stringify({ playerId }),
    },
  )
}

export async function getComments(matchId: string): Promise<CommentListDto> {
  if (USE_MOCK) return mockDelay(getMockComments(matchId))

  // TODO(guide): confirm the match comments endpoint path.
  return apiFetch<CommentListDto>(`/matches/${encodeURIComponent(matchId)}/comments`)
}

export async function postComment(
  matchId: string,
  userId: string,
  userName: string,
  text: string,
): Promise<CommentListDto> {
  if (USE_MOCK) return mockDelay(mockPostComment(matchId, userId, userName, text))

  // TODO(guide): confirm the match comment action endpoint path.
  return apiFetch<CommentListDto>(`/matches/${encodeURIComponent(matchId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  })
}

export async function removeComment(
  matchId: string,
  commentId: string,
): Promise<CommentListDto> {
  if (USE_MOCK) return mockDelay(mockRemoveComment(matchId, commentId))

  // TODO(guide): confirm the comment delete endpoint path.
  return apiFetch<CommentListDto>(
    `/matches/${encodeURIComponent(matchId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" },
  )
}

export async function getPicks(matchId: string, userId: string): Promise<PickListDto> {
  if (USE_MOCK) return mockDelay(getMockPicks(matchId, userId))

  // TODO(guide): confirm the match Pick'em list endpoint path.
  return apiFetch<PickListDto>(`/matches/${encodeURIComponent(matchId)}/picks`)
}

export async function placePick(
  matchId: string,
  userId: string,
  teamId: string,
): Promise<PickListDto> {
  if (USE_MOCK) return mockDelay(mockPlacePick(matchId, userId, teamId))

  // TODO(guide): confirm the Pick'em action endpoint path.
  return apiFetch<PickListDto>(`/matches/${encodeURIComponent(matchId)}/picks`, {
    method: "POST",
    body: JSON.stringify({ teamId }),
  })
}