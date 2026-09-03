import { apiFetch, mockDelay, USE_MOCK } from "./client"
import type { FollowListDto } from "../types/engagement.dto"
import {
  getMockFollows,
  mockFollow,
  mockUnfollow,
} from "../mocks/engagement.mock"

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