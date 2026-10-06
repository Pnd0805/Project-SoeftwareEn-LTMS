import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { MatchDto } from '../../types/match.dto'
vi.mock('../../api/upload', () => ({
  uploadImage: vi.fn().mockResolvedValue('evidence-key'), UPLOAD_IMAGE_ACCEPT: 'image/png,image/jpeg',
  imageUploadErrorMessage: () => 'Upload failed',
}))
import { ResultChallengeForm } from './MatchWorkflowPanel'
const match = { id: 9, teamA: { id: 101, name: 'A' }, teamB: { id: 102, name: 'B' } } as MatchDto
afterEach(() => vi.unstubAllGlobals())
it('previews uploaded evidence and submits only the existing evidence key', async () => {
  const submit = vi.fn().mockResolvedValue({})
  let nextUrl = 0
  const create = vi.fn().mockImplementation(() => `blob:evidence-${++nextUrl}`)
  const revoke = vi.fn()
  vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke })
  const view = render(<StrictMode><ResultChallengeForm m={match} title="Dispute" pending={false} error={null} submit={submit} /></StrictMode>)
  const file = new File(['image'], 'score-sheet.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Dispute evidence'), { target: { files: [file] } })
  await waitFor(() => expect(screen.getByRole('img', { name: 'score-sheet.png' })).toBeInTheDocument())
  expect(screen.getByText('1 of 5 files')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Dispute reason'), { target: { value: 'Wrong score' } })
  fireEvent.click(screen.getByRole('button', { name: 'Dispute' }))
  await waitFor(() => expect(submit).toHaveBeenCalledWith({ reason: 'Wrong score', evidenceKeys: ['evidence-key'] }))
  view.unmount()
  expect(new Set(revoke.mock.calls.map(([url]) => url))).toEqual(new Set(create.mock.results.map(({ value }) => value)))
})
