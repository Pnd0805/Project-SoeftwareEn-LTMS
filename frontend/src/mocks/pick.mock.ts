import type { PickDto, PickListDto } from "../types/engagement.dto"
import { getState } from "../shared/store"

/**
 * FR-PK-01 — ทายผลต้องปิดก่อนแมตช์เริ่ม
 *
 * SDS §4.2.1 ขั้นที่ 12 ให้ PickemService.settle() ทำงานตอนผลถูกยืนยัน
 * ถ้ายังทายได้หลังรู้ผลแล้ว ทุกคนก็ทายถูกหมด เกมทั้งเกมไม่มีความหมาย
 */
function pickWindow(matchId: string): string | null {
  const s = getState()
  const m = s.matches.find(x => x.id === matchId)
  if (!m) return null
  if (m.status !== "scheduled") return "PICK_CLOSED_MATCH_STARTED"
  if (m.checkedIn.length) return "PICK_CLOSED_CHECKIN_OPEN"
  return null
}

/** ทายได้เฉพาะสองทีมที่ลงแมตช์นั้น */
function inMatch(matchId: string, teamId: string): boolean {
  const m = getState().matches.find(x => x.id === matchId)
  return !!m && (m.a === teamId || m.b === teamId)
}

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
  const closed = pickWindow(matchId)
  if (closed) throw new Error(closed)
  if (!inMatch(matchId, teamId)) throw new Error("PICK_TEAM_NOT_IN_MATCH")

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