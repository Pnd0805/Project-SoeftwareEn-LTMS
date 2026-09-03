import { apiFetch, mockDelay, USE_MOCK } from "./client"
import type { FollowListDto, MvpVoteListDto } from "../types/engagement.dto"
import {
  getMockFollows,
  mockFollow,
  mockUnfollow,
} from "../mocks/engagement.mock"
import { getMockMvpVotes, mockCastMvpVote } from "../mocks/mvp.mock"

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