import type { PickDto, PickListDto } from "../types/engagement.dto"
import { commitStore, getState } from "../shared/store"

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

function read(matchId: string): PickDto[] {
  return getState().picks
    .filter(pick => pick.match === matchId)
    .map(pick => ({ id: pick.id, matchId: pick.match, userId: pick.by, teamId: pick.team }))
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

  const state = getState()
  const existing = state.picks.find(pick => pick.match === matchId && pick.by === userId)

  if (existing) {
    existing.team = teamId
  } else {
    state.picks.push({
      id: `${matchId}-${userId}`,
      match: matchId,
      by: userId,
      team: teamId,
    })
  }

  commitStore()
  return getMockPicks(matchId, userId)
}
