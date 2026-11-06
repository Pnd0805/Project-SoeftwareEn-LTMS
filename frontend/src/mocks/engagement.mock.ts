import type { FollowListDto } from "../types/engagement.dto"

function key(userId: number) {
  return `ltms-follows-${userId}`
}

export function getMockFollows(userId: number): FollowListDto {
  const saved = localStorage.getItem(key(userId))

  if (!saved) return { targets: [], notifications: {} }

  try {
    const parsed: unknown = JSON.parse(saved)
    const targets = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
    let preferences: unknown = {}
    try { preferences = JSON.parse(localStorage.getItem(`${key(userId)}-notifications`) ?? '{}') }
    catch { /* กระดิ่งเสียไม่ควรทำให้รายชื่อติดตามเดิมหายไปด้วย */ }
    const stored = preferences && typeof preferences === 'object' ? preferences as Record<string, unknown> : {}
    return { targets, notifications: Object.fromEntries(targets.map(target => [target, stored[target] === true])) }
  } catch {
    return { targets: [], notifications: {} }
  }
}

export function mockFollow(userId: number, target: string): FollowListDto {
  const current = getMockFollows(userId)

  if (!current.targets.includes(target)) {
    current.targets.push(target)
    current.notifications = { ...current.notifications, [target]: false }
  }

  localStorage.setItem(key(userId), JSON.stringify(current.targets))
  localStorage.setItem(`${key(userId)}-notifications`, JSON.stringify(current.notifications))
  return current
}

export function mockUnfollow(userId: number, target: string): FollowListDto {
  const current = getMockFollows(userId)
  const targets = current.targets.filter(item => item !== target)
  const notifications = Object.fromEntries(Object.entries(current.notifications ?? {}).filter(([key]) => key !== target))

  localStorage.setItem(key(userId), JSON.stringify(targets))
  localStorage.setItem(`${key(userId)}-notifications`, JSON.stringify(notifications))
  return { targets, notifications }
}

export function mockSetFollowNotifications(userId: number, target: string, notifyEnabled: boolean): FollowListDto {
  const current = getMockFollows(userId)
  current.notifications = { ...current.notifications, [target]: notifyEnabled }
  localStorage.setItem(`${key(userId)}-notifications`, JSON.stringify(current.notifications))
  return current
}
