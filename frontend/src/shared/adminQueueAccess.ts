/** Operational tournament queues use the server's Faculty/University scope policy. */
export function canReadTournamentQueues(scope: { scopeType: string; facultyId?: number | null } | null | undefined) {
  return scope?.scopeType === 'university_wide'
    || (scope?.scopeType === 'faculty' && Number.isSafeInteger(scope.facultyId) && Number(scope.facultyId) > 0)
}
