import type { HomeTask } from '../home/homeTasks'
import type { MatchListItemDto } from '../../types/match.dto'

export function matchHomeTasks(matches: readonly MatchListItemDto[]): HomeTask[] {
  const tasks: HomeTask[] = []

  for (const match of matches) {
    const can = match.viewer?.can
    if (!can) continue

    const context = `${match.tournament.name} · Match ${match.id}`
    const task = (action: string, label: string, href: string): HomeTask => ({
      key: `match:${match.id}:${action}`,
      source: 'match',
      label,
      context,
      urgency: 'ready',
      href,
    })

    if (can.openCheckin || can.manageCheckin) {
      tasks.push(task('open-checkin', 'Open check-in', `/checkin/${match.id}`))
    }
    if (can.submitResult) tasks.push(task('record-result', 'Record result', `/m/${match.id}`))
    if (can.verifyResult || can.resolveDispute) {
      tasks.push(task('review-result', can.resolveDispute ? 'Resolve dispute' : 'Review result', `/m/${match.id}`))
    }
    if (can.verifyCheckin) tasks.push(task('review-checkin', 'Review check-in', `/checkin/${match.id}`))
    if (can.finishMatch) tasks.push(task('finish-match', 'Finish match', `/m/${match.id}`))
  }

  return tasks
}
