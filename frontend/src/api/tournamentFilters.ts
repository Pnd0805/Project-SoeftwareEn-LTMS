export interface TournamentFilters {
  status?: 'public' | 'completed' | 'cancelled'
  sportTypeId?: number
  facultyId?: number
  q?: string
  registration?: 'open' | 'closed'
  startFrom?: string
  startTo?: string
}

/** ค่าว่างกับไม่ได้ระบุต้องเป็นคำขอและ cache เดียวกัน */
export function normalizeTournamentFilters(filters: TournamentFilters = {}): TournamentFilters {
  return Object.fromEntries(Object.entries(filters).flatMap(([key, value]) => {
    const normalized = typeof value === 'string' ? value.trim() : value
    return normalized === '' || normalized === undefined ? [] : [[key, normalized]]
  }))
}
