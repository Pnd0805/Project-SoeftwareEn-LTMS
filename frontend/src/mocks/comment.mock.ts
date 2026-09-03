import type { CommentDto, CommentListDto } from "../types/engagement.dto"

function key(matchId: string) {
  return `ltms-comments-${matchId}`
}

function read(matchId: string): CommentDto[] {
  const saved = localStorage.getItem(key(matchId))
  if (!saved) return []

  try {
    return JSON.parse(saved) as CommentDto[]
  } catch {
    return []
  }
}

export function getMockComments(matchId: string): CommentListDto {
  return { items: read(matchId) }
}

export function mockPostComment(
  matchId: string,
  userId: string,
  userName: string,
  text: string,
): CommentListDto {
  const items = read(matchId)
  items.push({
    id: `${matchId}-${Date.now()}`,
    matchId,
    userId,
    userName,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  })
  localStorage.setItem(key(matchId), JSON.stringify(items))
  return { items }
}

export function mockRemoveComment(matchId: string, commentId: string): CommentListDto {
  const items = read(matchId).filter(comment => comment.id !== commentId)
  localStorage.setItem(key(matchId), JSON.stringify(items))
  return { items }
}