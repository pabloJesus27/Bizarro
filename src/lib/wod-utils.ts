import type { RankingEntry } from '@/lib/db'
import type { WodType } from '@/lib/types'

export function parseTime(t: string): number {
  const m = t.match(/(\d+):(\d+)/)
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : Infinity
}

export function parseAmrap(s: string): number {
  const m = s.match(/(\d+)\+(\d+)/)
  if (m) return parseInt(m[1]) * 10000 + parseInt(m[2])
  const n = parseInt(s)
  return isNaN(n) ? 0 : n * 10000
}

export function parseNumber(s: string): number {
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : 0
}

export function sortRanking(entries: RankingEntry[], type: WodType): RankingEntry[] {
  return [...entries].sort((a, b) => {
    switch (type) {
      case 'For Time':
        return parseTime(a.score_time ?? '') - parseTime(b.score_time ?? '')
      case 'AMRAP':
        return parseAmrap(b.score_rounds ?? '0') - parseAmrap(a.score_rounds ?? '0')
      case 'For Max':
        return parseNumber(b.score_rounds ?? '0') - parseNumber(a.score_rounds ?? '0')
      case 'Strength':
        return (b.score_weight ?? 0) - (a.score_weight ?? 0)
      case 'EMOM': {
        const wDiff = (b.score_weight ?? 0) - (a.score_weight ?? 0)
        if (wDiff !== 0) return wDiff
        return parseNumber(b.score_rounds ?? '0') - parseNumber(a.score_rounds ?? '0')
      }
      default: return 0
    }
  })
}
