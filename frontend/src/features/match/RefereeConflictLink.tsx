import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'

/** Only the owner receives this private schedule detail from the acceptance API. */
export function RefereeConflictLink({ error }: { error: unknown }) {
  if (!(error instanceof ApiError) || error.code !== 'REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT') return null
  const conflict = error.extra.conflictsWith as { matchId?: unknown } | undefined
  const id = conflict?.matchId
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null
  return <p><Link className="btn" to={`/m/${id}`}>Open match #{id} to request withdrawal</Link></p>
}
