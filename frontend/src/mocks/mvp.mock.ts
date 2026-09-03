import type { MvpVoteDto, MvpVoteListDto } from "../types/engagement.dto"

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

  items.push({
    id: `${tournamentId}-${userId}`,
    tournamentId,
    userId,
    playerId,
  })
  localStorage.setItem(key(tournamentId), JSON.stringify(items))
  return result(items, userId)
}
