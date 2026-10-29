import type { MvpVoteDto, MvpVoteListDto } from "../types/engagement.dto"
import { getState } from "../shared/store"

/**
 * FR-CM-03 — โหวตให้ "นักกีฬายอดเยี่ยมของรายการ" ได้เฉพาะคนที่ลงแข่งในรายการนั้น
 * ไม่งั้นคะแนน MVP กลายเป็นการโหวตความนิยมทั่วมหาวิทยาลัย ไม่ใช่ผลงานในสนาม
 */
function playsIn(tournamentId: string, playerId: string): boolean {
  const s = getState()
  const teams = s.registrations
    .filter(r => r.tour === tournamentId && r.status === "approved")
    .map(r => r.team)
  return s.teams.some(t => teams.includes(t.id) && t.members.includes(playerId))
}

function key(tournamentId: string) {
  return `ltms-mvp-votes-${tournamentId}`
}

function readVotes(tournamentId: string): MvpVoteDto[] {
  const saved = localStorage.getItem(key(tournamentId))
  if (!saved) return []

  try {
    return JSON.parse(saved) as MvpVoteDto[]
  } catch {
    return []
  }
}

function result(items: MvpVoteDto[], userId: string): MvpVoteListDto {
  return {
    items,
    mine: items.find(vote => vote.userId === userId) ?? null,
  }
}

export function getMockMvpVotes(
  tournamentId: string,
  userId: string,
): MvpVoteListDto {
  return result(readVotes(tournamentId), userId)
}

export function mockCastMvpVote(
  tournamentId: string,
  userId: string,
  playerId: string,
): MvpVoteListDto {
  const items = readVotes(tournamentId)
  if (items.some(vote => vote.userId === userId)) {
    throw new Error("MVP_VOTE_ALREADY_CAST")
  }
  if (!playsIn(tournamentId, playerId)) {
    throw new Error("MVP_PLAYER_NOT_IN_TOURNAMENT")
  }

  items.push({
    id: `${tournamentId}-${userId}`,
    tournamentId,
    userId,
    playerId,
  })
  localStorage.setItem(key(tournamentId), JSON.stringify(items))
  return result(items, userId)
}
