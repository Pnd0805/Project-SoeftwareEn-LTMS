import { describe, expect, it } from 'vitest'
import { scanMatchId } from './scanMatchId'

function signedStyleQr(payload: unknown) {
  return `header.${btoa(JSON.stringify(payload)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}.signature`
}

describe('scanMatchId', () => {
  it('reads the Match id from a signed-style Check-in QR without changing its token', () => {
    const token = signedStyleQr({ type: 'checkin_qr', matchId: 42, exp: 2_000_000_000 })
    expect(scanMatchId(token, [])).toBe(42)
  })

  it('rejects unrelated, malformed, and unsafe Match ids', () => {
    expect(scanMatchId(signedStyleQr({ type: 'other', matchId: 42 }), [])).toBeNull()
    expect(scanMatchId(signedStyleQr({ type: 'checkin_qr', matchId: '42' }), [])).toBeNull()
    expect(scanMatchId(signedStyleQr({ type: 'checkin_qr', matchId: -1 }), [])).toBeNull()
    expect(scanMatchId('unrelated QR', [])).toBeNull()
  })

  it('finds a local demo QR in the signed-in Player matches', () => {
    expect(scanMatchId('K7M-2Q9', [{ id: 'm-124', checkinToken: 'K7M-2Q9' }])).toBe('m-124')
  })
})
