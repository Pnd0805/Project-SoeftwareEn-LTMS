import type { CommentDto, CommentListDto } from "../types/engagement.dto"
import { commitStore, getState } from "../shared/store"

function read(matchId: string): CommentDto[] {
  const state = getState()
  return state.comments
    .filter(comment => comment.match === matchId)
    .map(comment => ({
      id: comment.id,
      matchId: comment.match,
      userId: comment.by,
      userName: state.users.find(user => user.id === comment.by)?.name ?? "Unknown user",
      text: comment.text,
      createdAt: new Date(comment.at).toISOString(),
    }))
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
  const state = getState()
  state.comments.push({
    id: `${matchId}-${Date.now()}`,
    match: matchId,
    by: userId,
    text: text.trim(),
    at: Date.now(),
  })
  // Keep the argument in the mock API contract while deriving the display name
  // from the shared entity source used by the rest of the mock application.
  void userName
  commitStore()
  return getMockComments(matchId)
}

export function mockRemoveComment(matchId: string, commentId: string): CommentListDto {
  const state = getState()
  state.comments = state.comments.filter(comment => comment.id !== commentId)
  commitStore()
  return getMockComments(matchId)
}
