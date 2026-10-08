type DemoMatch = { id: string | number; checkinToken: string | null }

/** Read the Match reference only. The server still verifies the signed QR and the Player. */
export function scanMatchId(qrPayload: string, demoMatches: DemoMatch[]): string | number | null {
  const token = qrPayload.trim()
  const demoMatch = demoMatches.find(match => match.checkinToken === token)
  if (demoMatch) return demoMatch.id

  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null

  try {
    const encoded = parts[1].replaceAll('-', '+').replaceAll('_', '/')
    const payload: unknown = JSON.parse(atob(encoded))
    if (typeof payload !== 'object' || payload === null) return null
    const { type, matchId } = payload as Record<string, unknown>
    return type === 'checkin_qr' && typeof matchId === 'number' && Number.isSafeInteger(matchId) && matchId > 0
      ? matchId : null
  } catch {
    return null
  }
}
