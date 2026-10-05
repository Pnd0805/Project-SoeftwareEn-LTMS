import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissCommentReport, voteMvp, getComments, getMvp, getPredictionSummary, getReviews, placePrediction, postComment, removeCommentByOrganizer, restoreFeedbackByAdmin, submitReview } from './liveEngagement'

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())

describe('BE_KN C6/C7 request contract', () => {
  it('uses tournament-scoped reviews/comments and match-scoped predictions', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))
    await getReviews(23)
    await submitReview(23, 4, 'Well run')
    await getMvp(13)
    await voteMvp(13, 9002)
    await dismissCommentReport(23, 41)
    await getComments(23, 2, true)
    await postComment(23, 'Good match')
    await removeCommentByOrganizer(23, 41, 'Off topic')
    await getPredictionSummary(13)
    await placePrediction(13, { '9024': 3, '9023': 1 })
    await restoreFeedbackByAdmin(41)
    const calls = fetchMock.mock.calls.map(([path, options]) => [String(path), options?.method, options?.body])
    expect(calls).toContainEqual(['/api/v1/tournaments/23/feedback', 'POST', JSON.stringify({ rating: 4, content: 'Well run' })])
    expect(calls).toContainEqual(['/api/v1/tournaments/23/comments?page=2&pageSize=20&reported=true', undefined, undefined])
    expect(calls).toContainEqual(['/api/v1/tournaments/23/comments', 'POST', JSON.stringify({ content: 'Good match' })])
    expect(calls).toContainEqual(['/api/v1/tournaments/23/comments/41', 'DELETE', JSON.stringify({ reason: 'Off topic' })])
    expect(calls).toContainEqual(['/api/v1/matches/13/predictions/summary', undefined, undefined])
    expect(calls).toContainEqual(['/api/v1/matches/13/predictions', 'POST', JSON.stringify({ scoreData: { '9024': 3, '9023': 1 } })])
    expect(calls).toContainEqual(['/api/v1/admin/feedback/41/restore', 'POST', undefined])
    expect(calls).toContainEqual(['/api/v1/matches/13/mvp-votes', undefined, undefined])
    expect(calls).toContainEqual(['/api/v1/matches/13/mvp-votes', 'POST', JSON.stringify({ userId: 9002 })])
    expect(calls).toContainEqual(['/api/v1/tournaments/23/comments/41/dismiss-report', 'POST', undefined])
    expect(calls.some(([path]) => String(path).includes('/matches/13/comments'))).toBe(false)
  })

  it('surfaces backend permission and validation failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'PICKEM_CONFLICT', message: 'Tournament participant cannot predict' } }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'Reason required', fields: { reason: 'Required' } } }), { status: 400 }))
    await expect(placePrediction(13, { '9024': 3, '9023': 1 })).rejects.toMatchObject({ status: 403, code: 'PICKEM_CONFLICT' })
    await expect(removeCommentByOrganizer(23, 41, '')).rejects.toMatchObject({ status: 400, fields: { reason: 'Required' } })
  })
})
