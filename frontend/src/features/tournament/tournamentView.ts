import type { TournamentDto, TournamentDetailDto } from '../../types/tournament.dto'
import type { Rules, Tournament } from '../../shared/types'

const sportNames: Record<number, string> = {
  1: 'Football', 2: 'Futsal', 3: 'Basketball', 4: 'Volleyball',
  5: 'Badminton', 6: 'VALORANT', 7: 'ROV', 8: 'Chess',
}

const rulesFromDto = (dto: TournamentDto): Rules => ({
  gender: dto.genderRequirement === 'male' ? 'Male' : dto.genderRequirement === 'female' ? 'Female' : 'any',
  ageMin: dto.minAge ?? 'any',
  ageMax: dto.maxAge ?? 'any',
  faculty: dto.organizingFacultyId === null ? 'any' : String(dto.organizingFacultyId),
  major: 'any',
  year: 'any',
})

export function tournamentView(dto: TournamentDto | TournamentDetailDto): Tournament {
  const format = dto.bracketFormat === 'double_elimination' ? 'double'
    : dto.bracketFormat === 'round_robin' ? 'roundrobin' : 'single'
  const status = dto.status === 'pending_approval' ? 'pending'
    : dto.status === 'private' ? 'private' : dto.status === 'public' ? 'public' : 'public'
  const referees = 'referees' in dto ? dto.referees.map(referee => String(referee.userId)) : []

  return {
    id: String(dto.id),
    name: dto.name,
    sport: sportNames[dto.sportTypeId] ?? `Sport ${dto.sportTypeId}`,
    format,
    channel: dto.sportTypeId === 6 || dto.sportTypeId === 7 ? 'online' : 'onsite',
    status,
    date: dto.eventStartDate,
    venue: dto.venue ?? '',
    pin: null,
    cap: dto.maxTeams,
    organizer: String(dto.requestedByUserId),
    referees,
    rules: rulesFromDto(dto),
    drawn: dto.status === 'completed',
    rounds: 0,
    champion: null,
  }
}
