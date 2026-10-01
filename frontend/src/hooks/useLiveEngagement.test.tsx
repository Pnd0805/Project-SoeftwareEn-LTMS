import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
const { state, getComments, dismiss } = vi.hoisted(() => ({ state: { reported: true }, getComments: vi.fn(), dismiss: vi.fn() }))
vi.mock('../api/liveEngagement', () => ({ getComments, dismissCommentReport: dismiss, reportFeedback: vi.fn() }))
import { useCommentsLive } from './useLiveEngagement'
it('refreshes all pages and filters after dismiss without deleting the comment', async () => {
  getComments.mockImplementation(async (_id: number, _page: number, reported: boolean) => ({ items: reported && !state.reported ? [] : [{ id: 42, isReported: state.reported }] }))
  dismiss.mockImplementation(async () => { state.reported = false; return { id: 42, isReported: false } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => ({ all: useCommentsLive(23), reported: useCommentsLive(23, 2, true) }), { wrapper })
  await waitFor(() => expect(result.current.reported.query.data?.items).toHaveLength(1))
  await act(async () => { await result.current.reported.dismiss.mutateAsync(42) })
  await waitFor(() => expect(result.current.reported.query.data?.items).toHaveLength(0))
  expect(result.current.all.query.data?.items).toEqual([{ id: 42, isReported: false }]); expect(dismiss).toHaveBeenCalledWith(23, 42)
})
