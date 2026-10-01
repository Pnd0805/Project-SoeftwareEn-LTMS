import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/client', async original => ({
  ...(await original<typeof import('../../api/client')>()), USE_MOCK: false,
}))
vi.mock('../../api/match', () => ({ getCheckinQr: vi.fn() }))
// Inspect the encoder's input; never substitute a hash or alter signed token case.
vi.mock('qrcode.react', () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr" data-payload={value} /> }))
import { getCheckinQr } from '../../api/match'
import { CheckinQrPanel } from './CheckinQrPanel'

const getQr = vi.mocked(getCheckinQr)
let client: QueryClient
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}>
    <CheckinQrPanel matchId={12} mockToken={null} done={0} total={4} />
  </QueryClientProvider>)
}
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T10:00:00Z')); getQr.mockReset() })
afterEach(() => { client?.clear(); vi.useRealTimers() })

describe('check-in QR lifecycle', () => {
  it('encodes the exact server payload and renews 30 seconds before server expiry', async () => {
    getQr.mockResolvedValueOnce({ qrPayload: 'Signed.CaseSensitive.Token', expiresAt: '2026-10-02T10:20:00Z' })
      .mockResolvedValue({ qrPayload: 'Next.Token', expiresAt: '2026-10-02T10:39:30Z' })
    mount()
    await advance(10)
    expect(screen.getByTestId('qr')).toHaveAttribute('data-payload', 'Signed.CaseSensitive.Token')
    await advance(1_169_980)
    expect(getQr).toHaveBeenCalledTimes(1)
    await advance(1020)
    expect(getQr).toHaveBeenCalledTimes(2)
    await advance(10)
    expect(screen.getByTestId('qr')).toHaveAttribute('data-payload', 'Next.Token')
  })

  it('hides expired codes and offers an explicit refresh', async () => {
    getQr.mockResolvedValue({ qrPayload: 'Expired', expiresAt: '2026-10-02T09:59:00Z' })
    mount()
    await advance(10)
    expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh QR' }))
    await advance(10)
    expect(getQr).toHaveBeenCalledTimes(2)
  })

  it('shows renewal failure instead of silently displaying a stale code', async () => {
    getQr.mockResolvedValueOnce({ qrPayload: 'Initial', expiresAt: '2026-10-02T10:01:00Z' })
      .mockRejectedValue({ status: 403, code: 'NOT_ORGANIZER_OR_REFEREE' })
    mount()
    await advance(30_010)
    expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
    expect(screen.getByText(/QR unavailable/)).toBeInTheDocument()
  })

  it('requests a token again after leaving and reopening the screen', async () => {
    getQr.mockResolvedValue({ qrPayload: 'Token', expiresAt: '2026-10-02T10:20:00Z' })
    const view = mount()
    await advance(10)
    view.unmount()
    mount()
    await advance(10)
    expect(getQr).toHaveBeenCalledTimes(2)
  })
})
