import { describe, it, expect } from 'vitest'
import { parseTime, parseAmrap, parseNumber, sortRanking } from './wod-utils'
import type { RankingEntry } from './db'

// ---------------------------------------------------------------------------
// parseTime
// ---------------------------------------------------------------------------
describe('parseTime', () => {
  it('parsea formato MM:SS', () => {
    expect(parseTime('5:30')).toBe(330)
    expect(parseTime('10:00')).toBe(600)
    expect(parseTime('0:45')).toBe(45)
  })

  it('devuelve Infinity para strings vacíos o inválidos', () => {
    expect(parseTime('')).toBe(Infinity)
    expect(parseTime('abc')).toBe(Infinity)
  })
})

// ---------------------------------------------------------------------------
// parseAmrap
// ---------------------------------------------------------------------------
describe('parseAmrap', () => {
  it('parsea formato rounds+reps (ej: 5+12)', () => {
    expect(parseAmrap('5+12')).toBe(50012)
    expect(parseAmrap('3+0')).toBe(30000)
  })

  it('parsea rondas enteras sin reps', () => {
    expect(parseAmrap('7')).toBe(70000)
    expect(parseAmrap('10')).toBe(100000)
  })

  it('devuelve 0 para strings inválidos', () => {
    expect(parseAmrap('')).toBe(0)
    expect(parseAmrap('abc')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// parseNumber
// ---------------------------------------------------------------------------
describe('parseNumber', () => {
  it('extrae el primer número del string', () => {
    expect(parseNumber('100 kg')).toBe(100)
    expect(parseNumber('85.5')).toBe(85.5)
    expect(parseNumber('42 reps')).toBe(42)
  })

  it('devuelve 0 si no hay número', () => {
    expect(parseNumber('')).toBe(0)
    expect(parseNumber('sin score')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// sortRanking
// ---------------------------------------------------------------------------
function entry(overrides: Partial<RankingEntry>): RankingEntry {
  return {
    user_id: 'u1',
    full_name: 'Atleta',
    avatar_url: null,
    score_time: null,
    score_rounds: null,
    score_weight: null,
    score_notes: null,
    rx: false,
    ...overrides,
  }
}

describe('sortRanking — For Time', () => {
  it('ordena de menor a mayor tiempo', () => {
    const entries = [
      entry({ user_id: 'u1', score_time: '10:30' }),
      entry({ user_id: 'u2', score_time: '8:15' }),
      entry({ user_id: 'u3', score_time: '12:00' }),
    ]
    const sorted = sortRanking(entries, 'For Time')
    expect(sorted.map(e => e.user_id)).toEqual(['u2', 'u1', 'u3'])
  })
})

describe('sortRanking — AMRAP', () => {
  it('ordena de más a menos rondas+reps', () => {
    const entries = [
      entry({ user_id: 'u1', score_rounds: '5+0' }),
      entry({ user_id: 'u2', score_rounds: '7+3' }),
      entry({ user_id: 'u3', score_rounds: '6+15' }),
    ]
    const sorted = sortRanking(entries, 'AMRAP')
    expect(sorted.map(e => e.user_id)).toEqual(['u2', 'u3', 'u1'])
  })
})

describe('sortRanking — Strength', () => {
  it('ordena de mayor a menor peso', () => {
    const entries = [
      entry({ user_id: 'u1', score_weight: 80 }),
      entry({ user_id: 'u2', score_weight: 100 }),
      entry({ user_id: 'u3', score_weight: 90 }),
    ]
    const sorted = sortRanking(entries, 'Strength')
    expect(sorted.map(e => e.user_id)).toEqual(['u2', 'u3', 'u1'])
  })
})
