import { mkMatch, roundName, seedOrder, shortRound } from '../../shared/rules'
import type { Match, Tournament } from '../../shared/types'

export function buildSingle(tr: Tournament, ids: string[], nid: () => string): Match[] {
  const { size, slots } = seedOrder(ids), rounds = Math.log2(size), made: Match[] = []
  for (let r = 0; r < rounds; r++)
    for (let i = 0; i < (size >> (r + 1)); i++)
      made.push(mkMatch(tr, { round: r, slot: i, bracket: 'W', depth: r, stage: roundName(r, rounds), tag: shortRound(r, rounds) + (i + 1), a: r === 0 ? slots[i] : null, b: r === 0 ? slots[size - 1 - i] : null }, nid()))
  const at = (r: number, i: number) => made.find(m => m.round === r && m.slot === i)
  made.forEach(m => { const nx = at(m.round + 1, m.slot >> 1); if (nx) m.winTo = { m: nx.id, side: m.slot % 2 === 0 ? 'a' : 'b' } })
  tr.rounds = rounds
  return made
}

export function buildDouble(tr: Tournament, ids: string[], nid: () => string): Match[] {
  const { size, slots } = seedOrder(ids), k = Math.log2(size)
  if (k < 2) return buildSingle(tr, ids, nid)
  const made: Match[] = [], winners: Match[][] = [], losers: Match[][] = []
  for (let r = 0; r < k; r++) {
    winners[r] = []
    for (let i = 0; i < (size >> (r + 1)); i++) {
      const match = mkMatch(tr, { round: r, slot: i, bracket: 'W', depth: r, stage: 'Winners ' + roundName(r, k).toLowerCase(), tag: 'W' + shortRound(r, k) + (i + 1), a: r === 0 ? slots[i] : null, b: r === 0 ? slots[size - 1 - i] : null }, nid())
      winners[r].push(match); made.push(match)
    }
  }
  const loserRounds = 2 * (k - 1)
  for (let r = 0; r < loserRounds; r++) {
    losers[r] = []
    for (let i = 0, count = size >> (Math.floor(r / 2) + 2); i < count; i++) {
      const match = mkMatch(tr, { round: k + r, slot: i, bracket: 'L', depth: r, stage: 'Losers round ' + (r + 1), tag: 'L' + (r + 1) + '.' + (i + 1) }, nid())
      losers[r].push(match); made.push(match)
    }
  }
  const final = mkMatch(tr, { round: k + loserRounds, slot: 0, bracket: 'GF', depth: loserRounds, stage: 'Grand final', tag: 'GF' }, nid())
  made.push(final)
  winners.forEach((row, r) => row.forEach((match, i) => {
    const next = winners[r + 1]?.[i >> 1]
    match.winTo = next ? { m: next.id, side: i % 2 === 0 ? 'a' : 'b' } : { m: final.id, side: 'a' }
    const target = r === 0 ? losers[0]?.[i >> 1] : losers[2 * r - 1]?.[losers[2 * r - 1].length - 1 - i]
    if (target) match.loseTo = { m: target.id, side: r === 0 && i % 2 === 0 ? 'a' : 'b' }
  }))
  losers.forEach((row, r) => row.forEach((match, i) => {
    const next = losers[r + 1]
    match.winTo = !next ? { m: final.id, side: 'b' } : r % 2 === 0 ? { m: next[i].id, side: 'a' } : { m: next[i >> 1].id, side: i % 2 === 0 ? 'a' : 'b' }
  }))
  tr.rounds = k
  return made
}

export function buildRoundRobin(tr: Tournament, ids: string[], nid: () => string): Match[] {
  const list: (string | null)[] = ids.slice()
  if (list.length % 2) list.push(null)
  const n = Math.max(2, list.length), days = n - 1, half = n / 2, made: Match[] = [], rotation = list.slice(1)
  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const day = [list[0], ...rotation]
    for (let i = 0; i < half; i++) made.push(mkMatch(tr, { round: dayIndex, slot: i, bracket: 'RR', depth: dayIndex, stage: 'Matchday ' + (dayIndex + 1), tag: 'MD' + (dayIndex + 1) + '.' + (i + 1), a: day[i], b: day[n - 1 - i] }, nid()))
    rotation.unshift(rotation.pop() as string | null)
  }
  tr.rounds = days
  return made
}

export function buildBracket(tr: Tournament, ids: string[], nid: () => string): Match[] {
  return tr.format === 'roundrobin' ? buildRoundRobin(tr, ids, nid) : tr.format === 'double' ? buildDouble(tr, ids, nid) : buildSingle(tr, ids, nid)
}
