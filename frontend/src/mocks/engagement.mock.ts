import type { FollowListDto } from "../types/engagement.dto"

function key(userId: number) {
  return `ltms-follows-${userId}`
}

export function getMockFollows(userId: number): FollowListDto {
  const saved = localStorage.getItem(key(userId))

  if (!saved) return { targets: [] }

  try {
    return { targets: JSON.parse(saved) as string[] }
  } catch {
    return { targets: [] }
  }
}

export function mockFollow(userId: number, target: string): FollowListDto {
  const current = getMockFollows(userId)

  if (!current.targets.includes(target)) {
    current.targets.push(target)
  }

  localStorage.setItem(key(userId), JSON.stringify(current.targets))
  return current
}

export function mockUnfollow(userId: number, target: string): FollowListDto {
  const current = getMockFollows(userId)
  const targets = current.targets.filter(item => item !== target)

  localStorage.setItem(key(userId), JSON.stringify(targets))
  return { targets }
}