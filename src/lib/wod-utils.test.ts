import { describe, it, expect } from 'vitest'
import { parseTime, parseAmrap, parseNumber, sortRanking, detectPRExercise, getScoreDisplay } from './wod-utils'
import type { RankingEntry } from './db'
import type { Wod, Result } from './types'

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

describe('sortRanking — For Max', () => {
  it('ordena de mayor a menor número', () => {
    const entries = [
      entry({ user_id: 'u1', score_rounds: '45' }),
      entry({ user_id: 'u2', score_rounds: '60' }),
      entry({ user_id: 'u3', score_rounds: '30' }),
    ]
    const sorted = sortRanking(entries, 'For Max')
    expect(sorted.map(e => e.user_id)).toEqual(['u2', 'u1', 'u3'])
  })
})

describe('sortRanking — EMOM', () => {
  it('ordena por peso primero, luego por rondas', () => {
    const entries = [
      entry({ user_id: 'u1', score_weight: 80,  score_rounds: '5' }),
      entry({ user_id: 'u2', score_weight: 100, score_rounds: '3' }),
      entry({ user_id: 'u3', score_weight: 80,  score_rounds: '8' }),
    ]
    const sorted = sortRanking(entries, 'EMOM')
    expect(sorted.map(e => e.user_id)).toEqual(['u2', 'u3', 'u1'])
  })
})

// ---------------------------------------------------------------------------
// detectPRExercise
// ---------------------------------------------------------------------------

describe('detectPRExercise — ejercicios simples', () => {
  it('detecta Back Squat', () => {
    expect(detectPRExercise('Back Squat')).toBe('Back Squat')
    expect(detectPRExercise('BACK SQUAT')).toBe('Back Squat')
  })

  it('detecta Deadlift', () => {
    expect(detectPRExercise('Deadlift')).toBe('Deadlift')
  })

  it('detecta Bench Press', () => {
    expect(detectPRExercise('Bench Press')).toBe('Bench Press')
  })

  it('detecta Strict Press', () => {
    expect(detectPRExercise('Strict Press')).toBe('Strict Press')
  })

  it('detecta Cluster', () => {
    expect(detectPRExercise('Cluster')).toBe('Cluster')
  })

  it('detecta Pull Ups', () => {
    expect(detectPRExercise('Pull Ups')).toBe('Pull Ups')
  })

  it('detecta Overhead Squat solo', () => {
    expect(detectPRExercise('Overhead Squat')).toBe('Overhead Squat')
  })
})

describe('detectPRExercise — familia del Clean', () => {
  it('Power Clean → Clean', () => {
    expect(detectPRExercise('Power Clean')).toBe('Power Clean')
  })

  it('Hang Power Clean → Hang Power Clean', () => {
    expect(detectPRExercise('Hang Power Clean')).toBe('Hang Power Clean')
  })

  it('Squat Clean es alias de Clean', () => {
    // Squat Clean no está en whitelist, Muscle Clean tampoco → null
    expect(detectPRExercise('Squat Clean')).toBeNull()
  })

  it('Muscle Clean no está en whitelist → null', () => {
    expect(detectPRExercise('Muscle Clean')).toBeNull()
  })
})

describe('detectPRExercise — familia del Snatch', () => {
  it('Snatch simple', () => {
    expect(detectPRExercise('Snatch')).toBe('Snatch')
  })

  it('Power Snatch', () => {
    expect(detectPRExercise('Power Snatch')).toBe('Power Snatch')
  })

  it('Hang Power Snatch', () => {
    expect(detectPRExercise('Hang Power Snatch')).toBe('Hang Power Snatch')
  })

  it('Muscle Snatch no está en whitelist → null', () => {
    expect(detectPRExercise('Muscle Snatch')).toBeNull()
  })
})

describe('detectPRExercise — Clean & Jerk', () => {
  it('Clean & Jerk directo', () => {
    expect(detectPRExercise('Clean & Jerk')).toBe('Clean & Jerk')
  })

  it('Clean and Jerk normaliza a Clean & Jerk', () => {
    expect(detectPRExercise('Clean and Jerk')).toBe('Clean & Jerk')
  })
})

describe('detectPRExercise — complex signals cancelan el PR', () => {
  it('Power Clean + Push Jerk → null (es un clean & jerk implícito, no hay slot)', () => {
    expect(detectPRExercise('Power Clean + Push Jerk')).toBeNull()
  })

  it('Clean + Jerk → null', () => {
    expect(detectPRExercise('Clean + Jerk')).toBeNull()
  })

  it('Snatch + Split Jerk → null', () => {
    expect(detectPRExercise('Snatch + Split Jerk')).toBeNull()
  })
})

describe('detectPRExercise — companion exercises', () => {
  it('Cluster + Front Squat → Cluster (Front Squat es companion)', () => {
    expect(detectPRExercise('Front Squat + Cluster')).toBe('Cluster')
  })

  it('Power Clean + Front Squat → null (dos whitelist sin companion único)', () => {
    // Ambos están en whitelist y ninguno es companion del otro como principal
    // Power Clean no es companion → mains = [Power Clean, Front Squat] → length > 1 → null
    // Front Squat es companion → mains = [Power Clean] → Power Clean
    expect(detectPRExercise('Power Clean + Front Squat')).toBe('Power Clean')
  })

  it('Back Squat + Push Press → Back Squat (Push Press es companion)', () => {
    expect(detectPRExercise('Back Squat + Push Press')).toBe('Back Squat')
  })

  it('Cluster + Strict Press → Cluster (Strict Press es companion)', () => {
    expect(detectPRExercise('Cluster + Strict Press')).toBe('Cluster')
  })
})

describe('detectPRExercise — títulos generados por IA (casos reales)', () => {
  it('título con drills técnicos antes del principal', () => {
    // Muscle Clean no whitelist, Front Squat companion, Cluster main
    expect(detectPRExercise('Muscle Clean Front Squat Cluster')).toBe('Cluster')
  })

  it('título en mayúsculas como los genera el coach', () => {
    expect(detectPRExercise('BACK SQUAT')).toBe('Back Squat')
    expect(detectPRExercise('POWER CLEAN')).toBe('Power Clean')
  })
})

describe('detectPRExercise — devuelve null correctamente', () => {
  it('string vacío → null', () => {
    expect(detectPRExercise('')).toBeNull()
  })

  it('ejercicio no reconocido → null', () => {
    expect(detectPRExercise('Fran')).toBeNull()
    expect(detectPRExercise('Cindy')).toBeNull()
  })

  it('AMRAP o for time → null', () => {
    expect(detectPRExercise('21-15-9 Thrusters Pull-ups')).toBeNull()
  })

  it('dos ejercicios principales sin companions → null', () => {
    expect(detectPRExercise('Back Squat Deadlift')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getScoreDisplay
// ---------------------------------------------------------------------------

function mockWod(type: Wod['type']): Wod {
  return { id: '1', date: '2026-01-01', title: 'Test', description: '', type, block: 1, program: 'bizarro', owner_id: null, created_at: '' }
}

function mockResult(overrides: Partial<Result>): Result {
  return { id: 'r1', wod_id: '1', user_id: 'u1', score_time: null, score_rounds: null, score_weight: null, score_notes: null, rx: false, created_at: '', ...overrides }
}

describe('getScoreDisplay', () => {
  it('For Time muestra score_time', () => {
    expect(getScoreDisplay(mockWod('For Time'), mockResult({ score_time: '12:34' }))).toBe('12:34')
  })

  it('AMRAP muestra score_rounds', () => {
    expect(getScoreDisplay(mockWod('AMRAP'), mockResult({ score_rounds: '7+5' }))).toBe('7+5')
  })

  it('EMOM muestra score_rounds', () => {
    expect(getScoreDisplay(mockWod('EMOM'), mockResult({ score_rounds: '4' }))).toBe('4')
  })

  it('For Max muestra score_rounds', () => {
    expect(getScoreDisplay(mockWod('For Max'), mockResult({ score_rounds: '45' }))).toBe('45')
  })

  it('Strength muestra peso con kg', () => {
    expect(getScoreDisplay(mockWod('Strength'), mockResult({ score_weight: 102.5 }))).toBe('102.5 kg')
  })

  it('fallback a score_notes si no hay score específico', () => {
    expect(getScoreDisplay(mockWod('Other'), mockResult({ score_notes: 'buena sesión' }))).toBe('buena sesión')
  })

  it('fallback a — si no hay nada', () => {
    expect(getScoreDisplay(mockWod('Gymnastics'), mockResult({}))).toBe('—')
  })
})
