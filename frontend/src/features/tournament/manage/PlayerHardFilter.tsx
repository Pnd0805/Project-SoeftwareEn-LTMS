import { Badge } from '../../../components/kit/primitives'

const reasons: Record<string, string> = { gender: 'Gender', age: 'Age', year: 'Year', faculty: 'Faculty' }

/** ผลรายคนมาจาก snapshot ของใบสมัคร ไม่อนุมานจากผลรวมของทีม */
function playerHardFilter(details: unknown, userId?: number): { passed: boolean; reason?: string } | undefined {
  if (!Array.isArray(details) || userId === undefined) return undefined
  for (const item of details as unknown[]) {
    if (item !== null && typeof item === 'object' && 'userId' in item && item.userId === userId
      && 'passed' in item && typeof item.passed === 'boolean') {
      return { passed: item.passed, reason: 'reason' in item && typeof item.reason === 'string' ? item.reason : undefined }
    }
  }
}

export function PlayerHardFilter({ result: mockResult, details, userId }: { result?: { passed: boolean; reason?: string }; details?: unknown; userId?: number }) {
  const result = mockResult ?? playerHardFilter(details, userId)
  return <span className="vstack" style={{ gap: 4, alignItems: 'flex-start' }}>
    <Badge kind={result ? result.passed ? 'ok' : 'crit' : 'neutral'}>
      {result ? result.passed ? 'Passed' : 'Failed' : 'Not reported'}
    </Badge>
    {result && !result.passed ? <span className="sub">{result.reason ? `Failed: ${reasons[result.reason] ?? result.reason}` : 'Failure reason not provided.'}</span> : null}
  </span>
}
