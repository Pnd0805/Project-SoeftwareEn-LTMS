import type { BackendBracketDto, MatchListItemDto } from '../../types/match.dto'

export interface BracketColumn {
  key: string
  label: string
  matches: MatchListItemDto[]
}

export function roundColumns(matches: MatchListItemDto[], roundRobin = false): BracketColumn[] {
  const rounds = [...new Set(matches.map(match => match.roundNumber ?? null))]
    .sort((a, b) => (a ?? Infinity) - (b ?? Infinity))
  return rounds.map(round => {
    const inRound = matches.filter(match => (match.roundNumber ?? null) === round)
    const stage = inRound[0]?.stage
    return {
      key: String(round),
      label: round === null || round < 1 ? 'Round not assigned'
        : roundRobin ? `Matchday ${round}`
          : stage && !/^Round \d+$/i.test(stage) ? stage
            : `Round ${round}`,
      matches: inRound,
    }
  })
}

/** ใช้ matchId ของผังมา join โดยไม่ใช้ทีมใน bracket_nodes ซึ่งอาจยังไม่เลื่อนตามผล */
export function doubleBracketColumns(matches: MatchListItemDto[], bracket: BackendBracketDto) {
  const byId = new Map(matches.map(match => [match.id, match]))
  const assigned = new Set<number>()
  const lane = (type: 'winners' | 'losers' | 'grand_final'): BracketColumn[] => {
    const laneNodes = bracket.nodes.filter(node => node.bracketType === type)
    const nodes = laneNodes.filter(node => node.matchId !== null && byId.has(node.matchId))
    const rounds = [...new Set(laneNodes.map(node => node.round))].sort((a, b) => (a ?? Infinity) - (b ?? Infinity))
    return rounds.map((round, index) => ({
      key: `${type}-${round}`,
      label: type === 'grand_final' ? 'Grand final'
        : index === rounds.length - 1 ? type === 'winners' ? 'Upper final' : 'Lower final'
          : type === 'winners' && rounds.length - index === 2 ? 'Upper semi-finals'
            : type === 'winners' && rounds.length - index === 3 ? 'Upper quarter-finals'
          : `${type === 'winners' ? 'Upper' : 'Lower'} round ${round ?? index + 1}`,
      matches: nodes.filter(node => node.round === round).sort((a, b) => a.matchNumber - b.matchNumber)
        .map(node => { assigned.add(node.matchId!); return byId.get(node.matchId!)! }),
    })).filter(column => column.matches.length > 0)
  }
  const upper = [...lane('winners'), ...lane('grand_final')]
  const lower = lane('losers')
  return { upper, lower, other: roundColumns(matches.filter(match => !assigned.has(match.id))) }
}
