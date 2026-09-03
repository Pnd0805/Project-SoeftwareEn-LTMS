import type { PickDto, PickListDto } from "../types/engagement.dto"

function key(matchId: string) {
  return `ltms-picks-${matchId}`
}

function read(matchId: string): PickDto[] {
  const saved = localStorage.getItem(key(matchId))
  if (!saved) return []

  try {
    return JSON.parse(saved) as PickDto[]
  } catch {
    return []
  }
}

function result(items: PickDto[], userId: string): PickListDto {
  return {
    items,
    mine: items.find(pick => pick.userId === userId) ?? null,
  }
}

export function getMockPicks(matchId: string, userId: string): PickListDto {
  return result(read(matchId), userId)
}

export function mockPlacePick(
  matchId: string,
  userId: string,
  teamId: string,
): PickListDto {
  const items = read(matchId)
  const existing = items.find(pick => pick.userId === userId)

  if (existing) {
    existing.teamId = teamId
  } else {
    items.push({
      id: `${matchId}-${userId}`,
      matchId,
      userId,
      teamId,
    })
  }

  localStorage.setItem(key(matchId), JSON.stringify(items))
  return result(items, userId)
}