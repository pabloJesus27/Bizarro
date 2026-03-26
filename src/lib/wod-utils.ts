import type { RankingEntry } from '@/lib/db'
import type { Wod, WodType, Result } from '@/lib/types'

export const WOD_TYPES: WodType[] = ['Warmup', 'Strength', 'Gymnastics', 'Core', 'Mobility', 'For Time', 'AMRAP', 'EMOM', 'For Max', 'Other']

// ── PR auto-detection ──────────────────────────────────

// Exercises that can have an auto-updated PR (must match Máximos page list)
const PR_WHITELIST = new Set([
  'back squat', 'front squat', 'overhead squat', 'deadlift',
  'bench press', 'strict press', 'push press', 'pull ups',
  'clean', 'power clean', 'hang power clean',
  'snatch', 'power snatch', 'hang power snatch',
  'clean & jerk', 'clean and jerk', 'cluster',
])

// All detectable exercise names for PR detection (sorted by length in use)
const PR_DETECTABLE = [
  'Clean & Jerk', 'Clean and Jerk',
  'Hang Power Snatch', 'Hang Power Clean',
  'Power Snatch', 'Power Clean',
  'Hang Snatch', 'Hang Clean',
  'Muscle Snatch', 'Muscle Clean',
  'Squat Snatch', 'Squat Clean',
  'Tall Clean', 'Overhead Squat',
  'Shoulder Press', 'Split Jerk', 'Push Jerk', 'Push Press',
  'Strict Press', 'Bench Press',
  'Front Squat', 'Back Squat',
  'Deadlift', 'Pull Ups', 'Cluster',
  'Snatch', 'Clean', 'Jerk',
]

const PR_DETECTABLE_SORTED = [...PR_DETECTABLE].sort((a, b) => b.length - a.length)

// Non-whitelist exercises that signal a complex when alongside a whitelist exercise
const COMPLEX_SIGNALS = new Set(['push jerk', 'split jerk', 'jerk', 'shoulder press'])

// Whitelist exercises that commonly appear as companions in a complex
// (front squat, push press, strict press) and should be deprioritized
// when a non-companion whitelist exercise is also present
const COMPANION_EXERCISES = new Set(['front squat', 'push press', 'strict press'])

/**
 * Returns the exercise name to update as PR, or null if this WOD
 * doesn't represent a single simple exercise.
 *
 * Rules:
 * - Filter detected exercises to whitelist only (ignores drills like muscle clean)
 * - No non-whitelist complex-signal exercise (push jerk, jerk…)
 * - If multiple whitelist exercises: demote companions (front squat, push press…)
 *   and return the remaining single main exercise
 */
export function detectPRExercise(title: string): string | null {
  const found: string[] = []
  let remaining = title.toLowerCase()
  for (const ex of PR_DETECTABLE_SORTED) {
    if (remaining.includes(ex.toLowerCase())) {
      found.push(ex)
      remaining = remaining.replaceAll(ex.toLowerCase(), '')
    }
  }

  // Ignore technical drills — only keep exercises that have a PR slot in Máximos
  const whitelisted = found.filter(ex => PR_WHITELIST.has(ex.toLowerCase()))

  // Non-whitelist complex signals (push jerk, jerk…) cancel the update
  const hasComplexSignal = found.some(ex => COMPLEX_SIGNALS.has(ex.toLowerCase()))
  if (hasComplexSignal && whitelisted.length > 0) return null

  if (whitelisted.length === 0) return null

  // Single whitelist exercise — straightforward
  if (whitelisted.length === 1) {
    const exercise = whitelisted[0]
    if (exercise.toLowerCase() === 'clean and jerk') return 'Clean & Jerk'
    return exercise
  }

  // Multiple whitelist exercises: demote companions to find the main lift
  // e.g. "Front Squat + Cluster" → Cluster is the main lift
  const mains = whitelisted.filter(ex => !COMPANION_EXERCISES.has(ex.toLowerCase()))
  if (mains.length !== 1) return null

  const exercise = mains[0]
  if (exercise.toLowerCase() === 'clean and jerk') return 'Clean & Jerk'
  return exercise
}

export const WOD_TYPE_LABEL: Record<string, string> = {
  'For Time':   'FOR TIME',
  'AMRAP':      'AMRAP',
  'EMOM':       'EMOM',
  'Strength':   'STRENGTH',
  'Gymnastics': 'GYMNASTICS',
  'Core':       'CORE',
  'Mobility':   'MOBILITY',
  'Warmup':     'WARMUP',
  'For Max':    'FOR MAX',
  'Other':      'WOD',
}

export function getScoreDisplay(wod: Wod, result: Result): string {
  if (wod.type === 'For Time'                        && result.score_time)   return result.score_time
  if ((wod.type === 'AMRAP' || wod.type === 'EMOM')  && result.score_rounds) return result.score_rounds
  if (wod.type === 'For Max'                         && result.score_rounds) return result.score_rounds
  if (wod.type === 'Strength'                        && result.score_weight) return `${result.score_weight} kg`
  return result.score_notes ?? '—'
}

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
