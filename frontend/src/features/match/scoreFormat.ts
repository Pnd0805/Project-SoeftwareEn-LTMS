import type { MatchDto } from '../../types/match.dto'

type Format = Pick<MatchDto, 'bestOf' | 'possibleScores'>
export function validMatchScore(m: Format, a: number, b: number): boolean {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 0 || b < 0 || a > 999 || b > 999 || a === b) return false
  return m.bestOf == null || !!m.possibleScores?.some(([win, loss]) => Math.max(a, b) === win && Math.min(a, b) === loss)
}
export function scoreFormatFromError(match: Format, error?: unknown): Format {
  const e = error as { code?: string; extra?: { bestOf?: unknown; possibleScores?: unknown } } | null
  if (!e || !['SCORE_NOT_IN_MATCH_FORMAT', 'PICK_SCORE_NOT_IN_MATCH_FORMAT'].includes(e.code ?? '')) return match
  const { bestOf, possibleScores } = e.extra ?? {}
  if (![1, 3, 5, 7].includes(bestOf as number) || !Array.isArray(possibleScores)) return match
  const pairs = possibleScores.filter((row): row is [number, number] => Array.isArray(row) && row.length === 2 && row.every(n => Number.isSafeInteger(n) && n >= 0))
  return { bestOf: bestOf as number, possibleScores: pairs }
}
